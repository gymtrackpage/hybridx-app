// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | undefined = undefined;
let adminDb: ReturnType<typeof getFirestore> | undefined = undefined;

if (getApps().length) {
    adminApp = getApps()[0];
} else {
    // In a managed Google Cloud environment (like App Hosting, Cloud Functions, Cloud Run, GKE, etc.),
    // the SDK will automatically discover the service account credentials.
    // We don't need to manually parse GOOGLE_APPLICATION_CREDENTIALS.
    try {
        console.log('Initializing Firebase Admin SDK with default credentials.');
        adminApp = initializeApp();
    } catch (e: any) {
        console.error('Failed to initialize Firebase Admin SDK. This can happen when GOOGLE_APPLICATION_CREDENTIALS are not set for local development or when permissions are insufficient.', e.message);
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
