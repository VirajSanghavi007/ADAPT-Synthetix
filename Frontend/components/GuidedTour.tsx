"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Mic,
  FolderUp,
  ActivitySquare,
  Settings as SettingsIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "adapt-synthetix-tour-completed";

const STEPS = [
  {
    icon: LayoutDashboard,
    title: "Welcome to ADAPT-Synthetix",
    body: "Your dashboard is home base — quick stats, and the transcribe/speak tools, in one place.",
  },
  {
    icon: Mic,
    title: "Transcribe and speak",
    body: "Record speech to get a transcript, or type text to hear it spoken. Pick a model per your plan's tier from the dropdown above each tool.",
  },
  {
    icon: FolderUp,
    title: "Bulk import",
    body: "Got a batch of recordings? Upload several at once from your computer, or import straight from Google Drive.",
  },
  {
    icon: ActivitySquare,
    title: "Error Analysis",
    body: "See where transcription slips up most — a phoneme-level confusion matrix, once you've transcribed with a reference text.",
  },
  {
    icon: SettingsIcon,
    title: "Settings & Account",
    body: "Theme, 2FA, API keys, subscription — all under Settings and Account. Replay this tour anytime from Settings.",
  },
];

export function markTourSeen() {
  localStorage.setItem(TOUR_KEY, "1");
}

export function resetTour() {
  localStorage.removeItem(TOUR_KEY);
}

export default function GuidedTour({ delayUntilReady = false }: { delayUntilReady?: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!delayUntilReady && !localStorage.getItem(TOUR_KEY)) setOpen(true);
  }, [delayUntilReady]);

  function finish() {
    markTourSeen();
    setOpen(false);
    setStep(0);
  }

  const current = STEPS[step];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish();
        else setOpen(next);
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <current.icon className="h-5 w-5" />
          </div>
          <DialogTitle>{current.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted">{current.body}</p>
        <div className="flex justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-accent" : "bg-secondary"}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={finish} className="cursor-pointer">
            Skip
          </Button>
          <Button
            variant="accent"
            className="cursor-pointer"
            onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : finish())}
          >
            {step < STEPS.length - 1 ? "Next" : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
