import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import { EDGE_TYPE_CONFIG, MEMORY_TYPE_CONFIG } from "../lib/memoryConfig";
import type { GraphSnapshot, MemoryNode, TopicEdge, TopicNode } from "../types";

interface GraphPanelProps {
  snapshot: GraphSnapshot | null;
  title?: string;
  selectedTopicId?: string | null;
  graftLabel?: string;
  grafting?: boolean;
  maintenanceLabel?: string;
  maintenanceRunning?: boolean;
  onRunMaintenance?: () => void;
  onSelectTopic?: (topicId: string | null) => void;
  onGraftSelected?: () => void;
}

type GraphNode =
  | (d3.SimulationNodeDatum & {
      id: string;
      kind: "topic";
      radius: number;
      topic: TopicNode;
      displayNumber: number;
      state: NodeMaintenanceState;
    })
  | (d3.SimulationNodeDatum & {
      id: string;
      kind: "memory";
      radius: number;
      memory: MemoryNode;
      state: NodeMaintenanceState;
    });

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  id: string;
  type: TopicEdge["type"] | "memory" | "memory-conflict" | "memory-update";
  weight: number;
};

interface TooltipState {
  x: number;
  y: number;
  title: string;
  body: string;
  kind: "topic" | "memory";
  meta?: string;
  expanded?: boolean;
}

interface NodeMaintenanceState {
  decayed: boolean;
  conflict: boolean;
  versioned: boolean;
}

const TOPIC_RADIUS = 44;
const MEMORY_RADIUS = 12;
const MEMORY_EDGE_COLOR = "#39c5cf";
const MEMORY_CONFLICT_EDGE_COLOR = "#f85149";
const MEMORY_UPDATE_EDGE_COLOR = "#bc8cff";
const DEFAULT_ZOOM_SCALE = 0.82;
const TOPIC_COLORS = [
  "#58a6ff",
  "#3fb950",
  "#d29922",
  "#bc8cff",
  "#f85149",
  "#39c5cf",
];

const EMPTY_NODE_STATE: NodeMaintenanceState = {
  decayed: false,
  conflict: false,
  versioned: false,
};

function isTopicNode(node: GraphNode): node is Extract<GraphNode, { kind: "topic" }> {
  return node.kind === "topic";
}

function getNodePoint(value: string | number | GraphNode): { x: number; y: number } {
  if (typeof value === "object") {
    return { x: value.x ?? 0, y: value.y ?? 0 };
  }

  return { x: 0, y: 0 };
}

function getTopicColor(displayNumber: number): string {
  return TOPIC_COLORS[Math.abs(displayNumber) % TOPIC_COLORS.length] ?? "#58a6ff";
}

function getMemoryColor(memory: MemoryNode, state: NodeMaintenanceState): string {
  if (state.decayed) {
    return "#30363d";
  }

  return MEMORY_TYPE_CONFIG[memory.memoryType]?.graphColor ?? "#8b949e";
}

function getLinkColor(link: GraphLink): string {
  if (link.type === "memory") {
    return MEMORY_EDGE_COLOR;
  }

  if (link.type === "memory-conflict") {
    return MEMORY_CONFLICT_EDGE_COLOR;
  }

  if (link.type === "memory-update") {
    return MEMORY_UPDATE_EDGE_COLOR;
  }

  return EDGE_TYPE_CONFIG[link.type].color;
}

function getLinkDash(link: GraphLink): string | null {
  if (link.type === "memory-conflict") {
    return "5,4";
  }

  if (link.type === "memory") {
    return null;
  }

  if (link.type === "memory-update") {
    return null;
  }

  const dash = EDGE_TYPE_CONFIG[link.type].dash;
  return dash === "none" ? null : dash;
}

