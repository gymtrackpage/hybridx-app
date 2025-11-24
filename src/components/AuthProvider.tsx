'use client';
import { logger } from '@/lib/logger';

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
        await setPersistence(auth, browserLocalPersistence).catch(logger.error);

        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          logger.log('🔐 [AuthProvider] Auth state changed:', firebaseUser?.email || 'null');

          if (firebaseUser) {
            // User is signed in - ensure session cookie exists
            try {
              // Check if session cookie exists by checking document.cookie
              const hasSessionCookie = typeof document !== 'undefined' &&
                document.cookie.split(';').some(c => c.trim().startsWith('__session='));

              if (!hasSessionCookie) {
                // No valid session cookie - create one
                logger.log('🍪 [AuthProvider] No session cookie found, creating one...');
                const idToken = await firebaseUser.getIdToken();

                const response = await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken }),
                  credentials: 'include',
                });

                if (response.ok) {
                  logger.log('✅ [AuthProvider] Session cookie created');
                } else {
                  logger.error('❌ [AuthProvider] Failed to create session cookie');
                }
              } else {
                logger.log('✅ [AuthProvider] Session cookie already exists');
              }

              setUser(firebaseUser);
            } catch (error) {
              logger.error('❌ [AuthProvider] Error syncing session:', error);
              // Still set the user even if session sync fails
              setUser(firebaseUser);
            }
          } else {
            // User is signed out
            logger.log('🚪 [AuthProvider] User signed out');
            setUser(null);
          }

          setLoading(false);
        });
      } catch (error) {
        logger.error('❌ [AuthProvider] Setup error:', error);
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
