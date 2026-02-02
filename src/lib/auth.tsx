import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { setApiAuthToken, clearUserCaches } from './api';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_RESTORE_KEY = 'pt_session_state';

interface StoredSessionState {
  viewState?: string;
  currentQuery?: string;
  currentPage?: number;
  sortBy?: string;
  dateFilter?: string;
}

export function getStoredSessionState(): StoredSessionState | null {
  try {
    const stored = localStorage.getItem(SESSION_RESTORE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveSessionState(state: StoredSessionState): void {
  try {
    localStorage.setItem(SESSION_RESTORE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function clearSessionState(): void {
  try {
    localStorage.removeItem(SESSION_RESTORE_KEY);
  } catch {
    // Ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    initialized: false,
  });

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          setState({
            session,
            user: session?.user ?? null,
            loading: false,
            initialized: true,
          });
          
          setApiAuthToken(session?.access_token ?? null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setState(prev => ({ ...prev, loading: false, initialized: true }));
        }
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        setState({
          session,
          user: session?.user ?? null,
          loading: false,
          initialized: true,
        });

        setApiAuthToken(session?.access_token ?? null);

        if (event === 'SIGNED_OUT') {
          clearUserCaches();
        }

        if (event === 'SIGNED_IN') {
          clearUserCaches();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true }));
    
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setState(prev => ({ ...prev, loading: false }));
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true }));
    
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    setState(prev => ({ ...prev, loading: false }));
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    await supabase.auth.signOut();
    clearUserCaches();
    setState(prev => ({ ...prev, loading: false }));
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    return { error };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }), [state, signIn, signUp, signOut, resetPassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth(): AuthContextValue & { isAuthenticated: true; user: User } {
  const auth = useAuth();
  
  if (!auth.user) {
    throw new Error('AUTH_REQUIRED');
  }
  
  return auth as AuthContextValue & { isAuthenticated: true; user: User };
}
