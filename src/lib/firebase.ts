// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  browserLocalPersistence,
  initializeAuth as initializeFirebaseAuth,
  Auth,
  onAuthStateChanged
} from "firebase/auth";

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

/**
 * Gets the initialized Firebase Auth instance using a promise-based singleton pattern.
 * Ensures persistence is set for PWA functionality and that it's only initialized once.
 */
const getAuthInstance = (): Promise<Auth> => {
  if (authInstancePromise) {
    return authInstancePromise;
  }

  authInstancePromise = new Promise((resolve, reject) => {
    try {
      if (typeof window !== 'undefined') {
        // For client-side, initialize with persistence.
        // Use only browserLocalPersistence to avoid PWA/IndexedDB issues
        const auth = initializeFirebaseAuth(app, {
          persistence: browserLocalPersistence,
          popupRedirectResolver: undefined
        });
        resolve(auth);
      } else {
        // For server-side, just get the auth instance without persistence.
        const auth = getAuth(app);
        resolve(auth);
      }
    } catch (error) {
      // If initialization fails, fall back to the basic getAuth.
      // This can happen with hot-reloading in development.
      if ((error as any).code === 'auth/already-initialized') {
        const existingAuth = getAuth(app);
        // Ensure persistence is set on existing instance
        existingAuth.setPersistence(browserLocalPersistence).catch(console.error);
        resolve(existingAuth);
      } else {
        console.error("Firebase Auth initialization error:", error);
        reject(error);
      }
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
