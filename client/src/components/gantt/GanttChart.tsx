import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  addDays,
  formatDate,
  isHoliday,
  isWeekend,
  nextWorkingDay,
  parseDate,
  scheduleProject,
  shiftWorkingDays,
  workingDaysBetween,
  type ProjectCalendar,
  type ProjectSnapshot,
  type TaskDto,
} from "shared";
import {
  ROW_HEIGHT,
  barGeometry,
  buildMonthBands,
  buildTicks,
  buildTimeline,
  dependencyPath,
  todayIso,
  xOfDate,
  type Zoom,
} from "../../lib/gantt";
import {
  assignmentSummary,
  buildTaskTree,
  flattenTree,
  parentTaskIds,
} from "../../lib/tree";
import { formatDateCompact, PRIORITY_LABELS } from "../../lib/format";
import { api } from "../../api/client";
import { Badge, EmptyState } from "../ui/Misc";
import { ChevronDownIcon, ChevronRightIcon, GanttIcon, PencilIcon, PlusIcon } from "../ui/Icons";

interface GanttChartProps {
  snapshot: ProjectSnapshot;
  calendar: ProjectCalendar;
  zoom: Zoom;
  highlightCritical: boolean;
  criticalIds: Set<string>;
  focusTodaySignal: number;
  onOpenTask: (task: TaskDto | null, parentId?: string | null) => void;
  onTasksChange: (tasks: TaskDto[]) => void;
  onSuccess: (message: string) => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

interface DragState {
  taskId: string;
  mode: "move" | "resize";
  startDate: string;
  durationDays: number;
}

const TABLE_WIDTH_CLASS = "w-[268px] sm:w-[420px] lg:w-[586px] xl:w-[748px]";

export function GanttChart({
  snapshot,
  calendar,
  zoom,
  highlightCritical,
  criticalIds,
  focusTodaySignal,
  onOpenTask,
  onTasksChange,
  onSuccess,
  onInfo,
  onError,
}: GanttChartProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    taskId: string;
    mode: "move" | "resize";
    startX: number;
    baseStart: string;
    baseDuration: number;
    originalStartDate: string;
    moved: boolean;
  } | null>(null);

  const today = todayIso();
  const timeline = useMemo(
    () => buildTimeline(snapshot.tasks, snapshot.project.startDate, zoom),
    [snapshot.tasks, snapshot.project.startDate, zoom],
  );
  const ticks = useMemo(() => buildTicks(timeline, zoom, calendar, today), [timeline, zoom, calendar, today]);
  const monthBands = useMemo(() => buildMonthBands(timeline), [timeline]);

