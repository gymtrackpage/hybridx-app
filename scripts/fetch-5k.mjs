import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('programs').get();
for (const doc of snap.docs) {
  const data = doc.data();
  if (data.name && data.name.toLowerCase().includes('5k')) {
    console.log('ID:', doc.id);
    console.log('Name:', data.name);
    console.log('ProgramType:', data.programType);
    console.log('Workouts:', JSON.stringify(data.workouts, null, 2));
  }
}
