'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ADMIN_NAV, findActiveItem, type AdminNavItem } from './nav-items';

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // min-h-11 keeps every row at a comfortable thumb target on a phone,
        // where these were previously default-height buttons.
        'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
        'touch-manipulation active:scale-[0.99]',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavSections({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const active = findActiveItem(pathname);

  return (
    <div className="space-y-4">
      {ADMIN_NAV.map((section) => {
        const SectionIcon = section.icon;
        return (
          <div key={section.label} className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <SectionIcon className="h-3.5 w-3.5" />
              {section.label}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={active?.href === item.href}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Persistent sidebar — desktop only. */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-56 shrink-0 border-r bg-muted/10 p-3 md:block lg:w-64">
      <div className="sticky top-20">
        <NavSections pathname={pathname} />
      </div>
    </nav>
  );
}

/**
 * Mobile navigation: a drawer behind a hamburger, plus the current section's
 * name in the header so the page is always self-identifying.
 *
 * The 256px sidebar this replaces left roughly a third of a phone screen for
 * the actual content, which is what made the panel unusable on mobile.
 */
export function AdminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = findActiveItem(pathname);

  // Navigating closes the drawer; without this it stays open over the page it
  // just moved to.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-w-0 items-center gap-2 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Admin menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] overflow-y-auto p-0">
          <SheetHeader className="border-b p-4 text-left">
            <SheetTitle>Admin</SheetTitle>
          </SheetHeader>
          <div className="p-3">
            <NavSections pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t p-3">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/dashboard">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <span className="truncate text-sm font-semibold">{active?.label ?? 'Admin'}</span>
    </div>
  );
}
