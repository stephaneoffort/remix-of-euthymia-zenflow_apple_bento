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
      return json({ error: "Équipe cible manquante" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // --- Contrôle d'accès : super-admin OU owner/admin de CETTE équipe ---
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");
    const isSuperAdmin = !!roles && roles.length > 0;

    let allowed = isSuperAdmin;
    if (!allowed) {
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("team_member_id")
        .eq("id", caller.id)
        .maybeSingle();

      if (callerProfile?.team_member_id) {
        const { data: orgRole } = await adminClient
          .from("organization_members")
          .select("role")
          .eq("org_id", org_id)
          .eq("member_id", callerProfile.team_member_id)
          .maybeSingle();
        allowed = orgRole?.role === "owner" || orgRole?.role === "admin";
      }
    }

    if (!allowed) {
      return json({ error: "Vous n'êtes pas administrateur de cette équipe" }, 403);
    }

    // Nom réel de l'équipe cible
    const { data: org } = await adminClient
      .from("organizations")
      .select("id, name")
      .eq("id", org_id)
      .maybeSingle();
    if (!org) return json({ error: "Équipe introuvable" }, 404);

    const cleanEmail = String(email).trim().toLowerCase();

    // --- CAS 1 : le membre existe déjà globalement -----------------------
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
      if (addError) return json({ error: addError.message }, 400);

      // Email d'information : lien de connexion vers l'application
      try {
        await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email: cleanEmail,
          options: { redirectTo: redirectTo || undefined },
        });
      } catch (_) {
        // L'ajout à l'équipe reste valide même si l'email échoue
      }

      return json({
        success: true,
        memberId: existingMember.id,
        orgName: org.name,
        existing: true,
      });
    }

    // --- CAS 2 : nouvel email --------------------------------------------
    const avatarColors = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
    const memberId = `tm_${crypto.randomUUID()}`;

    // Attention : team_members.role = intitulé de poste (texte libre)
    const { error: memberError } = await adminClient.from("team_members").insert({
      id: memberId,
      name: String(name).trim(),
      email: cleanEmail,
      role: String(role).trim(),
      avatar_color: avatarColor,
    });
    if (memberError) return json({ error: memberError.message }, 400);

    // organization_members.role = niveau de permission
    const { error: orgMemberError } = await adminClient
      .from("organization_members")
      .insert({ org_id, member_id: memberId, role: "member" });
    if (orgMemberError) {
      await adminClient.from("team_members").delete().eq("id", memberId);
      return json({ error: orgMemberError.message }, 400);
    }

    // Équipe active par défaut du nouvel arrivant
    await adminClient
      .from("member_active_org")
      .upsert({ member_id: memberId, org_id }, { onConflict: "member_id" });

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        redirectTo: redirectTo || undefined,
        data: {
          full_name: String(name).trim(),
          team_member_id: memberId,
          org_id,
        },
      }
    );

    if (inviteError) {
      // Rollback complet des trois tables
      await adminClient.from("member_active_org").delete().eq("member_id", memberId);
      await adminClient.from("organization_members").delete().eq("member_id", memberId);
      await adminClient.from("team_members").delete().eq("id", memberId);
      return json({ error: inviteError.message }, 400);
    }

    if (inviteData?.user) {
      await adminClient.from("profiles").upsert({
        id: inviteData.user.id,
        team_member_id: memberId,
      });
    }

    return json({
      success: true,
      memberId,
      userId: inviteData?.user?.id,
      orgName: org.name,
      existing: false,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
