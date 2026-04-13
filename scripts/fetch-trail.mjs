import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('programs').doc('ncYgpWVba8fxHre91CeD').get();
const program = snap.data();
console.log('Name:', program.name);
console.log('Description:', program.description);
console.log('\nTotal workouts:', program.workouts.length);

// Find strength, technical, and long run days
for (const w of program.workouts) {
  const title = (w.title || '').toLowerCase();
  if (title.includes('strength') || title.includes('technical') || title.includes('long') || title.includes('time on feet')) {
    console.log(`\nDay ${w.day}: "${w.title}"`);
    for (const r of (w.runs || [])) {
      console.log(`  run: ${r.type} ${r.distance}km @${r.paceZone} — ${r.description?.substring(0, 150)}`);
    }
    for (const e of (w.exercises || [])) {
      console.log(`  ex: ${e.name} — ${e.details?.substring(0, 80)}`);
    }
  }
}
