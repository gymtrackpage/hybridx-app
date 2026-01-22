
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { generateRaceProgram } from '@/services/race-scheduler';
import { generateRacePlanFlow } from '@/ai/flows/generate-race-plan'; // Import AI Flow
import type { Program } from '@/models/types';

// Increase timeout for AI generation (it processes a lot of data)
export const maxDuration = 60; 

export async function POST(request: Request) {
  try {
    const { date, eventName, eventType, eventDetails } = await request.json();
    const raceDate = new Date(date);

    // 1. Select the Best Template
    const db = getAdminDb();
    let templateQuery = db.collection('programs');
    
    // Simple mapping logic
    let typeToSearch = 'hyrox';
    if (eventType.includes('run') || eventType === 'marathon' || eventType === '5k') {
        typeToSearch = 'running';
    }

    const snapshot = await templateQuery.where('programType', '==', typeToSearch).limit(1).get();
    
    if (snapshot.empty) {
        return NextResponse.json({ error: "No suitable template found for this event type." }, { status: 404 });
    }

    const template = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Program;

    // 2. Generate the Baseline Schedule (Math-based Slicing/Extending)
    let customWorkouts = generateRaceProgram(template, raceDate);

    // 3. Apply AI Customization if details provided
    if (eventDetails && eventDetails.trim().length > 5) {
        try {
            console.log("🎨 Applying AI customization to race plan...");
            const aiResult = await generateRacePlanFlow({
                eventName,
                eventDate: raceDate.toDateString(),
                eventDetails,
                currentPlan: customWorkouts as any // Cast to match schema
            });
            
            if (aiResult.workouts && aiResult.workouts.length > 0) {
                console.log("✅ AI customization successful.");
                customWorkouts = aiResult.workouts as any;
            }
        } catch (aiError) {
            console.error("⚠️ AI Customization failed, falling back to baseline:", aiError);
            // Fallback: Return customWorkouts (baseline) without AI edits
        }
    }

    return NextResponse.json({ 
        success: true, 
        programName: `Prep for ${eventName}`,
        workouts: customWorkouts 
    });

  } catch (error) {
    console.error("Failed to generate race plan:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
