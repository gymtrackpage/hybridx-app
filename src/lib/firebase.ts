// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, browserLocalPersistence, setPersistence, Auth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCB_K8odTJ98LuCM5YGR6v8AbwykUzpaW4",
  authDomain: "hyroxedgeai.firebaseapp.com",
  projectId: "hyroxedgeai",
  storageBucket: "hyroxedgeai.firebasestorage.app",
  messagingSenderId: "321094496963",
  appId: "1:321094496963:web:7193225dfa2b160ddce876"
};

// A more robust way to initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Initialize auth and set persistence
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    // This could happen if the browser settings block local storage, etc.
    console.error("Firebase Auth: Could not set persistence.", error);
  });


export { app, db, auth };
