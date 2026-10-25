import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectCreateSchema } from "shared";
import { api, ApiError } from "../api/client";
import { projectsKey } from "../hooks/useProjectData";
import { formatDate, WEEKDAY_LABELS } from "../lib/format";
import { useToast } from "../components/ui/Toast";
import { Button } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Field";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { Badge, EmptyState, ErrorPanel, SkeletonBlock } from "../components/ui/Misc";
import { ArrowLeftIcon, FolderIcon, PlusIcon, TrashIcon } from "../components/ui/Icons";

interface CreateForm {
  name: string;
  description: string;
  startDate: string;
  weekendDays: number[];
}

function today(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

export function ProjectsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: projectsKey, queryFn: () => api.listProjects() });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    name: "",
    description: "",
    startDate: today(),
    weekendDays: [0, 6],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      const parsed = projectCreateSchema.safeParse({
        name: form.name,
        description: form.description || null,
        startDate: form.startDate,
        weekendDays: form.weekendDays,
      });
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          details[String(issue.path[0] ?? "_")] = [issue.message];
        }
        throw new ApiError("Periksa kembali data proyek.", 422, "VALIDATION_ERROR", details);
      }
      return api.createProject(parsed.data);
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: projectsKey });
      toast.success(`Proyek "${response.project.name}" dibuat.`);
      setCreateOpen(false);
      setForm({ name: "", description: "", startDate: today(), weekendDays: [0, 6] });
      setErrors({});
    },
    onError: (error) => {
      if (error instanceof ApiError && Object.keys(error.details).length > 0) {
        const details: Record<string, string> = {};
        for (const [key, messages] of Object.entries(error.details)) details[key] = messages[0];
        setErrors(details);
      } else {
        toast.error(error instanceof Error ? error.message : "Gagal membuat proyek.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectsKey });
      toast.success("Proyek dihapus.");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal menghapus proyek."),
  });

  function toggleWeekend(day: number): void {
    setForm((current) => ({
      ...current,
      weekendDays: current.weekendDays.includes(day)
        ? current.weekendDays.filter((item) => item !== day)
        : [...current.weekendDays, day].sort((a, b) => a - b),
    }));
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Ruang kerja</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">Proyek</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Semua proyek yang Anda miliki. Pilih salah satu untuk membuka Gantt Chart.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Proyek baru
        </Button>
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-md border border-line bg-surface p-4">
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="mt-3 h-3 w-full" />
                <SkeletonBlock className="mt-2 h-3 w-4/5" />
                <SkeletonBlock className="mt-5 h-8 w-full" />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <ErrorPanel
            message={query.error instanceof Error ? query.error.message : "Daftar proyek gagal dimuat."}
            onRetry={() => query.refetch()}
          />
        ) : (query.data?.projects.length ?? 0) === 0 ? (
          <div className="rounded-md border border-line bg-surface shadow-sm">
            <EmptyState
              icon={<FolderIcon className="size-6" />}
              title="Belum ada proyek"
              description="Buat proyek pertama untuk menyusun tugas, jadwal, tim, dan analisis jalur kritis."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <PlusIcon className="size-4" />
                  Buat proyek pertama
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {query.data?.projects.map((project) => (
              <li key={project.id}>
                <div className="group relative flex h-full flex-col rounded-md border border-line bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/projects/${project.id}/gantt`}
                      className="min-w-0 flex-1 rounded-sm focus-visible:outline-offset-4"
                    >
                      <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink group-hover:text-brand-700">
                        {project.name}
                      </h2>
                      <p className="mt-1 line-clamp-2 min-h-[32px] text-[12.5px] leading-relaxed text-ink-2">
                        {project.description || "Belum ada deskripsi."}
                      </p>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Hapus ${project.name}`}
                      onClick={() => setDeleteTarget({ id: project.id, name: project.name })}
                      className="grid size-8 shrink-0 place-items-center rounded-sm text-ink-3 opacity-0 transition-opacity hover:bg-danger-bg hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="brand">{project.taskCount} tugas</Badge>
                    <Badge tone="neutral">{project.resourceCount} anggota</Badge>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[12px]">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">Mulai</dt>
                      <dd className="tabular mt-0.5 font-medium text-ink">{formatDate(project.startDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                        Akhir pekan
                      </dt>
                      <dd className="mt-0.5 font-medium text-ink">
                        {project.weekendDays
                          .split(",")
                          .filter(Boolean)
                          .map((day) => WEEKDAY_LABELS[Number(day)])
                          .join(", ") || "Tidak ada"}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    to={`/projects/${project.id}/gantt`}
                    className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline"
                  >
                    Buka Gantt Chart
                    <ArrowLeftIcon className="size-3.5 rotate-180" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={createOpen}
        title="Proyek baru"
        description="Tentukan nama, tanggal mulai, dan hari akhir pekan."
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              Buat proyek
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nama proyek" htmlFor="project-name" required error={errors.name}>
            <Input
              id="project-name"
              placeholder="Contoh: Peluncuran aplikasi mobile"
              value={form.name}
              error={Boolean(errors.name)}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>

          <Field label="Deskripsi" htmlFor="project-description" hint="Opsional.">
            <Textarea
              id="project-description"
              rows={2}
              placeholder="Ringkasan singkat tujuan proyek…"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </Field>

          <Field label="Tanggal mulai" htmlFor="project-start" required error={errors.startDate}>
            <Input
              id="project-start"
              type="date"
              value={form.startDate}
              error={Boolean(errors.startDate)}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
            />
          </Field>

          <fieldset>
            <legend className="text-[13px] font-medium text-ink">Hari akhir pekan</legend>
            <p className="mt-0.5 text-xs text-ink-3">Durasi tugas hanya menghitung hari kerja.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => {
                const active = form.weekendDays.includes(day);
                return (
                  <label
                    key={label}
                    className={`cursor-pointer rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                      active
                        ? "border-brand-300 bg-brand-50 text-brand-800"
                        : "border-line bg-surface text-ink-2 hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={active}
                      onChange={() => toggleWeekend(day)}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            {errors.weekendDays ? <p className="mt-1 text-xs text-danger">{errors.weekendDays}</p> : null}
          </fieldset>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus proyek?"
        message={`"${deleteTarget?.name ?? ""}" beserta seluruh tugas, dependensi, tim, dan kalendernya akan dihapus permanen.`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
