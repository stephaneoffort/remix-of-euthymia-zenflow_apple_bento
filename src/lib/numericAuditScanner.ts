/**
 * Browser-side numeric attribute auditor.
 *
 * Mirrors the static analysis implemented in
 * `src/test/numericAttribute.test.ts` but runs in the browser by reading
 * `.tsx` source files via Vite's `import.meta.glob('?raw')`.
 *
 * The detection heuristics are intentionally identical to the test so the
 * admin page surfaces the exact same set of violations.
 */

export interface NumericViolation {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

const IGNORED_DIR_FRAGMENTS = ["/test/", "/integrations/", "/ui/"];

function isIgnored(path: string): boolean {
  return IGNORED_DIR_FRAGMENTS.some(f => path.includes(f));
}

/* ─── Source masking (strings, templates, regexes, comments) ─── */
function maskNonJsx(src: string): string {
  const out = src.split("");
  const FILL = " ";
  let i = 0;
  const n = src.length;
  const fill = (start: number, end: number) => {
    for (let k = start; k < end; k++) {
      if (out[k] !== "\n") out[k] = FILL;
    }
  };

  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === "/" && next === "/") {
      let j = i + 2;
      while (j < n && src[j] !== "\n") j++;
      fill(i, j);
      i = j;
      continue;
    }
    if (ch === "/" && next === "*") {
      let j = i + 2;
      while (j < n - 1 && !(src[j] === "*" && src[j + 1] === "/")) j++;
      fill(i, Math.min(j + 2, n));
      i = j + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const q = ch;
      let j = i + 1;
      while (j < n && src[j] !== q) {
        if (src[j] === "\\") j++;
        j++;
      }
      fill(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "`") {
      let j = i + 1;
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === "$" && src[j + 1] === "{") {
          let depth = 1;
          j += 2;
          while (j < n && depth > 0) {
            if (src[j] === "{") depth++;
            else if (src[j] === "}") depth--;
            j++;
          }
          continue;
        }
        j++;
      }
      fill(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "/") {
      let p = i - 1;
      while (p >= 0 && /\s/.test(src[p])) p--;
      const prev = p >= 0 ? src[p] : "";
      if ("(,=:!&|?;{[".includes(prev) || prev === "" || prev === "\n") {
        let j = i + 1;
        while (j < n && src[j] !== "\n" && src[j] !== "/") {
          if (src[j] === "\\") {
            j += 2;
            continue;
          }
          if (src[j] === "[") {
            j++;
            while (j < n && src[j] !== "]") {
              if (src[j] === "\\") j++;
              j++;
            }
          }
          j++;
        }
        let k = j + 1;
        while (k < n && /[a-z]/.test(src[k])) k++;
        if (j < n && src[j] === "/") {
          fill(i, k);
          i = k;
          continue;
        }
      }
    }
    i++;
  }

  return out.join("");
}

function extractJsxTextSegments(masked: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  const re = />([^<>]*\{[^<>]*\}[^<>]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    out.push({ text: m[1], offset: m.index + 1 });
  }
  return out;
}

function findPrevTag(masked: string, from: number): { start: number; end: number; isCloser: boolean; isSelfClosing: boolean } | null {
  let i = from - 1;
  while (i >= 0 && masked[i] !== ">") i--;
  if (i < 0) return null;
  const end = i;
  let j = end - 1;
  while (j >= 0 && masked[j] !== "<") j--;
  if (j < 0) return null;
  const tagText = masked.slice(j, end + 1);
  return {
    start: j,
    end,
    isCloser: tagText.startsWith("</"),
    isSelfClosing: /\/\s*>$/.test(tagText),
  };
}

function findEnclosingOpenTag(masked: string, offset: number, validate = false): { tag: string; start: number } | null {
  if (validate) {
    let probe = offset - 1;
    while (probe >= 0 && /\s/.test(masked[probe])) probe--;
    if (probe < 0 || masked[probe] !== ">") return null;
  }
  let cur = offset;
  let pendingClosers = 0;
  while (true) {
    const t = findPrevTag(masked, cur);
    if (!t) return null;
    if (t.isCloser) {
      pendingClosers++;
    } else if (t.isSelfClosing) {
      // ignore — sibling
    } else if (pendingClosers > 0) {
      pendingClosers--;
    } else {
      return { tag: masked.slice(t.start, t.end + 1), start: t.start };
    }
    cur = t.start;
  }
}

