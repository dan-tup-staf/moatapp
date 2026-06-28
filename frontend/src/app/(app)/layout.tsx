"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  Eye,
  Flame,
  Globe,
  Inbox,
  LayoutDashboard,
  List,
  LogOut,
  type LucideIcon,
  Megaphone,
  Plug,
  Radar,
  Rocket,
  Send,
  ShieldCheck,
  Target,
  UserCog,
  Users,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/start", label: "Zacznij tu", icon: Rocket }] },
  {
    title: "Strategia",
    items: [
      { href: "/icp", label: "Profil klienta", icon: Target },
      { href: "/signal-sources", label: "Źródła sygnałów", icon: Radar },
      { href: "/watchlists", label: "Listy obserwowane", icon: Eye },
    ],
  },
  {
    title: "Pozyskiwanie",
    items: [
      { href: "/signals", label: "Sygnały", icon: Bell },
      { href: "/companies", label: "Firmy", icon: Building2 },
      { href: "/people", label: "Osoby", icon: Users },
      { href: "/lists", label: "Listy", icon: List },
    ],
  },
  {
    title: "Zaangażowanie",
    items: [
      { href: "/groups", label: "Kampanie", icon: Megaphone },
      { href: "/campaigns", label: "Sekwencje", icon: Send },
      { href: "/inbox", label: "Skrzynka", icon: Inbox },
      { href: "/linkedin", label: "LinkedIn", icon: Briefcase },
      { href: "/results", label: "Wyniki", icon: BarChart3 },
    ],
  },
  {
    title: "Infrastruktura",
    items: [
      { href: "/domains", label: "Domeny", icon: Globe },
      { href: "/warmup", label: "Rozgrzewanie", icon: Flame },
      { href: "/deliverability", label: "Dostarczalność", icon: ShieldCheck },
    ],
  },
  {
    title: "Analiza",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
];

const ACCOUNT_GROUP: NavGroup = {
  title: "Konto",
  items: [
    { href: "/account/profile", label: "Profil i konto", icon: UserCog },
    { href: "/account/billing", label: "Płatności i plan", icon: CreditCard },
    { href: "/account/users", label: "Użytkownicy i dostępy", icon: Users },
  ],
};

const BOTTOM_ITEMS: NavItem[] = [
  { href: "/integrations", label: "Integracje / CRM", icon: Plug },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Ładowanie...</p>
      </div>
    );
  }

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors " +
          (collapsed ? "justify-center " : "") +
          (active
            ? "bg-gray-100 text-gray-900"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900")
        }
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside
        className={
          "sticky top-0 flex h-screen shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 " +
          (collapsed ? "w-16" : "w-60")
        }
      >
        {/* Brand + collapse */}
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-3">
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight">MOATION</span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Rozwiń panel" : "Zwiń panel"}
            className={
              "rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 " +
              (collapsed ? "mx-auto" : "")
            }
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="space-y-1">
              {group.title && !collapsed && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom: account group + integrations + logout */}
        <div className="space-y-1 border-t border-gray-200 px-2 py-3">
          {ACCOUNT_GROUP.title && !collapsed && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {ACCOUNT_GROUP.title}
            </p>
          )}
          {ACCOUNT_GROUP.items.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          {BOTTOM_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          <div
            className={
              "mt-1 flex items-center gap-2 rounded-md px-3 py-2 " +
              (collapsed ? "justify-center" : "")
            }
          >
            {!collapsed && (
              <span className="min-w-0 flex-1 truncate text-xs text-gray-500">
                {user.email}
              </span>
            )}
            <button
              onClick={logout}
              title="Wyloguj"
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
