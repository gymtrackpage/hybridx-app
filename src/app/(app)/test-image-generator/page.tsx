'use client';

import { WorkoutImageGenerator } from '@/components/WorkoutImageGenerator';

export default function TestImageGeneratorPage() {
  // Sample workout data for testing
  const sampleWorkout = {
    name: 'Upper Body Power',
    type: 'HYROX',
    distance: 5000, // 5km in meters
    calories: 450,
    startTime: new Date(),
    duration: '45:30',
    notes: 'Felt strong today! Hit a new PR on bench press. Really pushing my limits.',
  };

  const sampleWorkout2 = {
    name: 'Long Run',
    type: 'Running',
    distance: 10000, // 10km
    startTime: new Date(),
    duration: '52:15',
    notes: 'Easy pace, focused on building endurance. Beautiful morning for a run.',
  };

  const sampleWorkout3 = {
    name: 'Leg Day',
    type: 'Strength',
    startTime: new Date(),
    duration: '38:00',
    // No distance or notes - testing minimal data
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Image Generator Test</h1>
          <p className="text-muted-foreground">
            Test the WorkoutImageGenerator component with different workout types.
            Click the download button to generate and save the image.
          </p>
        </div>

        <div className="space-y-8">
          {/* Test 1: Full workout with all fields */}
          <div className="border rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Test 1: HYROX Workout (All Fields)</h2>
              <p className="text-sm text-muted-foreground">
                Includes: name, type, distance, duration, and notes
              </p>
            </div>
            <div className="bg-muted p-4 rounded-md">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(sampleWorkout, null, 2)}
              </pre>
            </div>
            <WorkoutImageGenerator workout={sampleWorkout} />
          </div>

          {/* Test 2: Running workout with distance */}
          <div className="border rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Test 2: Running Workout</h2>
              <p className="text-sm text-muted-foreground">
                Includes: name, type, distance (10km), duration, and notes
              </p>
            </div>
            <div className="bg-muted p-4 rounded-md">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(sampleWorkout2, null, 2)}
              </pre>
            </div>
            <WorkoutImageGenerator workout={sampleWorkout2} />
          </div>

          {/* Test 3: Minimal workout without distance or notes */}
          <div className="border rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Test 3: Minimal Workout</h2>
              <p className="text-sm text-muted-foreground">
                No distance or notes - tests the "HIGH" effort fallback
              </p>
            </div>
            <div className="bg-muted p-4 rounded-md">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(sampleWorkout3, null, 2)}
              </pre>
            </div>
            <WorkoutImageGenerator workout={sampleWorkout3} />
          </div>
        </div>

        {/* Instructions */}
        <div className="border-t pt-8 mt-8">
          <h3 className="text-lg font-semibold mb-2">Testing Instructions:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Click any "Download Story Image" button below each test case</li>
            <li>Wait for the image to be generated (you'll see a "Generating..." state)</li>
            <li>The image will automatically download to your Downloads folder</li>
            <li>Open the downloaded PNG file to verify:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Space Grotesk font is rendering correctly (not fallback fonts)</li>
                <li>Logo appears properly</li>
                <li>All text is crisp and readable</li>
                <li>Background gradients render smoothly</li>
                <li>Aspect ratio is 4:5 (1080x1350px) for Instagram Stories</li>
              </ul>
            </li>
          </ol>
        </div>

        {/* Visual Preview Info */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
            📌 Note about preview:
          </h3>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            The actual image card is positioned off-screen (at -9999px) so it won't interfere with the page layout.
            You won't see a visual preview on this page - the image is only generated when you click the download button.
            This is the standard approach for html2canvas to avoid layout conflicts.
          </p>
        </div>
      </div>
    </div>
  );
}
