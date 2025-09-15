// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;
let adminDb: ReturnType<typeof getFirestore>;
let adminAuth: ReturnType<typeof getAuth>;

function initializeAdminApp() {
    if (getApps().length > 0) {
        adminApp = getApps()[0];
    } else {
        const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountString) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set. Admin SDK initialization failed.');
        }

        try {
            const serviceAccount = JSON.parse(serviceAccountString);
            adminApp = initializeApp({
                credential: cert(serviceAccount)
            });
            console.log('Firebase Admin SDK initialized successfully.');
        } catch (e: any) {
             throw new Error(`Failed to parse or use FIREBASE_SERVICE_ACCOUNT_KEY: ${e.message}`);
        }
    }
    
    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
}

try {
    initializeAdminApp();
} catch (error: any) {
    console.error("CRITICAL: Firebase Admin SDK failed to initialize.", error.message);
}


const getAdminDb = () => {
    if (!adminDb) {
        throw new Error('Firebase Admin DB has not been initialized. Check server logs for critical errors.');
    }
    return adminDb;
};

const getAdminAuth = () => {
    if (!adminAuth) {
        throw new Error('Firebase Admin Auth has not been initialized. Check server logs for critical errors.');
    }
    return adminAuth;
}

export { adminApp, getAdminDb, getAdminAuth };
