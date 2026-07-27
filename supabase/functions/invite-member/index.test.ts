// Test d'intégration de la fonction invite-member.
// Il appelle réellement la fonction déployée avec une session d'administrateur,
// puis vérifie que le lien est généré et que les lignes sont créées en base.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Ouvre une session pour un super-admin existant, sans mot de passe,
// via un lien magique consommé immédiatement.
async function getAdminAccessToken(): Promise<string> {
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1);
  const userId = roles?.[0]?.user_id as string | undefined;
  assert(userId, "Aucun super-admin trouvé pour exécuter le test");

  const { data: userData } = await admin.auth.admin.getUserById(userId!);
  const email = userData?.user?.email;
  assert(email, "Le super-admin n'a pas d'adresse e-mail");

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email!,
  });
  assertEquals(linkError, null);

  const hash = linkData?.properties?.hashed_token;
  assert(hash, "Aucun jeton de vérification généré");

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: otpError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: hash!,
  });
  assertEquals(otpError, null);
  assert(session?.session?.access_token, "Session administrateur non obtenue");
  return session!.session!.access_token;
}

Deno.test("invite-member crée le membre et renvoie un lien d'invitation", async () => {
  const accessToken = await getAdminAccessToken();

  // Équipe cible : la première équipe disponible
  const { data: orgs } = await admin.from("organizations").select("id, name").limit(1);
  const orgId = orgs?.[0]?.id as string | undefined;
  assert(orgId, "Aucune équipe disponible pour le test");

  const email = `test-invite-${crypto.randomUUID()}@zenflow-test.invalid`;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/invite-member`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      email,
      name: "Testeur Intégration",
      role: "Testeur",
      org_id: orgId,
      redirectTo: "http://localhost:8080",
    }),
  });

  const body = await response.json();

  try {
    assertEquals(response.status, 200);
    assertEquals(body.success, true, `Échec inattendu : ${JSON.stringify(body)}`);
    assertEquals(body.existing, false);

    // 1) Le lien de connexion est bien généré
    assert(
      typeof body.inviteLink === "string" && body.inviteLink.startsWith("http"),
      "Lien d'invitation absent ou invalide",
    );

    // 2) Une ligne existe dans team_members
    const { data: member } = await admin
      .from("team_members")
      .select("id, email, name, role")
      .eq("email", email)
      .maybeSingle();
    assert(member, "Aucune ligne créée dans team_members");
    assertEquals(member!.id, body.memberId);
    assertEquals(member!.name, "Testeur Intégration");

    // 3) Une ligne existe dans organization_members pour l'équipe cible
    const { data: orgMember } = await admin
      .from("organization_members")
      .select("org_id, member_id, role")
      .eq("org_id", orgId!)
      .eq("member_id", body.memberId)
      .maybeSingle();
    assert(orgMember, "Aucune ligne créée dans organization_members");
    assertEquals(orgMember!.role, "member");
  } finally {
    // Nettoyage : on retire toutes les traces du membre de test
    if (body?.memberId) {
      await admin.from("member_active_org").delete().eq("member_id", body.memberId);
      await admin.from("organization_members").delete().eq("member_id", body.memberId);
      await admin.from("team_members").delete().eq("id", body.memberId);
    }
    if (body?.userId) {
      await admin.auth.admin.deleteUser(body.userId).catch(() => {});
    }
  }
});

Deno.test("invite-member refuse un email invalide sans rien créer en base", async () => {
  const accessToken = await getAdminAccessToken();

  const { data: orgs } = await admin.from("organizations").select("id").limit(1);
  const orgId = orgs?.[0]?.id as string | undefined;
  assert(orgId, "Aucune équipe disponible pour le test");

  const invalidEmails = [
    "pas-un-email",
    "sans-domaine@",
    "@sans-local.fr",
    "espace dans@mail.fr",
    "double@@mail.fr",
  ];

  for (const email of invalidEmails) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/invite-member`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email,
        name: "Testeur Email Invalide",
        role: "Testeur",
        org_id: orgId,
        redirectTo: "http://localhost:8080",
      }),
    });

    const body = await response.json();

    // Erreur MÉTIER : HTTP 200 + corps explicite
    assertEquals(response.status, 200, `Statut inattendu pour "${email}"`);
    assertEquals(body.success, false, `Succès inattendu pour "${email}" : ${JSON.stringify(body)}`);
    assertEquals(body.code, "invalid_email", `Code inattendu pour "${email}"`);
    assertEquals(body.memberId, undefined);

    // Aucune ligne dans team_members
    const { data: members } = await admin
      .from("team_members")
      .select("id")
      .eq("email", email.trim().toLowerCase());
    assertEquals(members?.length ?? 0, 0, `Ligne team_members créée pour "${email}"`);

    // Aucune ligne dans organization_members pour un membre au nom du test
    const { data: created } = await admin
      .from("team_members")
      .select("id")
      .eq("name", "Testeur Email Invalide");
    assertEquals(created?.length ?? 0, 0, "Fiche membre créée alors que l'email est invalide");

    const { data: orgMembers } = await admin
      .from("organization_members")
      .select("member_id")
      .eq("org_id", orgId!)
      .in("member_id", (created ?? []).map((m) => m.id as string).concat("__none__"));
    assertEquals(orgMembers?.length ?? 0, 0, "Ligne organization_members créée à tort");
  }
});

