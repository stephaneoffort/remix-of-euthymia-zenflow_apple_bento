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
    if (!authHeader) return businessError("no_auth", "Non autorisé : aucun jeton d'authentification transmis");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validation du jeton via le client admin : le runtime n'expose pas
    // systématiquement la clé publiable, l'ancien client anonyme échouait.
    const authClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user: caller } } = await authClient.auth.getUser(token);
    if (!caller) return businessError("no_auth", "Non autorisé : session invalide ou expirée");


    const { email, name, role, redirectTo, org_id } = await req.json();

    if (!email || !name || !role) {
      return businessError("missing_fields", "Email, nom et fonction sont requis");
    }
    if (!org_id) {
      console.error("invite-member: org_id manquant");
      return businessError("no_org", "Aucune équipe active détectée");
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
        return businessError("no_member_profile", "Votre compte n'est rattaché à aucune fiche membre");
      }

      const { data: orgRole } = await adminClient
        .from("organization_members")
        .select("role")
        .eq("org_id", org_id)
        .eq("member_id", callerProfile.team_member_id)
        .maybeSingle();

      if (orgRole?.role !== "owner" && orgRole?.role !== "admin") {
        console.error("invite-member: appelant non responsable", caller.id, org_id);
        return businessError("not_org_admin", "Vous n'êtes pas administrateur de cette équipe");
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
      return businessError("org_not_found", "Équipe introuvable");
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Format d'e-mail : contrôlé avant toute écriture en base
    const EMAIL_RE = /^[^\s@]+@[^\s@,;]+\.[a-z]{2,}$/i;
    if (!EMAIL_RE.test(cleanEmail)) {
      console.error("invite-member: email invalide");
      return businessError("invalid_email", "Adresse e-mail invalide");
    }

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
        throw Object.assign(new Error(error.message), { code: "generate_link_failed" });
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
        return businessError("already_member", `Ce membre fait déjà partie de l'équipe ${org.name}`);
      }

      const { error: addError } = await adminClient
        .from("organization_members")
        .insert({ org_id, member_id: existingMember.id, role: "member" });
      if (addError) {
        console.error("invite-member: ajout organization_members échoué", addError.message);
        return businessError("db_insert_failed", addError.message);
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
      return businessError("db_insert_failed", memberError.message);
    }

    // organization_members.role = niveau de permission
    const { error: orgMemberError } = await adminClient
      .from("organization_members")
      .insert({ org_id, member_id: memberId, role: "member" });
    if (orgMemberError) {
      // Rollback : seule une écriture en base ayant réellement échoué le justifie
      console.error("invite-member: création organization_members échouée", orgMemberError.message);
      await adminClient.from("team_members").delete().eq("id", memberId);
      return businessError("db_insert_failed", orgMemberError.message);
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
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as any)?.code;
    // Échec de génération du lien = erreur métier remontable en 200
    if (code === "generate_link_failed") {
      return businessError("generate_link_failed", message);
    }
    // Vraie erreur technique inattendue : statut non-2xx, message inclus dans le corps
    return json({ success: false, error: message, code: "unexpected" }, 500);
  }
});
