// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | undefined = undefined;
let adminDb: ReturnType<typeof getFirestore> | undefined = undefined;

if (getApps().length) {
    adminApp = getApps()[0];
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('Initializing Firebase Admin SDK with service account.');
    try {
        const serviceAccount = JSON.parse(
            Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'base64').toString('utf-8')
        );
        adminApp = initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (e: any) {
        console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS:', e.message);
    }
} else {
    console.warn(
      'Firebase Admin SDK not initialized. GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.'
    );
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
