
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
    duration?: string; // New optional duration
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
      // Wait for images to load
      const logoImg = new Image();
      logoImg.src = '/icon-logo.png';
      await new Promise((resolve) => {
          if (logoImg.complete) resolve(true);
          logoImg.onload = () => resolve(true);
          logoImg.onerror = () => resolve(true); // Proceed even if logo fails
      });

      const canvas = await html2canvas(cardRef.current, {
        width: 1080,
        height: 1350, // Portrait ratio 4:5 for Instagram/Socials
        scale: 2,
        backgroundColor: '#0A0A0A', // Ensuring a dark background
        useCORS: true,
        logging: false,
        allowTaint: true,
      });
      
      const link = document.createElement('a');
      link.download = `hybridx_${workout.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      
    } catch (error) {
      logger.error('Error generating image:', error);
    } finally {
      setGenerating(false);
    }
  };

  const distance = formatDistance(workout.distance);
  const date = new Date(workout.startTime).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-4">
       <div 
        ref={cardRef}
        className="fixed -left-[9999px] top-0"
        style={{
            width: '1080px',
            height: '1350px', // 4:5 Aspect Ratio
            background: '#0A0A0A',
            fontFamily: '"Space Grotesk", sans-serif',
            color: '#FFFFFF',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}
        >
            {/* Dynamic Background Elements */}
            <div style={{
                position: 'absolute',
                top: '-20%',
                right: '-20%',
                width: '800px',
                height: '800px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255, 193, 7, 0.15) 0%, rgba(10, 10, 10, 0) 70%)',
                filter: 'blur(60px)',
                zIndex: 0,
            }} />
            
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                left: '-10%',
                width: '600px',
                height: '600px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, rgba(10, 10, 10, 0) 70%)',
                filter: 'blur(40px)',
                zIndex: 0,
            }} />

            {/* Content Container */}
            <div style={{
                position: 'relative',
                zIndex: 1,
                height: '100%',
                padding: '80px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
            }}>
                
                {/* Header */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    paddingBottom: '40px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: '#FFC107',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 20px rgba(255, 193, 7, 0.3)'
                        }}>
                             <img src="/icon-logo.png" style={{ width: '48px', height: '48px', filter: 'brightness(0)' }} alt="Logo" />
                        </div>
                        <div>
                            <div style={{ fontSize: '32px', fontWeight: '700', lineHeight: '1', letterSpacing: '-0.5px' }}>
                                HYBRIDX
                            </div>
                            <div style={{ fontSize: '18px', color: '#FFC107', letterSpacing: '2px', fontWeight: '600', marginTop: '4px' }}>
                                CLUB
                            </div>
                        </div>
                    </div>
                    <div style={{
                        border: '1px solid rgba(255, 193, 7, 0.3)',
                        background: 'rgba(255, 193, 7, 0.1)',
                        color: '#FFC107',
                        padding: '12px 24px',
                        borderRadius: '100px',
                        fontSize: '20px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        {workout.type}
                    </div>
                </div>

                {/* Main Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '40px' }}>
                    <div>
                        <div style={{
                            display: 'inline-block',
                            fontSize: '20px',
                            fontWeight: '600',
                            color: 'rgba(255,255,255,0.6)',
                            marginBottom: '16px',
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                        }}>
                            {date}
                        </div>
                        <h1 style={{
                            fontSize: '96px',
                            fontWeight: '800',
                            lineHeight: '0.95',
                            textTransform: 'uppercase',
                            margin: 0,
                            backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #AAAAAA 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-2px'
                        }}>
                            {workout.name}
                        </h1>
                    </div>

                    {/* Stats Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '30px',
                        marginTop: '20px'
                    }}>
                        {workout.duration && (
                            <div style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '24px',
                                padding: '32px'
                            }}>
                                <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Time</div>
                                <div style={{ fontSize: '56px', fontWeight: '700', color: '#FFC107' }}>{workout.duration}</div>
                            </div>
                        )}
                        
                        {distance ? (
                            <div style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '24px',
                                padding: '32px'
                            }}>
                                <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Distance</div>
                                <div style={{ fontSize: '56px', fontWeight: '700', color: '#FFC107' }}>{distance}</div>
                            </div>
                        ) : (
                             <div style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '24px',
                                padding: '32px'
                            }}>
                                <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Effort</div>
                                <div style={{ fontSize: '56px', fontWeight: '700', color: '#FFC107' }}>HIGH</div>
                            </div>
                        )}
                    </div>

                    {workout.notes && (
                        <div style={{
                            marginTop: '20px',
                            paddingLeft: '30px',
                            borderLeft: '4px solid #FFC107',
                        }}>
                            <p style={{
                                fontSize: '28px',
                                lineHeight: '1.4',
                                color: 'rgba(255,255,255,0.9)',
                                fontFamily: '"Inter", sans-serif',
                                fontStyle: 'italic',
                                margin: 0,
                                display: '-webkit-box',
                                WebkitLineClamp: '3',
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}>
                                "{workout.notes}"
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ 
                    paddingTop: '40px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end'
                }}>
                    <div>
                        <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Train Smarter</div>
                        <div style={{ fontSize: '24px', fontWeight: '700' }}>APP.HYBRIDX.CLUB</div>
                    </div>
                    
                    {/* Abstract decorative element */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[100, 70, 40, 100, 60, 90].map((h, i) => (
                            <div key={i} style={{
                                width: '8px',
                                height: `${h}%`,
                                background: i % 2 === 0 ? '#FFC107' : 'rgba(255,255,255,0.2)',
                                borderRadius: '4px'
                            }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
        
        <Button 
            onClick={generateImage} 
            disabled={generating}
            className="w-full bg-[#FFC107] text-black hover:bg-[#E0A800]"
        >
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {generating ? 'Generating...' : 'Download Story Image'}
        </Button>
    </div>
  );
}
