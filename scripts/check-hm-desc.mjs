import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const snap = await db.collection('programs').doc('5wjLfv0N4VWxxPT0ZxiO').get();
const d = snap.data();
console.log('Name:', d.name);
console.log('Description:', d.description);
// Also check days 41, 46, 55, 68
for (const day of [41, 46, 55, 68]) {
  const w = d.workouts.find(w => w.day === day);
  console.log(`\nDay ${day}: ${w.title}`);
  w.runs.forEach((r,i) => console.log(`  run[${i}]: ${r.type}/${r.distance}km @${r.paceZone} — "${r.description}"`));
}
