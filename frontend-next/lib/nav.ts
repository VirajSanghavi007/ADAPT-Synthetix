import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ActivitySquare,
  Settings,
  CreditCard,
  BookOpen,
  KeyRound,
  History,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  hideForEnterprise?: boolean;
};

// Profile and Account live inside Settings (collapsible sections) instead of
// their own sidebar entries — their routes (/profile, /account) still work
// standalone for deep links/bookmarks, just not linked from the sidebar.
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "History", href: "/history", icon: History },
  { title: "Error Analysis", href: "/errors", icon: ActivitySquare },
  { title: "API Keys", href: "/api-keys", icon: KeyRound },
  { title: "Subscription", href: "/subscription", icon: CreditCard, hideForEnterprise: true },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Docs", href: "/docs", icon: BookOpen },
];
