import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const programs = [
  { id: 'JrHDGwFm0Cn4sRJosApH', name: 'First Steps to Hyrox' },
  { id: 'j5qE8awNGl8IPoNzaVFH', name: 'Hyrox Fusion Balance' },
  { id: 'mTSbnEGsI9nzqDccm90B', name: 'Hyrox Run Performance' },
  { id: 'uf3EsOGPMp5wGV7bPi1h', name: 'Hyrox Doubles & Relay Prep' },
  { id: 'QXpgKvrxjW4VfYspOlHQ', name: 'Olympic Lifting & Power Cycle' },
  { id: 'dBJAHOM8TqeMyanNG9s5', name: 'Ultra Elite Performance' },
  { id: 'RQDomx9rFVLnJNUCkkKh', name: '50K Ultra Marathon Plan' },
  { id: 'hI2ziHSOkazjrbObnOOj', name: 'Hyrox to CrossFit Bridge' },
];

for (const { id, name } of programs) {
  const snap = await db.collection('programs').doc(id).get();
  const p = snap.data();
  const workouts = p.workouts || [];
  
  // Count exercises and runs
  let totalExercises = 0, totalRuns = 0, runAsStrength = 0;
  for (const w of workouts) {
    totalExercises += (w.exercises || []).length;
    totalRuns += (w.runs || []).length;
    // Flag strength sessions wrongly coded as runs
    for (const r of (w.runs || [])) {
      if (r.distance === 0 && r.type === 'recovery' && r.description && r.description.length > 50) {
        runAsStrength++;
      }
    }
  }
  
  console.log(`\n=== ${name} (${id}) ===`);
  console.log(`  Description: ${p.description?.substring(0, 200)}`);
  console.log(`  programType: ${p.programType} | workouts: ${workouts.length}`);
  console.log(`  Total exercises: ${totalExercises} | Total runs: ${totalRuns} | Strength-as-run entries: ${runAsStrength}`);
  
  // Show first 3 workout titles to understand structure
  for (const w of workouts.slice(0, 14)) {
    const exCount = (w.exercises || []).length;
    const runsData = (w.runs || []);
    const runSummary = runsData.map(r => `${r.type}(${r.distance}km)`).join(', ');
    console.log(`  Day ${String(w.day).padStart(2)}: "${w.title}" | ex:${exCount} | runs:[${runSummary}]`);
  }
  console.log('  ...');
}