function isNumericExpression(expr: string): boolean {
  const e = expr.trim();
  if (!e) return false;
  if (e.includes("'") || e.includes('"')) return false;
  if (/^-?\d+(\.\d+)?$/.test(e)) return true;
  if (/\.(length|count|size)\s*$/.test(e)) return true;
  if (/^[A-Za-z_][A-Za-z0-9_]*(Count|Total)$/.test(e)) return true;
  if (/^Math\.(round|floor|ceil|abs|min|max)\s*\(/.test(e)) return true;
  if (/\.toFixed\s*\(/.test(e)) return true;
  return false;
}

function hasNumericAncestor(masked: string, offset: number): boolean {
  let cur = offset;
  for (let depth = 0; depth < 8; depth++) {
    const found = findEnclosingOpenTag(masked, cur);
    if (!found) return false;
    if (/\bdata-numeric\b/.test(found.tag)) return true;
    cur = found.start;
  }
  return false;
}

function analyzeSource(file: string, src: string): NumericViolation[] {
  const violations: NumericViolation[] = [];
  const masked = maskNonJsx(src);
  const segments = extractJsxTextSegments(masked);

  for (const { text, offset } of segments) {
    if (!text.trim()) continue;

    const reasons: string[] = [];
    if (/\{[^{}]+\}\s*%/.test(text)) reasons.push("percentage display");
    if (/\}\s*\/\s*\{/.test(text)) reasons.push("ratio display (a/b)");

    const exprRe = /\{([^{}]+)\}/g;
    let em: RegExpExecArray | null;
    while ((em = exprRe.exec(text)) !== null) {
      if (isNumericExpression(em[1])) {
        reasons.push(`numeric expression: {${em[1].trim()}}`);
        break;
      }
    }

    if (reasons.length === 0) continue;
    if (hasNumericAncestor(masked, offset)) continue;
    const found = findEnclosingOpenTag(masked, offset, true);
    if (!found) continue;

    const line = src.slice(0, offset).split("\n").length;
    violations.push({
      file,
      line,
      snippet: text.trim().replace(/\s+/g, " ").slice(0, 200),
      reason: reasons.join(", "),
    });
  }
  return violations;
}

/**
 * Run the audit against all .tsx sources bundled in the project.
 * Sources are loaded lazily through `import.meta.glob` so the analyzer
 * itself doesn't ship them up-front in the main bundle.
 */
export async function runNumericAudit(): Promise<NumericViolation[]> {
  const modules = import.meta.glob("/src/**/*.tsx", { query: "?raw", import: "default" });
  const violations: NumericViolation[] = [];
  for (const [path, loader] of Object.entries(modules)) {
    if (isIgnored(path)) continue;
    const src = (await loader()) as string;
    // Normalize path to match what the test reports (relative from project)
    const rel = path.replace(/^\//, "");
    violations.push(...analyzeSource(rel, src));
  }
  // Stable sort by file then line
  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return violations;
}

/**
 * Extract a small context snippet (with line numbers) around a given
 * line in a source file. Useful for previewing the raw code under a
 * violation in the audit UI.
 */
export async function loadSourceContext(file: string, line: number, padding = 3): Promise<{ lineNumber: number; content: string; isTarget: boolean }[] | null> {
  const modules = import.meta.glob("/src/**/*.tsx", { query: "?raw", import: "default" });
  const key = `/${file.replace(/^\//, "")}`;
  const loader = modules[key];
  if (!loader) return null;
  const src = (await loader()) as string;
  const lines = src.split("\n");
  const start = Math.max(0, line - 1 - padding);
  const end = Math.min(lines.length, line - 1 + padding + 1);
  return lines.slice(start, end).map((content, i) => ({
    lineNumber: start + i + 1,
    content,
    isTarget: start + i + 1 === line,
  }));
}
