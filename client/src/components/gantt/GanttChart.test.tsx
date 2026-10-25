import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createCalendar } from "shared";
import { GanttChart } from "./GanttChart";
import { seedSnapshot } from "../../test/fixtures";

function renderChart() {
  const snapshot = seedSnapshot();
  const utils = render(
    <GanttChart
      snapshot={snapshot}
      calendar={createCalendar([0, 6], ["2026-11-11"])}
      zoom="day"
      highlightCritical
      criticalIds={new Set(["task-1-1", "task-1-2"])}
      focusTodaySignal={0}
      onOpenTask={vi.fn()}
      onTasksChange={vi.fn()}
      onSuccess={vi.fn()}
      onInfo={vi.fn()}
      onError={vi.fn()}
    />,
  );
  return { snapshot, ...utils };
}

describe("GanttChart", () => {
  it("merender bar Gantt untuk tugas daun dari data seed", () => {
    const { container } = renderChart();

    const bars = container.querySelectorAll(".gantt-bar");
    expect(bars).toHaveLength(3);

    const labels = [...bars].map((bar) => bar.getAttribute("aria-label") ?? "");
    expect(labels.some((label) => label.includes("Kickoff dan kebutuhan"))).toBe(true);
    expect(labels.some((label) => label.includes("Penyusunan spesifikasi"))).toBe(true);
    expect(labels.some((label) => label.includes("Riset dan wireframe"))).toBe(true);

    expect(screen.getAllByText("1 Perencanaan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 Desain").length).toBeGreaterThan(0);
  });

  it("merender panah dependensi FS dan SS dari data seed", () => {
    const { container } = renderChart();

    const edges = container.querySelectorAll('[data-testid="dependency-edge"]');
    expect(edges).toHaveLength(2);
    expect(edges[0]).toHaveAttribute("data-type", "FS");
    expect(edges[1]).toHaveAttribute("data-type", "SS");
    for (const edge of edges) {
      const path = edge.querySelector("path");
      expect(path?.getAttribute("d")).toBeTruthy();
    }
  });
});
