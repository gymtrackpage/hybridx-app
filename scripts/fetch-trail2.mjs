import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('programs').doc('ncYgpWVba8fxHre91CeD').get();
const program = snap.data();

// Show all workouts
for (const w of program.workouts) {
  console.log(`Day ${String(w.day).padStart(2)}: "${w.title}"`);
}
