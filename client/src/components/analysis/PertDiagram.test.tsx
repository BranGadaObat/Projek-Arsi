import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PertResult } from "shared";
import { PertDiagram } from "./PertDiagram";

function makeResult(): PertResult {
  return {
    nodes: [
      {
        taskId: "task-a",
        name: "Rancang database dan API",
        duration: 5,
        es: 0,
        ef: 4,
        ls: 0,
        lf: 4,
        totalFloat: 0,
        critical: true,
        column: 0,
        te: null,
        variance: null,
      },
      {
        taskId: "task-b",
        name: "Implementasi backend",
        duration: 10,
        es: 5,
        ef: 14,
        ls: 5,
        lf: 14,
        totalFloat: 0,
        critical: true,
        column: 1,
        te: 10.5,
        variance: 1.36,
      },
      {
        taskId: "task-c",
        name: "Skenario uji",
        duration: 3,
        es: 5,
        ef: 7,
        ls: 9,
        lf: 11,
        totalFloat: 4,
        critical: false,
        column: 1,
        te: null,
        variance: null,
      },
    ],
    edges: [
      { predecessorId: "task-a", successorId: "task-b", type: "FS", critical: true },
      { predecessorId: "task-a", successorId: "task-c", type: "SS", critical: false },
    ],
    criticalVariance: 1.36,
    criticalStdDev: 1.17,
  };
}

describe("PertDiagram", () => {
  it("menandai node dan panah kritis", () => {
    const { container } = render(<PertDiagram result={makeResult()} />);

    const nodes = screen.getAllByTestId("pert-node");
    expect(nodes).toHaveLength(3);

    const criticalNodes = container.querySelectorAll('[data-testid="pert-node"][data-critical="true"]');
    expect(criticalNodes).toHaveLength(2);

    const criticalEdges = container.querySelectorAll('path[data-critical="true"]');
    expect(criticalEdges.length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("KRITIS")).toHaveLength(2);
    expect(screen.getByText("Longgar")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Diagram PERT" })).toBeInTheDocument();
  });
});
