import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import { EDGE_TYPE_CONFIG, MEMORY_TYPE_CONFIG } from "../lib/memoryConfig";
import type { GraphSnapshot, MemoryNode, TopicEdge, TopicNode } from "../types";

interface GraphPanelProps {
  snapshot: GraphSnapshot | null;
}

type GraphNode =
  | (d3.SimulationNodeDatum & {
      id: string;
      kind: "topic";
      radius: number;
      topic: TopicNode;
    })
  | (d3.SimulationNodeDatum & {
      id: string;
      kind: "memory";
      radius: number;
      memory: MemoryNode;
    });

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  id: string;
  type: TopicEdge["type"] | "memory";
  weight: number;
};

interface TooltipState {
  x: number;
  y: number;
  title: string;
  body: string;
  meta?: string;
}

const TOPIC_RADIUS = 44;
const MEMORY_RADIUS = 17;
const MEMORY_EDGE_COLOR = "#30363d";
const TOPIC_COLORS = [
  "#58a6ff",
  "#3fb950",
  "#d29922",
  "#bc8cff",
  "#f85149",
  "#39c5cf",
];

function isTopicNode(node: GraphNode): node is Extract<GraphNode, { kind: "topic" }> {
  return node.kind === "topic";
}

function getNodePoint(value: string | number | GraphNode): { x: number; y: number } {
  if (typeof value === "object") {
    return { x: value.x ?? 0, y: value.y ?? 0 };
  }

  return { x: 0, y: 0 };
}

function getTopicColor(topic: TopicNode): string {
  return TOPIC_COLORS[Math.abs(topic.topicOrder) % TOPIC_COLORS.length] ?? "#58a6ff";
}

function getMemoryColor(memory: MemoryNode): string {
  return MEMORY_TYPE_CONFIG[memory.memoryType]?.graphColor ?? "#8b949e";
}

function getLinkColor(link: GraphLink): string {
  if (link.type === "memory") {
    return MEMORY_EDGE_COLOR;
  }

  return EDGE_TYPE_CONFIG[link.type].color;
}

function getLinkDash(link: GraphLink): string | null {
  if (link.type === "memory") {
    return null;
  }

  const dash = EDGE_TYPE_CONFIG[link.type].dash;
  return dash === "none" ? null : dash;
}

function getLinkPath(link: GraphLink): string {
  const source = getNodePoint(link.source as string | number | GraphNode);
  const target = getNodePoint(link.target as string | number | GraphNode);

  if (link.type !== "reentry") {
    return `M${source.x},${source.y}L${target.x},${target.y}`;
  }

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  const cx = mx - dy * 0.25;
  const cy = my + dx * 0.25;

  return `M${source.x},${source.y}Q${cx},${cy} ${target.x},${target.y}`;
}

function buildGraph(snapshot: GraphSnapshot): {
  nodes: GraphNode[];
  links: GraphLink[];
  topicByMemoryId: Map<string, string>;
} {
  const topicIds = new Set(snapshot.nodes.map((node) => node.id));
  const topicByMemoryId = new Map<string, string>();
  const nodes: GraphNode[] = [
    ...snapshot.nodes.map((topic) => ({
      id: `topic:${topic.id}`,
      kind: "topic" as const,
      radius: TOPIC_RADIUS,
      topic,
    })),
    ...snapshot.memories.map((memory) => {
      const memoryId = `memory:${memory.id}`;
      topicByMemoryId.set(memoryId, `topic:${memory.topicNodeId}`);

      return {
        id: memoryId,
        kind: "memory" as const,
        radius: MEMORY_RADIUS,
        memory,
      };
    }),
  ];

  const topicLinks: GraphLink[] = snapshot.edges
    .filter((edge) => topicIds.has(edge.srcId) && topicIds.has(edge.dstId))
    .map((edge) => ({
      id: `edge:${edge.srcId}:${edge.dstId}:${edge.type}`,
      source: `topic:${edge.srcId}`,
      target: `topic:${edge.dstId}`,
      type: edge.type,
      weight: edge.weight,
    }));

  const memoryLinks: GraphLink[] = snapshot.memories
    .filter((memory) => topicIds.has(memory.topicNodeId))
    .map((memory) => ({
      id: `memory-edge:${memory.id}:${memory.topicNodeId}`,
      source: `topic:${memory.topicNodeId}`,
      target: `memory:${memory.id}`,
      type: "memory",
      weight: 1,
    }));

  return { nodes, links: [...topicLinks, ...memoryLinks], topicByMemoryId };
}

function seedNodes(nodes: GraphNode[], width: number, height: number) {
  const topics = nodes.filter(isTopicNode);
  const centerX = width / 2;
  const centerY = height / 2;
  const ring = Math.max(190, Math.min(width, height) * 0.34);

  for (const [index, node] of topics.entries()) {
    const angle =
      topics.length === 1
        ? -Math.PI / 2
        : -Math.PI / 2 + (index / topics.length) * Math.PI * 2;
    node.x = centerX + Math.cos(angle) * ring;
    node.y = centerY + Math.sin(angle) * ring;
  }

  for (const [index, node] of nodes.entries()) {
    if (isTopicNode(node)) {
      continue;
    }

    const angle = index * 2.399963229728653;
    node.x = centerX + Math.cos(angle) * ring * 0.95;
    node.y = centerY + Math.sin(angle) * ring * 0.95;
  }
}

