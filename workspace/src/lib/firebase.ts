// IMPROVED: src/lib/firebase.ts

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { 
  getAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence,
  initializeAuth as initializeFirebaseAuth,
  Auth,
  onAuthStateChanged,
  setPersistence,
  connectAuthEmulator
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

// Auth initialization with better error handling and persistence
let authInstance: Auth | null = null;
let authInitializationPromise: Promise<Auth> | null = null;

/**
 * Initializes Firebase Auth with proper persistence for PWA functionality.
 * Uses a promise to ensure initialization happens only once.
 */
const initializeAuthWithPersistence = async (): Promise<Auth> => {
  if (authInstance) {
    return authInstance;
  }

  if (typeof window === 'undefined') {
    // Server-side: just return the basic auth instance
    authInstance = getAuth(app);
    return authInstance;
  }

  try {
    console.log('🔧 Initializing Firebase Auth with persistence...');
    
    // Initialize auth with multiple persistence options as fallbacks
    authInstance = initializeFirebaseAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence]
    });

    // Double-check persistence is properly set
    try {
      await setPersistence(authInstance, indexedDBLocalPersistence);
      console.log('✅ IndexedDB persistence set successfully');
    } catch (indexedDBError) {
      console.warn('⚠️ IndexedDB persistence failed, falling back to localStorage:', indexedDBError);
      try {
        await setPersistence(authInstance, browserLocalPersistence);
        console.log('✅ LocalStorage persistence set successfully');
      } catch (localStorageError) {
        console.error('❌ Both persistence methods failed:', localStorageError);
      }
    }

    // Connect to emulator in development
    if (process.env.NODE_ENV === 'development' && !authInstance.app.options.projectId?.includes('demo')) {
      try {
        connectAuthEmulator(authInstance, 'http://localhost:9099');
        console.log('🔧 Connected to Auth emulator');
      } catch (emulatorError) {
        console.log('ℹ️ Auth emulator not available, using production');
      }
    }

    console.log('🎉 Firebase Auth initialized successfully');
    return authInstance;

  } catch (error) {
    console.error('❌ Firebase Auth initialization failed:', error);
    
    // Fallback to basic auth if initialization fails
    authInstance = getAuth(app);
    return authInstance;
  }
};

/**
 * Gets the initialized Firebase Auth instance.
 * Ensures proper initialization and persistence for PWA functionality.
 */
const getAuthInstance = (): Promise<Auth> => {
  if (authInitializationPromise) {
    return authInitializationPromise;
  }

  authInitializationPromise = initializeAuthWithPersistence();
  return authInitializationPromise;
};

/**
 * Synchronous version for cases where you're certain auth is already initialized.
 * Use with caution - prefer getAuthInstance() for safety.
 */
const getAuthInstanceSync = (): Auth => {
  if (authInstance) {
    return authInstance;
  }
  
  // Fallback for cases where we need sync access
  console.warn('⚠️ Using sync auth access - auth may not be properly initialized');
  return getAuth(app);
};

/**
 * Enhanced auth state waiter with timeout and better error handling.
 */
const waitForAuthState = (timeoutMs: number = 10000): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('⚠️ Auth state check timed out');
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
          console.log(`🔐 Auth state determined: ${user ? 'authenticated' : 'not authenticated'}`);
          resolve(!!user);
        }
      }, (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.error('❌ Auth state check failed:', error);
          reject(error);
        }
      });
    }).catch(error => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.error('❌ Failed to get auth instance:', error);
        reject(error);
      }
    });
  });
};

/**
 * Checks if the current environment supports Firebase Auth persistence.
 */
const checkPersistenceSupport = async (): Promise<{
  indexedDB: boolean;
  localStorage: boolean;
}> => {
  const support = {
    indexedDB: false,
    localStorage: false
  };

  if (typeof window === 'undefined') {
    return support;
  }

  // Check IndexedDB support
  try {
    support.indexedDB = !!(window.indexedDB && 
      typeof window.indexedDB.open === 'function');
  } catch (error) {
    console.warn('IndexedDB not supported:', error);
  }

  // Check localStorage support
  try {
    const testKey = '__firebase_persistence_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    support.localStorage = true;
  } catch (error) {
    console.warn('localStorage not supported:', error);
  }

  return support;
};

/**
 * Diagnostic function to check Firebase Auth configuration.
 */
const diagnoseAuth = async (): Promise<{
  initialized: boolean;
  persistence: string[];
  user: boolean;
  support: { indexedDB: boolean; localStorage: boolean };
}> => {
  try {
    const auth = await getAuthInstance();
    const support = await checkPersistenceSupport();
    
    return {
      initialized: !!auth,
      persistence: (auth as any)._delegate?._persistence || ['unknown'],
      user: !!auth.currentUser,
      support
    };
  } catch (error) {
    console.error('Auth diagnosis failed:', error);
    return {
      initialized: false,
      persistence: [],
      user: false,
      support: { indexedDB: false, localStorage: false }
    };
  }
};

// Connect Firestore emulator in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('🔧 Connected to Firestore emulator');
  } catch (error) {
    console.log('ℹ️ Firestore emulator not available, using production');
  }
}

// Legacy auth export for backward compatibility
const auth = getAuth(app);

export { 
  app, 
  db, 
  auth, // Legacy export
  getAuthInstance, 
  getAuthInstanceSync,
  waitForAuthState,
  checkPersistenceSupport,
  diagnoseAuth
};
