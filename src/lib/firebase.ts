
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth as initializeFirebaseAuth,
  Auth,
  onAuthStateChanged,
  setPersistence
} from "firebase/auth";
import { Capacitor } from '@capacitor/core';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCB_K8odTJ98LuCM5YGR6v8AbwykUzpaW4",
  authDomain: "hyroxedgeai.firebaseapp.com",
  projectId: "hyroxedgeai",
  storageBucket: "hyroxedgeai.firebasestorage.app",
  messagingSenderId: "321094496963",
  appId: "1:321094496963:web:7193225dfa2b160ddce876"
};

// Initialize Firebase app
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Singleton promise to ensure auth is only initialized once
let authInstancePromise: Promise<Auth> | null = null;

// Track if we've already set up the auth state listener to prevent duplicates
let authStateListenerSetup = false;

/**
 * Gets the initialized Firebase Auth instance using a promise-based singleton pattern.
 * Ensures persistence is set for PWA functionality and that it's only initialized once.
 */
const getAuthInstance = (): Promise<Auth> => {
  if (authInstancePromise) {
    return authInstancePromise;
  }

  authInstancePromise = new Promise(async (resolve, reject) => {
    try {
      if (typeof window !== 'undefined') {
        const isNative = Capacitor.isNativePlatform();
        let auth: Auth;

        try {
          const persistenceOptions = isNative
            ? [indexedDBLocalPersistence]
            : [indexedDBLocalPersistence, browserLocalPersistence];

          auth = initializeFirebaseAuth(app, {
            persistence: persistenceOptions,
            popupRedirectResolver: undefined
          });

          if (isNative) {
            await setPersistence(auth, indexedDBLocalPersistence);
          }
          console.log(`✅ Firebase Auth initialized ${isNative ? '(Capacitor/Native)' : '(Web)'} with persistence`);

        } catch (initError: any) {
          if (initError.code === 'auth/already-initialized') {
            auth = getAuth(app);
            try {
              await setPersistence(auth, isNative ? indexedDBLocalPersistence : browserLocalPersistence);
            } catch (persistError) {
              console.warn('Persistence re-set failed, may already be set:', persistError);
            }
          } else {
            throw initError;
          }
        }

        if (!authStateListenerSetup) {
          authStateListenerSetup = true;

          onAuthStateChanged(auth, async (user) => {
            if (user) {
              console.log('✅ Auth state detected user:', user.email);

              // CRITICAL: Proactively create/validate session cookie on auth state change
              try {
                const idToken = await user.getIdToken(true);
                await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken }),
                });
                console.log('🍪 Session cookie created/validated on app startup.');
              } catch (sessionError) {
                console.error('❌ Failed to create session cookie on startup:', sessionError);
              }

              // Set up automatic token refresh
              if ((window as any).__authRefreshInterval) {
                clearInterval((window as any).__authRefreshInterval);
              }
              const refreshInterval = setInterval(async () => {
                try {
                  if (auth.currentUser) {
                    await auth.currentUser.getIdToken(true);
                  }
                } catch (err) {
                  console.error('❌ Background token refresh failed:', err);
                }
              }, 50 * 60 * 1000);
              (window as any).__authRefreshInterval = refreshInterval;
            } else {
              console.log('❌ No auth state detected');
              if ((window as any).__authRefreshInterval) {
                clearInterval((window as any).__authRefreshInterval);
                delete (window as any).__authRefreshInterval;
              }
            }
          });
        }

        resolve(auth);
      } else {
        const auth = getAuth(app);
        resolve(auth);
      }
    } catch (error) {
      console.error("Firebase Auth initialization error:", error);
      const auth = getAuth(app);
      resolve(auth);
    }
  });

  return authInstancePromise;
};


/**
 * A helper function that resolves when the auth state is first determined.
 * Resolves with `true` if a user is logged in, `false` otherwise.
 */
const waitForAuthState = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    getAuthInstance().then(auth => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe(); // Unsubscribe after the first emission
            resolve(!!user);
        }, reject); // Pass reject to handle errors during auth state observation
    }).catch(reject);
  });
};

// Function to get a specific cookie by name
const getCookie = (name: string): string | undefined => {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
};

/**
 * Provides a comprehensive diagnosis of the current authentication state.
 * Safe to call from client-side components.
 */
export async function diagnoseAuth() {
    try {
        const auth = await getAuthInstance();
        const sessionCookie = getCookie('__session');
        const currentUser = auth.currentUser;

        return {
            timestamp: new Date().toISOString(),
            authProviderInitialized: !!auth,
            currentUser: currentUser ? {
                uid: currentUser.uid,
                email: currentUser.email,
                emailVerified: currentUser.emailVerified,
            } : null,
            cookies: {
                sessionCookieExists: !!sessionCookie,
                sessionCookieLength: sessionCookie?.length || 0,
                allCookies: typeof document !== 'undefined' ? document.cookie : 'N/A (server-side)',
            },
        };
    } catch (error: any) {
        console.error('Auth diagnosis failed:', error);
        return {
            error: true,
            errorMessage: error.message,
            stack: error.stack,
        };
    }
}


// Maintain a direct export for any legacy code that might still use it,
// but getAuthInstance is the preferred method.
const auth = getAuth(app);

export { app, db, auth, getAuthInstance, waitForAuthState };
