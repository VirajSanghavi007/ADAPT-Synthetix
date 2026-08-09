import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="animate-fade-up flex flex-col items-center gap-4">
        <Logo className="h-12 w-12" />
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Compass className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <p className="mt-2 max-w-sm text-muted">
            The page you're looking for doesn't exist or may have moved.
          </p>
        </div>
        <Link href="/dashboard" className={buttonVariants({ variant: "accent", size: "lg", className: "px-6" })}>
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
