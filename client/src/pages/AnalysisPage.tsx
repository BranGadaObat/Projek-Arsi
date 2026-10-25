import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  formatDate as toIso,
  nextWorkingDay,
  parseDate,
  shiftWorkingDays,
} from "shared";
import { projectCalendar, useAnalysis, useProject } from "../hooks/useProjectData";
import { PertDiagram } from "../components/analysis/PertDiagram";
import { formatDate, formatNumber, formatRupiah } from "../lib/format";
import {
  Badge,
  EmptyState,
  ErrorPanel,
  SectionCard,
  Spinner,
  StatTile,
} from "../components/ui/Misc";
import { ChartIcon, ClockIcon, CoinsIcon, FlagIcon, SparkIcon, UsersIcon } from "../components/ui/Icons";

export function AnalysisPage() {
  const { id = "" } = useParams();
  const project = useProject(id);
  const analysis = useAnalysis(id);

  const snapshot = project.data;
  const calendar = useMemo(
    () => (snapshot ? projectCalendar(snapshot) : null),
    [snapshot],
  );

  const dateFor = useMemo(() => {
    if (!snapshot || !calendar) return null;
    const first = nextWorkingDay(parseDate(snapshot.project.startDate), calendar);
    return (ordinal: number) => toIso(shiftWorkingDays(first, ordinal, calendar));
  }, [snapshot, calendar]);

  if (!snapshot || analysis.isLoading) {
    return <Spinner label="Menghitung jalur kritis…" />;
  }

  if (analysis.isError || !analysis.data) {
    return (
      <ErrorPanel
        message="Analisis proyek tidak dapat dihitung. Coba muat ulang halaman."
        onRetry={() => analysis.refetch()}
      />
    );
  }

  const result = analysis.data;
  const { summary, cpm, criticalPath, pert, cost, resourceLoad } = result;
  const tasks = snapshot.tasks;
  const resources = snapshot.resources;
  const taskName = new Map(tasks.map((task) => [task.id, task.name]));

  if (tasks.length === 0) {
    return (
      <div className="rounded-md border border-line bg-surface shadow-sm">
        <EmptyState
          icon={<ChartIcon className="size-6" />}
          title="Belum ada data untuk dianalisis"
          description="Tambahkan tugas pada tab Gantt untuk melihat jalur kritis, PERT, biaya, dan beban kerja."
        />
      </div>
    );
  }

  const overAllocated = resourceLoad.filter((load) => load.overAllocationDays.length > 0);
  const topTasks = [...tasks]
    .sort((a, b) => (cost.byTask[b.id] ?? 0) - (cost.byTask[a.id] ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Analisis proyek</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Jalur kritis (CPM), estimasi PERT, biaya tenaga kerja, dan beban tim.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Rentang proyek"
          value={`${formatDate(summary.startDate)} – ${formatDate(summary.endDate)}`}
          hint={`${summary.totalWorkingDays} hari kerja`}
          icon={<ClockIcon className="size-4" />}
        />
        <StatTile
          label="Tugas kritis"
          value={`${summary.criticalCount} / ${cpm.length}`}
          hint="Float total = 0 hari"
          icon={<FlagIcon className="size-4" />}
          tone={summary.criticalCount > 0 ? "danger" : "success"}
        />
        <StatTile
          label="Biaya tenaga kerja"
          value={formatRupiah(cost.total)}
          hint={`${resources.length} anggota terlibat`}
          icon={<CoinsIcon className="size-4" />}
          tone="info"
        />
        <StatTile
          label="Deviasi PERT (kritis)"
          value={`${pert.criticalStdDev.toFixed(2)} hari`}
          hint={`Varians ${formatNumber(pert.criticalVariance)}`}
          icon={<SparkIcon className="size-4" />}
          tone="warning"
        />
      </div>

      <SectionCard
        title="Jalur kritis"
        description="Rantai tugas tanpa kelonggaran — keterlambatannya menunda proyek."
        bodyClassName="p-4"
      >
        {criticalPath.length === 0 ? (
          <p className="text-[13px] text-ink-2">
            Tidak ada jalur kritis saat ini (semua tugas punya kelonggaran).
          </p>
        ) : (
          <ol className="flex flex-wrap items-center gap-1.5">
            {criticalPath.map((taskId, index) => (
              <li key={taskId} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-ink-3">
                    →
                  </span>
                ) : null}
                <span className="rounded-sm border border-danger/25 bg-danger-bg px-2 py-1 text-[12px] font-medium text-danger">
                  {taskName.get(taskId) ?? cpm.find((node) => node.taskId === taskId)?.name ?? taskId}
                </span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <SectionCard
        title="Critical Path Method"
        description="ES/EF: jadwal paling awal · LS/LF: jadwal paling akhir · Float: kelonggaran hari kerja."
        bodyClassName=""
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-ink-3">
                <th scope="col" className="px-4 py-2 font-semibold">Tugas</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Durasi</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">ES</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">EF</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">LS</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">LF</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Float</th>
                <th scope="col" className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {cpm.map((node) => (
                <tr
                  key={node.taskId}
                  className={`border-b border-line/70 last:border-0 ${node.critical ? "bg-danger-bg/40" : ""}`}
                >
                  <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-ink">{node.name}</td>
                  <td className="tabular px-2 py-2.5 text-right text-ink-2">{node.duration} hr</td>
                  <td className="tabular px-2 py-2.5 text-right text-ink-2">{dateFor?.(node.es) ?? "—"}</td>
                  <td className="tabular px-2 py-2.5 text-right text-ink-2">{dateFor?.(node.ef) ?? "—"}</td>
                  <td className="tabular px-2 py-2.5 text-right text-ink-2">{dateFor?.(node.ls) ?? "—"}</td>
                  <td className="tabular px-2 py-2.5 text-right text-ink-2">{dateFor?.(node.lf) ?? "—"}</td>
                  <td className="tabular px-2 py-2.5 text-right font-semibold text-ink">{node.totalFloat}</td>
                  <td className="px-4 py-2.5">
                    {node.critical ? <Badge tone="danger">Kritis</Badge> : <Badge tone="neutral">Longgar</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard
          title="Diagram PERT"
          description="Jaringan activity-on-node: node dan panah merah adalah jalur kritis. TE = (o + 4m + p) / 6."
          bodyClassName=""
        >
          <PertDiagram result={pert} dateFor={dateFor ?? undefined} />
        </SectionCard>

        <SectionCard
          title="Biaya tenaga kerja"
          description="Tarif harian = gaji bulanan / 22, dikalikan alokasi pada tugas daun."
          bodyClassName="p-4"
        >
          <p className="tabular text-2xl font-semibold tracking-tight text-ink">
            {formatRupiah(cost.total)}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">Total biaya seluruh tugas</p>

          <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            Per anggota
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {resources.map((resource) => (
              <li key={resource.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-ink-2">{resource.name}</span>
                <span className="tabular font-medium text-ink">
                  {formatRupiah(cost.byResource[resource.id] ?? 0)}
                </span>
              </li>
            ))}
            {resources.length === 0 ? (
              <li className="text-[13px] text-ink-3">Belum ada anggota tim.</li>
            ) : null}
          </ul>

          <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            Tugas teratas
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {topTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-ink-2">{task.name}</span>
                <span className="tabular font-medium text-ink">
                  {formatRupiah(cost.byTask[task.id] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Beban kerja tim"
        description="Alokasi di atas 100% pada hari kerja yang sama ditandai sebagai over-alokasi."
        bodyClassName="p-4"
      >
        {overAllocated.length === 0 ? (
          <div className="flex items-center gap-2 text-[13px] text-success">
            <Badge tone="success">Sehat</Badge>
            <span>Tidak ada anggota yang over-alokasi pada jadwal saat ini.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {overAllocated.map((load) => (
              <li key={load.resourceId} className="rounded-sm border border-warning/30 bg-warning-bg/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-warning">
                    <UsersIcon className="size-4" />
                    {load.name}
                  </span>
                  <Badge tone="warning">{load.overAllocationDays.length} hari bertabrakan</Badge>
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {load.overAllocationDays.slice(0, 8).map((day) => (
                    <li
                      key={day.date}
                      className="rounded-full border border-warning/30 bg-surface px-2 py-0.5 text-[11px] tabular text-warning"
                    >
                      {formatDate(day.date)} · {day.totalPercent}%
                    </li>
                  ))}
                  {load.overAllocationDays.length > 8 ? (
                    <li className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-ink-3">
                      +{load.overAllocationDays.length - 8} lainnya
                    </li>
                  ) : null}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {analysis.isFetching ? (
          <p className="mt-3 text-[12px] text-ink-3">Memperbarui analisis…</p>
        ) : null}
      </SectionCard>
    </div>
  );
}
