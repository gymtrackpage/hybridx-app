// src/components/mobile-nav-bar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, User, BookOpenCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomWorkoutIcon } from './icons';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/workout/active', icon: CustomWorkoutIcon, label: 'Workout', isCentral: true },
  { href: '/programs', icon: BookOpenCheck, label: 'Programs' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function MobileNavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          
          if (item.isCentral) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-6 flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full bg-accent text-accent-foreground shadow-lg"
              >
                <item.icon className="h-6 w-6" />
                <span className="text-xs font-bold">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-primary',
                isActive && 'text-primary'
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
