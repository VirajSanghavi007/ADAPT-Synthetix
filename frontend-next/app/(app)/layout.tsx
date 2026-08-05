"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useSession } from "@/lib/useSession";
import { useAAL } from "@/lib/useAAL";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";
import { NAV_ITEMS } from "@/lib/nav";
import Logo from "@/components/Logo";
import MFAChallenge from "@/components/MFAChallenge";
import EnterpriseChallenge from "@/components/EnterpriseChallenge";
import GuidedTour from "@/components/GuidedTour";
import WhatsNewModal from "@/components/WhatsNewModal";
import { CURRENT_VERSION } from "@/lib/changelog";
import { buttonVariants } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const { loading: aalLoading, needsChallenge } = useAAL();
  const { profile, loading: profileLoading } = useProfile();
  const [verified, setVerified] = useState(false);
  const [whatsNewSeen, setWhatsNewSeen] = useState(true);
  const [betaFeatures, setBetaFeatures] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setWhatsNewSeen(localStorage.getItem("mercury-last-seen-version") === CURRENT_VERSION);
    setBetaFeatures(localStorage.getItem("mercury-beta-features") === "true");
  }, []);

  useEffect(() => {
    if (session && !profileLoading && profile && !profile.username && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [session, profile, profileLoading, pathname, router]);

  if (loading || aalLoading || (session && profileLoading)) return null;

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="animate-fade-up flex flex-col items-center gap-4">
          <Logo className="h-14 w-14" />
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Mercury</h1>
            <p className="mt-2 max-w-sm text-muted">Sign in to continue.</p>
          </div>
          <Link href="/login" className={buttonVariants({ variant: "accent", size: "lg", className: "px-6" })}>
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (profile?.is_enterprise && !verified) {
    return <EnterpriseChallenge onVerified={() => setVerified(true)} />;
  }

  if (needsChallenge && !verified) {
    return <MFAChallenge onVerified={() => setVerified(true)} />;
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Logo className="h-6 w-6 shrink-0" />
            <span className="font-heading text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              Mercury
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.filter((item) => !(item.hideForEnterprise && profile?.is_enterprise)).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => supabase.auth.signOut()}
                tooltip="Sign out"
                className="cursor-pointer"
              >
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <p className="truncate px-2 pb-1 text-xs text-muted group-data-[collapsible=icon]:hidden">
            {profile?.display_name || profile?.username || session.user.email}
          </p>
          <p className="px-2 pb-1 text-[11px] text-muted group-data-[collapsible=icon]:hidden">
            v{CURRENT_VERSION}
            {betaFeatures ? "-beta" : ""}
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="cursor-pointer" />
        </header>
        <div className="flex-1 space-y-6 p-6">{children}</div>
      </SidebarInset>
      {profile?.username && (
        <>
          <WhatsNewModal onDismiss={() => setWhatsNewSeen(true)} />
          <GuidedTour delayUntilReady={!whatsNewSeen} />
        </>
      )}
    </SidebarProvider>
  );
}
