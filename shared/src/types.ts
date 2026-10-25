export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type DependencyType = "FS" | "SS";

export type ViewZoom = "day" | "week" | "month";

/** Data model yang dikirim API (tanggal selalu string ISO `YYYY-MM-DD`). */
export interface UserDto {
  id: string;
  name: string;
  email: string;
}

export interface ProjectDto {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  startDate: string;
  /** Daftar angka dipisah koma, 0 = Minggu ... 6 = Sabtu. */
  weekendDays: string;
  createdAt: string;
}

export interface HolidayDto {
  id: string;
  projectId: string;
  date: string;
  name: string;
}

export interface TaskDto {
  id: string;
  projectId: string;
  parentId: string | null;
  position: number;
  name: string;
  description: string | null;
  durationDays: number;
  startDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  priority: Priority;
  color: string;
  progress: number;
  optimisticDays: number | null;
  pessimisticDays: number | null;
}

export interface DependencyDto {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ResourceDto {
  id: string;
  projectId: string;
  name: string;
  email: string;
  role: string;
  salary: number;
}

export interface AssignmentDto {
  id: string;
  taskId: string;
  resourceId: string;
  allocationPercent: number;
}

export interface ProjectSnapshot {
  project: ProjectDto;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  holidays: HolidayDto[];
}

/** Bentuk minimal yang dibutuhkan mesin penjadwalan. */
export interface SchedulingTask {
  id: string;
  parentId: string | null;
  durationDays: number;
  startDate: string;
  progress: number;
}

export interface SchedulingDependency {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ScheduledTask extends SchedulingTask {
  scheduledStart: string;
  scheduledEnd: string;
}

export interface ScheduledValues {
  scheduledStart: string;
  scheduledEnd: string;
  durationDays: number;
  progress: number;
}

export interface CpmNode {
  taskId: string;
  name: string;
  duration: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  totalFloat: number;
  critical: boolean;
}

export interface CpmResult {
  nodes: CpmNode[];
  projectEnd: number;
  criticalPath: string[];
}

export interface PertNode extends CpmNode {
  column: number;
  te: number | null;
  variance: number | null;
}

export interface PertEdge {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  critical: boolean;
}

export interface PertResult {
  nodes: PertNode[];
  edges: PertEdge[];
  criticalVariance: number;
  criticalStdDev: number;
}

export interface CostBreakdown {
  total: number;
  byTask: Record<string, number>;
  byResource: Record<string, number>;
}

export interface OverAllocationDay {
  date: string;
  totalPercent: number;
}

export interface ResourceLoad {
  resourceId: string;
  name: string;
  overAllocationDays: OverAllocationDay[];
}

export interface AnalysisSummary {
  startDate: string | null;
  endDate: string | null;
  totalWorkingDays: number;
  totalCost: number;
  criticalCount: number;
}

export interface AnalysisResult {
  summary: AnalysisSummary;
  cpm: CpmNode[];
  criticalPath: string[];
  pert: PertResult;
  cost: CostBreakdown;
  resourceLoad: ResourceLoad[];
}
