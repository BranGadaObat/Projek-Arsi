import { z } from "zod";
import { isValidDateString } from "./dates.js";
import { validateWeekendDays } from "./calendar.js";

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
  .refine((value) => isValidDateString(value), "Tanggal tidak valid.");

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Warna harus berupa kode hex, contoh #2563EB.");

export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"], {
  errorMap: () => ({ message: "Prioritas harus LOW, MEDIUM, atau HIGH." }),
});

export const dependencyTypeSchema = z.enum(["FS", "SS"], {
  errorMap: () => ({ message: "Tipe dependensi harus FS atau SS." }),
});

const idSchema = z.string().min(1, "ID wajib diisi.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80, "Nama maksimal 80 karakter."),
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama proyek wajib diisi.").max(120, "Nama proyek maksimal 120 karakter."),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: dateStringSchema,
  weekendDays: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .refine((days) => days === undefined || validateWeekendDays(days) === null, {
      message: "Akhir pekan tidak boleh berisi ketujuh hari.",
    }),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const taskCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama tugas wajib diisi.").max(160, "Nama tugas maksimal 160 karakter."),
  description: z.string().trim().max(2000).optional().nullable(),
  parentId: idSchema.nullable().optional(),
  durationDays: z
    .number()
    .int("Durasi harus bilangan bulat.")
    .min(1, "Durasi minimal 1 hari kerja.")
    .max(365, "Durasi maksimal 365 hari kerja."),
  startDate: dateStringSchema,
  priority: prioritySchema.default("MEDIUM"),
  color: colorSchema.default("#3B82F6"),
  progress: z.number().int().min(0, "Progres minimal 0.").max(100, "Progres maksimal 100.").default(0),
  optimisticDays: z.number().int().min(1).max(365).nullable().optional(),
  pessimisticDays: z.number().int().min(1).max(365).nullable().optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial();

export const taskMoveSchema = z.object({
  parentId: idSchema.nullable(),
  position: z.number().int().min(0, "Posisi tidak boleh negatif."),
});

export const dependencyCreateSchema = z.object({
  predecessorId: idSchema,
  type: dependencyTypeSchema.default("FS"),
  lagDays: z
    .number()
    .int("Jeda harus bilangan bulat.")
    .min(-365, "Jeda minimal -365 hari.")
    .max(365, "Jeda maksimal 365 hari.")
    .default(0),
});

export const dependencyUpdateSchema = z.object({
  type: dependencyTypeSchema.optional(),
  lagDays: z.number().int().min(-365).max(365).optional(),
});

export const resourceCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama anggota wajib diisi.").max(120),
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  role: z.string().trim().min(1, "Peran wajib diisi.").max(80),
  salary: z
    .number()
    .int("Gaji harus bilangan bulat.")
    .min(0, "Gaji tidak boleh negatif.")
    .max(1_000_000_000, "Gaji terlalu besar."),
});

export const resourceUpdateSchema = resourceCreateSchema.partial();

export const assignmentCreateSchema = z.object({
  resourceId: idSchema,
  allocationPercent: z.number().int().min(1, "Alokasi minimal 1%.").max(100, "Alokasi maksimal 100%.").default(100),
});

export const assignmentUpdateSchema = z.object({
  allocationPercent: z.number().int().min(1).max(100),
});

export const calendarUpdateSchema = z.object({
  weekendDays: z
    .array(z.number().int().min(0).max(6))
    .superRefine((days, ctx) => {
      const message = validateWeekendDays(days);
      if (message) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      }
    }),
});

export const holidayCreateSchema = z.object({
  date: dateStringSchema,
  name: z.string().trim().min(1, "Nama hari libur wajib diisi.").max(120),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type DependencyCreateInput = z.infer<typeof dependencyCreateSchema>;
export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;
