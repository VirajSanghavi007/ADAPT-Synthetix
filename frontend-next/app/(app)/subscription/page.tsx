"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Lock } from "lucide-react";
import { useProfile } from "@/lib/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    cadence: "/month",
    description: "Try Mercury on a handful of sessions.",
    features: ["25 transcriptions / month", "Standard ASR latency", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹1,499",
    cadence: "/month",
    description: "For individual clinicians and lecturers.",
    features: [
      "Unlimited transcriptions",
      "Priority ASR latency",
      "Error Analysis dashboard",
      "Email support",
    ],
    highlighted: true,
  },
  {
    id: "max",
    name: "Max",
    price: "₹4,999",
    cadence: "/month",
    description: "For teams needing admin controls and audit trail.",
    features: [
      "Everything in Pro",
      "Admin panel + audit log",
      "Priority queue for domain vocabulary",
      "Dedicated support",
    ],
  },
];

export default function SubscriptionPage() {
  const { profile, loading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile?.is_enterprise) router.replace("/dashboard");
  }, [loading, profile, router]);

  if (loading || profile?.is_enterprise) return null;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Subscription</h1>
        <p className="text-sm text-muted">Choose the plan that fits your usage.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={cn(plan.highlighted && "border-accent ring-1 ring-accent")}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.highlighted && <Badge>Most popular</Badge>}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-heading text-3xl font-semibold tracking-tight">{plan.price}</span>
                <span className="text-sm text-muted">{plan.cadence}</span>
              </div>
              <p className="text-sm text-muted">{plan.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.id === "free" ? (
                <Button className="w-full cursor-pointer" variant="outline" disabled>
                  Current plan
                </Button>
              ) : (
                <CheckoutDialog plan={plan} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CheckoutDialog({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");

  function handlePay(e: React.FormEvent) {
    e.preventDefault();
    // No payment gateway is wired up yet — this is a UI-only mock, nothing is charged
    // or transmitted anywhere.
    setStep("success");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setStep("form");
      }}
    >
      <DialogTrigger render={<Button variant="accent" className="w-full cursor-pointer" />}>
        Upgrade to {plan.name}
      </DialogTrigger>
      <DialogContent>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Upgrade to {plan.name}
              </DialogTitle>
              <DialogDescription>
                {plan.price}
                {plan.cadence}, billed monthly.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePay} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cc-name">Name on card</Label>
                <Input id="cc-name" required autoComplete="cc-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-number">Card number</Label>
                <Input id="cc-number" required autoComplete="cc-number" placeholder="4242 4242 4242 4242" inputMode="numeric" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cc-exp">Expiry</Label>
                  <Input id="cc-exp" required autoComplete="cc-exp" placeholder="MM/YY" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc-cvc">CVC</Label>
                  <Input id="cc-cvc" required autoComplete="cc-csc" placeholder="123" inputMode="numeric" />
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button type="submit" variant="accent" className="w-full cursor-pointer">
                  Pay {plan.price}
                  {plan.cadence}
                </Button>
                <p className="flex items-center justify-center gap-1 text-xs text-muted">
                  <Lock className="h-3 w-3" /> Payments are not yet enabled — no card data leaves this page.
                </p>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-accent">
                <Check className="h-4 w-4" /> Upgrade confirmed
              </DialogTitle>
              <DialogDescription>
                This is a preview only — no payment was actually processed and your plan hasn't changed yet.
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
              Close
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
