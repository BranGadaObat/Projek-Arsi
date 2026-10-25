import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { holidayCreateSchema, parseWeekendDays, validateWeekendDays, type HolidayDto } from "shared";
import { api, ApiError } from "../api/client";
import { useProject, useRefreshProject } from "../hooks/useProjectData";
import { formatDate, WEEKDAY_LABELS } from "../lib/format";
import { useToast } from "../components/ui/Toast";
import { MonthCalendar } from "../components/calendar/MonthCalendar";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { ConfirmDialog } from "../components/ui/Modal";
import { Badge, EmptyState, SectionCard, Spinner, StatTile } from "../components/ui/Misc";
import { AlertIcon, CalendarIcon, PlusIcon, TrashIcon } from "../components/ui/Icons";

interface HolidayForm {
  date: string;
  name: string;
}

const EMPTY_HOLIDAY: HolidayForm = { date: "", name: "" };

export function CalendarPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const project = useProject(id);
  const refresh = useRefreshProject(id);

  const [weekend, setWeekend] = useState<number[] | null>(null);
  const [holidayForm, setHolidayForm] = useState<HolidayForm>(EMPTY_HOLIDAY);
  const [holidayError, setHolidayError] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<HolidayDto | null>(null);

  const snapshot = project.data;
  const holidays = snapshot?.holidays ?? [];
  const savedWeekend = snapshot ? parseWeekendDays(snapshot.project.weekendDays) : [];
  const activeWeekend = weekend ?? savedWeekend;
  const weekendDirty =
    activeWeekend.length !== savedWeekend.length ||
    activeWeekend.some((day, index) => day !== savedWeekend[index]);
  const weekendError = weekendDirty ? validateWeekendDays(activeWeekend) : null;

  const saveWeekendMutation = useMutation({
    mutationFn: () => api.updateCalendar(id, activeWeekend),
    onSuccess: () => {
      refresh.reload();
      refresh.analysis();
      toast.success("Jadwal diperbarui.");
      setWeekend(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal menyimpan kalender."),
  });

  const addHolidayMutation = useMutation({
    mutationFn: () => {
      const parsed = holidayCreateSchema.safeParse(holidayForm);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          details[String(issue.path[0] ?? "_")] = [issue.message];
        }
        throw new ApiError("Periksa kembali data hari libur.", 422, "VALIDATION_ERROR", details);
      }
      return api.createHoliday(id, parsed.data);
    },
    onSuccess: (response) => {
      refresh.applyHolidays(response.holidays);
      refresh.reload();
      toast.success(`Hari libur "${response.holiday.name}" ditambahkan.`);
      setHolidayForm(EMPTY_HOLIDAY);
      setHolidayError({});
    },
    onError: (error) => {
      if (error instanceof ApiError && Object.keys(error.details).length > 0) {
        const details: Record<string, string> = {};
        for (const [key, messages] of Object.entries(error.details)) details[key] = messages[0];
        setHolidayError(details);
      } else {
        toast.error(error instanceof Error ? error.message : "Gagal menambahkan hari libur.");
      }
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (holidayId: string) => api.deleteHoliday(holidayId),
    onSuccess: (response) => {
      refresh.applyHolidays(response.holidays);
      refresh.reload();
      toast.success("Hari libur dihapus.");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal menghapus hari libur."),
  });

  function toggleWeekend(day: number): void {
    setWeekend(
      activeWeekend.includes(day)
        ? activeWeekend.filter((item) => item !== day)
        : [...activeWeekend, day].sort((a, b) => a - b),
    );
  }

  if (!snapshot) {
    return <Spinner label="Memuat kalender proyek…" />;
  }

  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const hasTasks = snapshot.tasks.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Kalender kerja</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Hari kerja menentukan durasi, penjadwalan ulang, dan perhitungan jalur kritis.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Hari akhir pekan"
          value={activeWeekend.map((day) => WEEKDAY_LABELS[day]).join(", ") || "Tidak ada"}
          hint="Durasi hanya menghitung hari kerja"
          icon={<CalendarIcon className="size-4" />}
        />
        <StatTile
          label="Hari libur"
          value={holidays.length}
          hint="Dikecualikan dari penjadwalan"
          icon={<CalendarIcon className="size-4" />}
          tone="info"
        />
        <StatTile
          label="Tugas terpengaruh"
          value={hasTasks ? snapshot.tasks.length : 0}
          hint="Dihitung ulang saat kalender berubah"
          icon={<AlertIcon className="size-4" />}
          tone={hasTasks ? "warning" : "neutral"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <SectionCard
          title="Hari akhir pekan"
          description="Pilih hari yang tidak dihitung sebagai hari kerja."
          bodyClassName="p-4"
        >
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, day) => {
            const active = activeWeekend.includes(day);
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
        {weekendError ? (
          <p role="alert" className="mt-2 text-xs font-medium text-danger">
            {weekendError}
          </p>
        ) : null}
        <div className="mt-4 flex items-center gap-2">
          <Button
            disabled={!weekendDirty || Boolean(weekendError)}
            loading={saveWeekendMutation.isPending}
            onClick={() => saveWeekendMutation.mutate()}
          >
            Simpan kalender
          </Button>
          {weekendDirty && !weekendError ? (
            <span className="text-[12px] text-warning">Ada perubahan yang belum disimpan.</span>
          ) : null}
        </div>
      </SectionCard>

        <SectionCard
          title="Kalender bulanan"
          description="Hari non-kerja ditandai otomatis."
          bodyClassName="p-4"
        >
          <MonthCalendar
            weekendDays={activeWeekend}
            holidays={holidays.map((holiday) => holiday.date)}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Hari libur"
        description="Tanggal libur meniadakan hari kerja pada penjadwalan."
        bodyClassName="p-4"
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            addHolidayMutation.mutate();
          }}
        >
          <Field label="Tanggal" htmlFor="holiday-date" required error={holidayError.date} className="w-full sm:w-44">
            <Input
              id="holiday-date"
              type="date"
              value={holidayForm.date}
              error={Boolean(holidayError.date)}
              onChange={(event) =>
                setHolidayForm((current) => ({ ...current, date: event.target.value }))
              }
            />
          </Field>
          <Field
            label="Nama hari libur"
            htmlFor="holiday-name"
            required
            error={holidayError.name}
            className="w-full min-w-[200px] flex-1"
          >
            <Input
              id="holiday-name"
              placeholder="Contoh: Hari Libur Nasional"
              value={holidayForm.name}
              error={Boolean(holidayError.name)}
              onChange={(event) =>
                setHolidayForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <Button type="submit" loading={addHolidayMutation.isPending}>
            <PlusIcon className="size-4" />
            Tambah
          </Button>
        </form>

        <div className="mt-4">
          {sortedHolidays.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon className="size-6" />}
              title="Belum ada hari libur"
              description="Tambahkan tanggal libur nasional atau cuti tim agar penjadwalan melewati hari tersebut."
            />
          ) : (
            <ul className="divide-y divide-line">
              {sortedHolidays.map((holiday) => (
                <li key={holiday.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-info-bg text-info">
                    <CalendarIcon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{holiday.name}</p>
                    <p className="tabular text-[12px] text-ink-3">{formatDate(holiday.date)}</p>
                  </div>
                  <Badge tone="info">Libur</Badge>
                  <button
                    type="button"
                    aria-label={`Hapus ${holiday.name}`}
                    onClick={() => setDeleteTarget(holiday)}
                    className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-bg hover:text-danger"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus hari libur?"
        message={`"${deleteTarget?.name ?? ""}" akan dihapus dan jadwal tugas dihitung ulang tanpa tanggal tersebut.`}
        loading={deleteHolidayMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteHolidayMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
