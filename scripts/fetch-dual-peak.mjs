import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('programs').doc('BtijMgolHGvf2P8QsZEK').get();
const program = snap.data();
console.log('Name:', program.name);
console.log('Description:', program.description);
console.log('\nAll workouts:');
for (const w of program.workouts) {
  console.log(`\nDay ${String(w.day).padStart(2)}: "${w.title}"`);
  for (const r of (w.runs || [])) {
    console.log(`  run[${r.type}] ${r.distance}km @${r.paceZone} effortLevel:${r.effortLevel}`);
    console.log(`    desc: ${r.description?.substring(0, 180)}`);
  }
  for (const e of (w.exercises || [])) {
    console.log(`  ex: ${e.name}`);
  }
}
