import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { createCalendar } from "shared";
import { useAnalysis, useProject, useRefreshProject } from "../hooks/useProjectData";
import { projectCalendar } from "../hooks/useProjectData";
import { GanttChart } from "../components/gantt/GanttChart";
import { TaskDialog } from "../components/gantt/TaskDialog";
import { useToast } from "../components/ui/Toast";
import { Button } from "../components/ui/Button";
import { Badge, Spinner } from "../components/ui/Misc";
import { CalendarIcon, FlagIcon, PlusIcon } from "../components/ui/Icons";
import type { Zoom } from "../lib/gantt";
import { formatPercent } from "../lib/format";
import type { TaskDto } from "shared";

const ZOOM_OPTIONS: { value: Zoom; label: string }[] = [
  { value: "day", label: "Hari" },
  { value: "week", label: "Minggu" },
  { value: "month", label: "Bulan" },
];

export function GanttPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const query = useProject(id);
  const analysis = useAnalysis(id);
  const refresh = useRefreshProject(id);

  const [zoom, setZoom] = useState<Zoom>("day");
  const [highlightCritical, setHighlightCritical] = useState(true);
  const [focusSignal, setFocusSignal] = useState(0);
  const [dialog, setDialog] = useState<{ open: boolean; task: TaskDto | null; parentId: string | null }>({
    open: false,
    task: null,
    parentId: null,
  });

  const snapshot = query.data;
  const calendar = useMemo(
    () => (snapshot ? projectCalendar(snapshot) : createCalendar([0, 6])),
    [snapshot],
  );
  const criticalIds = useMemo(
    () => new Set((analysis.data?.cpm ?? []).filter((node) => node.critical).map((node) => node.taskId)),
    [analysis.data],
  );

  if (!snapshot) {
    return <Spinner label="Menyiapkan Gantt Chart…" />;
  }

  const totalProgress =
    snapshot.tasks.length === 0
      ? 0
      : Math.round(snapshot.tasks.reduce((sum, task) => sum + task.progress, 0) / snapshot.tasks.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Skala timeline"
          className="flex items-center rounded-sm border border-line bg-surface p-0.5 shadow-sm"
        >
          {ZOOM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setZoom(option.value)}
              aria-pressed={zoom === option.value}
              className={`rounded-[4px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                zoom === option.value ? "bg-brand-600 text-white shadow-sm" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Button variant="secondary" size="sm" onClick={() => setFocusSignal((value) => value + 1)}>
          <CalendarIcon className="size-3.5" />
          Hari ini
        </Button>

        <button
          type="button"
          onClick={() => setHighlightCritical((value) => !value)}
          aria-pressed={highlightCritical}
          className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-[12px] font-medium transition-colors ${
            highlightCritical
              ? "border-danger/30 bg-danger-bg text-danger"
              : "border-line bg-surface text-ink-2 hover:bg-surface-2"
          }`}
        >
          <FlagIcon className="size-3.5" />
          Sorot jalur kritis
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Badge tone="neutral">Progres rata-rata {formatPercent(totalProgress)}</Badge>
          <Button size="sm" onClick={() => setDialog({ open: true, task: null, parentId: null })}>
            <PlusIcon className="size-4" />
            Tugas baru
          </Button>
        </div>
      </div>

      <GanttChart
        snapshot={snapshot}
        calendar={calendar}
        zoom={zoom}
        highlightCritical={highlightCritical}
        criticalIds={criticalIds}
        focusTodaySignal={focusSignal}
        onOpenTask={(task, parentId) =>
          setDialog({ open: true, task, parentId: parentId ?? null })
        }
        onTasksChange={(tasks) => refresh.applyTasks(tasks)}
        onSuccess={(message) => toast.success(message)}
        onInfo={(message) => toast.info(message)}
        onError={(message) => toast.error(message)}
      />

      <TaskDialog
        open={dialog.open}
        task={dialog.task}
        defaultParentId={dialog.parentId}
        projectId={id}
        snapshot={snapshot}
        onClose={() => setDialog((current) => ({ ...current, open: false }))}
        onTasksChange={(tasks) => refresh.applyTasks(tasks)}
        onRefresh={refresh.reload}
        onSuccess={(message) => toast.success(message)}
        onError={(message) => toast.error(message)}
      />
    </div>
  );
}
