import Image from 'next/image';
import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  // The className is passed to control size via Tailwind (e.g., h-8 w-8)
  // The parent element should be a flex container to center the logo if needed.
  // The component itself doesn't apply sizing, it relies on the passed className.
  return (
    <Image 
      src="/icon-logo.png" 
      alt="HYBRIDX.CLUB Logo" 
      width={100} // Intrinsic width, actual size controlled by className
      height={100} // Intrinsic height, actual size controlled by className
      className={cn("dark:invert", className)}
      priority // Preload logo as it's likely LCP
    />
  );
}

export function CustomWorkoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
        width="67" 
        height="50" 
        viewBox="0 0 66.02 49.8" 
        xmlns="http://www.w3.org/2000/svg" 
        fill="currentColor"
        {...props}
    >
      <g>
        <path d="M34.34,17.91 L33.01,16.57 L16.55,0 L0,0 L23.01,23.16C23.97,24.12 23.97,25.68 23.01,26.65 L0,49.8 L16.55,49.8 L33.01,33.23 L34.34,31.89C38.18,28.02 38.18,21.78 34.34,17.91Z"/>
        <path d="M51.83,14.3 L66.02,0 L49.47,0 L35.28,14.3C39.84,18.89 47.26,18.89 51.82,14.3Z"/>
        <path d="M35.28,35.5 L49.47,49.8 L66.02,49.8 L51.82,35.5C47.26,30.91 39.84,30.91 35.28,35.5Z"/>
      </g>
    </svg>
  );
}
