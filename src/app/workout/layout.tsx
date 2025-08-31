// src/app/workout/layout.tsx
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons";

export default function WorkoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
            <Logo className="h-6 w-6 text-primary" />
            <span className="font-semibold">HyroxEdgeAI</span>
        </Link>
        <Button asChild variant="outline">
            <Link href="/dashboard">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Link>
        </Button>
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
