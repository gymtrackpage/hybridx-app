import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('programs').doc('ncYgpWVba8fxHre91CeD').get();
const program = snap.data();
const w6 = program.workouts.find(w => w.day === 6);
const w27 = program.workouts.find(w => w.day === 27);
console.log('Day 6 elevation guidance:', w6.runs[0].description.includes('Elevation goal'));
console.log('Day 27 elevation guidance:', w27.runs[0].description.includes('Elevation goal'));
console.log('Day 6 last 80 chars:', w6.runs[0].description.slice(-80));
