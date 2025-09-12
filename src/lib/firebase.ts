
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { 
  getAuth, 
  indexedDBLocalPersistence, 
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

// Singleton instance for Auth
let authInstance: Auth | null = null;

/**
 * Gets the initialized Firebase Auth instance.
 * Ensures persistence is set for PWA functionality and that it's only initialized once.
 */
const getAuthInstance = (): Auth => {
  if (authInstance) {
    return authInstance;
  }

  if (typeof window !== 'undefined') {
    // For client-side, initialize with persistence. This will create a new instance if one doesn't exist
    // or return the existing one if it's already been initialized elsewhere.
    authInstance = initializeFirebaseAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence]
    });
  } else {
    // For server-side, just get the auth instance
    authInstance = getAuth(app);
  }
  
  return authInstance;
};


/**
 * A helper function that resolves when the auth state is first determined.
 * Resolves with `true` if a user is logged in, `false` otherwise.
 */
const waitForAuthState = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe(); // Unsubscribe after the first emission
        resolve(!!user);
    });
  });
};

// Maintain a direct export for any legacy code that might still use it,
// but getAuthInstance is the preferred method.
const auth = getAuth(app);

export { app, db, auth, getAuthInstance, waitForAuthState };
