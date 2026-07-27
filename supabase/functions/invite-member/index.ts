import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Erreur MÉTIER : statut 200 + corps explicite, pour que le client puisse toujours le lire
const businessError = (code: string, message: string) =>
  json({ success: false, error: message, code });


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // L'appelant doit être authentifié
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Non autorisé" }, 401);

    const { email, name, role, redirectTo, org_id } = await req.json();

    if (!email || !name || !role) {
      return json({ error: "Email, nom et fonction sont requis" }, 400);
    }
    if (!org_id) {
      console.error("invite-member: org_id manquant");
      return json({ error: "Aucune équipe active détectée" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // --- Étape A : contrôle d'accès --------------------------------------
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");
    const isSuperAdmin = !!roles && roles.length > 0;

    if (!isSuperAdmin) {
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("team_member_id")
        .eq("id", caller.id)
        .maybeSingle();

      if (!callerProfile?.team_member_id) {
        console.error("invite-member: appelant sans fiche membre", caller.id);
        return json({ error: "Votre compte n'est rattaché à aucune fiche membre" }, 403);
      }

      const { data: orgRole } = await adminClient
        .from("organization_members")
        .select("role")
        .eq("org_id", org_id)
        .eq("member_id", callerProfile.team_member_id)
        .maybeSingle();

      if (orgRole?.role !== "owner" && orgRole?.role !== "admin") {
        console.error("invite-member: appelant non responsable", caller.id, org_id);
        return json({ error: "Vous n'êtes pas administrateur de cette équipe" }, 403);
      }
    }

    // Nom réel de l'équipe cible
    const { data: org } = await adminClient
      .from("organizations")
      .select("id, name")
      .eq("id", org_id)
      .maybeSingle();
    if (!org) {
      console.error("invite-member: équipe introuvable", org_id);
      return json({ error: "Équipe introuvable" }, 404);
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Génère un lien d'authentification sans dépendre de l'envoi d'e-mail
    const generate = async (type: "invite" | "magiclink", data?: Record<string, unknown>) => {
      const { data: linkData, error } = await adminClient.auth.admin.generateLink({
        type,
        email: cleanEmail,
        options: {
          redirectTo: redirectTo || undefined,
          ...(type === "invite" && data ? { data } : {}),
        },
      } as any);
      if (error) {
        console.error("invite-member: generateLink échoué", type, error.message);
        throw new Error(error.message);
      }
      return {
        link: linkData?.properties?.action_link as string | undefined,
        userId: linkData?.user?.id as string | undefined,
      };
    };

    // --- Étape B : le membre existe déjà globalement ----------------------
    const { data: existingMember } = await adminClient
      .from("team_members")
      .select("id, name")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingMember) {
      const { data: alreadyIn } = await adminClient
        .from("organization_members")
        .select("member_id")
        .eq("org_id", org_id)
        .eq("member_id", existingMember.id)
        .maybeSingle();

      if (alreadyIn) {
        return json({ error: `Ce membre fait déjà partie de l'équipe ${org.name}` }, 400);
      }

      const { error: addError } = await adminClient
        .from("organization_members")
        .insert({ org_id, member_id: existingMember.id, role: "member" });
      if (addError) {
        console.error("invite-member: ajout organization_members échoué", addError.message);
        return json({ error: addError.message }, 400);
      }

      const { link, userId } = await generate("magiclink");

      return json({
        success: true,
        memberId: existingMember.id,
        userId,
        orgName: org.name,
        existing: true,
        inviteLink: link,
        linkType: "magiclink",
      });
    }

    // --- Étape C : email inconnu de team_members --------------------------
    // Cas limite : un compte Auth peut exister sans fiche membre
    const { data: authUsers } = await adminClient.rpc("get_user_by_email", { p_email: cleanEmail });
    const existingAuthUserId = (authUsers as { id: string }[] | null)?.[0]?.id ?? null;

    const memberId = `tm_${crypto.randomUUID()}`;

    const { link, userId: generatedUserId } = existingAuthUserId
      ? await generate("magiclink")
      : await generate("invite", {
          full_name: String(name).trim(),
          team_member_id: memberId,
          org_id,
        });

    const authUserId = existingAuthUserId ?? generatedUserId ?? null;

    const avatarColors = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    // Attention : team_members.role = intitulé de poste (texte libre)
    const { error: memberError } = await adminClient.from("team_members").insert({
      id: memberId,
      name: String(name).trim(),
      email: cleanEmail,
      role: String(role).trim(),
      avatar_color: avatarColor,
    });
    if (memberError) {
      console.error("invite-member: création team_members échouée", memberError.message);
      return json({ error: memberError.message }, 400);
    }

    // organization_members.role = niveau de permission
    const { error: orgMemberError } = await adminClient
      .from("organization_members")
      .insert({ org_id, member_id: memberId, role: "member" });
    if (orgMemberError) {
      // Rollback : seule une écriture en base ayant réellement échoué le justifie
      console.error("invite-member: création organization_members échouée", orgMemberError.message);
      await adminClient.from("team_members").delete().eq("id", memberId);
      return json({ error: orgMemberError.message }, 400);
    }

    // Équipe active par défaut du nouvel arrivant
    await adminClient
      .from("member_active_org")
      .upsert({ member_id: memberId, org_id }, { onConflict: "member_id" });

    // Liaison profil ↔ fiche membre
    if (authUserId) {
      await adminClient.from("profiles").upsert({ id: authUserId, team_member_id: memberId });
    }

    return json({
      success: true,
      memberId,
      userId: authUserId,
      orgName: org.name,
      existing: false,
      inviteLink: link,
      linkType: existingAuthUserId ? "magiclink" : "invite",
    });
  } catch (err) {
    console.error("invite-member: erreur inattendue", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