Deno.test("invite-member ne crée pas de doublon pour un membre déjà existant", async () => {
  const accessToken = await getAdminAccessToken();

  const { data: orgs } = await admin.from("organizations").select("id, name").limit(1);
  const orgId = orgs?.[0]?.id as string | undefined;
  assert(orgId, "Aucune équipe disponible pour le test");

  const email = `test-dup-${crypto.randomUUID()}@zenflow-test.invalid`;

  const invite = () =>
    fetch(`${SUPABASE_URL}/functions/v1/invite-member`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email,
        name: "Testeur Doublon",
        role: "Testeur",
        org_id: orgId,
        redirectTo: "http://localhost:8080",
      }),
    }).then((r) => r.json());

  // 1re invitation : création initiale du membre
  const first = await invite();

  try {
    assertEquals(first.success, true, `Première invitation échouée : ${JSON.stringify(first)}`);
    const memberId = first.memberId as string;

    // --- Cas A : membre déjà dans l'équipe -> refus explicite, aucun doublon
    const second = await invite();
    assertEquals(second.success, false, "Une seconde invitation identique aurait dû être refusée");
    assertEquals(second.code, "already_member");

    const countRows = async () => {
      const { data: members } = await admin.from("team_members").select("id").eq("email", email);
      const { data: links } = await admin
        .from("organization_members")
        .select("member_id")
        .eq("org_id", orgId!)
        .eq("member_id", memberId);
      return { members: members?.length ?? 0, links: links?.length ?? 0 };
    };

    let counts = await countRows();
    assertEquals(counts.members, 1, "Doublon détecté dans team_members");
    assertEquals(counts.links, 1, "Doublon détecté dans organization_members");

    // --- Cas B : membre existant hors de l'équipe -> rattachement + lien renvoyé
    await admin
      .from("organization_members")
      .delete()
      .eq("org_id", orgId!)
      .eq("member_id", memberId);

    const third = await invite();
    assertEquals(third.success, true, `Rattachement échoué : ${JSON.stringify(third)}`);
    assertEquals(third.existing, true, "Le membre existant n'a pas été reconnu comme tel");
    assertEquals(third.memberId, memberId, "Un nouvel identifiant de membre a été créé à tort");
    assertEquals(third.linkType, "magiclink");
    assert(
      typeof third.inviteLink === "string" && third.inviteLink.startsWith("http"),
      "Aucun lien d'invitation renvoyé pour le membre existant",
    );

    counts = await countRows();
    assertEquals(counts.members, 1, "Doublon créé dans team_members lors du rattachement");
    assertEquals(counts.links, 1, "Doublon créé dans organization_members lors du rattachement");
  } finally {
    const { data: members } = await admin.from("team_members").select("id").eq("email", email);
    for (const m of members ?? []) {
      await admin.from("member_active_org").delete().eq("member_id", m.id as string);
      await admin.from("organization_members").delete().eq("member_id", m.id as string);
      await admin.from("team_members").delete().eq("id", m.id as string);
    }
    if (first?.userId) {
      await admin.auth.admin.deleteUser(first.userId).catch(() => {});
    }
  }
});

