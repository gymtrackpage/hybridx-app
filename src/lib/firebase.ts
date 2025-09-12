// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { 
  getAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence,
  Auth,
  onAuthStateChanged,
  setPersistence
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

// Single auth instance - no double initialization
let authInstance: Auth | null = null;
let persistenceSet = false;

/**
 * Gets the Firebase Auth instance with proper persistence.
 * Safe to call multiple times - only initializes once.
 */
const getAuthInstance = async (): Promise<Auth> => {
  // Return existing instance if already created
  if (authInstance) {
    return authInstance;
  }

  // Server-side: return basic auth
  if (typeof window === 'undefined') {
    authInstance = getAuth(app);
    return authInstance;
  }

  try {
    console.log('Initializing Firebase Auth...');
    
    // Get the auth instance (this is safe to call multiple times)
    authInstance = getAuth(app);
    
    // Set persistence only if not already set
    if (!persistenceSet) {
      try {
        await setPersistence(authInstance, indexedDBLocalPersistence);
        console.log('IndexedDB persistence set successfully');
        persistenceSet = true;
      } catch (indexedDBError) {
        console.warn('IndexedDB persistence failed, trying localStorage:', indexedDBError);
        try {
          await setPersistence(authInstance, browserLocalPersistence);
          console.log('LocalStorage persistence set successfully');
          persistenceSet = true;
        } catch (localStorageError) {
          console.error('Both persistence methods failed:', localStorageError);
          // Continue anyway - auth will work without persistence
        }
      }
    }

    console.log('Firebase Auth initialized successfully');
    return authInstance;

  } catch (error) {
    console.error('Firebase Auth initialization error:', error);
    
    // Fallback: return basic auth instance
    if (!authInstance) {
      authInstance = getAuth(app);
    }
    return authInstance;
  }
};

/**
 * Synchronous getter for cases where auth is already initialized.
 * Use getAuthInstance() instead when possible.
 */
const getAuthInstanceSync = (): Auth => {
  if (!authInstance) {
    authInstance = getAuth(app);
  }
  return authInstance;
};

/**
 * Wait for initial auth state determination.
 */
const waitForAuthState = async (timeoutMs: number = 10000): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('Auth state check timed out');
        resolve(false);
      }
    }, timeoutMs);

    getAuthInstance().then(auth => {
      if (resolved) return;
      
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsubscribe();
          console.log(`Auth state determined: ${user ? 'authenticated' : 'not authenticated'}`);
          resolve(!!user);
        }
      }, (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.error('Auth state check failed:', error);
          reject(error);
        }
      });
    }).catch(error => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.error('Failed to get auth instance:', error);
        reject(error);
      }
    });
  });
};

// Legacy sync export for backward compatibility
// DO NOT USE - prefer getAuthInstance()
const auth = getAuth(app);

export { 
  app, 
  db, 
  auth, // Legacy - avoid using this
  getAuthInstance, 
  getAuthInstanceSync,
  waitForAuthState
};
