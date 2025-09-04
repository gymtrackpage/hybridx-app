// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | undefined = undefined;
let adminDb: ReturnType<typeof getFirestore> | undefined = undefined;

function initializeAdminApp() {
    if (getApps().length > 0) {
        adminApp = getApps()[0];
        adminDb = getFirestore(adminApp);
        return;
    }

    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountString) {
        try {
            const serviceAccount = JSON.parse(serviceAccountString);
            console.log('Initializing Firebase Admin SDK with service account credentials.');
            adminApp = initializeApp({
                credential: cert(serviceAccount)
            });
            adminDb = getFirestore(adminApp);
        } catch (e: any) {
             console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Ensure it is a valid JSON string.', e.message);
        }
    } else {
         try {
            console.log('Initializing Firebase Admin SDK with default credentials.');
            adminApp = initializeApp();
            adminDb = getFirestore(adminApp);
        } catch (e: any) {
            console.error('Failed to initialize Firebase Admin SDK with default credentials. This can happen when service account permissions are insufficient.', e.message);
        }
    }
}

// Call initialization
initializeAdminApp();

// Export a function that throws an error if the db is not initialized
const getAdminDb = () => {
    if (!adminDb) {
        throw new Error('Firebase Admin has not been initialized. Check server logs for initialization errors.');
    }
    return adminDb;
}

export { adminApp, getAdminDb };