Deno.test("invite-member renvoie generate_link_failed sans rien créer", async () => {
  const accessToken = await getAdminAccessToken();

  const { data: orgs } = await admin.from("organizations").select("id").limit(1);
  const orgId = orgs?.[0]?.id as string | undefined;
  assert(orgId, "Aucune équipe disponible pour le test");

  // Adresse au format valide mais refusée par le service d'authentification
  // (partie locale trop longue) : la génération du lien échoue à coup sûr.
  const email = `${"a".repeat(250)}@zenflow-test.invalid`;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/invite-member`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      email,
      name: "Testeur Lien Impossible",
      role: "Testeur",
      org_id: orgId,
      redirectTo: "http://localhost:8080",
    }),
  });

  const body = await response.json();

  try {
    // Erreur MÉTIER : HTTP 200 + code explicite
    assertEquals(response.status, 200, `Statut inattendu : ${JSON.stringify(body)}`);
    assertEquals(body.success, false);
    assertEquals(body.code, "generate_link_failed", `Corps inattendu : ${JSON.stringify(body)}`);
    assert(typeof body.error === "string" && body.error.length > 0, "Message d'erreur absent");
    assertEquals(body.memberId, undefined);
    assertEquals(body.inviteLink, undefined);

    // Aucune écriture : la génération du lien précède les insertions
    const { data: members } = await admin
      .from("team_members")
      .select("id")
      .eq("email", email.toLowerCase());
    assertEquals(members?.length ?? 0, 0, "Ligne créée dans team_members malgré l'échec");

    const { data: named } = await admin
      .from("team_members")
      .select("id")
      .eq("name", "Testeur Lien Impossible");
    assertEquals(named?.length ?? 0, 0, "Fiche membre créée malgré l'échec");

    const { data: orgMembers } = await admin
      .from("organization_members")
      .select("member_id")
      .eq("org_id", orgId!)
      .in("member_id", (named ?? []).map((m) => m.id as string).concat("__none__"));
    assertEquals(orgMembers?.length ?? 0, 0, "Ligne créée dans organization_members malgré l'échec");
  } finally {
    const { data: leftovers } = await admin
      .from("team_members")
      .select("id")
      .eq("email", email.toLowerCase());
    for (const m of leftovers ?? []) {
      await admin.from("member_active_org").delete().eq("member_id", m.id as string);
      await admin.from("organization_members").delete().eq("member_id", m.id as string);
      await admin.from("team_members").delete().eq("id", m.id as string);
    }
  }
});

Deno.test("invite-member refuse un appelant non autorisé sans rien créer", async () => {
  const { data: orgs } = await admin.from("organizations").select("id").limit(1);
  const orgId = orgs?.[0]?.id as string | undefined;
  assert(orgId, "Aucune équipe disponible pour le test");

  const targetEmail = `test-unauth-${crypto.randomUUID()}@zenflow-test.invalid`;

  const call = (authorization?: string) =>
    fetch(`${SUPABASE_URL}/functions/v1/invite-member`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({
        email: targetEmail,
        name: "Testeur Non Autorisé",
        role: "Testeur",
        org_id: orgId,
        redirectTo: "http://localhost:8080",
      }),
    });

  // Utilisateur légitime mais sans droits : compte Auth sans fiche membre
  const outsiderEmail = `test-outsider-${crypto.randomUUID()}@zenflow-test.invalid`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: outsiderEmail,
    email_confirm: true,
  });
  assertEquals(createError, null);
  const outsiderId = created?.user?.id as string | undefined;
  assert(outsiderId, "Compte de test non créé");

  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: outsiderEmail,
  });
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: outsiderSession } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData!.properties!.hashed_token!,
  });
  const outsiderToken = outsiderSession?.session?.access_token;
  assert(outsiderToken, "Session du compte non autorisé non obtenue");

  try {
    const cases: Array<{ label: string; auth?: string; code: string }> = [
      { label: "aucun jeton", auth: undefined, code: "no_auth" },
      { label: "jeton invalide", auth: "Bearer jeton-bidon", code: "no_auth" },
      { label: "clé anonyme seule", auth: `Bearer ${ANON_KEY}`, code: "no_auth" },
      { label: "compte sans droits", auth: `Bearer ${outsiderToken}`, code: "no_member_profile" },
    ];

    for (const c of cases) {
      const response = await call(c.auth);
      const body = await response.json();

      assertEquals(response.status, 200, `Statut inattendu (${c.label})`);
      assertEquals(body.success, false, `Invitation acceptée à tort (${c.label})`);
      assertEquals(body.code, c.code, `Code inattendu (${c.label}) : ${JSON.stringify(body)}`);
      assertEquals(body.inviteLink, undefined, `Lien renvoyé à tort (${c.label})`);
      assertEquals(body.memberId, undefined, `memberId renvoyé à tort (${c.label})`);
    }

    // Aucune écriture en base, quelle que soit la tentative
    const { data: members } = await admin
      .from("team_members")
      .select("id")
      .in("email", [targetEmail, outsiderEmail]);
    assertEquals(members?.length ?? 0, 0, "Ligne créée dans team_members par un appelant non autorisé");

    const { data: named } = await admin
      .from("team_members")
      .select("id")
      .eq("name", "Testeur Non Autorisé");
    assertEquals(named?.length ?? 0, 0, "Fiche membre créée par un appelant non autorisé");

    const { data: orgMembers } = await admin
      .from("organization_members")
      .select("member_id")
      .eq("org_id", orgId!)
      .in("member_id", (named ?? []).map((m) => m.id as string).concat("__none__"));
    assertEquals(orgMembers?.length ?? 0, 0, "Ligne créée dans organization_members à tort");
  } finally {
    const { data: leftovers } = await admin
      .from("team_members")
      .select("id")
      .in("email", [targetEmail, outsiderEmail]);
    for (const m of leftovers ?? []) {
      await admin.from("member_active_org").delete().eq("member_id", m.id as string);
      await admin.from("organization_members").delete().eq("member_id", m.id as string);
      await admin.from("team_members").delete().eq("id", m.id as string);
    }
    await admin.auth.admin.deleteUser(outsiderId!).catch(() => {});
  }
});
