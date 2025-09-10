// src/app/api/generate-workout-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, registerFont } from 'canvas';
import path from 'path';

// Register fonts (assuming they are in public/fonts)
try {
  const fontPath = path.join(process.cwd(), 'src', 'fonts');
  registerFont(path.join(fontPath, 'SpaceGrotesk-Bold.ttf'), { family: 'Space Grotesk', weight: 'bold' });
  registerFont(path.join(fontPath, 'SpaceGrotesk-Medium.ttf'), { family: 'Space Grotesk', weight: 'normal' });
  console.log('Fonts registered successfully.');
} catch (error) {
  console.warn('Could not load local fonts. Using system fallback fonts.', error);
}

interface WorkoutData {
  name: string;
  type: string;
  duration: number; // in seconds
  distance?: number; // in meters
  calories?: number;
  date: string;
  notes?: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDistance(meters?: number): string | null {
  if (meters === undefined || meters === null) return null;
  const km = meters / 1000;
  return km >= 1 ? `${km.toFixed(1)} km` : `${meters.toFixed(0)} m`;
}

async function generateWorkoutImage(workout: WorkoutData): Promise<Buffer> {
  const width = 1200;
  const height = 630;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const colors = {
    primary: '#000000',
    accent: '#FFD700',
    background: '#FFFFFF',
    text: '#333333',
    lightGray: '#F5F5F5',
    mediumGray: '#CCCCCC'
  };

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors.background);
  gradient.addColorStop(1, colors.lightGray);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.03;
  for (let i = 0; i < width; i += 40) {
    for (let j = 0; j < height; j += 40) {
      ctx.fillStyle = colors.primary;
      ctx.fillRect(i, j, 2, 2);
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 32px "Space Grotesk", Arial, sans-serif';
  ctx.fillText('HYBRID', 50, 60);
  
  const hybridWidth = ctx.measureText('HYBRID').width;
  ctx.fillStyle = colors.accent;
  ctx.fillText('X', 50 + hybridWidth, 60);

  ctx.fillStyle = colors.text;
  ctx.font = '16px "Space Grotesk", Arial, sans-serif';
  ctx.fillText('STOP TRAINING BLIND', 50, 85);

  ctx.fillStyle = colors.primary;
  let fontSize = 60;
  ctx.font = `bold ${fontSize}px "Space Grotesk", Arial, sans-serif`;
  const maxTitleWidth = width - 100;
  while (ctx.measureText(workout.name).width > maxTitleWidth && fontSize > 24) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px "Space Grotesk", Arial, sans-serif`;
  }
  const titleMetrics = ctx.measureText(workout.name);
  const titleX = (width - titleMetrics.width) / 2;
  ctx.fillText(workout.name, titleX, 220);

  const badgeY = 260;
  const badgeHeight = 40;
  const typeText = workout.type.toUpperCase();
  ctx.font = 'bold 18px "Space Grotesk", Arial, sans-serif';
  const badgeWidth = ctx.measureText(typeText).width + 40;
  const badgeX = (width - badgeWidth) / 2;

  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 20);
  ctx.fill();

  ctx.fillStyle = colors.primary;
  const typeMetrics = ctx.measureText(typeText);
  ctx.fillText(typeText, badgeX + (badgeWidth - typeMetrics.width) / 2, badgeY + 26);

  const statsY = 380;
  const stats: { label: string; value: string | null }[] = [
    { label: 'DURATION', value: formatDuration(workout.duration) },
    { label: 'DISTANCE', value: formatDistance(workout.distance) },
    { label: 'CALORIES', value: workout.calories ? workout.calories.toString() : null },
  ].filter(s => s.value !== null);

  const totalStatWidth = stats.reduce((acc, stat) => {
    ctx.font = 'bold 48px "Space Grotesk", Arial, sans-serif';
    return acc + ctx.measureText(stat.value!).width;
  }, 0) + (stats.length - 1) * 150;

  let currentX = (width - totalStatWidth) / 2;

  stats.forEach((stat, index) => {
    ctx.fillStyle = colors.primary;
    ctx.font = 'bold 48px "Space Grotesk", Arial, sans-serif';
    ctx.fillText(stat.value!, currentX, statsY);
    
    ctx.fillStyle = colors.text;
    ctx.font = '16px "Space Grotesk", Arial, sans-serif';
    ctx.fillText(stat.label, currentX, statsY + 30);
    
    currentX += ctx.measureText(stat.value!).width + 150;
  });

  ctx.fillStyle = colors.text;
  ctx.font = '18px "Space Grotesk", Arial, sans-serif';
  const date = new Date(workout.date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const dateMetrics = ctx.measureText(date);
  ctx.fillText(date, (width - dateMetrics.width) / 2, 500);

  ctx.fillStyle = colors.mediumGray;
  ctx.font = '14px "Space Grotesk", Arial, sans-serif';
  ctx.fillText('HYBRIDX.CLUB', 50, height - 30);
  
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(50, height - 50);
  ctx.lineTo(200, height - 50);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

export async function POST(req: NextRequest) {
  try {
    const workoutData: WorkoutData = await req.json();
    const imageBuffer = await generateWorkoutImage(workoutData);
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating workout image:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
