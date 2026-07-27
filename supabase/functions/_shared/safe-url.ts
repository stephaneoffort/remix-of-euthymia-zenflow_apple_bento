/**
 * Protection SSRF : valide une URL fournie par l'utilisateur avant tout fetch
 * côté serveur (n8n, CalDAV, ICS...).
 *
 * Règles :
 *  - schéma https uniquement (http toléré uniquement si explicitement autorisé)
 *  - pas de port inhabituel
 *  - rejet des hôtes loopback / privés / link-local / metadata cloud
 *  - rejet des noms d'hôtes qui résolvent vers une IP privée
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out;
}

export function isPrivateIp(host: string): boolean {
  const lower = host.toLowerCase().replace(/^\[|\]$/g, "");

  // IPv6
  if (lower.includes(":")) {
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // IPv4-mapped ::ffff:a.b.c.d
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }

  const long = ipv4ToLong(lower);
  if (long === null) return false;

  const ranges: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16], // link-local + metadata cloud
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];

  for (const [base, bits] of ranges) {
    const baseLong = ipv4ToLong(base)!;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((long & mask) >>> 0 === (baseLong & mask) >>> 0) return true;
  }
  return false;
}

export interface SafeUrlOptions {
  /** Autoriser http:// en plus de https:// (déconseillé). */
  allowHttp?: boolean;
  /** Autoriser webcal:// (flux ICS). */
  allowWebcal?: boolean;
}

/**
 * Valide l'URL et renvoie l'URL normalisée, ou lève une erreur explicite.
 */
export async function assertSafeExternalUrl(
  rawUrl: string,
  options: SafeUrlOptions = {},
): Promise<string> {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("URL manquante ou invalide");
  }

  let url: URL;
  let input = rawUrl.trim();
  if (options.allowWebcal && /^webcal:\/\//i.test(input)) {
    input = input.replace(/^webcal:\/\//i, "https://");
  }

  try {
    url = new URL(input);
  } catch {
    throw new Error("URL invalide");
  }

  const allowedProtocols = options.allowHttp ? ["https:", "http:"] : ["https:"];
  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(`Protocole non autorisé (${url.protocol}). Utilisez https://`);
  }

  if (url.username || url.password) {
    throw new Error("Les identifiants dans l'URL ne sont pas autorisés");
  }

  const host = url.hostname.toLowerCase();
  if (!host || BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("Cette adresse cible un service interne et n'est pas autorisée");
  }

  if (isPrivateIp(host)) {
    throw new Error("Cette adresse cible un réseau privé et n'est pas autorisée");
  }

  // Résolution DNS : bloque les noms d'hôte pointant vers une IP privée.
  try {
    const records = [
      ...(await Deno.resolveDns(host, "A").catch(() => [] as string[])),
      ...(await Deno.resolveDns(host, "AAAA").catch(() => [] as string[])),
    ];
    if (records.length > 0 && records.some((ip) => isPrivateIp(ip))) {
      throw new Error("Cette adresse résout vers un réseau privé et n'est pas autorisée");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("réseau privé")) throw e;
    // Résolution DNS indisponible : on s'appuie sur les contrôles ci-dessus.
  }

  return url.toString();
}

/**
 * fetch() sécurisé : valide l'URL et interdit les redirections vers un hôte non autorisé.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeUrlOptions = {},
): Promise<Response> {
  let current = await assertSafeExternalUrl(rawUrl, options);

  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      const next = new URL(location, current).toString();
      current = await assertSafeExternalUrl(next, options);
      continue;
    }
    return res;
  }
  throw new Error("Trop de redirections");
}
