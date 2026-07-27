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

    if (invitation.status === "revoked") {
      return businessError("already_revoked", "Cette invitation est déjà révoquée");
    }

    // Invitation déjà utilisée ? On ne détruit alors aucune donnée du membre.
    let accepted = invitation.status === "accepted";
    if (!accepted && invitation.member_id) {
      const { data: linkedProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("team_member_id", invitation.member_id)
        .maybeSingle();
      if (linkedProfile && invitation.auth_user_id) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(invitation.auth_user_id);
        accepted = !!authUser?.user?.last_sign_in_at;
      }
    }

    if (accepted) {
      await adminClient
        .from("member_invitations")
        .update({ status: "accepted", accepted_at: invitation.accepted_at ?? new Date().toISOString() })
        .eq("id", invitationId);
      return businessError(
        "already_accepted",
        "Cette invitation a déjà été acceptée : retirez le membre depuis la liste des membres.",
      );
    }

    // --- Révocation : on démonte ce que l'invitation avait créé ------------
    const memberId = invitation.member_id as string | null;
    let removedMember = false;

    if (memberId) {
      await adminClient
        .from("organization_members")
        .delete()
        .eq("org_id", invitation.org_id)
        .eq("member_id", memberId);

      // La fiche membre n'est supprimée que si elle n'appartient plus à aucune équipe
      const { data: remainingOrgs } = await adminClient
        .from("organization_members")
        .select("org_id")
        .eq("member_id", memberId);

      if (!remainingOrgs || remainingOrgs.length === 0) {
        await adminClient.from("member_active_org").delete().eq("member_id", memberId);
        await adminClient.from("profiles").update({ team_member_id: null }).eq("team_member_id", memberId);
        await adminClient.from("team_members").delete().eq("id", memberId);
        removedMember = true;

        // Compte Auth créé par l'invitation et jamais utilisé : on le supprime
        if (invitation.auth_user_id && invitation.link_type === "invite") {
          const { data: authUser } = await adminClient.auth.admin.getUserById(invitation.auth_user_id);
          if (authUser?.user && !authUser.user.last_sign_in_at) {
            await adminClient.auth.admin.deleteUser(invitation.auth_user_id);
          }
        }
      }
    }

    await adminClient
      .from("member_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), invite_link: null })
      .eq("id", invitationId);

    return json({ success: true, removedMember });
  } catch (err) {
    console.error("revoke-invitation: erreur inattendue", err);
    const message = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: message, code: "unexpected" }, 500);
  }
});
