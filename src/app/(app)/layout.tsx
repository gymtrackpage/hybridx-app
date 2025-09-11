
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Shield,
  BookOpenCheck,
  User as UserIcon,
  CreditCard,
  Zap,
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
import { getUserClient } from '@/services/user-service-client';
import { addMonths, isAfter } from 'date-fns';


const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/assistant', icon: MessageSquare, label: 'AI Assistant' },
  { href: '/activity-feed', icon: Zap, label: 'Activity Feed' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/programs', icon: BookOpenCheck, label: 'Programs' },
  { href: '/profile', icon: UserIcon, label: 'Profile' },
  { href: '/subscription', icon: CreditCard, label: 'Subscription' },
];

const adminNavItems = [
    { href: '/admin/programs', icon: Shield, label: 'Manage Programs' },
];

function NavMenu() {
    const { setOpenMobile } = useSidebar();
    const pathname = usePathname();

    const handleLinkClick = () => {
        setOpenMobile(false);
    };

    return (
        <>
            <SidebarMenu>
                {navItems.map((item) => (
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
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
            setUser(currentUser);
            // Subscription check logic
            const appUser = await getUserClient(currentUser.uid);
            if (appUser && !appUser.isAdmin && pathname !== '/subscription') {
                const status = appUser.subscriptionStatus || 'trial';
                const trialStart = appUser.trialStartDate;
                const trialEnded = trialStart ? isAfter(new Date(), addMonths(trialStart, 1)) : true;

                if (status === 'trial' && trialEnded) {
                    router.push('/subscription');
                } else if (!['trial', 'active'].includes(status)) {
                    router.push('/subscription');
                }
            }

        } else {
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
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
      router.push('/login');
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
        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-28">{children}</main>
        <InstallPwaBanner />
      </SidebarInset>
    </SidebarProvider>
  );
}
