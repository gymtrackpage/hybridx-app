// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

if (!getApps().length) {
    // When deployed to a Google Cloud environment (like Firebase App Hosting),
    // the SDK automatically discovers the service account credentials.
    // For local development, you need to set the GOOGLE_APPLICATION_CREDENTIALS
    // environment variable to point to your service account key file.
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? JSON.parse(Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'base64').toString('utf-8'))
        : undefined;

    if (serviceAccount) {
        adminApp = initializeApp({
            credential: cert(serviceAccount)
        });
    } else {
        // Initialize without explicit credentials, relying on the environment.
        console.log('Initializing Firebase Admin SDK without explicit credentials.');
        adminApp = initializeApp();
    }
} else {
    adminApp = getApps()[0];
}

const adminDb = getFirestore(adminApp);

export { adminApp, adminDb };
