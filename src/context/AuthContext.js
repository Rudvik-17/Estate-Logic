import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // On sign-in or initial session restore, silently link any unlinked
        // tenant row whose email matches this user's auth email.
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          linkTenantIfNeeded(session.user);
        }
        fetchRole(session.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Silently link an unlinked tenant row to this auth user if emails match.
  // This runs on every sign-in so the first time a tenant authenticates their
  // account gets connected to the row the owner pre-created.
  const linkTenantIfNeeded = async (authUser) => {
    if (!authUser?.email) return;
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('email', authUser.email)
      .is('user_id', null)
      .limit(1);
    if (data?.[0]) {
      await supabase
        .from('tenants')
        .update({ user_id: authUser.id, status: 'active' })
        .eq('id', data[0].id);
    }
  };

  const fetchRole = async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    setRole(data?.role ?? null);
    setLoading(false);
  };

  // Exposed so screens can force a role re-fetch after updating the users table
  // without relying on an auth state change event firing.
  const refetchRole = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) await fetchRole(currentUser.id);
  };

  // Sets role to null in memory so RootNavigator shows RoleSelectionScreen.
  // Does not touch the database — RoleSelectionScreen will upsert the new choice.
  const clearRole = () => setRole(null);

  return (
    <AuthContext.Provider value={{ user, role, loading, refetchRole, clearRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);