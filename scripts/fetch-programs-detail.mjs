import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// First Steps to Hyrox — check truncated descriptions and Week 3 finisher
{
  const snap = await db.collection('programs').doc('JrHDGwFm0Cn4sRJosApH').get();
  const p = snap.data();
  console.log('=== FIRST STEPS TO HYROX ===');
  for (const w of p.workouts) {
    if ([1, 2, 4, 5, 15, 16, 17, 18].includes(w.day)) {
      console.log(`\nDay ${w.day}: "${w.title}"`);
      for (const e of (w.exercises || [])) {
        console.log(`  [${e.name}]: ${e.details?.substring(0, 200)}`);
      }
    }
  }
}

// 50K Ultra — check programType field
{
  const snap = await db.collection('programs').doc('RQDomx9rFVLnJNUCkkKh').get();
  const p = snap.data();
  console.log('\n=== 50K ULTRA ===');
  console.log('programType:', p.programType);
  console.log('description:', p.description?.substring(0, 300));
  // Show last week
  const last7 = p.workouts.slice(-7);
  for (const w of last7) {
    console.log(`Day ${w.day}: "${w.title}"`);
    for (const e of (w.exercises || [])) {
      console.log(`  [${e.name}]: ${e.details?.substring(0, 120)}`);
    }
  }
}

// Olympic Lifting — check deload weeks and active recovery content
{
  const snap = await db.collection('programs').doc('QXpgKvrxjW4VfYspOlHQ').get();
  const p = snap.data();
  console.log('\n=== OLYMPIC LIFTING ===');
  console.log('description:', p.description?.substring(0, 300));
  // Week 4 and active recovery day
  for (const w of p.workouts) {
    if ([22, 23, 24, 25, 26, 27, 28, 3, 10, 17].includes(w.day)) {
      console.log(`\nDay ${w.day}: "${w.title}"`);
      for (const e of (w.exercises || [])) {
        console.log(`  [${e.name}]: ${e.details?.substring(0, 150)}`);
      }
    }
  }
}

// Ultra Elite — check structure and deload
{
  const snap = await db.collection('programs').doc('dBJAHOM8TqeMyanNG9s5').get();
  const p = snap.data();
  console.log('\n=== ULTRA ELITE ===');
  console.log('description:', p.description?.substring(0, 300));
  // Check all day titles to find any deload weeks
  for (const w of p.workouts) {
    if ((w.title || '').toLowerCase().includes('deload') || (w.title || '').toLowerCase().includes('taper')) {
      console.log(`Day ${w.day}: "${w.title}"`);
    }
  }
  console.log('(any deload found above — if none printed, there are none)');
}
