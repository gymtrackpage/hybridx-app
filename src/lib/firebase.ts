// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { 
  getAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence, 
  setPersistence, 
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

// Use a singleton promise to ensure auth is initialized only once
let authInitialized: Promise<Auth> | null = null;

const initializeAuth = (): Promise<Auth> => {
    // This function runs only once
    const auth = getAuth(app);

    // Run this only in the browser
    if (typeof window !== 'undefined') {
        return setPersistence(auth, indexedDBLocalPersistence)
            .then(() => {
                console.log('Firebase Auth: IndexedDB persistence set successfully');
                return auth;
            })
            .catch((error) => {
                console.warn('Firebase Auth: IndexedDB persistence failed, trying localStorage', error);
                return setPersistence(auth, browserLocalPersistence);
            })
            .then(() => {
                console.log('Firebase Auth: localStorage persistence set successfully');
                return auth;
            })
            .catch((error) => {
                console.error('Firebase Auth: Could not set any persistence', error);
                // Still resolve auth, but persistence might not be what's expected.
                return auth;
            });
    } else {
        // For server-side rendering, just resolve the auth instance
        return Promise.resolve(auth);
    }
};

/**
 * Gets the initialized Firebase Auth instance.
 * Uses a singleton promise to prevent race conditions.
 */
const getAuthInstance = (): Promise<Auth> => {
  if (!authInitialized) {
    authInitialized = initializeAuth();
  }
  return authInitialized;
};

/**
 * A helper function that resolves when the auth state is first determined.
 * Resolves with `true` if a user is logged in, `false` otherwise.
 */
const waitForAuthState = async (): Promise<boolean> => {
  const authInstance = await getAuthInstance();
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
        unsubscribe(); // Unsubscribe after the first emission
        resolve(!!user);
    });
  });
};

// Maintain a direct export for any legacy code that might still use it,
// but getAuthInstance is the preferred method.
const auth = getAuth(app);

export { app, db, auth, getAuthInstance, waitForAuthState };
