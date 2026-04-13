import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Fusion Balance - Week 4 onwards to check race simulation timing
{
  const snap = await db.collection('programs').doc('j5qE8awNGl8IPoNzaVFH').get();
  const p = snap.data();
  console.log('=== FUSION BALANCE ===');
  console.log('description:', p.description?.substring(0, 250));
  for (const w of p.workouts) {
    const t = (w.title || '').toLowerCase();
    if (t.includes('simulation') || t.includes('compromised') || t.includes('long aerobic') || w.day <= 7) {
      console.log(`Day ${String(w.day).padStart(2)}: "${w.title}" | ex:${(w.exercises||[]).length}`);
      if (t.includes('simulation') || t.includes('long aerobic')) {
        for (const e of (w.exercises||[])) {
          console.log(`   [${e.name}]: ${e.details?.substring(0,200)}`);
        }
      }
    }
  }
}

// Doubles - Partner WOD content
{
  const snap = await db.collection('programs').doc('uf3EsOGPMp5wGV7bPi1h').get();
  const p = snap.data();
  console.log('\n=== DOUBLES ===');
  console.log('description:', p.description?.substring(0, 250));
  for (const w of p.workouts) {
    if ((w.title || '').includes('Partner WOD')) {
      console.log(`\nDay ${w.day}: "${w.title}"`);
      for (const e of (w.exercises||[])) {
        console.log(`  [${e.name}]: ${e.details?.substring(0,200)}`);
      }
    }
  }
}

// Run Performance - strength and compromised run content
{
  const snap = await db.collection('programs').doc('mTSbnEGsI9nzqDccm90B').get();
  const p = snap.data();
  console.log('\n=== RUN PERFORMANCE ===');
  console.log('description:', p.description?.substring(0, 250));
  for (const w of p.workouts) {
    const t = (w.title||'').toLowerCase();
    if (t.includes('strength') || t.includes('compromised')) {
      if (w.day <= 21) {
        console.log(`\nDay ${w.day}: "${w.title}"`);
        for (const e of (w.exercises||[])) {
          console.log(`  [${e.name}]: ${e.details?.substring(0,200)}`);
        }
      }
    }
  }
}

// CrossFit Bridge - Block 1 content 
{
  const snap = await db.collection('programs').doc('hI2ziHSOkazjrbObnOOj').get();
  const p = snap.data();
  console.log('\n=== CROSSFIT BRIDGE ===');
  console.log('description:', p.description?.substring(0, 250));
  for (const w of p.workouts.slice(0,5)) {
    console.log(`\nDay ${w.day}: "${w.title}"`);
    for (const e of (w.exercises||[])) {
      console.log(`  [${e.name}]: ${e.details?.substring(0,200)}`);
    }
  }
  // Show Engine Maintenance
  for (const w of p.workouts) {
    if ((w.title||'').includes('Engine')) {
      console.log(`\nDay ${w.day}: "${w.title}"`);
      for (const e of (w.exercises||[])) {
        console.log(`  [${e.name}]: ${e.details?.substring(0,200)}`);
      }
      break;
    }
  }
}
