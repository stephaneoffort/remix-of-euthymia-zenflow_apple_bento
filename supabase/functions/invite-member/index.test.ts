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
