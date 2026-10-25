import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { parseWeekendDays } from "shared";
import { useProject } from "../hooks/useProjectData";
import { formatDate, WEEKDAY_LABELS } from "../lib/format";
import { ErrorPanel, SkeletonBlock } from "./ui/Misc";
import { ArrowLeftIcon, CalendarIcon, ChartIcon, GanttIcon, UsersIcon } from "./ui/Icons";

const TABS = [
  { to: "gantt", label: "Gantt", icon: GanttIcon },
  { to: "team", label: "Tim", icon: UsersIcon },
  { to: "calendar", label: "Kalender", icon: CalendarIcon },
  { to: "analysis", label: "Analisis", icon: ChartIcon },
];

export function ProjectLayout() {
  const { id = "" } = useParams();
  const query = useProject(id);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8">
        <SkeletonBlock className="h-6 w-40" />
        <SkeletonBlock className="mt-4 h-10 w-80" />
        <SkeletonBlock className="mt-6 h-10 w-full max-w-xl" />
        <SkeletonBlock className="mt-6 h-96 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorPanel
          message={query.error instanceof Error ? query.error.message : "Proyek tidak dapat dimuat."}
          onRetry={() => query.refetch()}
        />
        <Link to="/projects" className="mt-4 inline-flex text-sm font-medium text-brand-700 hover:underline">
          Kembali ke daftar proyek
        </Link>
      </div>
    );
  }

  const { project, tasks, resources } = query.data;
  const weekend = parseWeekendDays(project.weekendDays);

  return (
    <div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1500px] px-4 pt-5 lg:px-8">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-brand-700"
          >
            <ArrowLeftIcon className="size-3.5" />
            Semua proyek
          </Link>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
                {project.name}
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-2">
                {project.description || "Belum ada deskripsi proyek."}
              </p>
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Mulai</dt>
                <dd className="tabular font-medium text-ink">{formatDate(project.startDate)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Akhir pekan</dt>
                <dd className="font-medium text-ink">
                  {weekend.length === 0
                    ? "Tanpa akhir pekan"
                    : weekend.map((day) => WEEKDAY_LABELS[day]).join(", ")}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Tugas</dt>
                <dd className="tabular font-medium text-ink">{tasks.length}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Tim</dt>
                <dd className="tabular font-medium text-ink">{resources.length} anggota</dd>
              </div>
            </dl>
          </div>

          <nav aria-label="Navigasi proyek" className="-mb-px mt-5 flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                      isActive
                        ? "border-brand-600 text-brand-700"
                        : "border-transparent text-ink-2 hover:border-line hover:text-ink"
                    }`
                  }
                >
                  <TabIcon className="size-4" />
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-8">
        <Outlet />
      </div>
    </div>
  );
}
