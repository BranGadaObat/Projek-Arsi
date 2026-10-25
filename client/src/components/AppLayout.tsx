import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { initials } from "../lib/format";
import { FolderIcon, LogOutIcon, MenuIcon } from "./ui/Icons";
import { Button } from "./ui/Button";

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M4 6h9M7 12h11M4 18h7" strokeLinecap="round" />
        </svg>
      </span>
      <span>
        <span className="block text-[15px] font-semibold leading-4 tracking-tight text-ink">Jalur</span>
        <span className="block text-[11px] font-medium text-ink-3">Manajemen proyek</span>
      </span>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-brand-50 text-brand-800" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
  }`;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <BrandMark />
      </div>
      <nav aria-label="Navigasi utama" className="flex-1 space-y-1 px-3">
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          Ruang kerja
        </p>
        <NavLink to="/projects" className={navClass} onClick={onNavigate}>
          <FolderIcon className="size-4" />
          Proyek
        </NavLink>
      </nav>
      <div className="m-3 rounded-md border border-line bg-surface-2/70 p-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
            {user ? initials(user.name) : "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{user?.name ?? "Pengguna"}</p>
            <p className="truncate text-[11px] text-ink-3">{user?.email ?? ""}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={logout}>
          <LogOutIcon className="size-3.5" />
          Keluar
        </Button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka menu navigasi"
              aria-expanded={drawerOpen}
              className="grid size-10 place-items-center rounded-sm border border-line text-ink-2 transition-colors hover:bg-surface-2"
            >
              <MenuIcon className="size-5" />
            </button>
            <BrandMark />
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-12">
          <Outlet />
        </main>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi"
            className="relative h-full w-[268px] border-r border-line bg-surface shadow-lg"
          >
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
