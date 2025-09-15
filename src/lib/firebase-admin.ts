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
            console.error('FIREBASE_SERVICE_ACCOUNT_KEY is not set. Admin SDK initialization failed.');
            return;
        }

        try {
            const serviceAccount = JSON.parse(serviceAccountString);
            adminApp = initializeApp({
                credential: cert(serviceAccount)
            });
            console.log('Firebase Admin SDK initialized successfully.');
        } catch (e: any) {
            console.error('Failed to parse or use FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
            return;
        }
    }
    
    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
}

initializeAdminApp();

const getAdminDb = () => {
    if (!adminDb) {
        throw new Error('Firebase Admin DB has not been initialized. Check server logs for errors.');
    }
    return adminDb;
};

const getAdminAuth = () => {
    if (!adminAuth) {
        throw new Error('Firebase Admin Auth has not been initialized. Check server logs for errors.');
    }
    return adminAuth;
}

export { adminApp, getAdminDb, getAdminAuth };
