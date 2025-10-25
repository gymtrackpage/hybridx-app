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
        // For client-side, initialize with persistence.
        // For Capacitor apps, always use IndexedDB for better reliability
        const isNative = Capacitor.isNativePlatform();
        let auth: Auth;

        try {
          // CRITICAL: For Capacitor native apps, use IndexedDB with explicit configuration
          // This is the most reliable persistence mechanism for hybrid apps
          const persistenceOptions = isNative
            ? [indexedDBLocalPersistence]
            : [indexedDBLocalPersistence, browserLocalPersistence];

          auth = initializeFirebaseAuth(app, {
            persistence: persistenceOptions,
            popupRedirectResolver: undefined
          });

          // Force immediate persistence confirmation
          if (isNative) {
            await setPersistence(auth, indexedDBLocalPersistence);
          }

          console.log(`✅ Firebase Auth initialized ${isNative ? '(Capacitor/Native)' : '(Web)'} with ${isNative ? 'IndexedDB' : 'IndexedDB+LocalStorage'} persistence`);
        } catch (initError: any) {
          // If initialization fails (already initialized), get existing instance
          if (initError.code === 'auth/already-initialized') {
            auth = getAuth(app);
            // CRITICAL: Always re-set persistence for existing instance
            try {
              await setPersistence(auth, indexedDBLocalPersistence);
              console.log('✅ Persistence re-set to IndexedDB on existing instance');
            } catch (persistError) {
              if (!isNative) {
                console.warn('⚠️ IndexedDB persistence failed, falling back to localStorage', persistError);
                try {
                  await setPersistence(auth, browserLocalPersistence);
                } catch (fallbackError) {
                  console.error('❌ All persistence mechanisms failed', fallbackError);
                }
              } else {
                console.error('❌ CRITICAL: IndexedDB persistence failed in Capacitor app', persistError);
                // In native app, this is a critical error
              }
            }
          } else {
            throw initError;
          }
        }

        // CRITICAL FIX: Set up proactive token refresh ONLY ONCE
        // Prevent multiple listeners from being created on navigation
        if (!authStateListenerSetup && typeof window !== 'undefined') {
          authStateListenerSetup = true;

          auth.onAuthStateChanged(async (user) => {
            if (user) {
              console.log('✅ Auth state detected:', user.email);

              // CRITICAL: Immediately refresh token on auth state change
              try {
                await user.getIdToken(true);
                console.log('🔄 Token refreshed successfully');
              } catch (err) {
                console.error('❌ Token refresh error:', err);
              }

              // Clear any existing refresh interval before creating a new one
              if ((window as any).__authRefreshInterval) {
                clearInterval((window as any).__authRefreshInterval);
                console.log('🧹 Cleared previous refresh interval');
              }

              // CRITICAL: Set up automatic token refresh every 50 minutes (before 1-hour expiry)
              const refreshInterval = setInterval(async () => {
                try {
                  const currentUser = auth.currentUser;
                  if (currentUser) {
                    // Check if page is visible before refreshing (save resources)
                    if (document.visibilityState === 'visible') {
                      await currentUser.getIdToken(true);
                      console.log('🔄 Background token refresh successful');
                    } else {
                      console.log('⏸️ Skipping refresh - page not visible');
                    }
                  } else {
                    console.warn('⚠️ No current user, clearing refresh interval');
                    clearInterval(refreshInterval);
                    delete (window as any).__authRefreshInterval;
                  }
                } catch (err) {
                  console.error('❌ Background token refresh failed:', err);
                }
              }, 50 * 60 * 1000); // 50 minutes

              // Store interval ID so we can clear it later
              (window as any).__authRefreshInterval = refreshInterval;
              console.log('⏰ Token refresh interval established');
            } else {
              console.log('❌ No auth state detected');

              // Clear refresh interval if user logs out
              if ((window as any).__authRefreshInterval) {
                clearInterval((window as any).__authRefreshInterval);
                delete (window as any).__authRefreshInterval;
                console.log('🧹 Refresh interval cleared on logout');
              }
            }
          });

          // CRITICAL: Refresh token when page becomes visible again
          // This handles cases where user left tab inactive for > 1 hour
          document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
              const currentUser = auth.currentUser;
              if (currentUser) {
                console.log('👁️ Page visible again, refreshing token...');
                try {
                  await currentUser.getIdToken(true);
                  console.log('✅ Token refreshed after visibility change');
                } catch (err) {
                  console.error('❌ Token refresh failed on visibility change:', err);
                }
              }
            }
          });
        }

        resolve(auth);
      } else {
        // For server-side, just get the auth instance without persistence.
        const auth = getAuth(app);
        resolve(auth);
      }
    } catch (error) {
      console.error("Firebase Auth initialization error:", error);
      // Last resort fallback
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