function getLinkPath(link: GraphLink): string {
  const source = getNodePoint(link.source as string | number | GraphNode);
  const target = getNodePoint(link.target as string | number | GraphNode);

  if (link.type !== "reentry" && link.type !== "memory-conflict") {
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

function getLinkTooltip(link: GraphLink): TooltipState | null {
  if (link.type !== "memory-conflict" && link.type !== "memory-update") {
    return null;
  }

  const source = link.source as GraphNode;
  const target = link.target as GraphNode;

  if (source.kind !== "memory" || target.kind !== "memory") {
    return null;
  }

  if (link.type === "memory-conflict") {
    return {
      x: 0,
      y: 0,
      title: "Conflict",
      body: `${source.memory.value} conflicts with ${target.memory.value}`,
      kind: "memory",
    };
  }

  return {
    x: 0,
    y: 0,
    title: "Version update",
    body: `New: ${source.memory.value}\nOld: ${target.memory.value}`,
    kind: "memory",
  };
}

function buildGraph(snapshot: GraphSnapshot): {
  nodes: GraphNode[];
  links: GraphLink[];
  topicByMemoryId: Map<string, string>;
} {
  const topicIds = new Set(snapshot.nodes.map((node) => node.id));
  const topicDisplayNumberById = getTopicDisplayNumberById(snapshot.nodes);
  const maintenanceStateByMemoryId = getMaintenanceStateByMemoryId(snapshot);
  const maintenanceStateByTopicId = getMaintenanceStateByTopicId(
    snapshot,
    maintenanceStateByMemoryId,
  );
  const topicByMemoryId = new Map<string, string>();
  const nodes: GraphNode[] = [
    ...snapshot.nodes.map((topic) => ({
      id: `topic:${topic.id}`,
      kind: "topic" as const,
      radius: TOPIC_RADIUS,
      topic,
      displayNumber: topicDisplayNumberById.get(topic.id) ?? 0,
      state: maintenanceStateByTopicId.get(topic.id) ?? EMPTY_NODE_STATE,
    })),
    ...snapshot.memories.map((memory) => {
      const memoryId = `memory:${memory.id}`;
      topicByMemoryId.set(memoryId, `topic:${memory.topicNodeId}`);

      return {
        id: memoryId,
        kind: "memory" as const,
        radius: MEMORY_RADIUS,
        memory,
        state: maintenanceStateByMemoryId.get(memory.id) ?? EMPTY_NODE_STATE,
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
  const memoryRelationshipLinks: GraphLink[] = (snapshot.memoryEdges ?? [])
    .filter((edge) => edge.edgeType === "conflicts" || edge.edgeType === "updates")
    .map((edge) => ({
      id: `memory-relation:${edge.id}:${edge.edgeType}`,
      source: `memory:${edge.sourceId}`,
      target: `memory:${edge.targetId}`,
      type: edge.edgeType === "conflicts" ? "memory-conflict" : "memory-update",
      weight: edge.weight,
    }));

  return {
    nodes,
    links: [...topicLinks, ...memoryLinks, ...memoryRelationshipLinks],
    topicByMemoryId,
  };
}

function getMaintenanceStateByMemoryId(
  snapshot: GraphSnapshot,
): Map<string, NodeMaintenanceState> {
  const stateByMemoryId = new Map<string, NodeMaintenanceState>();
  const conflictIds = new Set<string>();
  const versionIds = new Set<string>();

  for (const edge of snapshot.memoryEdges ?? []) {
    if (edge.edgeType === "conflicts") {
      conflictIds.add(edge.sourceId);
      conflictIds.add(edge.targetId);
    }

    if (edge.edgeType === "updates") {
      versionIds.add(edge.sourceId);
      versionIds.add(edge.targetId);
    }
  }

  for (const memory of snapshot.memories) {
    stateByMemoryId.set(memory.id, {
      decayed: memory.decayed,
      conflict: Boolean(memory.hasConflict) || conflictIds.has(memory.id),
      versioned: Boolean(memory.supersededBy) || versionIds.has(memory.id),
    });
  }

  return stateByMemoryId;
}

function getMaintenanceStateByTopicId(
  snapshot: GraphSnapshot,
  stateByMemoryId: Map<string, NodeMaintenanceState>,
): Map<string, NodeMaintenanceState> {
  const stateByTopicId = new Map<string, NodeMaintenanceState>();

  for (const memory of snapshot.memories) {
    const memoryState = stateByMemoryId.get(memory.id) ?? EMPTY_NODE_STATE;
    const current = stateByTopicId.get(memory.topicNodeId) ?? EMPTY_NODE_STATE;
    stateByTopicId.set(memory.topicNodeId, {
      decayed: current.decayed || memoryState.decayed,
      conflict: current.conflict || memoryState.conflict,
      versioned: current.versioned || memoryState.versioned,
    });
  }

  return stateByTopicId;
}

function getStateMeta(state: NodeMaintenanceState): string | undefined {
  const labels = [
    state.decayed ? "decayed" : null,
    state.conflict ? "conflict" : null,
    state.versioned ? "versioned" : null,
  ].filter(Boolean);

  return labels.length > 0 ? `Detected: ${labels.join(", ")}` : undefined;
}

export function getTopicDisplayNumberById(
  topics: TopicNode[],
): Map<string, number> {
  return new Map(
    [...topics]
      .sort((a, b) => {
        const orderDelta = a.topicOrder - b.topicOrder;
        if (orderDelta !== 0) {
          return orderDelta;
        }

        const labelDelta = a.label.localeCompare(b.label);
        if (labelDelta !== 0) {
          return labelDelta;
        }

        return a.id.localeCompare(b.id);
      })
      .map((topic, index) => [topic.id, index]),
  );
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

function getTooltipPosition(
  tooltip: TooltipState,
  size: { width: number; height: number },
): { left: number; top: number } {
  const width = 320;
  const reservedHeight =
    tooltip.kind === "topic" && tooltip.body.length > 140 ? 280 : 150;

  return {
    left: Math.min(tooltip.x, Math.max(12, size.width - width - 16)),
    top: Math.min(tooltip.y, Math.max(12, size.height - reservedHeight - 16)),
  };
}

function getDefaultZoomTransform(width: number, height: number): d3.ZoomTransform {
  return d3.zoomIdentity
    .translate((width * (1 - DEFAULT_ZOOM_SCALE)) / 2, (height * (1 - DEFAULT_ZOOM_SCALE)) / 2)
    .scale(DEFAULT_ZOOM_SCALE);
}

export function GraphPanel({
  snapshot,
  title = "Knowledge graph",
  selectedTopicId,
  graftLabel,
  grafting,
  maintenanceLabel,
  maintenanceRunning,
  onRunMaintenance,
  onSelectTopic,
  onGraftSelected,
}: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipCloseTimerRef = useRef<number | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(
    null,
  );
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const hasGraphData = Boolean(
    snapshot && (snapshot.nodes.length > 0 || snapshot.memories.length > 0),
  );

  const graph = useMemo(() => {
    return snapshot ? buildGraph(snapshot) : { nodes: [], links: [], topicByMemoryId: new Map<string, string>() };
  }, [snapshot]);

  function clearTooltipCloseTimer() {
    if (tooltipCloseTimerRef.current !== null) {
      window.clearTimeout(tooltipCloseTimerRef.current);
      tooltipCloseTimerRef.current = null;
    }
  }

  function scheduleTooltipClose() {
    clearTooltipCloseTimer();
    tooltipCloseTimerRef.current = window.setTimeout(() => {
      setTooltip(null);
      tooltipCloseTimerRef.current = null;
    }, 180);
  }

  function zoomBy(factor: number) {
    const svg = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;

    if (!svg || !zoomBehavior) {
      return;
    }

    d3.select(svg)
      .transition()
      .duration(160)
      .call(zoomBehavior.scaleBy, factor);
  }

  function resetView() {
    const svg = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;

    if (!svg || !zoomBehavior) {
      return;
    }

    d3.select(svg)
      .transition()
      .duration(160)
      .call(zoomBehavior.transform, getDefaultZoomTransform(size.width, size.height));
  }

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

    const viewport = selection.append("g").attr("class", "graph-viewport");
    const linkLayer = viewport.append("g").attr("class", "links");
    const nodeLayer = viewport.append("g").attr("class", "nodes");
    const labelLayer = viewport.append("g").attr("class", "labels");

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.45, 2.8])
      .on("zoom", (event) => {
        viewport.attr("transform", event.transform.toString());
      });

    selection
      .call(zoomBehavior)
      .call(zoomBehavior.transform, getDefaultZoomTransform(width, height))
      .on("dblclick.zoom", null);
    zoomBehaviorRef.current = zoomBehavior;

    const linkPaths = linkLayer
      .selectAll<SVGPathElement, GraphLink>("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", getLinkColor)
      .attr("stroke-width", (link) =>
        link.type === "memory" ? 1.4 : link.type.startsWith("memory-") ? 2 : 2.1,
      )
      .attr("stroke-opacity", (link) =>
        link.type === "memory" ? 0.42 : link.type.startsWith("memory-") ? 0.86 : 0.9,
      )
      .attr("stroke-dasharray", getLinkDash)
      .on("mouseenter", (event, link) => {
        const linkTooltip = getLinkTooltip(link);
        if (!linkTooltip) {
          return;
        }

        clearTooltipCloseTimer();
        const rect = container.getBoundingClientRect();
        setTooltip({
          ...linkTooltip,
          x: event.clientX - rect.left + 12,
          y: event.clientY - rect.top + 12,
        });
      })
      .on("mousemove", (event, link) => {
        const linkTooltip = getLinkTooltip(link);
        if (!linkTooltip) {
          return;
        }

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
      .on("mouseleave", scheduleTooltipClose);

    const nodeGroups = nodeLayer
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "grab")
      .on("mouseenter", function (event, node) {
        clearTooltipCloseTimer();
        const rect = container.getBoundingClientRect();
        const circle = d3.select(this).select<SVGCircleElement>("circle");

        circle
          .interrupt()
          .transition()
          .duration(130)
          .attr("r", node.radius + (isTopicNode(node) ? 8 : 3))
          .attr("stroke-width", isTopicNode(node) ? 3 : 2.2)
          .attr("filter", "drop-shadow(0 0 10px rgba(88, 166, 255, 0.45))");

        if (isTopicNode(node)) {
          setTooltip({
            x: event.clientX - rect.left + 12,
            y: event.clientY - rect.top + 12,
            title: node.topic.label,
            body: node.topic.summary || "No summary yet.",
            kind: "topic",
            meta: getStateMeta(node.state),
          });
        } else {
          const config = MEMORY_TYPE_CONFIG[node.memory.memoryType];
          setTooltip({
            x: event.clientX - rect.left + 12,
            y: event.clientY - rect.top + 12,
            title: config.label,
            body: `${node.memory.subject}: ${node.memory.value}`,
            kind: "memory",
            meta:
              getStateMeta(node.state) ??
              `Confidence ${Math.round(node.memory.confidence * 100)}%`,
          });
        }
      })
      .on("click", (_event, node) => {
        if (isTopicNode(node)) {
          _event.stopPropagation();
          onSelectTopic?.(node.topic.id);
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
          .attr("stroke-width", isTopicNode(node) ? 2.1 : 1.2)
          .attr("filter", null);

        scheduleTooltipClose();
      });

    nodeGroups
      .append("circle")
      .attr("r", (node) => node.radius)
      .attr("fill", (node) =>
        isTopicNode(node)
          ? `${getTopicColor(node.displayNumber)}33`
          : getMemoryColor(node.memory, node.state),
      )
      .attr("stroke", (node) =>
        node.state.versioned
            ? "#d29922"
            : isTopicNode(node)
              ? getTopicColor(node.displayNumber)
              : "#e6edf3",
      )
      .attr("stroke-opacity", (node) =>
        node.state.decayed ? 0.48 : isTopicNode(node) ? 0.95 : 0.78,
      )
      .attr("stroke-width", (node) =>
        node.state.versioned
          ? isTopicNode(node)
            ? 3
            : 2
          : isTopicNode(node)
            ? 2.1
            : 1.2,
      )
      .attr("stroke-dasharray", (node) => (node.state.decayed ? "4,3" : null))
      .attr("opacity", (node) => (node.state.decayed ? 0.58 : 1));

    nodeGroups
      .filter((node) => node.state.conflict)
      .append("circle")
      .attr("r", (node) => node.radius + (isTopicNode(node) ? 8 : 5))
      .attr("fill", "none")
      .attr("stroke", MEMORY_CONFLICT_EDGE_COLOR)
      .attr("stroke-width", 2.4)
      .attr("stroke-opacity", 0.35)
      .attr("pointer-events", "none")
      .append("animate")
      .attr("attributeName", "stroke-opacity")
      .attr("values", "0.18;1;0.18")
      .attr("dur", "1.35s")
      .attr("repeatCount", "indefinite");

    nodeGroups
      .filter(isTopicNode)
      .select<SVGCircleElement>("circle")
      .attr("stroke-width", (node) =>
        isTopicNode(node) && node.topic.id === selectedTopicId ? 4 : 2.1,
      )
      .attr("stroke-dasharray", (node) =>
        isTopicNode(node) && node.topic.id === selectedTopicId
          ? "5,3"
          : node.state.decayed
            ? "4,3"
            : null,
      );

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
      .text((node) => String(node.displayNumber));

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .alphaMin(0.012)
      .alphaTarget(0.012)
      .alphaDecay(0.028)
      .velocityDecay(0.54)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((node) => node.id)
          .distance((link) =>
            link.type === "memory"
              ? 128
              : link.type.startsWith("memory-")
                ? 96
                : 250,
          )
          .strength((link) =>
            link.type === "memory"
              ? 0.22
              : link.type.startsWith("memory-")
                ? 0.08
                : 0.16,
          ),
      )
      .force(
        "charge",
        d3
          .forceManyBody<GraphNode>()
          .strength((node) => (isTopicNode(node) ? -180 : -28)),
      )
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.045))
      .force("memory-tether", memoryTetherForce(graph.topicByMemoryId))
      .force(
        "collide",
        d3
          .forceCollide<GraphNode>()
          .radius((node) => (isTopicNode(node) ? TOPIC_RADIUS + 22 : MEMORY_RADIUS + 9))
          .iterations(3),
      )
      .on("tick", () => {
        linkPaths.attr("d", getLinkPath);
        nodeGroups.attr("transform", (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);
        labels.attr("x", (node) => node.x ?? 0).attr("y", (node) => node.y ?? 0);
      });

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, node) => {
        event.sourceEvent?.stopPropagation();
        d3.select(event.sourceEvent.currentTarget).attr("cursor", "grabbing");
        if (!event.active) {
          simulation.alphaTarget(0.16).restart();
        }
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        event.sourceEvent?.stopPropagation();
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        event.sourceEvent?.stopPropagation();
        d3.select(event.sourceEvent.currentTarget).attr("cursor", "grab");
        if (!event.active) {
          simulation.alpha(0.18).alphaTarget(0.012).restart();
        }
        node.fx = null;
        node.fy = null;
      });

    nodeGroups.call(drag);
    selection.on("click", () => {
      onSelectTopic?.(null);
    });

    return () => {
      simulation.stop();
      clearTooltipCloseTimer();
      selection.on("click", null).on(".zoom", null);
      zoomBehaviorRef.current = null;
      selection.selectAll("*").remove();
    };
  }, [graph, onSelectTopic, resetKey, selectedTopicId, size]);

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
        <div className="text-xs font-semibold text-white">{title}</div>
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

      <div className="absolute right-3 top-14 flex overflow-hidden rounded-md border border-border bg-surface/95">
        <button
          type="button"
          onClick={() => zoomBy(1.2)}
          className="h-8 w-8 border-r border-border text-sm font-bold text-accent transition hover:bg-accent/10"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.2)}
          className="h-8 w-8 border-r border-border text-sm font-bold text-accent transition hover:bg-accent/10"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          onClick={resetView}
          className="h-8 px-2 text-[11px] font-semibold text-muted transition hover:bg-accent/10 hover:text-accent"
        >
          Reset view
        </button>
      </div>

      {selectedTopicId && graftLabel && onGraftSelected ? (
        <button
          type="button"
          disabled={grafting}
          onClick={onGraftSelected}
          className="absolute right-3 top-24 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning transition hover:bg-warning/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {grafting ? "Grafting..." : graftLabel}
        </button>
      ) : null}

      {maintenanceLabel && onRunMaintenance ? (
        <button
          type="button"
          disabled={maintenanceRunning}
          onClick={onRunMaintenance}
          className="absolute left-3 top-20 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs font-semibold text-success transition hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {maintenanceRunning ? "Running..." : maintenanceLabel}
        </button>
      ) : null}

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
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <svg width="34" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="34"
                y2="4"
                stroke={MEMORY_EDGE_COLOR}
                strokeWidth="2"
              />
            </svg>
            <span>Memory</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <svg width="34" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="34"
                y2="4"
                stroke={MEMORY_CONFLICT_EDGE_COLOR}
                strokeWidth="2"
                strokeDasharray="5,4"
              />
            </svg>
            <span>Conflict</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <svg width="34" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="34"
                y2="4"
                stroke={MEMORY_UPDATE_EDGE_COLOR}
                strokeWidth="2"
              />
            </svg>
            <span>Version update</span>
          </div>
        </div>
      </div>

      {tooltip ? (
        <div
          className="absolute z-10 max-w-80 rounded-md border border-border bg-surface px-3 py-2 shadow-xl"
          onMouseEnter={clearTooltipCloseTimer}
          onMouseLeave={scheduleTooltipClose}
          style={getTooltipPosition(tooltip, size)}
        >
          <div className="text-xs font-semibold text-white">{tooltip.title}</div>
          <div
            className={`mt-1 text-xs leading-5 text-muted ${
              tooltip.expanded ? "max-h-48 overflow-y-auto pr-1" : "line-clamp-3"
            }`}
          >
            {tooltip.body}
          </div>
          {tooltip.kind === "topic" &&
          !tooltip.expanded &&
          tooltip.body.length > 140 ? (
            <button
              type="button"
              onMouseDown={clearTooltipCloseTimer}
              onClick={() =>
                setTooltip((current) =>
                  current ? { ...current, expanded: true } : current,
                )
              }
              className="mt-2 text-[11px] font-semibold text-accent transition hover:text-white"
            >
              Read more
            </button>
          ) : null}
          {tooltip.meta ? (
            <div className="mt-2 text-[11px] text-accent">{tooltip.meta}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
