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

const businessError = (code: string, message: string) =>
  json({ success: false, error: message, code });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return businessError("no_auth", "Non autorisé : aucun jeton d'authentification transmis");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user: caller } } = await adminClient.auth.getUser(token);
    if (!caller) return businessError("no_auth", "Non autorisé : session invalide ou expirée");

    const body = await req.json().catch(() => ({}));
    const invitationId = typeof body?.invitation_id === "string" ? body.invitation_id : "";
    const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo : undefined;
    if (!invitationId) return businessError("missing_fields", "Identifiant d'invitation manquant");

    const { data: invitation } = await adminClient
      .from("member_invitations")
      .select("*")
      .eq("id", invitationId)
      .maybeSingle();
    if (!invitation) return businessError("not_found", "Invitation introuvable");

    // --- Contrôle d'accès : super-admin ou responsable de l'équipe ---------
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
        return businessError("no_member_profile", "Votre compte n'est rattaché à aucune fiche membre");
      }
      const { data: orgRole } = await adminClient
        .from("organization_members")
        .select("role")
        .eq("org_id", invitation.org_id)
        .eq("member_id", callerProfile.team_member_id)
        .maybeSingle();
      if (orgRole?.role !== "owner" && orgRole?.role !== "admin") {
        return businessError("not_org_admin", "Vous n'êtes pas administrateur de cette équipe");
      }
    }

    if (invitation.status === "accepted") {
      return businessError(
        "already_accepted",
        "Cette invitation a déjà été acceptée : le membre peut se connecter normalement.",
      );
    }

    const email = String(invitation.email).trim().toLowerCase();

    // Le compte Auth existe-t-il encore ? Détermine le type de lien à produire.
    const { data: authUsers } = await adminClient.rpc("get_user_by_email", { p_email: email });
    const existingAuthUserId = (authUsers as { id: string }[] | null)?.[0]?.id ?? null;

    // --- Fiche membre : on ne recrée un compte pour rien ------------------
    // Une invitation révoquée a pu détacher (voire supprimer) la fiche membre.
    let memberId = invitation.member_id as string | null;
    if (memberId) {
      const { data: memberRow } = await adminClient
        .from("team_members")
        .select("id")
        .eq("id", memberId)
        .maybeSingle();
      if (!memberRow) memberId = null;
    }
    if (!memberId) {
      const { data: byEmail } = await adminClient
        .from("team_members")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      memberId = byEmail?.id ?? null;
    }

    if (!memberId) {
      const avatarColors = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
      memberId = `tm_${crypto.randomUUID()}`;
      const { error: memberError } = await adminClient.from("team_members").insert({
        id: memberId,
        name: invitation.name,
        email,
        role: invitation.job_role,
        avatar_color: avatarColors[Math.floor(Math.random() * avatarColors.length)],
      });
      if (memberError) {
        console.error("resend-invitation: création team_members échouée", memberError.message);
        return businessError("db_insert_failed", memberError.message);
      }
    }

    // Rattachement à l'équipe (idempotent)
    const { data: alreadyIn } = await adminClient
      .from("organization_members")
      .select("member_id")
      .eq("org_id", invitation.org_id)
      .eq("member_id", memberId)
      .maybeSingle();
    if (!alreadyIn) {
      await adminClient
        .from("organization_members")
        .insert({ org_id: invitation.org_id, member_id: memberId, role: "member" });
    }
    await adminClient
      .from("member_active_org")
      .upsert({ member_id: memberId, org_id: invitation.org_id }, { onConflict: "member_id" });

    // --- Régénération du lien --------------------------------------------
    const linkType: "invite" | "magiclink" = existingAuthUserId ? "magiclink" : "invite";
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: linkType,
      email,
      options: {
        redirectTo: redirectTo || undefined,
        ...(linkType === "invite"
          ? { data: { full_name: invitation.name, team_member_id: memberId, org_id: invitation.org_id } }
          : {}),
      },
    } as any);
    if (linkError) {
      console.error("resend-invitation: generateLink échoué", linkType, linkError.message);
      return businessError("generate_link_failed", linkError.message);
    }

    const link = (linkData as any)?.properties?.action_link as string | undefined;
    const authUserId = existingAuthUserId ?? ((linkData as any)?.user?.id as string | undefined) ?? null;

    if (authUserId) {
      await adminClient.from("profiles").upsert({ id: authUserId, team_member_id: memberId });
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: updateError } = await adminClient
      .from("member_invitations")
      .update({
        member_id: memberId,
        auth_user_id: authUserId,
        invite_link: link ?? null,
        link_type: linkType,
        status: "pending",
        revoked_at: null,
        expires_at: expiresAt,
        invited_by: caller.id,
      })
      .eq("id", invitationId);
    if (updateError) {
      console.error("resend-invitation: mise à jour invitation échouée", updateError.message);
      return businessError("db_update_failed", updateError.message);
    }

    return json({
      success: true,
      invitationId,
      memberId,
      userId: authUserId,
      inviteLink: link,
      linkType,
      expiresAt,
    });
  } catch (err) {
    console.error("resend-invitation: erreur inattendue", err);
    const message = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: message, code: "unexpected" }, 500);
  }
});
