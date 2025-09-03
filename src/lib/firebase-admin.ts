// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// It's recommended to store your service account key in environment variables
// and not commit it to your repository.
// For this example, we'll check for environment variables.

let adminApp: App;

if (!getApps().length) {
    // In a real production environment, you would use environment variables
    // For local development, you might use a serviceAccountKey.json file
    // IMPORTANT: Ensure this file is in .gitignore and not committed to your repo.
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)
        : {
            // Fallback for local dev if GOOGLE_APPLICATION_CREDENTIALS is not set
            // Note: This is a placeholder and should be replaced with your actual service account details
            // or by setting the environment variable.
            "type": "service_account",
            "project_id": "hyroxedgeai",
            "private_key_id": "YOUR_PRIVATE_KEY_ID", // Replace with your key ID
            "private_key": "YOUR_PRIVATE_KEY", // Replace with your private key
            "client_email": "YOUR_CLIENT_EMAIL", // Replace with your client email
            "client_id": "YOUR_CLIENT_ID", // Replace with your client ID
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "YOUR_CLIENT_X509_CERT_URL" // Replace with your cert URL
          };
    
    adminApp = initializeApp({
        credential: cert(serviceAccount)
    });
} else {
    adminApp = getApps()[0];
}

const adminDb = getFirestore(adminApp);

export { adminApp, adminDb };
