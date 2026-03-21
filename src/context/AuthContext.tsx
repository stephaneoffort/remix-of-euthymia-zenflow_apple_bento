import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  teamMemberId: string | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  linkTeamMember: (teamMemberId: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth listener BEFORE getting session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(async () => {
            // Check if profile already has a team_member_id
            const { data } = await supabase
              .from('profiles')
              .select('team_member_id')
              .eq('id', session.user.id)
              .single();

            if (data?.team_member_id) {
              setTeamMemberId(data.team_member_id);
            } else {
              // Try to auto-link by matching email to an existing team_member
              const userEmail = session.user.email?.toLowerCase();
              if (userEmail) {
                const { data: matchedMember } = await supabase
                  .from('team_members')
                  .select('id')
                  .eq('email', userEmail)
                  .maybeSingle();

                if (matchedMember) {
                  // Auto-link the user to the matched team member
                  await supabase.from('profiles').update({ team_member_id: matchedMember.id }).eq('id', session.user.id);
                  setTeamMemberId(matchedMember.id);
                } else {
                  setTeamMemberId(null);
                }
              } else {
                setTeamMemberId(null);
              }
            }
          }, 0);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from('profiles')
          .select('team_member_id')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            setTeamMemberId(data?.team_member_id ?? null);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const linkTeamMember = async (memberId: string) => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('profiles')
      .update({ team_member_id: memberId })
      .eq('id', user.id);
    if (!error) setTeamMemberId(memberId);
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, teamMemberId, loading, signUp, signIn, signOut, linkTeamMember }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
