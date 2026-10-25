import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resourceCreateSchema, type ResourceDto } from "shared";
import { api, ApiError } from "../api/client";
import { analysisKey, projectKey, useAnalysis, useProject } from "../hooks/useProjectData";
import { formatDate, formatRupiah, initials } from "../lib/format";
import { useToast } from "../components/ui/Toast";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { Badge, EmptyState, ErrorPanel, SectionCard, Spinner, StatTile } from "../components/ui/Misc";
import { AlertIcon, CoinsIcon, PencilIcon, PlusIcon, TrashIcon, UsersIcon } from "../components/ui/Icons";

interface ResourceForm {
  name: string;
  email: string;
  role: string;
  salary: string;
}

const EMPTY_FORM: ResourceForm = { name: "", email: "", role: "", salary: "" };

export function TeamPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const project = useProject(id);
  const analysis = useAnalysis(id);

  const [dialog, setDialog] = useState<{ open: boolean; resource: ResourceDto | null }>({
    open: false,
    resource: null,
  });
  const [form, setForm] = useState<ResourceForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ResourceDto | null>(null);

  const resources = project.data?.resources ?? [];
  const assignments = project.data?.assignments ?? [];
  const tasks = project.data?.tasks ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = resourceCreateSchema.safeParse({
        name: form.name,
        email: form.email,
        role: form.role,
        salary: Number(form.salary.replace(/[^0-9]/g, "")),
      });
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          details[String(issue.path[0] ?? "_")] = [issue.message];
        }
        throw new ApiError("Periksa kembali data anggota.", 422, "VALIDATION_ERROR", details);
      }
      if (dialog.resource) {
        return api.updateResource(dialog.resource.id, parsed.data);
      }
      return api.createResource(id, parsed.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKey(id) });
      void queryClient.invalidateQueries({ queryKey: analysisKey(id) });
      toast.success(dialog.resource ? "Data anggota diperbarui." : "Anggota tim ditambahkan.");
      setDialog({ open: false, resource: null });
      setErrors({});
    },
    onError: (error) => {
      if (error instanceof ApiError && Object.keys(error.details).length > 0) {
        const details: Record<string, string> = {};
        for (const [key, messages] of Object.entries(error.details)) details[key] = messages[0];
        setErrors(details);
      } else {
        toast.error(error instanceof Error ? error.message : "Gagal menyimpan anggota tim.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (resourceId: string) => api.deleteResource(resourceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKey(id) });
      void queryClient.invalidateQueries({ queryKey: analysisKey(id) });
      toast.success("Anggota tim dihapus.");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal menghapus anggota."),
  });

  function openCreate(): void {
    setForm(EMPTY_FORM);
    setErrors({});
    setDialog({ open: true, resource: null });
  }

  function openEdit(resource: ResourceDto): void {
    setForm({
      name: resource.name,
      email: resource.email,
      role: resource.role,
      salary: String(resource.salary),
    });
    setErrors({});
    setDialog({ open: true, resource });
  }

  if (!project.data) {
    return <Spinner label="Memuat data tim…" />;
  }

  const totalSalary = resources.reduce((sum, resource) => sum + resource.salary, 0);
  const totalCost = analysis.data?.cost.total ?? 0;
  const overAllocated = (analysis.data?.resourceLoad ?? []).filter(
    (load) => load.overAllocationDays.length > 0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Tim proyek</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Kelola anggota, lihat alokasi tugas, dan pantau beban kerja.
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4" />
          Tambah anggota
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Anggota"
          value={resources.length}
          hint="Terdaftar pada proyek ini"
          icon={<UsersIcon className="size-4" />}
        />
        <StatTile
          label="Total gaji / bulan"
          value={formatRupiah(totalSalary)}
          hint="Sebelum dialokasikan ke tugas"
          icon={<CoinsIcon className="size-4" />}
          tone="info"
        />
        <StatTile
          label="Biaya tenaga kerja"
          value={formatRupiah(totalCost)}
          hint="Dari tugas daun yang dialokasikan"
          icon={<CoinsIcon className="size-4" />}
          tone="success"
        />
      </div>

      {overAllocated.length > 0 ? (
        <div className="rounded-md border border-warning/30 bg-warning-bg/60 p-3.5" role="status">
          <div className="flex items-start gap-2">
            <AlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-warning">Peringatan over-alokasi</p>
              <ul className="mt-1 space-y-1 text-[12px] text-warning/90">
                {overAllocated.map((load) => (
                  <li key={load.resourceId}>
                    <span className="font-medium">{load.name}</span> melebihi 100% pada{" "}
                    {load.overAllocationDays.length} hari kerja, misalnya{" "}
                    {load.overAllocationDays
                      .slice(0, 2)
                      .map((day) => `${formatDate(day.date)} (${day.totalPercent}%)`)
                      .join(", ")}
                    .
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <SectionCard
        title="Anggota tim"
        description={`${resources.length} anggota · ${assignments.length} alokasi tugas`}
        bodyClassName=""
      >
        {resources.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="size-6" />}
            title="Belum ada anggota tim"
            description="Tambahkan anggota dengan nama, email, peran, dan gaji bulanan agar bisa dialokasikan ke tugas."
            action={
              <Button onClick={openCreate}>
                <PlusIcon className="size-4" />
                Tambah anggota
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wide text-ink-3">
                    <th scope="col" className="px-4 py-2 font-semibold">Nama</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Peran</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Gaji / bulan</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Tugas dialokasikan</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Biaya tugas</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((resource) => {
                    const allocated = assignments
                      .filter((assignment) => assignment.resourceId === resource.id)
                      .map((assignment) => ({
                        assignment,
                        task: tasks.find((task) => task.id === assignment.taskId),
                      }))
                      .filter((item) => item.task);
                    const load = (analysis.data?.resourceLoad ?? []).find(
                      (item) => item.resourceId === resource.id,
                    );
                    return (
                      <tr key={resource.id} className="border-b border-line/70 last:border-0 hover:bg-surface-2/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-800">
                              {initials(resource.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{resource.name}</p>
                              <p className="truncate text-[11.5px] text-ink-3">{resource.email}</p>
                            </div>
                            {load && load.overAllocationDays.length > 0 ? (
                              <Badge tone="warning">Over-alokasi</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{resource.role}</td>
                        <td className="tabular px-4 py-3 text-right font-medium text-ink">
                          {formatRupiah(resource.salary)}
                        </td>
                        <td className="px-4 py-3">
                          {allocated.length === 0 ? (
                            <span className="text-ink-3">Belum ada</span>
                          ) : (
                            <div className="flex max-w-[280px] flex-wrap gap-1">
                              {allocated.slice(0, 3).map(({ assignment, task }) => (
                                <span
                                  key={assignment.id}
                                  className="max-w-[160px] truncate rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2"
                                  title={task?.name}
                                >
                                  {task?.name} · {assignment.allocationPercent}%
                                </span>
                              ))}
                              {allocated.length > 3 ? (
                                <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">
                                  +{allocated.length - 3} lainnya
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="tabular px-4 py-3 text-right font-medium text-ink">
                          {analysis.data ? formatRupiah(analysis.data.cost.byResource[resource.id] ?? 0) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(resource)}
                              aria-label={`Ubah ${resource.name}`}
                              className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink"
                            >
                              <PencilIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(resource)}
                              aria-label={`Hapus ${resource.name}`}
                              className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-bg hover:text-danger"
                            >
                              <TrashIcon className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {resources.map((resource) => {
                const allocated = assignments.filter((assignment) => assignment.resourceId === resource.id);
                const load = (analysis.data?.resourceLoad ?? []).find(
                  (item) => item.resourceId === resource.id,
                );
                return (
                  <li key={resource.id} className="p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-800">
                        {initials(resource.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">{resource.name}</p>
                        <p className="truncate text-[11.5px] text-ink-3">{resource.email}</p>
                        <p className="mt-0.5 text-[12px] text-ink-2">{resource.role}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(resource)}
                          aria-label={`Ubah ${resource.name}`}
                          className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-surface-2"
                        >
                          <PencilIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(resource)}
                          aria-label={`Hapus ${resource.name}`}
                          className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-bg hover:text-danger"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </div>
                    </div>
                    <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[12px]">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-ink-3">Gaji</dt>
                        <dd className="tabular font-medium text-ink">{formatRupiah(resource.salary)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-ink-3">Biaya tugas</dt>
                        <dd className="tabular font-medium text-ink">
                          {analysis.data ? formatRupiah(analysis.data.cost.byResource[resource.id] ?? 0) : "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge tone="neutral">{allocated.length} alokasi</Badge>
                      {load && load.overAllocationDays.length > 0 ? (
                        <Badge tone="warning">Over-alokasi {load.overAllocationDays.length} hari</Badge>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </SectionCard>

      {analysis.isError ? (
        <ErrorPanel
          message="Perhitungan biaya dan beban kerja tidak dapat dimuat."
          onRetry={() => analysis.refetch()}
        />
      ) : null}

      <Modal
        open={dialog.open}
        title={dialog.resource ? "Ubah anggota tim" : "Anggota tim baru"}
        description="Data anggota dipakai untuk alokasi tugas dan perhitungan biaya."
        onClose={() => setDialog({ open: false, resource: null })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog({ open: false, resource: null })}>
              Batal
            </Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {dialog.resource ? "Simpan perubahan" : "Tambah anggota"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nama lengkap" htmlFor="resource-name" required error={errors.name}>
            <Input
              id="resource-name"
              placeholder="Contoh: Budi Santoso"
              value={form.name}
              error={Boolean(errors.name)}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Email" htmlFor="resource-email" required error={errors.email}>
            <Input
              id="resource-email"
              type="email"
              placeholder="budi@example.com"
              value={form.email}
              error={Boolean(errors.email)}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </Field>
          <Field label="Peran" htmlFor="resource-role" required error={errors.role}>
            <Input
              id="resource-role"
              placeholder="Contoh: Backend Developer"
              value={form.role}
              error={Boolean(errors.role)}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            />
          </Field>
          <Field
            label="Gaji per bulan (Rp)"
            htmlFor="resource-salary"
            required
            hint="Dipakai untuk menghitung biaya tugas (tarif harian = gaji / 22)."
            error={errors.salary}
          >
            <Input
              id="resource-salary"
              inputMode="numeric"
              placeholder="12000000"
              value={form.salary}
              error={Boolean(errors.salary)}
              onChange={(event) => setForm((current) => ({ ...current, salary: event.target.value }))}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus anggota tim?"
        message={`"${deleteTarget?.name ?? ""}" akan dihapus beserta seluruh alokasinya pada tugas.`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