function memoryTetherForce(topicByMemoryId: Map<string, string>) {
  let nodes: GraphNode[] = [];
  const byId = new Map<string, GraphNode>();
  const distance = 118;
  const strength = 0.12;

  function force(alpha: number) {
    for (const node of nodes) {
      if (node.kind !== "memory") {
        continue;
      }

      const topicId = topicByMemoryId.get(node.id);
      const topic = topicId ? byId.get(topicId) : undefined;
      if (!topic) {
        continue;
      }

      const dx = (node.x ?? 0) - (topic.x ?? 0);
      const dy = (node.y ?? 0) - (topic.y ?? 0);
      const length = Math.sqrt(dx * dx + dy * dy) || 1;
      const delta = (length - distance) / length;
      const push = delta * strength * alpha;
      const offsetX = dx * push;
      const offsetY = dy * push;

      node.vx = (node.vx ?? 0) - offsetX;
      node.vy = (node.vy ?? 0) - offsetY;
      topic.vx = (topic.vx ?? 0) + offsetX * 0.08;
      topic.vy = (topic.vy ?? 0) + offsetY * 0.08;
    }
  }

  force.initialize = (nextNodes: GraphNode[]) => {
    nodes = nextNodes;
    byId.clear();
    for (const node of nextNodes) {
      byId.set(node.id, node);
    }
  };

  return force;
}

