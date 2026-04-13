import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const snap = await db.collection('programs').get();
for (const doc of snap.docs) {
  const data = doc.data();
  console.log(`ID: ${doc.id} | Name: ${data.name} | Type: ${data.programType} | Days: ${data.workouts?.length}`);
}
