// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";

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
const auth = getAuth(app);

// Set persistence to local storage to keep the user signed in
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Error setting auth persistence:", error);
  });


export { app, db, auth };
