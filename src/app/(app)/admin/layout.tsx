import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Settings, Users, BookOpen, BarChart2, Mail, Send, Contact, Sparkles, Workflow, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons";
import { getAdminUser } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

// Admin pages read and write every athlete's data, so the gate belongs here at
// the layout — it covers every current and future page under /admin in one
// place, rather than relying on each page to remember to check.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: AdminLayoutProps) {
  if (!(await getAdminUser())) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo className="h-6 w-6 text-primary" />
          <span className="font-semibold">HYBRIDX.CLUB</span>
          <span className="text-sm text-muted-foreground">• Admin</span>
        </Link>
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </header>

      <div className="flex flex-1">
        {/* Sidebar Navigation */}
        <nav className="w-64 border-r bg-muted/10 p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-muted-foreground">
              <Settings className="h-4 w-4" />
              Admin Panel
            </div>
            <AdminNavLink href="/admin/programs" icon={BookOpen}>
              Programs
            </AdminNavLink>
            <AdminNavLink href="/admin/users" icon={Users}>
              Users
            </AdminNavLink>
            <AdminNavLink href="/admin/analytics" icon={BarChart2}>
              Analytics
            </AdminNavLink>

            <div className="flex items-center gap-2 px-2 pb-1 pt-4 text-sm font-medium text-muted-foreground">
              <Mail className="h-4 w-4" />
              Marketing
            </div>
            <AdminNavLink href="/admin/marketing" icon={BarChart2}>
              Overview
            </AdminNavLink>
            <AdminNavLink href="/admin/marketing/studio" icon={Sparkles}>
              Studio
            </AdminNavLink>
            <AdminNavLink href="/admin/marketing/journeys" icon={Workflow}>
              Journeys
            </AdminNavLink>
            <AdminNavLink href="/admin/marketing/campaigns" icon={Send}>
              Campaigns
            </AdminNavLink>
            <AdminNavLink href="/admin/marketing/subscribers" icon={Contact}>
              Subscribers
            </AdminNavLink>
            <AdminNavLink href="/admin/marketing/segments" icon={Filter}>
              Segments
            </AdminNavLink>
            <AdminNavLink href="/admin/marketing/settings" icon={Settings}>
              Settings
            </AdminNavLink>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

interface AdminNavLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function AdminNavLink({ href, icon: Icon, children }: AdminNavLinkProps) {
  return (
    <Button asChild variant="ghost" className="w-full justify-start">
      <Link href={href}>
        <Icon className="mr-2 h-4 w-4" />
        {children}
      </Link>
    </Button>
  );
}