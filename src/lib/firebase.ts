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

// Initialize auth with proper persistence
let auth: Auth;
let authInitialized: Promise<Auth>;

const initializeAuth = (): Promise<Auth> => {
    if (authInitialized) {
        return authInitialized;
    }

    auth = getAuth(app);

    authInitialized = new Promise<Auth>((resolve, reject) => {
        // Run this only in the browser
        if (typeof window !== 'undefined') {
            setPersistence(auth, indexedDBLocalPersistence)
                .then(() => {
                    console.log('Firebase Auth: IndexedDB persistence set successfully');
                    resolve(auth);
                })
                .catch((error) => {
                    console.warn('Firebase Auth: IndexedDB persistence failed, trying localStorage', error);
                    return setPersistence(auth, browserLocalPersistence);
                })
                .then(() => {
                    console.log('Firebase Auth: localStorage persistence set successfully');
                    resolve(auth);
                })
                .catch((error) => {
                    console.error('Firebase Auth: Could not set any persistence', error);
                    // Still resolve auth, but persistence might not be what's expected.
                    // The app can function with in-memory persistence.
                    resolve(auth);
                });
        } else {
            // For server-side rendering, just resolve the auth instance
            resolve(auth);
        }
    });

    return authInitialized;
};


// Helper function to ensure auth is ready
const getAuthInstance = async (): Promise<Auth> => {
  if (!authInitialized) {
    return initializeAuth();
  }
  return authInitialized;
};

// Helper function to wait for auth state to be determined
const waitForAuthState = (authInstance: Auth): Promise<boolean> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
        unsubscribe();
        resolve(!!user);
    });
  });
};

// Initialize auth immediately if in browser environment
if (typeof window !== 'undefined') {
  initializeAuth();
}

export { app, db, getAuthInstance, waitForAuthState };

// Export auth directly for compatibility, but prefer getAuthInstance for new code
export { auth };
