
'use client';
import { logger } from '@/lib/logger';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface WorkoutImageGeneratorProps {
  workout: {
    name: string;
    type: string;
    distance?: number;
    calories?: number;
    startTime: Date;
    notes?: string;
    duration?: string;
  };
}

export function WorkoutImageGenerator({ workout }: WorkoutImageGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // --- Derived Variables ---
  const formatDistance = (meters?: number): string | null => {
    if (!meters) return null;
    return meters >= 1000
      ? `${(meters / 1000).toFixed(2)} km`
      : `${meters} m`;
  };

  const distance = formatDistance(workout.distance);

  const date = new Date(workout.startTime).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const time = new Date(workout.startTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const generateImage = async () => {
    if (!cardRef.current) return;
    setGenerating(true);

    try {
      // Step 1: Font Loading
      await document.fonts.ready;
      if ('fonts' in document) {
        try {
          await document.fonts.load('400 16px "Space Grotesk"');
          await document.fonts.load('700 16px "Space Grotesk"');
        } catch (fontError) {
          logger.error('Font loading failed:', fontError);
        }
      }

      // Step 2: Image Preloading
      const logoImg = new Image();
      logoImg.src = '/icon-logo.png';
      await new Promise((resolve) => {
        if (logoImg.complete) resolve(true);
        logoImg.onload = () => resolve(true);
        logoImg.onerror = () => resolve(true); // Fail gracefully
      });

      // Step 3: Canvas Generation
      const canvas = await html2canvas(cardRef.current, {
        width: 1080,
        height: 1350,
        scale: 2,
        backgroundColor: '#0A0A0A',
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      // Export (Download)
      const link = document.createElement('a');
      link.download = `hybridx-workout-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

    } catch (err) {
      logger.error('Error generating workout image:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      {/* --- PREVIEW CONTAINER --- */}
      <div className="overflow-hidden shadow-2xl rounded-lg border border-gray-800">
        <div
          ref={cardRef}
          className="relative bg-[#0A0A0A] text-white flex flex-col"
          style={{
            width: '1080px',
            height: '1350px',
            fontFamily: 'var(--font-space-grotesk), "Space Grotesk", sans-serif',
            // Simple grid pattern background for the "Blueprint" vibe
            backgroundImage: `
              linear-gradient(to right, #1a1a1a 1px, transparent 1px),
              linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        >
          {/* Top Bar / Branding */}
          <div className="flex justify-between items-center p-12 border-b-2 border-white/10">
            <div className="flex items-center gap-4">
              <img
                src="/icon-logo.png"
                alt="HybridX"
                className="w-16 h-16 object-contain"
                crossOrigin="anonymous"
              />
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-wider uppercase">HybridX.Club</span>
                <span className="text-xl text-gray-400">Performance Hub</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-medium text-gray-300">{date}</div>
              <div className="text-xl text-gray-500">{time}</div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col justify-center px-12 relative">
            {/* Background Accent Gradient (Subtle Glow) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[100px] rounded-full pointer-events-none" />

            {/* Workout Type Badge */}
            <div className="mb-6 relative z-10">
              <span className="inline-block px-6 py-2 border border-white/30 text-2xl font-bold tracking-widest uppercase rounded-full">
                {workout.type}
              </span>
            </div>

            {/* Workout Name */}
            <h1 className="text-8xl font-bold leading-tight uppercase mb-8 relative z-10">
              {workout.name}
            </h1>

            {/* Notes Section (Visualized as 'Terminal/Data' output) */}
            {workout.notes && (
              <div className="mt-8 p-8 bg-white/5 border-l-4 border-white/20 relative z-10">
                <p className="text-3xl text-gray-300 italic">
                  "{workout.notes}"
                </p>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 border-t-2 border-white/10">
            {/* Duration Stat */}
            <div className="p-12 border-r-2 border-white/10 flex flex-col justify-center">
              <span className="text-2xl text-gray-500 uppercase tracking-widest mb-2">Duration</span>
              <span className="text-8xl font-bold tabular-nums">
                {workout.duration || "--:--"}
              </span>
            </div>

            {/* Distance Stat */}
            <div className="p-12 flex flex-col justify-center">
              <span className="text-2xl text-gray-500 uppercase tracking-widest mb-2">Distance</span>
              <span className="text-8xl font-bold tabular-nums">
                {distance || "---"}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="p-8 bg-white text-black flex justify-between items-center">
            <span className="text-2xl font-bold tracking-tighter">HYBRIDX.CLUB</span>
            <span className="text-xl font-medium uppercase tracking-widest">Train Hybrid. Race Strong.</span>
          </div>
        </div>
      </div>

      {/* Control Button */}
      <Button
        onClick={generateImage}
        disabled={generating}
        className="px-8 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition disabled:opacity-50"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download Image
          </>
        )}
      </Button>
    </div>
  );
}
