import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const snap = await db.collection('programs').doc('jYNyJoDcdJVCLCq3zxZw').get();
const { name, programType, workouts } = snap.data();
console.log('Name:', name, '| Type:', programType, '| Days:', workouts.length);
workouts.forEach(w => {
  const runSummary = w.runs.map(r => `${r.type}/${r.distance}km@${r.paceZone}(e${r.effortLevel})`).join(' + ');
  const exCount = w.exercises?.length ? ` [${w.exercises.length}ex]` : '';
  console.log(`Day ${String(w.day).padStart(2)}: ${w.title.padEnd(35)} ${runSummary}${exCount}`);
});
