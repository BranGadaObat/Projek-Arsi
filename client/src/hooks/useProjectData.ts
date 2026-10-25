import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createCalendar,
  parseWeekendDays,
  type AnalysisResult,
  type HolidayDto,
  type ProjectCalendar,
  type ProjectSnapshot,
  type TaskDto,
} from "shared";
import { api } from "../api/client";

export const projectsKey = ["projects"] as const;
export const projectKey = (id: string) => ["project", id] as const;
export const analysisKey = (id: string) => ["analysis", id] as const;

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKey(projectId),
    queryFn: () => api.getProject(projectId),
    enabled: Boolean(projectId),
  });
}

export function useAnalysis(projectId: string) {
  return useQuery({
    queryKey: analysisKey(projectId),
    queryFn: () => api.getAnalysis(projectId),
    enabled: Boolean(projectId),
  });
}

export function projectCalendar(snapshot: ProjectSnapshot): ProjectCalendar {
  return createCalendar(
    parseWeekendDays(snapshot.project.weekendDays),
    snapshot.holidays.map((holiday) => holiday.date),
  );
}

export function setSnapshotTasks(
  queryClient: QueryClient,
  projectId: string,
  tasks: TaskDto[],
): void {
  queryClient.setQueryData<ProjectSnapshot>(projectKey(projectId), (snapshot) =>
    snapshot ? { ...snapshot, tasks } : snapshot,
  );
  void queryClient.invalidateQueries({ queryKey: analysisKey(projectId) });
}

export function setSnapshotHolidays(
  queryClient: QueryClient,
  projectId: string,
  holidays: HolidayDto[],
): void {
  queryClient.setQueryData<ProjectSnapshot>(projectKey(projectId), (snapshot) =>
    snapshot ? { ...snapshot, holidays } : snapshot,
  );
  void queryClient.invalidateQueries({ queryKey: analysisKey(projectId) });
}

export function useRefreshProject(projectId: string) {
  const queryClient = useQueryClient();
  return {
    applyTasks: (tasks: TaskDto[]) => setSnapshotTasks(queryClient, projectId, tasks),
    applyHolidays: (holidays: HolidayDto[]) => setSnapshotHolidays(queryClient, projectId, holidays),
    reload: () => queryClient.invalidateQueries({ queryKey: projectKey(projectId) }),
    analysis: () => queryClient.invalidateQueries({ queryKey: analysisKey(projectId) }),
    analysisData: () => queryClient.getQueryData<AnalysisResult>(analysisKey(projectId)),
  };
}
