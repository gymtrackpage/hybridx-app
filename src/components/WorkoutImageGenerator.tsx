'use client';

import { useRef, useState, useLayoutEffect } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface WorkoutImageGeneratorProps {
  workout: {
    name: string;
    type: string;
    startTime: Date;
    distance?: number;
    calories?: number;
    duration?: string;
    notes?: string;
  };
}

export function WorkoutImageGenerator({ workout }: WorkoutImageGeneratorProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [scale, setScale] = useState<number | null>(null);

  // Measure immediately before paint, then watch for resize
  useLayoutEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) setScale(width / 1080);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const formatDistance = (m?: number) =>
    m ? (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`) : '—';

  const date = new Date(workout.startTime).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  const time = new Date(workout.startTime).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });

  const generate = async () => {
    if (!cardRef.current) return;
    setGenerating(true);

    try {
      await document.fonts.ready;
      const images = Array.from(cardRef.current.getElementsByTagName('img'));
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          });
        })
      );

      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0A0A0A',
        logging: false,
        width: 1080,
        height: 1350,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('workout-card-capture');
          if (el) {
            el.style.fontFamily = "'Space Grotesk', sans-serif";
            // Remove the preview scale transform so html2canvas captures at full resolution
            el.style.transform = 'none';
          }
        }
      });

      const link = document.createElement('a');
      link.download = `hybridx-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      logger.error('Failed to generate image:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full">

      {/* Outer container — measures available width and sets the correct height for the scaled card */}
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-white/10"
        style={{ height: scale ? `${1350 * scale}px` : '0px' }}
      >
        {/* Scale wrapper — visually shrinks the 1080px card to fit, hidden until scale is measured */}
        <div
          style={{
            width: '1080px',
            transformOrigin: 'top left',
            transform: `scale(${scale ?? 0})`,
          }}
        >
          {/* ===== CARD — captured at full 1080×1350 by html2canvas ===== */}
          <div
            ref={cardRef}
            id="workout-card-capture"
            className="relative text-white overflow-hidden bg-[#0A0A0A]"
            style={{
              width: '1080px',
              height: '1350px',
              backgroundImage: `
                linear-gradient(45deg, #111 25%, transparent 25%),
                linear-gradient(-45deg, #111 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #111 75%),
                linear-gradient(-45deg, transparent 75%, #111 75%)
              `,
              backgroundSize: '80px 80px',
              backgroundPosition: '0 0, 0 40px, 40px -40px, -40px 0px',
              fontFamily: 'var(--font-space-grotesk), sans-serif'
            }}
          >
            {/* HEADER */}
            <div className="flex justify-between items-center p-14 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-yellow-500 rounded-2xl flex items-center justify-center p-2">
                  <img
                    src="/icon-logo.png"
                    alt="Logo"
                    className="w-full h-full object-contain"
                    crossOrigin="anonymous"
                  />
                </div>
                <div>
                  <div className="text-4xl font-black tracking-tighter">HYBRIDX.CLUB</div>
                  <div className="text-xl text-yellow-400 font-bold uppercase tracking-widest mt-1">Performance Hub</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-bold">{date}</div>
                <div className="text-xl text-gray-500 font-medium">{time}</div>
              </div>
            </div>

            {/* BADGE */}
            <div className="px-14 mt-4 relative z-10">
              <span className="inline-flex items-center bg-yellow-500 text-black px-8 py-2 rounded-full text-2xl font-black uppercase tracking-tighter">
                {workout.type}
              </span>
            </div>

            {/* TITLE */}
            <div className="px-14 mt-16 relative z-10">
              <h1 className="text-[140px] leading-[0.85] font-black uppercase tracking-tighter text-white">
                {workout.name}
              </h1>
            </div>

            {/* NOTES */}
            {workout.notes && (
              <div className="px-14 mt-12 relative z-10">
                <div className="bg-white/5 border-l-8 border-yellow-500 p-10 backdrop-blur-md">
                  <p className="text-4xl text-gray-200 font-medium leading-relaxed italic">
                    "{workout.notes}"
                  </p>
                </div>
              </div>
            )}

            {/* STATS */}
            <div className="absolute bottom-32 left-0 w-full grid grid-cols-3 border-t border-white/10 bg-black/40 backdrop-blur-sm">
              <div className="p-12 border-r border-white/10">
                <div className="text-2xl text-yellow-500 font-bold uppercase tracking-widest">Duration</div>
                <div className="text-7xl font-black mt-4">{workout.duration ?? '--:--'}</div>
              </div>

              <div className="p-12 border-r border-white/10">
                <div className="text-2xl text-yellow-500 font-bold uppercase tracking-widest">Distance</div>
                <div className="text-7xl font-black mt-4 whitespace-nowrap">{formatDistance(workout.distance)}</div>
              </div>

              <div className="p-12">
                <div className="text-2xl text-yellow-500 font-bold uppercase tracking-widest">Calories</div>
                <div className="text-7xl font-black mt-4">{workout.calories ?? '0'}</div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="absolute bottom-0 w-full bg-yellow-500 text-black py-8 px-14 flex justify-between items-center">
              <div className="text-4xl font-black tracking-tighter">
                HYBRIDX.CLUB
              </div>
              <div className="text-2xl font-black tracking-widest uppercase">
                Train Hybrid. Race Strong.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Download button — full width on mobile */}
      <Button
        onClick={generate}
        disabled={generating}
        size="lg"
        className="w-full h-14 bg-yellow-500 text-black hover:bg-yellow-400 text-lg font-black rounded-2xl transition-all active:scale-95"
      >
        {generating ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            GENERATING IMAGE...
          </>
        ) : (
          <>
            <Download className="h-5 w-5 mr-2" />
            DOWNLOAD WORKOUT CARD
          </>
        )}
      </Button>
    </div>
  );
}
