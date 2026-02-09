import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";

interface DependencyGraphProps {
  graph: Record<string, string[]>;
  circularCount?: number;
}

const DIR_COLORS: Record<string, string> = {
  components: "#3b82f6", // blue
  hooks: "#10b981", // green
  utils: "#a855f7", // purple
  lib: "#a855f7",
  services: "#f59e0b", // amber
  api: "#f59e0b",
  pages: "#ec4899", // pink
  views: "#ec4899",
  routes: "#ec4899",
  store: "#ef4444", // red
  context: "#ef4444",
  styles: "#06b6d4", // cyan
  assets: "#06b6d4",
  types: "#6b7280", // gray
};

function getNodeColor(filePath: string): string {
  const parts = filePath.split("/");
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (DIR_COLORS[lower]) return DIR_COLORS[lower];
  }
  return "#6b7280"; // default gray
}

function getFileName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1];
}

function findCircularEdges(graph: Record<string, string[]>): Set<string> {
  const circularEdges = new Set<string>();
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      // Found a cycle - mark all edges in the cycle
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        for (let i = cycleStart; i < path.length - 1; i++) {
          circularEdges.add(`${path[i]}|${path[i + 1]}`);
        }
        circularEdges.add(`${path[path.length - 1]}|${node}`);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const dep of graph[node] ?? []) {
      dfs(dep, [...path]);
    }

    stack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    dfs(node, []);
  }

  return circularEdges;
}

function layoutGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 30, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 160, height: 36 });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 80, y: pos.y - 18 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function DependencyGraph({ graph }: DependencyGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const allFiles = new Set<string>();
    for (const [file, deps] of Object.entries(graph)) {
      allFiles.add(file);
      for (const dep of deps) {
        allFiles.add(dep);
      }
    }

    const circularEdges = findCircularEdges(graph);

    const rawNodes: Node[] = Array.from(allFiles).map((file) => {
      const color = getNodeColor(file);
      return {
        id: file,
        data: { label: getFileName(file) },
        position: { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: "#1a1a2e",
          color: "#e2e8f0",
          border: `1.5px solid ${color}`,
          borderRadius: "6px",
          fontSize: "11px",
          padding: "6px 10px",
          fontFamily: "monospace",
          width: 160,
        },
      };
    });

    const rawEdges: Edge[] = [];
    for (const [file, deps] of Object.entries(graph)) {
      for (const dep of deps) {
        const isCircular = circularEdges.has(`${file}|${dep}`);
        rawEdges.push({
          id: `${file}->${dep}`,
          source: file,
          target: dep,
          style: {
            stroke: isCircular ? "#ef4444" : "#374151",
            strokeWidth: isCircular ? 2 : 1,
          },
          animated: isCircular,
          label: isCircular ? "circular" : undefined,
          labelStyle: isCircular
            ? { fill: "#ef4444", fontSize: "9px", fontWeight: 600 }
            : undefined,
          labelBgStyle: isCircular
            ? { fill: "#1a1a2e", fillOpacity: 0.9 }
            : undefined,
        });
      }
    }

    return layoutGraph(rawNodes, rawEdges);
  }, [graph]);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100);
  }, []);

  if (nodes.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-border overflow-hidden"
      style={{ height: 600 }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onInit={onInit}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: "#0a0a0a" }}
      >
        <Background color="#1e1e2e" gap={20} />
      </ReactFlow>
    </div>
  );
}
