import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ActivitySquare,
  Settings,
  UserCircle,
  ShieldCheck,
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

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "History", href: "/history", icon: History },
  { title: "Error Analysis", href: "/errors", icon: ActivitySquare },
  { title: "Profile", href: "/profile", icon: UserCircle },
  { title: "Account", href: "/account", icon: ShieldCheck },
  { title: "API Keys", href: "/api-keys", icon: KeyRound },
  { title: "Subscription", href: "/subscription", icon: CreditCard, hideForEnterprise: true },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Docs", href: "/docs", icon: BookOpen },
];
