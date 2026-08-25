import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons";
import { getAdminUser } from "@/lib/admin-auth";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-nav";

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
    // The app shell already pads its <main>; the negative margins let the admin
    // header and sidebar run edge to edge inside it, and the inner <main> puts
    // the padding back around the page content only.
    <div className="-mx-4 -mt-4 flex min-h-full flex-col lg:-mx-6 lg:-mt-6">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur-sm md:h-16 md:px-6">
        {/* Phones get the section name and a drawer trigger; the wordmark is
            already in the app header directly above, so repeating it there
            only ate the width the title needs. */}
        <AdminMobileNav />

        <Link href="/dashboard" className="hidden items-center gap-2 md:flex">
          <Logo className="h-6 w-6 text-primary" />
          <span className="font-semibold">HYBRIDX.CLUB</span>
          <span className="text-sm text-muted-foreground">• Admin</span>
        </Link>

        <Button
          asChild
          variant="outline"
          className="h-9 w-9 shrink-0 p-0 md:h-10 md:w-auto md:px-4"
        >
          <Link href="/dashboard" aria-label="Back to Dashboard">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden md:inline">Back to Dashboard</span>
          </Link>
        </Button>
      </header>

      <div className="flex flex-1">
        <AdminSidebar />

        {/* min-w-0 stops wide children (tables, previews) from forcing the
            whole page to scroll sideways on a phone. */}
        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
