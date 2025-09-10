'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Image as ImageIcon } from 'lucide-react';
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
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true
      });
      
      // Download the image
      const link = document.createElement('a');
      link.download = `${workout.name}-hybridx.png`;
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
            Workout Image
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={generateImage} 
            disabled={generating}
            className="mb-4"
          >
            <Download className="h-4 w-4 mr-2" />
            {generating ? 'Generating...' : 'Download Image'}
          </Button>
          
          {/* This is the hidden card that gets converted to image */}
          <div 
            ref={cardRef}
            className="hidden"
            style={{
              width: '1200px',
              height: '630px',
              position: 'relative',
              background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
              fontFamily: '"Space Grotesk", system-ui, sans-serif'
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
            
            {/* Logo */}
            <div style={{
              position: 'absolute',
              top: '40px',
              left: '50px',
              fontSize: '32px',
              fontWeight: '700',
              color: '#000000'
            }}>
              HYBRID<span style={{ color: '#FFD700' }}>X</span>
            </div>
            
            {/* Tagline */}
            <div style={{
              position: 'absolute',
              top: '75px',
              left: '50px',
              fontSize: '16px',
              color: '#666666',
              letterSpacing: '1px'
            }}>
              STOP TRAINING BLIND
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
              {/* Title */}
              <h1 style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#000000',
                marginBottom: '20px',
                lineHeight: '1.1'
              }}>
                {workout.name}
              </h1>
              
              {/* Type badge */}
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
              
              {/* Stats */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '80px',
                marginBottom: '30px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '700',
                    color: '#000000'
                  }}>
                    {formatDuration(workout.duration)}
                  </div>
                  <div style={{
                    fontSize: '16px',
                    color: '#666666',
                    marginTop: '8px',
                    textTransform: 'uppercase'
                  }}>
                    Duration
                  </div>
                </div>
                
                {distance && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '36px',
                      fontWeight: '700',
                      color: '#000000'
                    }}>
                      {distance}
                    </div>
                    <div style={{
                      fontSize: '16px',
                      color: '#666666',
                      marginTop: '8px',
                      textTransform: 'uppercase'
                    }}>
                      Distance
                    </div>
                  </div>
                )}
                
                {workout.calories && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '36px',
                      fontWeight: '700',
                      color: '#000000'
                    }}>
                      {workout.calories}
                    </div>
                    <div style={{
                      fontSize: '16px',
                      color: '#666666',
                      marginTop: '8px',
                      textTransform: 'uppercase'
                    }}>
                      Calories
                    </div>
                  </div>
                )}
              </div>
              
              {/* Date */}
              <div style={{
                fontSize: '18px',
                color: '#666666'
              }}>
                {date}
              </div>
            </div>
            
            {/* Bottom branding */}
            <div style={{
              position: 'absolute',
              bottom: '50px',
              left: '50px',
              width: '150px',
              height: '4px',
              background: '#FFD700'
            }} />
            
            <div style={{
              position: 'absolute',
              bottom: '30px',
              left: '50px',
              fontSize: '14px',
              color: '#cccccc',
              textTransform: 'uppercase'
            }}>
              hybridx.club
            </div>
          </div>
          
          {/* Preview version */}
          <div className="mt-4 border rounded-lg p-4 bg-gradient-to-br from-white to-gray-50">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-2xl">
                  HYBRID<span className="text-yellow-500">X</span>
                </div>
                <div className="text-sm text-gray-500">STOP TRAINING BLIND</div>
              </div>
              
              <h2 className="text-3xl font-bold">{workout.name}</h2>
              
              <div className="inline-block bg-yellow-400 text-black px-4 py-2 rounded-full font-bold uppercase text-sm">
                {workout.type}
              </div>
              
              <div className="flex justify-center gap-8 text-center">
                <div>
                  <div className="text-2xl font-bold">{formatDuration(workout.duration)}</div>
                  <div className="text-sm text-gray-500 uppercase">Duration</div>
                </div>
                {distance && (
                  <div>
                    <div className="text-2xl font-bold">{distance}</div>
                    <div className="text-sm text-gray-500 uppercase">Distance</div>
                  </div>
                )}
                {workout.calories && (
                  <div>
                    <div className="text-2xl font-bold">{workout.calories}</div>
                    <div className="text-sm text-gray-500 uppercase">Calories</div>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-500">{date}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