  const tree = useMemo(() => buildTaskTree(snapshot.tasks), [snapshot.tasks]);
  const rows = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);
  const parents = useMemo(() => parentTaskIds(snapshot.tasks), [snapshot.tasks]);
  const rowIndexById = useMemo(
    () => new Map(rows.map((row, index) => [row.task.id, index])),
    [rows],
  );

  const previewSchedule = useMemo(() => {
    if (!drag) return null;
    const modified = snapshot.tasks.map((task) =>
      task.id === drag.taskId
        ? { ...task, startDate: drag.startDate, durationDays: drag.durationDays }
        : task,
    );
    return scheduleProject(
      modified.map((task) => ({
        id: task.id,
        parentId: task.parentId,
        durationDays: task.durationDays,
        startDate: task.startDate,
        progress: task.progress,
      })),
      snapshot.dependencies,
      calendar,
    );
  }, [drag, snapshot.tasks, snapshot.dependencies, calendar]);

  function valuesOf(task: TaskDto): { scheduledStart: string; scheduledEnd: string } {
    const preview = previewSchedule?.get(task.id);
    if (preview) return { scheduledStart: preview.scheduledStart, scheduledEnd: preview.scheduledEnd };
    return { scheduledStart: task.scheduledStart, scheduledEnd: task.scheduledEnd };
  }

  function toggleCollapse(taskId: string): void {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function beginDrag(event: ReactPointerEvent, task: TaskDto, mode: "move" | "resize"): void {
    if (parents.has(task.id)) return;
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const base = valuesOf(task);
    dragRef.current = {
      taskId: task.id,
      mode,
      startX: event.clientX,
      baseStart: base.scheduledStart,
      baseDuration: task.durationDays,
      originalStartDate: task.startDate,
      moved: false,
    };
    setDrag({
      taskId: task.id,
      mode,
      startDate: task.startDate,
      durationDays: task.durationDays,
    });
  }

  function moveDrag(event: ReactPointerEvent): void {
    const info = dragRef.current;
    if (!info) return;
    const deltaDays = Math.round((event.clientX - info.startX) / timeline.dayWidth);
    if (Math.abs(deltaDays) >= 1) info.moved = true;
    if (!info.moved) return;

    if (info.mode === "move") {
      const snapped = nextWorkingDay(addDays(parseDate(info.baseStart), deltaDays), calendar);
      setDrag({
        taskId: info.taskId,
        mode: "move",
        startDate: formatDate(snapped),
        durationDays: info.baseDuration,
      });
      return;
    }
    const start = parseDate(info.baseStart);
    const end = shiftWorkingDays(start, Math.max(0, info.baseDuration - 1 + deltaDays), calendar);
    const duration = Math.max(1, workingDaysBetween(start, end, calendar));
    setDrag((current) =>
      current && current.taskId === info.taskId
        ? { ...current, startDate: info.originalStartDate, durationDays: duration }
        : current,
    );
  }

  async function endDrag(event: ReactPointerEvent, task: TaskDto): Promise<void> {
    const info = dragRef.current;
    dragRef.current = null;
    const pending = drag;
    setDrag(null);
    if (info) {
      try {
        (event.currentTarget as Element).releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture bisa sudah dilepas oleh browser.
      }
    }
    if (!info) return;
    if (!info.moved || !pending) {
      onOpenTask(task);
      return;
    }

    const previewed = previewSchedule?.get(task.id);
    try {
      const result =
        info.mode === "move"
          ? await api.updateTask(task.id, { startDate: pending.startDate })
          : await api.updateTask(task.id, { durationDays: pending.durationDays });
      onTasksChange(result.tasks);
      const finalTask = result.tasks.find((item) => item.id === task.id);
      if (previewed && finalTask && finalTask.scheduledStart !== previewed.scheduledStart) {
        onInfo(
          `"${task.name}" dikembalikan ke batas dependensi predecessor (${formatDateCompact(finalTask.scheduledStart)}).`,
        );
      } else {
        onSuccess(info.mode === "move" ? "Tanggal mulai tugas diperbarui." : "Durasi tugas diperbarui.");
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gagal menyimpan perubahan jadwal.");
    }
  }

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const target = xOfDate(parseDate(today), timeline) - 180;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    // Signal sengaja dipakai agar tombol "Hari ini" memicu scroll ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTodaySignal]);

  const svgHeight = Math.max(rows.length * ROW_HEIGHT, 120);
  const dayCount = timeline.days;
  const nonWorkingDays = useMemo(() => {
    const days: { iso: string; holiday: boolean }[] = [];
    for (let index = 0; index < dayCount; index += 1) {
      const date = addDays(timeline.start, index);
      if (isWeekend(date, calendar) || isHoliday(date, calendar)) {
        days.push({ iso: formatDate(date), holiday: isHoliday(date, calendar) });
      }
    }
    return days;
  }, [dayCount, timeline.start, calendar]);

  const visibleDependencies = snapshot.dependencies.filter(
    (dependency) =>
      rowIndexById.has(dependency.predecessorId) && rowIndexById.has(dependency.successorId),
  );

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface shadow-sm">
      <div ref={scrollRef} className="scroll-thin max-h-[calc(100vh-260px)] min-h-[360px] overflow-auto">
        <div className="relative flex w-max">
          <div
            className={`sticky left-0 z-30 shrink-0 border-r border-line bg-surface ${TABLE_WIDTH_CLASS}`}
          >
            <div className="flex h-14 items-end gap-2 border-b border-line bg-surface px-3 pb-2">
              <span className="w-8 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                WBS
              </span>
              <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                Nama tugas
              </span>
              <span className="hidden w-12 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-3 md:block">
                Hari
              </span>
              <span className="hidden w-[74px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-3 lg:block">
                Mulai
              </span>
              <span className="hidden w-[74px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-3 lg:block">
                Selesai
              </span>
              <span className="hidden w-[70px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-3 xl:block">
                Prioritas
              </span>
              <span className="hidden w-[120px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-3 xl:block">
                Penanggung jawab
              </span>
              <span className="hidden w-12 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-3 md:block">
                Progres
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<GanttIcon className="size-6" />}
                  title="Belum ada tugas"
                  description="Tambahkan tugas pertama untuk mulai menyusun jadwal proyek."
                  action={
                    <button
                      type="button"
                      onClick={() => onOpenTask(null, null)}
                      className="inline-flex items-center gap-1.5 rounded-sm bg-brand-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-700"
                    >
                      <PlusIcon className="size-4" />
                      Tambah tugas
                    </button>
                  }
                />
              </div>
            ) : null}

            {rows.map(({ task, depth, hasChildren }) => {
              const wbs = wbsLabel(snapshot.tasks, task.id);
              const critical = highlightCritical && criticalIds.has(task.id);
              return (
                <div
                  key={task.id}
                  className={`group flex h-10 items-center gap-2 border-b border-line/70 px-3 text-[13px] transition-colors hover:bg-brand-50/40 ${
                    critical ? "bg-danger-bg/25" : ""
                  }`}
                >
                  <span className="tabular w-8 shrink-0 text-[11px] text-ink-3">{wbs}</span>
                  <div className="flex min-w-0 flex-1 items-center" style={{ paddingLeft: depth * 12 }}>
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleCollapse(task.id)}
                        aria-label={collapsed.has(task.id) ? `Buka ${task.name}` : `Lipat ${task.name}`}
                        aria-expanded={!collapsed.has(task.id)}
                        className="mr-1 grid size-5 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink"
                      >
                        {collapsed.has(task.id) ? (
                          <ChevronRightIcon className="size-3.5" />
                        ) : (
                          <ChevronDownIcon className="size-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="mr-1 w-5 shrink-0" aria-hidden="true" />
                    )}
                    <span
                      aria-hidden="true"
                      className="mr-1.5 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: task.color }}
                    />
                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      className={`min-w-0 truncate text-left hover:underline ${
                        hasChildren ? "font-semibold text-ink" : "text-ink-2"
                      }`}
                      title={task.name}
                    >
                      {task.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      aria-label={`Ubah ${task.name}`}
                      className="ml-auto hidden size-6 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink group-hover:grid group-focus-within:grid"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                  </div>
                  <span className="tabular hidden w-12 shrink-0 text-right text-[12px] text-ink-2 md:block">
                    {task.durationDays}
                  </span>
                  <span className="hidden w-[74px] shrink-0 text-[12px] text-ink-2 lg:block">
                    {formatDateCompact(task.scheduledStart)}
                  </span>
                  <span className="hidden w-[74px] shrink-0 text-[12px] text-ink-2 lg:block">
                    {formatDateCompact(task.scheduledEnd)}
                  </span>
                  <span className="hidden w-[70px] shrink-0 xl:block">
                    <Badge tone={task.priority === "HIGH" ? "danger" : task.priority === "MEDIUM" ? "info" : "neutral"}>
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </span>
                  <span
                    className="hidden w-[120px] shrink-0 truncate text-[12px] text-ink-2 xl:block"
                    title={assignmentSummary(task.id, snapshot.assignments, snapshot.resources)}
                  >
                    {assignmentSummary(task.id, snapshot.assignments, snapshot.resources)}
                  </span>
                  <span className="hidden w-12 shrink-0 text-right md:block">
                    <span className="tabular text-[12px] text-ink-2">{task.progress}%</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="relative shrink-0" style={{ width: timeline.width }}>
            <div className="sticky top-0 z-20 h-14 border-b border-line bg-surface/95 backdrop-blur">
              <div className="relative h-6 border-b border-line/70">
                {monthBands.map((band) => (
                  <div
                    key={band.key}
                    className="absolute top-0 flex h-6 items-center border-l border-line/70 pl-2 text-[10px] font-semibold uppercase tracking-wide text-ink-3"
                    style={{ left: band.x, width: band.width }}
                  >
                    <span className="truncate">{band.label}</span>
                  </div>
                ))}
              </div>
              <div className="relative h-[31px]">
                {ticks.map((tick) => (
                  <div
                    key={tick.key}
                    className={`absolute top-0 flex h-[31px] flex-col items-center justify-center border-l border-line/60 text-[10px] ${
                      tick.holiday
                        ? "bg-warning-bg/70 text-warning"
                        : tick.weekend
                          ? "bg-surface-2 text-ink-3"
                          : "text-ink-3"
                    }`}
                    style={{ left: tick.x, width: Math.max(tick.width, 1) }}
                  >
                    {zoom === "day" ? (
                      <>
                        <span className="text-[9px] font-medium uppercase">{WEEKDAY_SHORT[tick.key.length === 10 ? tickWeekday(tick.key) : 0]}</span>
                        <span className="tabular font-semibold text-ink-2">{tick.label}</span>
                      </>
                    ) : (
                      <span className="truncate px-1 font-medium">{tick.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <svg
              width={timeline.width}
              height={svgHeight}
              role="img"
              aria-label="Timeline Gantt Chart proyek"
              onPointerMove={moveDrag}
              onPointerUp={(event) => {
                const taskId = dragRef.current?.taskId;
                const task = snapshot.tasks.find((item) => item.id === taskId);
                if (task) void endDrag(event, task);
              }}
              onPointerCancel={() => {
                dragRef.current = null;
                setDrag(null);
              }}
              className={drag ? "cursor-grabbing" : ""}
            >
              {nonWorkingDays.map((day) => {
                const x = xOfDate(parseDate(day.iso), timeline);
                return (
                  <rect
                    key={day.iso}
                    x={x}
                    y={0}
                    width={timeline.dayWidth}
                    height={svgHeight}
                    className={day.holiday ? "fill-warning-bg/50" : "fill-surface-2/70"}
                  />
                );
              })}

              {ticks
                .filter((tick) => tick.width >= timeline.dayWidth)
                .map((tick) => (
                  <line
                    key={`grid-${tick.key}`}
                    x1={tick.x}
                    x2={tick.x}
                    y1={0}
                    y2={svgHeight}
                    className="stroke-line/50"
                    strokeWidth={1}
                  />
                ))}

              {visibleDependencies.map((dependency) => {
                const predecessor = snapshot.tasks.find((task) => task.id === dependency.predecessorId);
                const successor = snapshot.tasks.find((task) => task.id === dependency.successorId);
                if (!predecessor || !successor) return null;
                const predecessorRow = rowIndexById.get(predecessor.id);
                const successorRow = rowIndexById.get(successor.id);
                if (predecessorRow === undefined || successorRow === undefined) return null;
                const from = barGeometry(valuesOf(predecessor), timeline, predecessorRow);
                const to = barGeometry(valuesOf(successor), timeline, successorRow);
                const critical =
                  highlightCritical && criticalIds.has(predecessor.id) && criticalIds.has(successor.id);
                const path = dependencyPath(dependency.type, from, to);
                const targetX = to.x - 7;
                return (
                  <g
                    key={dependency.id}
                    data-testid="dependency-edge"
                    data-type={dependency.type}
                    className={critical ? "text-danger" : "text-ink-3/70"}
                  >
                    <path
                      d={path}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeDasharray={dependency.type === "SS" ? "4 3" : undefined}
                    />
                    <polygon
                      points={`${targetX + 1},${to.centerY} ${targetX - 5},${to.centerY - 4} ${targetX - 5},${to.centerY + 4}`}
                      fill="currentColor"
                    />
                  </g>
                );
              })}

              {rows.map(({ task }, rowIndex) => {
                const values = valuesOf(task);
                const geometry = barGeometry(values, timeline, rowIndex);
                const isParent = parents.has(task.id);
                const critical = highlightCritical && criticalIds.has(task.id);
                const isDragging = drag?.taskId === task.id;

                if (isParent) {
                  return (
                    <g key={task.id} className="cursor-pointer">
                      <rect
                        x={geometry.x}
                        y={geometry.y + 7}
                        width={geometry.width}
                        height={7}
                        rx={2}
                        fill={task.color}
                        opacity={isDragging ? 0.6 : 0.95}
                        onClick={() => onOpenTask(task)}
                      />
                      <rect x={geometry.x} y={geometry.y + 2} width={2.5} height={17} rx={1} fill={task.color} />
                      <rect
                        x={geometry.x + geometry.width - 2.5}
                        y={geometry.y + 2}
                        width={2.5}
                        height={17}
                        rx={1}
                        fill={task.color}
                      />
                      <text
                        x={geometry.x + geometry.width + 6}
                        y={geometry.centerY + 4}
                        className="fill-ink-2 text-[11px] font-medium"
                      >
                        {task.name}
                      </text>
                    </g>
                  );
                }

                return (
                  <g
                    key={task.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${task.name}, ${formatDateCompact(values.scheduledStart)} sampai ${formatDateCompact(
                      values.scheduledEnd,
                    )}, progres ${task.progress}%`}
                    className="gantt-bar cursor-grab outline-none focus-visible:[&>rect:first-of-type]:stroke-brand-700"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenTask(task);
                      }
                    }}
                    onPointerDown={(event) => beginDrag(event, task, "move")}
                    onPointerUp={(event) => void endDrag(event, task)}
                  >
                    <rect
                      x={geometry.x}
                      y={geometry.y}
                      width={geometry.width}
                      height={geometry.height}
                      rx={5}
                      fill={task.color}
                      fillOpacity={0.22}
                      stroke={critical ? "#B42318" : task.color}
                      strokeWidth={critical ? 2 : 1}
                    />
                    <rect
                      x={geometry.x}
                      y={geometry.y}
                      width={Math.max(2, (geometry.width * task.progress) / 100)}
                      height={geometry.height}
                      rx={5}
                      fill={task.color}
                      fillOpacity={0.9}
                      pointerEvents="none"
                    />
                    {geometry.width > 74 ? (
                      <text
                        x={geometry.x + 8}
                        y={geometry.centerY + 4}
                        className="pointer-events-none fill-white text-[10.5px] font-semibold"
                        style={{ paintOrder: "stroke" }}
                        stroke="rgba(20,26,44,0.25)"
                        strokeWidth={2}
                      >
                        {task.progress}%
                      </text>
                    ) : null}
                    <rect
                      x={geometry.x + geometry.width - 6}
                      y={geometry.y - 2}
                      width={8}
                      height={geometry.height + 4}
                      rx={3}
                      fill="transparent"
                      className="cursor-ew-resize"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        beginDrag(event, task, "resize");
                      }}
                      onPointerUp={(event) => {
                        event.stopPropagation();
                        void endDrag(event, task);
                      }}
                    />
                  </g>
                );
              })}

              <line
                x1={xOfDate(parseDate(today), timeline) + timeline.dayWidth / 2}
                x2={xOfDate(parseDate(today), timeline) + timeline.dayWidth / 2}
                y1={0}
                y2={svgHeight}
                stroke="#DB2777"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-surface-2/50 px-3 py-2 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-surface-2 ring-1 ring-line" aria-hidden="true" />
          Akhir pekan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-warning-bg ring-1 ring-warning/30" aria-hidden="true" />
          Hari libur
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-[#DB2777]" aria-hidden="true" />
          Hari ini
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-danger" aria-hidden="true" />
          Tugas kritis
        </span>
        <span className="ml-auto hidden sm:inline">
          Geser bar untuk memindahkan tanggal, tarik tepi kanan untuk durasi.
        </span>
      </div>
    </div>
  );
}

const WEEKDAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

function tickWeekday(iso: string): number {
  return parseDate(iso).getUTCDay();
}

function wbsLabel(tasks: TaskDto[], taskId: string): string {
  const path: number[] = [];
  let cursor = tasks.find((task) => task.id === taskId);
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    const siblings = tasks
      .filter((task) => (task.parentId ?? null) === (cursor?.parentId ?? null))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    const index = siblings.findIndex((task) => task.id === cursor?.id);
    path.unshift(index + 1);
    cursor = cursor.parentId ? tasks.find((task) => task.id === cursor?.parentId) : undefined;
  }
  return path.join(".");
}