export function GraphPanel({ snapshot }: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const hasGraphData = Boolean(
    snapshot && (snapshot.nodes.length > 0 || snapshot.memories.length > 0),
  );

  const graph = useMemo(() => {
    return snapshot ? buildGraph(snapshot) : { nodes: [], links: [], topicByMemoryId: new Map<string, string>() };
  }, [snapshot]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const next = {
        width: Math.round(Math.max(0, rect.width)),
        height: Math.round(Math.max(0, rect.height)),
      };

      setSize((current) => {
        if (current.width === next.width && current.height === next.height) {
          return current;
        }

        return next;
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [hasGraphData]);

  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    const width = size.width || Math.round(container?.getBoundingClientRect().width ?? 0);
    const height =
      size.height || Math.round(container?.getBoundingClientRect().height ?? 0);

    if (!svg || !container || width === 0 || height === 0) {
      return;
    }

    const nodes = graph.nodes.map((node) => ({ ...node }));
    const links = graph.links.map((link) => ({ ...link }));
    seedNodes(nodes, width, height);

    const selection = d3.select(svg);
    selection.selectAll("*").remove();

    const linkLayer = selection.append("g").attr("class", "links");
    const nodeLayer = selection.append("g").attr("class", "nodes");
    const labelLayer = selection.append("g").attr("class", "labels");

    const linkPaths = linkLayer
      .selectAll<SVGPathElement, GraphLink>("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", getLinkColor)
      .attr("stroke-width", (link) => (link.type === "memory" ? 1.4 : 2.1))
      .attr("stroke-opacity", (link) => (link.type === "memory" ? 0.42 : 0.9))
      .attr("stroke-dasharray", getLinkDash);

    const nodeGroups = nodeLayer
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "grab")
      .on("mouseenter", function (event, node) {
        const rect = container.getBoundingClientRect();
        const circle = d3.select(this).select<SVGCircleElement>("circle");

        circle
          .interrupt()
          .transition()
          .duration(130)
          .attr("r", node.radius + (isTopicNode(node) ? 8 : 5))
          .attr("stroke-width", isTopicNode(node) ? 3 : 2.6)
          .attr("filter", "drop-shadow(0 0 10px rgba(88, 166, 255, 0.45))");

        if (isTopicNode(node)) {
          setTooltip({
            x: event.clientX - rect.left + 12,
            y: event.clientY - rect.top + 12,
            title: node.topic.label,
            body: node.topic.summary || "No summary yet.",
            meta: `Drift score ${node.topic.driftScore.toFixed(2)}`,
          });
        } else {
          const config = MEMORY_TYPE_CONFIG[node.memory.memoryType];
          setTooltip({
            x: event.clientX - rect.left + 12,
            y: event.clientY - rect.top + 12,
            title: config.label,
            body: `${node.memory.subject}: ${node.memory.value}`,
            meta: `Confidence ${Math.round(node.memory.confidence * 100)}%`,
          });
        }
      })
      .on("mousemove", (event) => {
        const rect = container.getBoundingClientRect();
        setTooltip((current) =>
          current
            ? {
                ...current,
                x: event.clientX - rect.left + 12,
                y: event.clientY - rect.top + 12,
              }
            : null,
        );
      })
      .on("mouseleave", function (_event, node) {
        d3.select(this)
          .select<SVGCircleElement>("circle")
          .interrupt()
          .transition()
          .duration(160)
          .attr("r", node.radius)
          .attr("stroke-width", isTopicNode(node) ? 2.1 : 1.4)
          .attr("filter", null);

        setTooltip(null);
      });

    nodeGroups
      .append("circle")
      .attr("r", (node) => node.radius)
      .attr("fill", (node) =>
        isTopicNode(node) ? `${getTopicColor(node.topic)}33` : getMemoryColor(node.memory),
      )
      .attr("stroke", (node) =>
        isTopicNode(node) ? getTopicColor(node.topic) : "#e6edf3",
      )
      .attr("stroke-opacity", (node) => (isTopicNode(node) ? 0.95 : 0.78))
      .attr("stroke-width", (node) => (isTopicNode(node) ? 2.1 : 1.4));

    const labels = labelLayer
      .selectAll<SVGTextElement, GraphNode>("text")
      .data(nodes.filter(isTopicNode))
      .join("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#e6edf3")
      .attr("font-size", 21)
      .attr("font-weight", 700)
      .attr("pointer-events", "none")
      .text((node) => String(node.topic.topicOrder));

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .alphaDecay(0.035)
      .velocityDecay(0.58)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((node) => node.id)
          .distance((link) => (link.type === "memory" ? 128 : 250))
          .strength((link) => (link.type === "memory" ? 0.22 : 0.16)),
      )
      .force(
        "charge",
        d3.forceManyBody<GraphNode>().strength((node) => (isTopicNode(node) ? -125 : -8)),
      )
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.045))
      .force("memory-tether", memoryTetherForce(graph.topicByMemoryId))
      .force(
        "collide",
        d3
          .forceCollide<GraphNode>()
          .radius((node) => (isTopicNode(node) ? TOPIC_RADIUS + 18 : MEMORY_RADIUS + 8))
          .iterations(2),
      )
      .on("tick", () => {
        linkPaths.attr("d", getLinkPath);
        nodeGroups.attr("transform", (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);
        labels.attr("x", (node) => node.x ?? 0).attr("y", (node) => node.y ?? 0);
      });

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, node) => {
        d3.select(event.sourceEvent.currentTarget).attr("cursor", "grabbing");
        if (!event.active) {
          simulation.alphaTarget(0.12).restart();
        }
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        d3.select(event.sourceEvent.currentTarget).attr("cursor", "grab");
        if (!event.active) {
          simulation.alphaTarget(0);
        }
        node.fx = null;
        node.fy = null;
      });

    nodeGroups.call(drag);

    return () => {
      simulation.stop();
      selection.selectAll("*").remove();
    };
  }, [graph, resetKey, size]);

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="animate-pulse rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted">
          Loading knowledge graph
        </div>
      </div>
    );
  }

  if (snapshot.nodes.length === 0 && snapshot.memories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-bg text-sm text-muted">
        Your knowledge graph will appear here
      </div>
    );
  }

  return (
    <section ref={containerRef} className="relative h-full overflow-hidden bg-bg">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
        className="block h-full w-full"
        role="img"
        aria-label="Developer memory knowledge graph"
      />

      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-surface/95 px-3 py-2">
        <div className="text-xs font-semibold text-white">Knowledge graph</div>
        <div className="mt-1 text-[11px] text-muted">
          {snapshot.nodes.length} topics / {snapshot.memories.length} memories /{" "}
          {snapshot.edges.length} edges
        </div>
      </div>

      <button
        type="button"
        onClick={() => setResetKey((value) => value + 1)}
        className="absolute right-3 top-3 rounded-md border border-border bg-surface/95 px-3 py-2 text-xs font-semibold text-accent transition hover:border-accent hover:bg-accent/10"
      >
        Reset graph
      </button>

      <div className="absolute bottom-3 right-3 rounded-md border border-border bg-surface/95 px-3 py-2">
        <div className="mb-2 text-[11px] font-semibold uppercase text-muted">
          Edges
        </div>
        <div className="space-y-1.5">
          {Object.entries(EDGE_TYPE_CONFIG).map(([type, config]) => (
            <div key={type} className="flex items-center gap-2 text-[11px] text-muted">
              <svg width="34" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="34"
                  y2="4"
                  stroke={config.color}
                  strokeWidth="2"
                  strokeDasharray={config.dash === "none" ? undefined : config.dash}
                />
              </svg>
              <span>{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-md border border-border bg-surface px-3 py-2 shadow-xl"
          style={{
            left: Math.min(tooltip.x, Math.max(0, size.width - 272)),
            top: Math.min(tooltip.y, Math.max(0, size.height - 132)),
          }}
        >
          <div className="text-xs font-semibold text-white">{tooltip.title}</div>
          <div className="mt-1 line-clamp-3 text-xs leading-5 text-muted">
            {tooltip.body}
          </div>
          {tooltip.meta ? (
            <div className="mt-2 text-[11px] text-accent">{tooltip.meta}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
