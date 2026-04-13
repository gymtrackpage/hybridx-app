import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Fix programType: 'hyrox' → 'running' for 50K Ultra Marathon Plan
await db.collection('programs').doc('RQDomx9rFVLnJNUCkkKh').update({ programType: 'running' });
console.log('✅ 50K Ultra programType fixed: hyrox → running');
