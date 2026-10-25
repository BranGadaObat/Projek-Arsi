import type { ReactNode } from "react";
import { CheckIcon, ChartIcon, GanttIcon, UsersIcon } from "./ui/Icons";

const HIGHLIGHTS = [
  {
    icon: GanttIcon,
    title: "Gantt Chart interaktif",
    text: "Geser bar, atur dependensi FS/SS, dan lihat lag antar tugas.",
  },
  {
    icon: UsersIcon,
    title: "Beban kerja & biaya",
    text: "Alokasi tim per tugas dengan deteksi over-alokasi dan biaya proyek.",
  },
  {
    icon: ChartIcon,
    title: "Jalur kritis & PERT",
    text: "Ketahui tugas kritis beserta float dan estimasi variansinya.",
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-800 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(900px 500px at 15% 0%, rgba(129,140,248,0.55), transparent 60%), radial-gradient(700px 500px at 90% 90%, rgba(13,148,136,0.45), transparent 60%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-md bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M4 6h9M7 12h11M4 18h7" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-[15px] font-semibold leading-4">Jalur</p>
              <p className="text-[11px] text-white/70">Manajemen proyek</p>
            </div>
          </div>

          <h2 className="mt-14 max-w-md text-[34px] font-semibold leading-tight tracking-tight xl:text-[40px]">
            Rencanakan proyek, jaga tim tetap sinkron.
          </h2>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/75">
            Gantt Chart, kalender hari kerja, alokasi tim, dan analisis jalur kritis dalam satu
            workspace.
          </p>
        </div>

        <ul className="relative mt-12 space-y-4">
          {HIGHLIGHTS.map((item) => {
            const ItemIcon = item.icon;
            return (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-white/12 ring-1 ring-white/20">
                  <ItemIcon className="size-4" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold">{item.title}</p>
                  <p className="text-[12px] leading-relaxed text-white/70">{item.text}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-10 flex items-center gap-2 text-[12px] text-white/60">
          <CheckIcon className="size-3.5" />
          Data tersimpan di database, bukan di browser.
        </div>
      </aside>

      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M4 6h9M7 12h11M4 18h7" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-ink">Jalur</span>
          </div>

          <h1 className="text-[26px] font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-[13px] text-ink-2">{subtitle}</p>

          <div className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-md sm:p-6">{children}</div>
          <div className="mt-5 text-center">{footer}</div>
        </div>
      </div>
    </div>
  );
}
