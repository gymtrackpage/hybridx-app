// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | undefined = undefined;
let adminDb: ReturnType<typeof getFirestore> | undefined = undefined;

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (getApps().length) {
    adminApp = getApps()[0];
} else if (serviceAccount) {
    // If a service account key is provided via environment variable, use it.
    console.log('Initializing Firebase Admin SDK with service account credentials.');
    adminApp = initializeApp({
        credential: cert(serviceAccount)
    });
} else {
    // In a managed Google Cloud environment (like App Hosting, Cloud Functions, Cloud Run),
    // the SDK will automatically discover the service account credentials if not provided.
    try {
        console.log('Initializing Firebase Admin SDK with default credentials.');
        adminApp = initializeApp();
    } catch (e: any) {
        console.error('Failed to initialize Firebase Admin SDK with default credentials. This can happen when service account permissions are insufficient.', e.message);
    }
}


if (adminApp) {
    adminDb = getFirestore(adminApp);
}

// Export a function that throws an error if the db is not initialized
const getAdminDb = () => {
    if (!adminDb) {
        throw new Error('Firebase Admin has not been initialized. Check server logs for details.');
    }
    return adminDb;
}

export { adminApp, getAdminDb };
