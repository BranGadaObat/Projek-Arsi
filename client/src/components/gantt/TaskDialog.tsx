import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  taskCreateSchema,
  taskUpdateSchema,
  type DependencyType,
  type Priority,
  type ProjectSnapshot,
  type TaskDto,
} from "shared";
import { api } from "../../api/client";
import { assignmentSummary, descendantsOf, parentTaskIds, taskDepth } from "../../lib/tree";
import { formatDate, PRIORITY_LABELS } from "../../lib/format";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { Badge } from "../ui/Misc";
import { PlusIcon, TrashIcon } from "../ui/Icons";

interface TaskDialogProps {
  open: boolean;
  task: TaskDto | null;
  defaultParentId?: string | null;
  projectId: string;
  snapshot: ProjectSnapshot;
  onClose: () => void;
  onTasksChange: (tasks: TaskDto[]) => void;
  onRefresh: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

interface FormValues {
  name: string;
  description: string;
  parentId: string;
  durationDays: number;
  startDate: string;
  priority: Priority;
  color: string;
  progress: number;
  optimisticDays: number | "";
  pessimisticDays: number | "";
}

export function TaskDialog({
  open,
  task,
  defaultParentId = null,
  projectId,
  snapshot,
  onClose,
  onTasksChange,
  onRefresh,
  onSuccess,
  onError,
}: TaskDialogProps) {
  const parents = useMemo(() => parentTaskIds(snapshot.tasks), [snapshot.tasks]);
  const isParent = Boolean(task && parents.has(task.id));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: buildDefaults(task, defaultParentId, snapshot.project.startDate),
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaults(task, defaultParentId, snapshot.project.startDate));
    }
  }, [open, task, defaultParentId, snapshot.project.startDate, reset]);

  const parentOptions = useMemo(() => {
    if (!task) {
      return snapshot.tasks
        .filter((item) => !parents.has(item.id) || taskDepth(snapshot.tasks, item.id) < 3)
        .filter((item) => taskDepth(snapshot.tasks, item.id) < 3);
    }
    const blocked = new Set([task.id, ...descendantsOf(snapshot.tasks, task.id).map((item) => item.id)]);
    return snapshot.tasks
      .filter((item) => !blocked.has(item.id) && taskDepth(snapshot.tasks, item.id) < 3);
  }, [snapshot.tasks, task, parents]);

  const predecessors = task
    ? snapshot.dependencies.filter((dependency) => dependency.successorId === task.id)
    : [];
  const assignments = task
    ? snapshot.assignments.filter((assignment) => assignment.taskId === task.id)
    : [];

  const [newDependency, setNewDependency] = useState<{ predecessorId: string; type: DependencyType; lagDays: number }>({
    predecessorId: "",
    type: "FS",
    lagDays: 0,
  });
  const [newAssignment, setNewAssignment] = useState<{ resourceId: string; allocationPercent: number }>({
    resourceId: "",
    allocationPercent: 100,
  });

  const dependencyCandidates = useMemo(() => {
    if (!task) return [];
    const already = new Set(predecessors.map((dependency) => dependency.predecessorId));
    return snapshot.tasks.filter(
      (item) => item.id !== task.id && !parents.has(item.id) && !already.has(item.id),
    );
  }, [snapshot.tasks, task, parents, predecessors]);

  function applyIssues(issues: { path: PropertyKey[]; message: string }[]): void {
    for (const issue of issues) {
      const key = issue.path[0];
      if (typeof key === "string") {
        setError(key as keyof FormValues, { message: issue.message });
      }
    }
  }

  async function onSubmit(values: FormValues): Promise<void> {
    const editable = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      priority: values.priority,
      color: values.color,
    };
    const payload = isParent
      ? editable
      : {
          ...editable,
          parentId: values.parentId || null,
          durationDays: Number(values.durationDays),
          startDate: values.startDate,
          progress: Number(values.progress),
          optimisticDays: values.optimisticDays === "" ? null : Number(values.optimisticDays),
          pessimisticDays: values.pessimisticDays === "" ? null : Number(values.pessimisticDays),
        };

    if (task) {
      const parsed = taskUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        applyIssues(parsed.error.issues);
        return;
      }
      setSaving(true);
      try {
        const result = await api.updateTask(task.id, parsed.data);
        onTasksChange(result.tasks);
        onSuccess("Perubahan tugas disimpan.");
        onClose();
      } catch (error) {
        onError(error instanceof Error ? error.message : "Gagal menyimpan tugas.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const parsed = taskCreateSchema.safeParse(payload);
    if (!parsed.success) {
      applyIssues(parsed.error.issues);
      return;
    }

    setSaving(true);
    try {
      const result = await api.createTask(projectId, parsed.data);
      onTasksChange(result.tasks);
      onSuccess(`Tugas "${result.task.name}" ditambahkan.`);
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gagal menyimpan tugas.");
    } finally {
      setSaving(false);
    }
  }

  async function addDependency(): Promise<void> {
    if (!task || !newDependency.predecessorId) {
      onError("Pilih tugas predecessor terlebih dahulu.");
      return;
    }
    try {
      const result = await api.createDependency(task.id, newDependency);
      onTasksChange(result.tasks);
      onRefresh();
      setNewDependency({ predecessorId: "", type: "FS", lagDays: 0 });
      onSuccess("Dependensi ditambahkan.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gagal menambah dependensi.");
    }
  }

  async function updateDependency(id: string, payload: { type?: DependencyType; lagDays?: number }): Promise<void> {
    try {
      const result = await api.updateDependency(id, payload);
      onTasksChange(result.tasks);
      onRefresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gagal mengubah dependensi.");
    }
  }

  async function removeDependency(id: string): Promise<void> {
    try {
      const result = await api.deleteDependency(id);
      onTasksChange(result.tasks);
      onRefresh();
      onSuccess("Dependensi dihapus.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gagal menghapus dependensi.");
    }
  }

  async function addAssignment(): Promise<void> {
    if (!task || !newAssignment.resourceId) {
      onError("Pilih anggota tim terlebih dahulu.");
      return;
    }
    try {
      await api.createAssignment(task.id, newAssignment);
      setNewAssignment({ resourceId: "", allocationPercent: 100 });
      onRefresh();
      onSuccess("Alokasi anggota ditambahkan.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gagal menambah alokasi.");
    }
  }

  async function changeAssignment(id: string, allocationPercent: number): Promise<void> {
    try {
      await api.updateAssignment(id, { allocationPercent });
      onRefresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gagal mengubah alokasi.");
    }
  }

  async function removeAssignment(id: string): Promise<void> {
    try {
      await api.deleteAssignment(id);
      onRefresh();
      onSuccess("Alokasi dihapus.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gagal menghapus alokasi.");
    }
  }

  async function deleteTask(): Promise<void> {
    if (!task) return;
    setDeleting(true);
    try {
      const result = await api.deleteTask(task.id);
      onTasksChange(result.tasks);
      onSuccess(`Tugas "${task.name}" dihapus.`);
      setConfirmDelete(false);
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gagal menghapus tugas.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        size="lg"
        title={task ? task.name : "Tugas baru"}
        description={
          isParent
            ? "Tugas induk menghitung tanggal, durasi, dan progres otomatis dari sub-tugas."
            : task
              ? `Jadwal saat ini ${formatDate(task.scheduledStart)} – ${formatDate(task.scheduledEnd)}`
              : "Isi detail tugas. Durasi dihitung dalam hari kerja."
        }
        onClose={onClose}
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            {task ? (
              <Button variant="ghost" className="text-danger hover:bg-danger-bg" onClick={() => setConfirmDelete(true)}>
                <TrashIcon className="size-4" />
                Hapus
              </Button>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>
                Batal
              </Button>
              <Button loading={saving} onClick={() => void handleSubmit(onSubmit)()}>
                {task ? "Simpan perubahan" : "Tambah tugas"}
              </Button>
            </div>
          </div>
        }
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(onSubmit)();
          }}
          id="task-form"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama tugas" htmlFor="task-name" required error={errors.name?.message} className="sm:col-span-2">
              <Input id="task-name" error={Boolean(errors.name)} placeholder="Contoh: Implementasi backend" {...register("name")} />
            </Field>

            <Field label="Tugas induk" htmlFor="task-parent" hint="Biarkan kosong untuk tugas level teratas.">
              <Select id="task-parent" disabled={isParent} {...register("parentId")}>
                <option value="">Tanpa induk</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Prioritas" htmlFor="task-priority">
              <Select id="task-priority" {...register("priority")}>
                {(["LOW", "MEDIUM", "HIGH"] as Priority[]).map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Durasi (hari kerja)"
              htmlFor="task-duration"
              required={!isParent}
              hint={isParent ? "Dihitung dari sub-tugas." : undefined}
              error={errors.durationDays?.message}
            >
              <Input
                id="task-duration"
                type="number"
                min={1}
                max={365}
                disabled={isParent}
                error={Boolean(errors.durationDays)}
                {...register("durationDays", { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Mulai paling awal"
              htmlFor="task-start"
              required={!isParent}
              hint={isParent ? "Dihitung dari sub-tugas." : "Bisa lebih lambat karena dependensi."}
              error={errors.startDate?.message}
            >
              <Input
                id="task-start"
                type="date"
                disabled={isParent}
                error={Boolean(errors.startDate)}
                {...register("startDate")}
              />
            </Field>

            <Field label="Progres (%)" htmlFor="task-progress" error={errors.progress?.message}>
              <Input
                id="task-progress"
                type="number"
                min={0}
                max={100}
                disabled={isParent}
                error={Boolean(errors.progress)}
                {...register("progress", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Warna indikator" htmlFor="task-color" error={errors.color?.message}>
              <div className="flex items-center gap-2">
                <input
                  id="task-color"
                  type="color"
                  className="h-10 w-12 cursor-pointer rounded-sm border border-line-strong bg-surface p-1"
                  {...register("color")}
                />
                <Input className="font-mono text-[13px]" {...register("color")} aria-label="Kode warna hex" />
              </div>
            </Field>

            <Field label="Estimasi optimistis (hari)" htmlFor="task-optimistic" hint="Opsional, untuk diagram PERT.">
              <Input
                id="task-optimistic"
                type="number"
                min={1}
                max={365}
                disabled={isParent}
                placeholder="—"
                {...register("optimisticDays", { setValueAs: emptyToEmptyNumber })}
              />
            </Field>

            <Field label="Estimasi pesimistis (hari)" htmlFor="task-pessimistic" hint="Opsional, untuk diagram PERT.">
              <Input
                id="task-pessimistic"
                type="number"
                min={1}
                max={365}
                disabled={isParent}
                placeholder="—"
                {...register("pessimisticDays", { setValueAs: emptyToEmptyNumber })}
              />
            </Field>

            <Field label="Deskripsi" htmlFor="task-description" className="sm:col-span-2">
              <Textarea id="task-description" rows={2} placeholder="Catatan singkat tentang tugas ini…" {...register("description")} />
            </Field>
          </div>

          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>

        {task ? (
          <div className="mt-6 space-y-5 border-t border-line pt-5">
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Predecessor</h3>
                  <p className="text-xs text-ink-3">Hubungkan tugas dengan Finish-to-Start atau Start-to-Start.</p>
                </div>
                <Badge tone="neutral">{predecessors.length} dependensi</Badge>
              </div>

              {isParent ? (
                <p className="mt-3 rounded-sm border border-line bg-surface-2/60 px-3 py-2 text-[13px] text-ink-2">
                  Tugas induk tidak bisa diberi dependensi. Hubungkan tugas daunnya.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {predecessors.length === 0 ? (
                    <p className="text-[13px] text-ink-3">Belum ada predecessor.</p>
                  ) : null}
                  {predecessors.map((dependency) => {
                    const predecessor = snapshot.tasks.find((item) => item.id === dependency.predecessorId);
                    return (
                      <div
                        key={dependency.id}
                        className="flex flex-wrap items-center gap-2 rounded-sm border border-line bg-surface-2/40 px-2.5 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                          {predecessor?.name ?? "Tugas tidak dikenal"}
                        </span>
                        <Select
                          aria-label="Tipe dependensi"
                          className="h-8 w-24 text-[12px]"
                          defaultValue={dependency.type}
                          onChange={(event) =>
                            void updateDependency(dependency.id, { type: event.target.value as DependencyType })
                          }
                        >
                          <option value="FS">FS</option>
                          <option value="SS">SS</option>
                        </Select>
                        <Input
                          aria-label="Jeda hari kerja"
                          type="number"
                          min={-365}
                          max={365}
                          defaultValue={dependency.lagDays}
                          className="h-8 w-16 text-[12px]"
                          onBlur={(event) => {
                            const lagDays = Number(event.target.value);
                            if (Number.isFinite(lagDays) && lagDays !== dependency.lagDays) {
                              void updateDependency(dependency.id, { lagDays });
                            }
                          }}
                        />
                        <span className="text-[11px] text-ink-3">hari jeda</span>
                        <button
                          type="button"
                          onClick={() => void removeDependency(dependency.id)}
                          aria-label={`Hapus dependensi dari ${predecessor?.name ?? "tugas"}`}
                          className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-bg hover:text-danger"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap items-end gap-2">
                    <Select
                      aria-label="Tugas predecessor baru"
                      className="h-9 min-w-[180px] flex-1 text-[13px]"
                      value={newDependency.predecessorId}
                      onChange={(event) => setNewDependency((prev) => ({ ...prev, predecessorId: event.target.value }))}
                    >
                      <option value="">Pilih predecessor…</option>
                      {dependencyCandidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      aria-label="Tipe dependensi baru"
                      className="h-9 w-20 text-[13px]"
                      value={newDependency.type}
                      onChange={(event) =>
                        setNewDependency((prev) => ({ ...prev, type: event.target.value as DependencyType }))
                      }
                    >
                      <option value="FS">FS</option>
                      <option value="SS">SS</option>
                    </Select>
                    <Input
                      aria-label="Jeda hari kerja baru"
                      type="number"
                      className="h-9 w-20 text-[13px]"
                      value={newDependency.lagDays}
                      onChange={(event) =>
                        setNewDependency((prev) => ({ ...prev, lagDays: Number(event.target.value) }))
                      }
                    />
                    <Button variant="secondary" size="sm" onClick={() => void addDependency()}>
                      <PlusIcon className="size-3.5" />
                      Tambah
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <section className="border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Penanggung jawab</h3>
                  <p className="text-xs text-ink-3">
                    {isParent ? "Alokasi mengikuti sub-tugas." : assignmentSummary(task.id, snapshot.assignments, snapshot.resources)}
                  </p>
                </div>
                <Badge tone="brand">{assignments.length} anggota</Badge>
              </div>

              {isParent ? (
                <p className="mt-3 rounded-sm border border-line bg-surface-2/60 px-3 py-2 text-[13px] text-ink-2">
                  Tugas induk tidak bisa dialokasikan langsung.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {assignments.length === 0 ? (
                    <p className="text-[13px] text-ink-3">Belum ada anggota dialokasikan.</p>
                  ) : null}
                  {assignments.map((assignment) => {
                    const resource = snapshot.resources.find((item) => item.id === assignment.resourceId);
                    return (
                      <div
                        key={assignment.id}
                        className="flex flex-wrap items-center gap-2 rounded-sm border border-line bg-surface-2/40 px-2.5 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                          {resource?.name ?? "Anggota tidak dikenal"}
                          {resource ? <span className="ml-1 text-[11px] text-ink-3">· {resource.role}</span> : null}
                        </span>
                        <Input
                          aria-label={`Alokasi ${resource?.name ?? "anggota"} (%)`}
                          type="number"
                          min={1}
                          max={100}
                          defaultValue={assignment.allocationPercent}
                          className="h-8 w-16 text-[12px]"
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isFinite(value) && value !== assignment.allocationPercent) {
                              void changeAssignment(assignment.id, Math.min(100, Math.max(1, value)));
                            }
                          }}
                        />
                        <span className="text-[11px] text-ink-3">%</span>
                        <button
                          type="button"
                          onClick={() => void removeAssignment(assignment.id)}
                          aria-label={`Hapus alokasi ${resource?.name ?? "anggota"}`}
                          className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-bg hover:text-danger"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {snapshot.resources.length === 0 ? (
                    <p className="text-[13px] text-ink-3">
                      Belum ada anggota tim. Tambahkan dulu di halaman Tim.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <Select
                        aria-label="Anggota tim baru"
                        className="h-9 min-w-[180px] flex-1 text-[13px]"
                        value={newAssignment.resourceId}
                        onChange={(event) => setNewAssignment((prev) => ({ ...prev, resourceId: event.target.value }))}
                      >
                        <option value="">Pilih anggota…</option>
                        {snapshot.resources
                          .filter(
                            (resource) => !assignments.some((assignment) => assignment.resourceId === resource.id),
                          )
                          .map((resource) => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} — {resource.role}
                            </option>
                          ))}
                      </Select>
                      <Input
                        aria-label="Persentase alokasi baru"
                        type="number"
                        min={1}
                        max={100}
                        className="h-9 w-20 text-[13px]"
                        value={newAssignment.allocationPercent}
                        onChange={(event) =>
                          setNewAssignment((prev) => ({
                            ...prev,
                            allocationPercent: Number(event.target.value),
                          }))
                        }
                      />
                      <Button variant="secondary" size="sm" onClick={() => void addAssignment()}>
                        <PlusIcon className="size-3.5" />
                        Alokasikan
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus tugas?"
        message={
          task
            ? `"${task.name}" beserta sub-tugas, dependensi, dan alokasinya akan dihapus. Tindakan ini tidak bisa dibatalkan.`
            : ""
        }
        loading={deleting}
        onConfirm={() => void deleteTask()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function buildDefaults(task: TaskDto | null, defaultParentId: string | null, projectStart: string): FormValues {
  return {
    name: task?.name ?? "",
    description: task?.description ?? "",
    parentId: task?.parentId ?? defaultParentId ?? "",
    durationDays: task?.durationDays ?? 3,
    startDate: task?.startDate ?? projectStart,
    priority: task?.priority ?? "MEDIUM",
    color: task?.color ?? "#4F46E5",
    progress: task?.progress ?? 0,
    optimisticDays: task?.optimisticDays ?? "",
    pessimisticDays: task?.pessimisticDays ?? "",
  };
}

function emptyToEmptyNumber(value: string): number | "" {
  return value === "" ? "" : Number(value);
}
