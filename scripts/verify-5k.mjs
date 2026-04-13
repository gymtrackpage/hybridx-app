import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const snap = await db.collection('programs').doc('ve6fME6cJH6dDuSPrMSl').get();
const workouts = snap.data().workouts;

// Check each changed day
for (const day of [3, 5, 10, 12, 14, 17, 19, 41, 56]) {
  const w = workouts.find(w => w.day === day);
  console.log(`\n=== Day ${day}: ${w.title} ===`);
  if (w.runs?.length) console.log('  runs[0]:', w.runs[0].description.substring(0, 100) + '...');
  if (w.exercises?.length) console.log('  exercises:', w.exercises.map(e => e.name).join(', '));
  if (day === 41) console.log('  paceZone:', w.runs[0].paceZone);
}
