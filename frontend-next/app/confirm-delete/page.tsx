"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_URL, supabase } from "@/lib/supabase";
import { buttonVariants } from "@/components/ui/button";
import Logo from "@/components/Logo";

export default function ConfirmDeletePage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"pending" | "done" | "error">("pending");
  const [message, setMessage] = useState("Confirming...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing confirmation token.");
      return;
    }
    fetch(`${API_URL}/api/account/delete/confirm?token=${encodeURIComponent(token)}`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "confirmation failed");
        await supabase.auth.signOut();
        setStatus("done");
        setMessage(
          `Deletion scheduled — your account and all its data will be permanently deleted in ${data.delay_hours} hours. This cannot be undone or cancelled.`
        );
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, [token]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <Logo className="h-12 w-12" />
      <p className="max-w-sm text-foreground">{message}</p>
      {status !== "pending" && (
        <Link href="/" className={buttonVariants({ variant: "outline", className: "cursor-pointer" })}>
          Return home
        </Link>
      )}
    </main>
  );
}
