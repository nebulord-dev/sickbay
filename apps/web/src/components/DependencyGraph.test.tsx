import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges }: { nodes: Array<{id: string; data: {label: string}}>; edges: Array<{id: string; animated?: boolean}> }) => (
    <div data-testid="react-flow">
      {nodes.map((n) => (
        <div key={n.id} data-testid="flow-node">{n.data.label}</div>
      ))}
      {edges.map((e) => (
        <div key={e.id} data-testid="flow-edge" data-animated={String(e.animated ?? false)} />
      ))}
    </div>
  ),
  Background: () => <div data-testid="flow-background" />,
  Position: { Right: 'right', Left: 'left' },
}));

vi.mock('dagre', () => ({
  default: {
    graphlib: {
      Graph: class {
        setDefaultEdgeLabel = vi.fn();
        setGraph = vi.fn();
        setNode = vi.fn();
        setEdge = vi.fn();
        node = vi.fn(() => ({ x: 100, y: 100 }));
      },
    },
    layout: vi.fn(),
  },
}));

// Import after mocks are set up
const { DependencyGraph } = await import('./DependencyGraph.js');

describe('DependencyGraph', () => {
  it('renders null for an empty graph', () => {
    const { container } = render(<DependencyGraph graph={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the ReactFlow component for a non-empty graph', () => {
    render(<DependencyGraph graph={{ 'src/a.ts': ['src/b.ts'], 'src/b.ts': [] }} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('creates a node for each unique file in the graph', () => {
    render(<DependencyGraph graph={{ 'src/a.ts': ['src/b.ts'], 'src/b.ts': [] }} />);
    const nodes = screen.getAllByTestId('flow-node');
    expect(nodes).toHaveLength(2);
  });

  it('renders file names (not full paths) as node labels', () => {
    render(<DependencyGraph graph={{ 'src/components/Button.tsx': [], 'src/utils/helpers.ts': [] }} />);
    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    expect(screen.getByText('helpers.ts')).toBeInTheDocument();
  });

  it('marks circular dependency edges as animated', () => {
    // A → B → A forms a cycle
    const graph = { 'src/a.ts': ['src/b.ts'], 'src/b.ts': ['src/a.ts'] };
    render(<DependencyGraph graph={graph} />);
    const edges = screen.getAllByTestId('flow-edge');
    const animatedEdges = edges.filter((e) => e.getAttribute('data-animated') === 'true');
    expect(animatedEdges.length).toBeGreaterThan(0);
  });

  it('does not animate edges in a DAG with no cycles', () => {
    const graph = { 'src/a.ts': ['src/b.ts'], 'src/b.ts': ['src/c.ts'], 'src/c.ts': [] };
    render(<DependencyGraph graph={graph} />);
    const edges = screen.getAllByTestId('flow-edge');
    const animatedEdges = edges.filter((e) => e.getAttribute('data-animated') === 'true');
    expect(animatedEdges).toHaveLength(0);
  });
});
