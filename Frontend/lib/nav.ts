import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ActivitySquare,
  Settings,
  CreditCard,
  BookOpen,
  KeyRound,
  History,
  Radio,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  hideForEnterprise?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Live Recording", href: "/live-recording", icon: Radio },
  { title: "History", href: "/history", icon: History },
  { title: "Error Analysis", href: "/errors", icon: ActivitySquare },
  { title: "API Keys", href: "/api-keys", icon: KeyRound },
  { title: "Subscription", href: "/subscription", icon: CreditCard, hideForEnterprise: true },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Docs", href: "/docs", icon: BookOpen },
];
