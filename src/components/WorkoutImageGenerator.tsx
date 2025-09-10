'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Logo } from './icons';

interface WorkoutImageGeneratorProps {
  workout: {
    name: string;
    type: string;
    distance?: number;
    calories?: number;
    startTime: Date;
    notes?: string;
  };
}

export function WorkoutImageGenerator({ workout }: WorkoutImageGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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
        width: 1080, // Instagram post size
        height: 1080,
        scale: 2, // Higher scale for better quality
        backgroundColor: null, // Use the element's background
        useCORS: true,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `${workout.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_hybridx.png`;
      link.href = canvas.toDataURL('image/png', 0.95);
      link.click();
      
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setGenerating(false);
    }
  };

  const distance = formatDistance(workout.distance);
  const date = new Date(workout.startTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).toUpperCase();

  return (
    <div className="space-y-4">
       {/* This is the hidden card that gets converted to image */}
       <div 
        ref={cardRef}
        className="fixed -left-[9999px] top-0"
        style={{
            width: '1080px',
            height: '1080px',
            background: 'linear-gradient(135deg, #1A1A1A 0%, #0D0D0D 100%)',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            color: '#FFFFFF',
            padding: '60px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
        }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="/icon-logo.png" style={{ width: '48px', height: '48px', filter: 'invert(1)' }} alt="Logo" />
                    <div style={{ fontSize: '28px', fontWeight: '700' }}>
                        HYBRIDX.CLUB
                    </div>
                </div>
                <div style={{
                    background: '#FAFAD2',
                    color: '#1A1A1A',
                    padding: '8px 20px',
                    borderRadius: '20px',
                    fontSize: '20px',
                    fontWeight: '700',
                    textTransform: 'uppercase'
                }}>
                    {workout.type}
                </div>
            </div>

            {/* Main Content */}
            <div style={{ textAlign: 'left', width: '100%' }}>
                 <div style={{
                    fontSize: '24px',
                    color: '#E0F8F8',
                    letterSpacing: '1px',
                    marginBottom: '10px',
                    textTransform: 'uppercase'
                }}>
                   {date}
                </div>
                <h1 style={{
                    fontSize: '100px',
                    fontWeight: '700',
                    lineHeight: '1.05',
                    margin: 0,
                    maxWidth: '90%',
                    textTransform: 'uppercase',
                }}>
                    {workout.name}
                </h1>
            </div>

            {/* Footer Stats */}
             <div style={{
                width: '100%',
                borderTop: '2px solid rgba(255, 255, 255, 0.2)',
                paddingTop: '40px',
                display: 'flex',
                justifyContent: 'flex-start',
                gap: '80px',
            }}>
                {distance && (
                    <div>
                        <div style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', marginBottom: '8px' }}>Distance</div>
                        <div style={{ fontSize: '56px', fontWeight: '700' }}>{distance}</div>
                    </div>
                )}
                 {workout.calories && (
                    <div>
                        <div style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', marginBottom: '8px' }}>Calories</div>
                        <div style={{ fontSize: '56px', fontWeight: '700' }}>{workout.calories}</div>
                    </div>
                )}
            </div>
        </div>
        
        {/* User-visible button */}
        <Button 
            onClick={generateImage} 
            disabled={generating}
            className="w-full"
            variant="outline"
        >
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {generating ? 'Generating...' : 'Download Social Image'}
        </Button>
    </div>
  );
}
