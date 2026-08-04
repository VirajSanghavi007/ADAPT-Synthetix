"use client";

import ProfileSection from "@/components/ProfileSection";
import { usePageTitle } from "@/lib/usePageTitle";

export default function ProfilePage() {
  usePageTitle("Profile");

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted">Your public identity within Mercury.</p>
      </div>
      <ProfileSection />
    </div>
  );
}
