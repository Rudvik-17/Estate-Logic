import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setLoading(true);
        setUser(session.user);
        const handleInitialSession = async () => {
          await linkTenantIfNeeded(session.user);
          await fetchRole(session.user.id);
        };
        handleInitialSession();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setLoading(true);
        setUser(session.user);
        
        const handleAuthSession = async () => {
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            await linkTenantIfNeeded(session.user);
          }
          await fetchRole(session.user.id);
        };
        
        handleAuthSession();
      } else {
        setUser(null);
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
      // 1. Link tenant row to user
      await supabase
        .from('tenants')
        .update({ user_id: authUser.id, status: 'active' })
        .eq('id', data[0].id);

      // 2. Auto-set role to 'tenant' in users table
      await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          role: 'tenant',
          full_name: authUser.user_metadata?.full_name || '',
          email: authUser.email || ''
        }, { onConflict: 'id' });
    }
  };

  const fetchRole = async (userId) => {
    setLoading(true);
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