import { BookOpen, CalendarCheck, LogOut, Tags, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useData } from "../data/DataContext";
import { useConfirm } from "./ConfirmDialog";
import { useAuth } from "../features/auth/AuthContext";
import { cn } from "../lib/cn";
import { NAV, navOf, onNavClick, type NavPath, type Page } from "../lib/route";

const ICONS: Record<NavPath, typeof Users> = {
  "/": CalendarCheck,
  "/klien": Users,
  "/uang": Wallet,
  "/jasa": Tags,
  "/panduan": BookOpen,
};

/** Sidebar di desktop, bottom tab bar di HP (di bawah 640px). */
export function AppShell({ page, children }: { page: Page; children: ReactNode }) {
  const route = navOf(page);
  const { logout } = useAuth();
  const ask = useConfirm();
  const onLogout = async () => {
    const ok = await ask({
      title: "Keluar dari dashboard?",
      body: "Data tetap tersimpan. Untuk masuk lagi perlu login Google.",
      confirmLabel: "Keluar",
    });
    if (ok) void logout();
  };
  const { error } = useData();

  const link = (path: NavPath, label: string, compact: boolean) => {
    const Icon = ICONS[path];
    const active = route === path;
    return (
      <a
        key={path}
        href={path}
        aria-current={active ? "page" : undefined}
        onClick={onNavClick(path)}
        className={cn(
          "flex min-h-11 items-center rounded-card transition-colors",
          compact ? "flex-auto flex-col justify-center gap-1 px-1 py-1.5" : "gap-3 px-3",
          active ? "text-accent" : "text-gray-600 hover:text-gray-900",
          !compact && active && "bg-accent-soft",
          !compact && !active && "hover:bg-gray-100",
        )}
      >
        <Icon size={compact ? 22 : 20} aria-hidden />
        <span className={cn(active && "font-semibold")}>{label}</span>
      </a>
    );
  };

  return (
    <div className="min-h-dvh sm:pl-60">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col overflow-y-auto border-r border-gray-200 bg-surface p-4 sm:flex">
        <p className="px-3 pb-6 pt-2 text-lg font-bold">Freelance</p>
        <nav className="flex flex-1 flex-col gap-1">{NAV.map((r) => link(r.path, r.label, false))}</nav>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="flex min-h-11 items-center gap-3 rounded-card px-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut size={20} aria-hidden />
          Keluar
        </button>
      </aside>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 sm:px-8 sm:pb-10 sm:pt-10">
        {error && (
          <p role="alert" className="mb-6 rounded-card bg-late-soft px-4 py-3 text-late">
            {error}
          </p>
        )}
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-gray-200 bg-surface pt-2 sm:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
      >
        {NAV.map((r) => link(r.path, r.label, true))}
      </nav>
    </div>
  );
}
