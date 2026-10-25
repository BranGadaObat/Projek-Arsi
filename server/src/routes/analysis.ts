import { Router } from "express";
import {
  buildPert,
  computeCosts,
  computeCpm,
  computeResourceLoad,
  createCalendar,
  parseDate,
  parseWeekendDays,
  workingDaysBetween,
  type AnalysisResult,
} from "shared";
import { asyncHandler, currentUserId } from "../middleware/auth.js";
import { getSnapshot } from "../services/snapshot.js";

export const analysisRouter = Router();

analysisRouter.get(
  "/projects/:id/analysis",
  asyncHandler(async (req, res) => {
    const snapshot = await getSnapshot(req.params.id, currentUserId(req));
    const { project, tasks, dependencies, resources, assignments, holidays } = snapshot;
    const calendar = createCalendar(
      parseWeekendDays(project.weekendDays),
      holidays.map((holiday) => holiday.date),
    );

    const estimates = Object.fromEntries(
      tasks.map((task) => [
        task.id,
        { optimisticDays: task.optimisticDays, pessimisticDays: task.pessimisticDays },
      ]),
    );

    const cpm = computeCpm({
      tasks,
      taskNames: Object.fromEntries(tasks.map((task) => [task.id, task.name])),
      dependencies,
      projectStartDate: project.startDate,
      calendar,
    });

    const pert = buildPert({
      tasks,
      cpmNodes: cpm.nodes,
      criticalPath: cpm.criticalPath,
      dependencies,
      estimates,
    });

    const cost = computeCosts({ tasks, resources, assignments });
    const resourceLoad = computeResourceLoad({ tasks, resources, assignments, calendar });

    const parentIds = new Set(tasks.filter((task) => task.parentId).map((task) => task.parentId as string));
    const leaves = tasks.filter((task) => !parentIds.has(task.id));
    const startDate =
      leaves.length === 0
        ? null
        : leaves.map((task) => task.scheduledStart).sort((a, b) => a.localeCompare(b))[0];
    const endDate =
      leaves.length === 0
        ? null
        : leaves.map((task) => task.scheduledEnd).sort((a, b) => b.localeCompare(a))[0];

    const result: AnalysisResult = {
      summary: {
        startDate,
        endDate,
        totalWorkingDays:
          startDate && endDate ? workingDaysBetween(parseDate(startDate), parseDate(endDate), calendar) : 0,
        totalCost: cost.total,
        criticalCount: cpm.nodes.filter((node) => node.critical).length,
      },
      cpm: cpm.nodes,
      criticalPath: cpm.criticalPath,
      pert,
      cost,
      resourceLoad,
    };

    res.json(result);
  }),
);
