"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, Compass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { resetTour } from "@/components/GuidedTour";
import { usePageTitle } from "@/lib/usePageTitle";

const THEME_KEY = "mercury-theme";
const THEME_OPTIONS = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "system", label: "System", icon: Monitor },
  { mode: "dark", label: "Dark", icon: Moon },
];

export default function SettingsPage() {
  usePageTitle("Settings");
  const [theme, setThemeState] = useState("system");
  const [emailNotifs, setEmailNotifs] = useState(true);

  useEffect(() => {
    setThemeState(localStorage.getItem(THEME_KEY) || "system");
  }, []);

  function setTheme(mode: string) {
    localStorage.setItem(THEME_KEY, mode);
    setThemeState(mode);
    if (mode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", mode);
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Appearance and notification preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <Label htmlFor="email-notifs">Email notifications</Label>
            <p className="text-sm text-muted">Session summaries and drift alerts.</p>
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
    </div>
  );
}
