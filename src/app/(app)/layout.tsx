
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  Shield,
} from 'lucide-react';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { InstallPwaBanner } from '@/components/install-pwa-banner';
import { NotificationPermissionPrompt } from '@/components/notification-permission-prompt';
import { OfflineIndicator } from '@/components/offline-indicator';
import { getUserClient } from '@/services/user-service-client';
import { addMonths, isAfter } from 'date-fns';
import { MobileNavBar, primaryNavItems, secondaryNavItems, adminNavItems } from '@/components/mobile-nav-bar';


function NavMenu() {
    const { setOpenMobile } = useSidebar();
    const pathname = usePathname();

    const handleLinkClick = () => {
        setOpenMobile(false);
    };

    return (
        <>
            <SidebarMenu>
                {primaryNavItems.map((item) => (
                    // Hide the central workout button from the sidebar list
                    !item.isCentral && (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton asChild tooltip={item.label} isActive={pathname.startsWith(item.href)}>
                                <Link href={item.href} onClick={handleLinkClick}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )
                ))}
            </SidebarMenu>
            <SidebarSeparator />
            <SidebarMenu>
                 {secondaryNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild tooltip={item.label} isActive={pathname.startsWith(item.href)}>
                            <Link href={item.href} onClick={handleLinkClick}>
                                <item.icon />
                                <span>{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
            <SidebarSeparator />
            <SidebarMenu>
                {adminNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild tooltip={item.label} isActive={pathname.startsWith(item.href)}>
                            <Link href={item.href} onClick={handleLinkClick}>
                                <item.icon />
                                <span>{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Debug" isActive={pathname.startsWith('/debug')}>
                        <Link href="/debug" onClick={handleLinkClick}>
                            <Shield />
                            <span>Debug</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const initialize = async () => {
        const auth = await getAuthInstance();

        // CRITICAL FIX: Wait for Firebase to restore session from IndexedDB
        // This prevents the race condition where the layout redirects before auth is ready.
        if (typeof auth.authStateReady === 'function') {
            await auth.authStateReady();
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                console.log('✅ [Layout] User authenticated:', currentUser.email);
                setUser(currentUser);

                const appUser = await getUserClient(currentUser.uid);
                if (appUser && !appUser.isAdmin && pathname !== '/subscription') {
                    const status = appUser.subscriptionStatus || 'trial';
                    const trialStart = appUser.trialStartDate;
                    const trialEnded = trialStart ? isAfter(new Date(), addMonths(new Date(trialStart), 1)) : true;

                    if (status === 'trial' && trialEnded) {
                        router.push('/subscription');
                    } else if (!['trial', 'active', 'paused'].includes(status)) {
                        router.push('/subscription');
                    }
                }
            } else {
                console.log('❌ [Layout] No authenticated user, redirecting to login');
                router.push('/login');
            }
            setLoading(false);
        });
        return unsubscribe;
    };

    let unsubscribe: () => void;
    initialize().then(unsub => unsubscribe = unsub);

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [router, pathname]);

  const handleLogout = async () => {
    try {
      const auth = await getAuthInstance();
      await signOut(auth);

      // CRITICAL FIX: Clear session cookie on logout via API
      await fetch('/api/auth/session', {
        method: 'DELETE',
        credentials: 'include',
      });
      console.log('🧹 Session cookie cleared on logout');

      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo className="h-8 w-8 text-primary" />
            <span className="text-lg font-semibold font-headline">HYBRIDX.CLUB</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
            <NavMenu />
        </SidebarContent>
        <SidebarFooter>
          <div className="flex w-full items-center justify-between p-2">
            {loading ? (
                <div className="flex items-center gap-2 w-full">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                </div>
            ) : user ? (
                <div className="flex items-center gap-2 overflow-hidden">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium">{user.email}</span>
                </div>
            ) : null}
            <Button variant="ghost" size="icon" onClick={handleLogout} className="flex-shrink-0">
                <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                 <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
                    <Logo className="h-6 w-6 text-primary" />
                    <span className="font-bold text-md font-headline">HYBRIDX.CLUB</span>
                </Link>
            </div>
            <div className="w-full flex-1">
                {/* Header content can go here, like breadcrumbs */}
            </div>
        </header>

        {/* Offline Indicator */}
        <OfflineIndicator />

        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-28 md:pb-6">{children}</main>

        {/* PWA Banner for Desktop */}
        <div className="hidden md:block">
            <InstallPwaBanner />
        </div>

        {/* Notification Permission Prompt */}
        <NotificationPermissionPrompt />

         {/* Mobile Nav Bar for smaller screens */}
        <div className="md:hidden">
          <MobileNavBar />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
