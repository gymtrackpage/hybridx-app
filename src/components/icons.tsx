import Image from 'next/image';

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
      className={className}
      priority // Preload logo as it's likely LCP
    />
  );
}
