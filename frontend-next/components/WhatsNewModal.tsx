"use client";

import { useEffect, useState } from "react";
import { Sparkles, Wrench } from "lucide-react";
import { CURRENT_VERSION, getLatestEntry } from "@/lib/changelog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const LAST_SEEN_KEY = "adapt-synthetix-last-seen-version";

export default function WhatsNewModal({ onDismiss }: { onDismiss?: () => void }) {
  const [open, setOpen] = useState(false);
  const entry = getLatestEntry();

  useEffect(() => {
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    if (lastSeen !== CURRENT_VERSION) setOpen(true);
    else onDismiss?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    localStorage.setItem(LAST_SEEN_KEY, CURRENT_VERSION);
    setOpen(false);
    onDismiss?.();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            What's new
            <Badge variant="secondary">v{entry.version}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-accent" /> New
            </p>
            <ul className="space-y-1.5 pl-1">
              {entry.whatsNew.map((item) => (
                <li key={item} className="text-sm text-muted">
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          {entry.bugFixes.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Wrench className="h-4 w-4 text-muted" /> Fixed
              </p>
              <ul className="space-y-1.5 pl-1">
                {entry.bugFixes.map((item) => (
                  <li key={item} className="text-sm text-muted">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="accent" onClick={dismiss} className="cursor-pointer">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
