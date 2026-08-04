"use client";

import { useEffect, useState } from "react";
import {
  Monitor,
  Moon,
  Sun,
  Compass,
  FlaskConical,
  Sparkles,
  Wrench,
  UserCircle,
  ShieldCheck,
  ChevronDown,
  Palette,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { resetTour } from "@/components/GuidedTour";
import ProfileSection from "@/components/ProfileSection";
import AccountSection from "@/components/AccountSection";
import { usePageTitle } from "@/lib/usePageTitle";
import { CURRENT_VERSION, getLatestEntry } from "@/lib/changelog";
import { cn } from "@/lib/utils";

const THEME_KEY = "mercury-theme";
const PALETTE_KEY = "mercury-palette";
const BETA_KEY = "mercury-beta-features";
const THEME_OPTIONS = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "system", label: "System", icon: Monitor },
  { mode: "dark", label: "Dark", icon: Moon },
];
const PALETTE_OPTIONS = [
  { id: "emerald", label: "Emerald", swatch: "#059669" },
  { id: "violet", label: "Violet", swatch: "#7c3aed" },
  { id: "amber", label: "Amber", swatch: "#d97706" },
  { id: "rose", label: "Rose", swatch: "#e11d48" },
  { id: "blue", label: "Blue", swatch: "#2563eb" },
];

function ExpandableSection({
  title,
  icon: Icon,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger
          className="flex w-full cursor-pointer items-center justify-between p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
        >
          <div>
            <p className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
              <Icon className="h-4 w-4" /> {title}
            </p>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-6 px-6 pb-6">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function SettingsPage() {
  usePageTitle("Settings");
  const [theme, setThemeState] = useState("system");
  const [palette, setPaletteState] = useState("emerald");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [betaFeatures, setBetaFeaturesState] = useState(false);
  const latest = getLatestEntry();

  useEffect(() => {
    setThemeState(localStorage.getItem(THEME_KEY) || "system");
    setPaletteState(localStorage.getItem(PALETTE_KEY) || "emerald");
    setBetaFeaturesState(localStorage.getItem(BETA_KEY) === "true");
  }, []);

  function setBetaFeatures(enabled: boolean) {
    localStorage.setItem(BETA_KEY, String(enabled));
    setBetaFeaturesState(enabled);
  }

  function setTheme(mode: string) {
    localStorage.setItem(THEME_KEY, mode);
    setThemeState(mode);
    if (mode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", mode);
    }
  }

  function setPalette(id: string) {
    localStorage.setItem(PALETTE_KEY, id);
    setPaletteState(id);
    if (id === "emerald") {
      document.documentElement.removeAttribute("data-palette");
    } else {
      document.documentElement.setAttribute("data-palette", id);
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Profile, account, appearance, and notification preferences.</p>
      </div>

      <ExpandableSection title="Profile" icon={UserCircle} description="Your public identity within Mercury.">
        <ProfileSection />
      </ExpandableSection>

      <ExpandableSection
        title="Account"
        icon={ShieldCheck}
        description="Contact details, security, and sign-in methods."
      >
        <AccountSection />
      </ExpandableSection>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="mb-2 block">Theme</Label>
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map(({ mode, label, icon: Icon }) => (
                <Button
                  key={mode}
                  variant={theme === mode ? "accent" : "outline"}
                  onClick={() => setTheme(mode)}
                  aria-pressed={theme === mode}
                  className="h-20 cursor-pointer flex-col gap-2"
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> Color palette
            </Label>
            <div className="grid grid-cols-5 gap-3">
              {PALETTE_OPTIONS.map(({ id, label, swatch }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPalette(id)}
                  aria-label={label}
                  aria-pressed={palette === id}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    palette === id ? "border-accent" : "border-border hover:border-accent/50"
                  )}
                >
                  <span
                    className="h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background"
                    style={{ backgroundColor: swatch, "--tw-ring-color": palette === id ? swatch : "transparent" } as React.CSSProperties}
                  />
                  <span className="text-xs text-muted">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <Label htmlFor="email-notifs">Email notifications</Label>
            <p className="text-sm text-muted">Session summaries, drift alerts, and rate-limit notices.</p>
          </div>
          <Switch id="email-notifs" checked={emailNotifs} onCheckedChange={setEmailNotifs} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Compass className="h-4 w-4" /> Guided tour
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted">Replay the walkthrough of Mercury's features.</p>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              resetTour();
              window.location.reload();
            }}
          >
            Restart tour
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> Beta features
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <Label htmlFor="beta-features">Enable beta features</Label>
            <p className="text-sm text-muted">
              Try experimental features early. They may change or break without notice.
            </p>
          </div>
          <Switch id="beta-features" checked={betaFeatures} onCheckedChange={setBetaFeatures} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            About
            <Badge variant="secondary">
              v{CURRENT_VERSION}
              {betaFeatures ? "-beta" : ""}
            </Badge>
            {betaFeatures && <Badge variant="outline">Beta</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-accent" /> What's new in v{latest.version}
            </p>
            <ul className="space-y-1.5 pl-1">
              {latest.whatsNew.map((item) => (
                <li key={item} className="text-sm text-muted">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Wrench className="h-4 w-4 text-muted-foreground" /> Bug fixes
            </p>
            <ul className="space-y-1.5 pl-1">
              {latest.bugFixes.map((item) => (
                <li key={item} className="text-sm text-muted">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">Released {latest.date}</p>
        </CardContent>
      </Card>
    </div>
  );
}
