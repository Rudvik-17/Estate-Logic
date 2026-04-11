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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
      else { setRole(null); setLoading(false); }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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