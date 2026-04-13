import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('programs').doc('JrHDGwFm0Cn4sRJosApH').get();
const p = snap.data();

// Find all truncated entries (ending abruptly)
let truncatedCount = 0;
for (const w of p.workouts) {
  for (const e of (w.exercises || [])) {
    const d = e.details || '';
    const isTruncated = d.endsWith('💡 Hyrox ') || d.endsWith('• 20m ') || d.endsWith('• H') || d.endsWith('💡 ');
    if (isTruncated) {
      console.log(`Day ${w.day} "${w.title}" [${e.name}]: ...${d.slice(-60)}`);
      truncatedCount++;
    }
  }
}
console.log(`\nTotal truncated: ${truncatedCount}`);

// Show recovery days content
console.log('\n--- ACTIVE RECOVERY DAYS ---');
for (const w of p.workouts) {
  if ((w.title || '').includes('Active Recovery') || (w.title || '').includes('Rest or')) {
    console.log(`Day ${w.day}: "${w.title}"`);
    for (const e of (w.exercises || [])) {
      console.log(`  [${e.name}]: ${e.details?.substring(0, 100)}`);
    }
  }
}

// Show finisher entries across weeks 1-6
console.log('\n--- FINISHERS weeks 1-6 ---');
for (const w of p.workouts.filter(w => w.day <= 42)) {
  for (const e of (w.exercises || [])) {
    if ((e.name || '').toLowerCase().includes('finisher')) {
      console.log(`Day ${w.day} "${w.title}" [${e.name}]: ${e.details?.substring(0, 200)}`);
    }
  }
}
