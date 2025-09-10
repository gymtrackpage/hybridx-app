'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface WorkoutImageGeneratorProps {
  workout: {
    name: string;
    type: string;
    duration: number;
    distance?: number;
    calories?: number;
    startTime: Date;
    notes?: string;
  };
}

export function WorkoutImageGenerator({ workout }: WorkoutImageGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters?: number): string | null => {
    if (!meters) return null;
    const km = meters / 1000;
    return km >= 1 ? `${km.toFixed(1)} km` : `${meters.toFixed(0)} m`;
  };

  const generateImage = async () => {
    if (!cardRef.current) return;
    
    setGenerating(true);
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        width: 1200,
        height: 630,
        scale: 1, // Use scale 1 for better performance, size is already large
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false, // Turn off logging for cleaner console
      });
      
      const link = document.createElement('a');
      link.download = `${workout.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_hybridx.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setGenerating(false);
    }
  };

  const distance = formatDistance(workout.distance);
  const date = workout.startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Social Image
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* This is the hidden card that gets converted to image */}
          <div 
            ref={cardRef}
            className="fixed -left-[9999px] top-0" // ** FIX: Position off-screen instead of hiding **
            style={{
              width: '1200px',
              height: '630px',
              background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              padding: '40px 50px',
              boxSizing: 'border-box'
            }}
          >
            {/* Pattern overlay */}
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0.03,
                backgroundImage: 'radial-gradient(circle at 20px 20px, #000 2px, transparent 2px)',
                backgroundSize: '40px 40px'
              }}
            />
            
            {/* Logo & Tagline */}
            <div style={{ position: 'absolute', top: '40px', left: '50px' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#000000' }}>
                HYBRID<span style={{ color: '#FFD700' }}>X</span>
                </div>
                <div style={{ fontSize: '16px', color: '#666666', letterSpacing: '1px', marginTop: '4px' }}>
                STOP TRAINING BLIND
                </div>
            </div>
            
            {/* Main content */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              width: '90%'
            }}>
              <h1 style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#000000',
                marginBottom: '20px',
                lineHeight: '1.1'
              }}>
                {workout.name}
              </h1>
              
              <div style={{
                display: 'inline-block',
                background: '#FFD700',
                color: '#000000',
                padding: '12px 24px',
                borderRadius: '25px',
                fontSize: '18px',
                fontWeight: '700',
                marginBottom: '40px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {workout.type}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '80px', marginBottom: '30px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '36px', fontWeight: '700', color: '#000000' }}>
                    {formatDuration(workout.duration)}
                  </div>
                  <div style={{ fontSize: '16px', color: '#666666', marginTop: '8px', textTransform: 'uppercase' }}>
                    Duration
                  </div>
                </div>
                
                {distance && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', fontWeight: '700', color: '#000000' }}>{distance}</div>
                    <div style={{ fontSize: '16px', color: '#666666', marginTop: '8px', textTransform: 'uppercase' }}>Distance</div>
                  </div>
                )}
                
                {workout.calories && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', fontWeight: '700', color: '#000000' }}>{workout.calories}</div>
                    <div style={{ fontSize: '16px', color: '#666666', marginTop: '8px', textTransform: 'uppercase' }}>Calories</div>
                  </div>
                )}
              </div>
              
              <div style={{ fontSize: '18px', color: '#666666' }}>{date}</div>
            </div>
            
            {/* Bottom branding */}
            <div style={{ position: 'absolute', bottom: '50px', left: '50px', width: '150px', height: '4px', background: '#FFD700' }} />
            <div style={{ position: 'absolute', bottom: '30px', left: '50px', fontSize: '14px', color: '#cccccc', textTransform: 'uppercase' }}>
              hybridx.club
            </div>
          </div>
          
          {/* Preview version visible to the user */}
          <div className="border rounded-lg p-4 bg-gradient-to-br from-white to-gray-50 aspect-[1200/630] w-full">
            <div className="text-center space-y-2 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                    <div className="font-bold text-lg md:text-2xl">
                    HYBRID<span className="text-yellow-500">X</span>
                    </div>
                    <div className="text-xs text-gray-500 hidden md:block">STOP TRAINING BLIND</div>
                </div>
                
                <div className="flex-grow flex flex-col justify-center">
                    <h2 className="text-xl md:text-3xl font-bold">{workout.name}</h2>
                    
                    <div className="inline-block bg-yellow-400 text-black px-3 py-1 md:px-4 md:py-2 rounded-full font-bold uppercase text-xs md:text-sm my-2 self-center">
                        {workout.type}
                    </div>
                    
                    <div className="flex justify-center gap-4 md:gap-8 text-center my-2">
                        <div>
                        <div className="text-lg md:text-2xl font-bold">{formatDuration(workout.duration)}</div>
                        <div className="text-xs text-gray-500 uppercase">Duration</div>
                        </div>
                        {distance && (
                        <div>
                            <div className="text-lg md:text-2xl font-bold">{distance}</div>
                            <div className="text-xs text-gray-500 uppercase">Distance</div>
                        </div>
                        )}
                        {workout.calories && (
                        <div>
                            <div className="text-lg md:text-2xl font-bold">{workout.calories}</div>
                            <div className="text-xs text-gray-500 uppercase">Calories</div>
                        </div>
                        )}
                    </div>
                </div>
              
              <div className="text-xs md:text-sm text-gray-500">{date}</div>
            </div>
          </div>
          
           <Button 
            onClick={generateImage} 
            disabled={generating}
            className="mt-4 w-full"
            variant="outline"
          >
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {generating ? 'Generating...' : 'Download Image'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
