import { useMemo, useState } from "react";
import type { PertNode, PertResult } from "shared";
import { Button } from "../ui/Button";
import { ZoomInIcon, ZoomOutIcon } from "../ui/Icons";

interface PertDiagramProps {
  result: PertResult;
  /** Mengubah ordinal hari kerja menjadi label tanggal, bila tersedia. */
  dateFor?: (ordinal: number) => string | null;
}

const NODE_WIDTH = 208;
const NODE_HEIGHT = 124;
const GAP_X = 68;
const GAP_Y = 18;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

interface Placed {
  node: PertNode;
  x: number;
  y: number;
}

function layout(result: PertResult): { placed: Placed[]; width: number; height: number } {
  const byColumn = new Map<number, PertNode[]>();
  for (const node of result.nodes) {
    const list = byColumn.get(node.column) ?? [];
    list.push(node);
    byColumn.set(node.column, list);
  }

  const placed: Placed[] = [];
  const columns = [...byColumn.keys()].sort((a, b) => a - b);
  for (const column of columns) {
    const nodes = byColumn.get(column) ?? [];
    nodes.forEach((node, row) => {
      placed.push({
        node,
        x: column * (NODE_WIDTH + GAP_X),
        y: row * (NODE_HEIGHT + GAP_Y),
      });
    });
  }

  const maxColumn = columns.length - 1;
  const maxRows = Math.max(1, ...[...byColumn.values()].map((list) => list.length));
  return {
    placed,
    width: (maxColumn + 1) * NODE_WIDTH + maxColumn * GAP_X,
    height: maxRows * NODE_HEIGHT + (maxRows - 1) * GAP_Y,
  };
}

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5];

export function PertDiagram({ result, dateFor }: PertDiagramProps) {
  const [zoomIndex, setZoomIndex] = useState(2);

  const { placed, width, height } = useMemo(() => layout(result), [result]);
  const positions = useMemo(
    () => new Map(placed.map((item) => [item.node.taskId, item])),
    [placed],
  );

  if (result.nodes.length === 0) {
    return (
      <p className="p-4 text-[13px] text-ink-2">
        Belum ada tugas daun untuk ditampilkan pada diagram PERT.
      </p>
    );
  }

  const zoom = ZOOM_STEPS[zoomIndex];

  const edges = result.edges.map((edge, index) => {
    const from = positions.get(edge.predecessorId);
    const to = positions.get(edge.successorId);
    if (!from || !to) return null;
    const x1 = from.x + NODE_WIDTH;
    const y1 = from.y + NODE_HEIGHT / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_HEIGHT / 2;
    const midX = x1 + (x2 - x1) / 2;
    const path =
      edge.type === "SS"
        ? `M ${from.x} ${from.y + NODE_HEIGHT / 2} L ${midX} ${from.y + NODE_HEIGHT / 2} L ${midX} ${y2} L ${x2} ${y2}`
        : `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    return (
      <path
        key={`${edge.predecessorId}-${edge.successorId}-${index}`}
        d={path}
        fill="none"
        data-critical={edge.critical ? "true" : "false"}
        className={edge.critical ? "stroke-danger" : "stroke-ink-3"}
        strokeWidth={edge.critical ? 2 : 1.5}
        strokeDasharray={edge.type === "SS" ? "6 4" : undefined}
        markerEnd={edge.critical ? "url(#pert-arrow-critical)" : "url(#pert-arrow)"}
      />
    );
  });

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Perkecil diagram PERT"
          disabled={zoomIndex === 0}
          onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
        >
          <ZoomOutIcon className="size-3.5" />
        </Button>
        <span className="tabular text-[12px] text-ink-2">{Math.round(zoom * 100)}%</span>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Perbesar diagram PERT"
          disabled={zoomIndex === ZOOM_STEPS.length - 1}
          onClick={() => setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))}
        >
          <ZoomInIcon className="size-3.5" />
        </Button>
        <span className="ml-2 text-[11px] text-ink-3">
          Gulir untuk melihat seluruh jaringan · garis merah = jalur kritis, putus-putus = SS
        </span>
      </div>

      <div className="max-h-[480px] overflow-auto p-4">
        <svg
          role="img"
          aria-label="Diagram PERT"
          width={width * zoom}
          height={height * zoom}
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-full"
        >
          <defs>
            <marker id="pert-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-ink-3" />
            </marker>
            <marker id="pert-arrow-critical" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-danger" />
            </marker>
          </defs>

          <g>{edges}</g>

          <g>
            {placed.map(({ node, x, y }) => (
              <g
                key={node.taskId}
                transform={`translate(${x}, ${y})`}
                data-testid="pert-node"
                data-critical={node.critical ? "true" : "false"}
                aria-label={`${node.name}, ${node.critical ? "kritis" : "longgar"}`}
              >
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={6}
                  className={
                    node.critical
                      ? "fill-danger-bg stroke-danger"
                      : "fill-surface stroke-line-strong"
                  }
                  strokeWidth={node.critical ? 2 : 1}
                />
                <text x={12} y={22} className="fill-ink text-[13px] font-semibold">
                  {truncate(node.name, 22)}
                </text>
                <text x={12} y={42} className="fill-ink-2 text-[11px]">
                  Durasi {node.duration} hr · Slack {node.totalFloat}
                </text>
                <text x={12} y={60} className="fill-ink-2 text-[11px]">
                  ES {dateFor?.(node.es) ?? node.es} → EF {dateFor?.(node.ef) ?? node.ef}
                </text>
                <text x={12} y={78} className="fill-ink-2 text-[11px]">
                  LS {dateFor?.(node.ls) ?? node.ls} → LF {dateFor?.(node.lf) ?? node.lf}
                </text>
                <text x={12} y={96} className="fill-ink-3 text-[11px]">
                  {node.te !== null && node.variance !== null
                    ? `TE ${node.te.toFixed(2)} hr · Varians ${node.variance.toFixed(2)}`
                    : "Tanpa estimasi PERT"}
                </text>
                {node.critical ? (
                  <text x={12} y={114} className="fill-danger text-[11px] font-semibold">
                    KRITIS
                  </text>
                ) : (
                  <text x={12} y={114} className="fill-ink-3 text-[11px]">
                    Longgar
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
