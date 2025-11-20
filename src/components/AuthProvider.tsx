'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    let unsubscribe: () => void;

    const setupAuth = async () => {
      try {
        const auth = await getAuthInstance();

        // Set persistence on mount
        await setPersistence(auth, browserLocalPersistence).catch(console.error);

        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('🔐 [AuthProvider] Auth state changed:', firebaseUser?.email || 'null');

          if (firebaseUser) {
            // User is signed in - ensure session cookie exists
            try {
              // Check if session cookie exists by checking document.cookie
              const hasSessionCookie = typeof document !== 'undefined' &&
                document.cookie.split(';').some(c => c.trim().startsWith('__session='));

              if (!hasSessionCookie) {
                // No valid session cookie - create one
                console.log('🍪 [AuthProvider] No session cookie found, creating one...');
                const idToken = await firebaseUser.getIdToken();

                const response = await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken }),
                  credentials: 'include',
                });

                if (response.ok) {
                  console.log('✅ [AuthProvider] Session cookie created');
                } else {
                  console.error('❌ [AuthProvider] Failed to create session cookie');
                }
              } else {
                console.log('✅ [AuthProvider] Session cookie already exists');
              }

              setUser(firebaseUser);
            } catch (error) {
              console.error('❌ [AuthProvider] Error syncing session:', error);
              // Still set the user even if session sync fails
              setUser(firebaseUser);
            }
          } else {
            // User is signed out
            console.log('🚪 [AuthProvider] User signed out');
            setUser(null);
          }

          setLoading(false);
        });
      } catch (error) {
        console.error('❌ [AuthProvider] Setup error:', error);
        setLoading(false);
      }
    };

    setupAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
