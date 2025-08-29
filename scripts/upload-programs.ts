// scripts/upload-programs.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { Program } from '@/models/types';

// NOTE: This is a simplified script that uses your client-side Firebase config.
// For more robust, server-side scripting, you would typically use the Firebase Admin SDK.
// However, for a one-time data upload, this approach is straightforward.

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCB_K8odTJ98LuCM5YGR6v8AbwykUzpaW4",
    authDomain: "hyroxedgeai.firebaseapp.com",
    projectId: "hyroxedgeai",
    storageBucket: "hyroxedgeai.firebasestorage.app",
    messagingSenderId: "321094496963",
    appId: "1:321094496963:web:7193225dfa2b160ddce876"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const programsCollection = collection(db, 'programs');

async function uploadPrograms() {
    try {
        console.log('Reading programs from JSON file...');
        const filePath = path.join(process.cwd(), 'src/data/programs.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const programs: Program[] = JSON.parse(fileContent);

        console.log(`Found ${programs.length} programs to upload.`);

        // Optional: Check if programs already exist to avoid duplicates
        const existingPrograms = await getDocs(query(programsCollection));
        const existingProgramIds = new Set(existingPrograms.docs.map(d => d.id));
        
        for (const program of programs) {
            if (existingProgramIds.has(program.id)) {
                console.log(`Program with ID "${program.id}" already exists. Skipping.`);
                continue;
            }

            console.log(`Uploading program: ${program.name} (ID: ${program.id})`);
            const programRef = doc(db, 'programs', program.id);
            // We remove the id from the object itself as it's used as the document ID
            const { id, ...programData } = program;
            await setDoc(programRef, programData);
            console.log(`Successfully uploaded ${program.name}.`);
        }

        console.log('All programs have been processed.');
        process.exit(0);

    } catch (error) {
        console.error('Error uploading programs:', error);
        process.exit(1);
    }
}

uploadPrograms();
