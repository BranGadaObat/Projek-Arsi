import type {
  AnalysisResult,
  AssignmentDto,
  DependencyDto,
  DependencyType,
  HolidayDto,
  Priority,
  ProjectDto,
  ProjectSnapshot,
  ResourceDto,
  TaskDto,
  UserDto,
} from "shared";

const TOKEN_KEY = "gantt.token";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Penyimpanan bisa tidak tersedia (mode privat); sesi tetap berjalan di memori.
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      "Tidak bisa menghubungi server. Periksa koneksi Anda lalu coba lagi.",
      0,
      "NETWORK_ERROR",
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const payload = data as { error?: { message?: string; code?: string; details?: Record<string, string[]> } } | null;
    if (response.status === 401) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    throw new ApiError(
      payload?.error?.message ?? "Terjadi kesalahan pada permintaan.",
      response.status,
      payload?.error?.code ?? "UNKNOWN_ERROR",
      payload?.error?.details ?? {},
    );
  }

  return data as T;
}

export interface ProjectListItem extends ProjectDto {
  taskCount: number;
  resourceCount: number;
}

export interface TaskInput {
  name: string;
  description?: string | null;
  parentId?: string | null;
  durationDays: number;
  startDate: string;
  priority: Priority;
  color: string;
  progress: number;
  optimisticDays?: number | null;
  pessimisticDays?: number | null;
}

export interface ResourceInput {
  name: string;
  email: string;
  role: string;
  salary: number;
}

export const api = {
  async login(email: string, password: string): Promise<{ token: string; user: UserDto }> {
    return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  },
  async register(name: string, email: string, password: string): Promise<{ token: string; user: UserDto }> {
    return request("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
  },
  async me(): Promise<{ user: UserDto }> {
    return request("/auth/me");
  },

  async listProjects(): Promise<{ projects: ProjectListItem[] }> {
    return request("/projects");
  },
  async createProject(input: {
    name: string;
    description?: string | null;
    startDate: string;
    weekendDays?: number[];
  }): Promise<{ project: ProjectDto }> {
    return request("/projects", { method: "POST", body: JSON.stringify(input) });
  },
  async getProject(id: string): Promise<ProjectSnapshot> {
    return request(`/projects/${id}`);
  },
  async updateProject(
    id: string,
    input: { name?: string; description?: string | null; startDate?: string; weekendDays?: number[] },
  ): Promise<ProjectSnapshot> {
    return request(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  async deleteProject(id: string): Promise<{ ok: boolean }> {
    return request(`/projects/${id}`, { method: "DELETE" });
  },

  async createTask(projectId: string, input: TaskInput): Promise<{ task: TaskDto; tasks: TaskDto[] }> {
    return request(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(input) });
  },
  async updateTask(taskId: string, input: Partial<TaskInput>): Promise<{ tasks: TaskDto[] }> {
    return request(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  async deleteTask(taskId: string): Promise<{ tasks: TaskDto[] }> {
    return request(`/tasks/${taskId}`, { method: "DELETE" });
  },
  async moveTask(taskId: string, input: { parentId: string | null; position: number }): Promise<{ tasks: TaskDto[] }> {
    return request(`/tasks/${taskId}/move`, { method: "POST", body: JSON.stringify(input) });
  },

  async createDependency(
    taskId: string,
    input: { predecessorId: string; type: DependencyType; lagDays: number },
  ): Promise<{ dependency: DependencyDto; tasks: TaskDto[] }> {
    return request(`/tasks/${taskId}/dependencies`, { method: "POST", body: JSON.stringify(input) });
  },
  async updateDependency(
    dependencyId: string,
    input: { type?: DependencyType; lagDays?: number },
  ): Promise<{ dependency: DependencyDto; tasks: TaskDto[] }> {
    return request(`/dependencies/${dependencyId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  async deleteDependency(dependencyId: string): Promise<{ tasks: TaskDto[] }> {
    return request(`/dependencies/${dependencyId}`, { method: "DELETE" });
  },

  async listResources(projectId: string): Promise<{ resources: ResourceDto[] }> {
    return request(`/projects/${projectId}/resources`);
  },
  async createResource(projectId: string, input: ResourceInput): Promise<{ resource: ResourceDto }> {
    return request(`/projects/${projectId}/resources`, { method: "POST", body: JSON.stringify(input) });
  },
  async updateResource(resourceId: string, input: Partial<ResourceInput>): Promise<{ resource: ResourceDto }> {
    return request(`/resources/${resourceId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  async deleteResource(resourceId: string): Promise<{ ok: boolean }> {
    return request(`/resources/${resourceId}`, { method: "DELETE" });
  },

  async createAssignment(
    taskId: string,
    input: { resourceId: string; allocationPercent: number },
  ): Promise<{ assignment: AssignmentDto }> {
    return request(`/tasks/${taskId}/assignments`, { method: "POST", body: JSON.stringify(input) });
  },
  async updateAssignment(
    assignmentId: string,
    input: { allocationPercent: number },
  ): Promise<{ assignment: AssignmentDto }> {
    return request(`/assignments/${assignmentId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  async deleteAssignment(assignmentId: string): Promise<{ ok: boolean }> {
    return request(`/assignments/${assignmentId}`, { method: "DELETE" });
  },

  async updateCalendar(projectId: string, weekendDays: number[]): Promise<{ tasks: TaskDto[]; weekendDays: string }> {
    return request(`/projects/${projectId}/calendar`, {
      method: "PUT",
      body: JSON.stringify({ weekendDays }),
    });
  },
  async createHoliday(
    projectId: string,
    input: { date: string; name: string },
  ): Promise<{ holiday: HolidayDto; holidays: HolidayDto[]; tasks: TaskDto[] }> {
    return request(`/projects/${projectId}/holidays`, { method: "POST", body: JSON.stringify(input) });
  },
  async deleteHoliday(holidayId: string): Promise<{ holidays: HolidayDto[]; tasks: TaskDto[] }> {
    return request(`/holidays/${holidayId}`, { method: "DELETE" });
  },

  async getAnalysis(projectId: string): Promise<AnalysisResult> {
    return request(`/projects/${projectId}/analysis`);
  },
};
