import { Node, Edge, MarkerType } from "reactflow"
import {
  AnyResponse,
  SchemaResponse,
  FlowResponse,
  MindmapResponse,
  TimelineResponse,
  ComparisonResponse,
  Table,
  FlowNode,
  MindmapNode,
  TimelineNode,
} from "./groq"

export type TableNodeData = { kind: "schema"; table: Table }
export type FlowNodeData = { kind: "flow"; node: FlowNode }
export type MindmapNodeData = { kind: "mindmap"; node: MindmapNode }
export type TimelineNodeData = { kind: "timeline"; node: TimelineNode }
export type ComparisonNodeData = {
  kind: "comparison"
  category: string
  option_a: string
  option_b: string
  winner: string | null
  id: number
}
export type AnyNodeData =
  | TableNodeData
  | FlowNodeData
  | MindmapNodeData
  | TimelineNodeData
  | ComparisonNodeData

const GAP_X = 340
const GAP_Y = 300
const marker = { type: MarkerType.ArrowClosed, color: "#7c6af7" }
const edgeBase = {
  type: "smoothstep" as const,
  style: { stroke: "#7c6af7", strokeWidth: 2 },
  markerEnd: marker,
}

export function schemaToFlow(r: SchemaResponse) {
  const tiers = new Map<number, number>()
  const visited = new Set<number>()

  function getTier(id: number): number {
    if (tiers.has(id)) return tiers.get(id)!
    if (visited.has(id)) return 0
    visited.add(id)

    const t = r.tables.find((x) => x.id === id)
    if (!t || !Array.isArray(t.depends_upon) || !t.depends_upon.length) {
      tiers.set(id, 0)
      return 0
    }

    const m = Math.max(
      0,
      ...t.depends_upon.filter((dep) => typeof dep === "number").map(getTier)
    )
    tiers.set(id, m + 1)
    return m + 1
  }

  // compute tiers
  r.tables.forEach((t) => {
    if (typeof t.id === "number") getTier(t.id)
  })

  // count nodes per tier
  const counts = new Map<number, number>()
  r.tables.forEach((t) => {
    const tier = tiers.get(t.id) ?? 0
    counts.set(tier, (counts.get(tier) ?? 0) + 1)
  })

  const used = new Map<number, number>()
  const nodes: Node<AnyNodeData>[] = r.tables.map((t) => {
    const tier = tiers.get(t.id) ?? 0
    const count = counts.get(tier) ?? 1
    const idx = used.get(tier) ?? 0
    used.set(tier, idx + 1)

    return {
      id: String(t.id),
      type: "tableNode",
      draggable: true,
      position: { x: idx * GAP_X - ((count - 1) * GAP_X) / 2, y: tier * GAP_Y },
      data: { kind: "schema", table: t } as TableNodeData,
    }
  })

  const edges: Edge[] = []
  const seen = new Set<string>()

  r.tables.forEach((t) => {
    // tier-based dependencies
    if (Array.isArray(t.depends_upon)) {
      t.depends_upon.forEach((pid) => {
        if (typeof pid !== "number") return
        const k = `${pid}-${t.id}`
        if (seen.has(k)) return
        seen.add(k)
        edges.push({
          id: `e${k}`,
          source: String(pid),
          target: String(t.id),
          ...edgeBase,
        })
      })
    }

    // column foreign keys
    if (Array.isArray(t.columns)) {
      t.columns.forEach((col) => {
        if (!col.references) return
        const refTableName = col.references.split(".")[0]
        const ref = r.tables.find((x) => x.table_name === refTableName)
        if (!ref) return

        const k = `fk-${ref.id}-${t.id}-${col.name}`
        if (seen.has(k)) return
        seen.add(k)

        edges.push({
          id: k,
          source: String(ref.id),
          target: String(t.id),
          label: col.name,
          labelStyle: {
            fill: "#7c6af7",
            fontSize: 10,
            fontFamily: "monospace",
          },
          labelBgStyle: { fill: "#0d0d14", fillOpacity: 0.9 },
          type: "smoothstep",
          style: { stroke: "#4a3a8a", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#4a3a8a" },
        })
      })
    }
  })

  return { nodes, edges }
}

function flowToFlow(r: FlowResponse) {
  const tiers = new Map<number, number>()
  const visited = new Set<number>()
  function getTier(id: number): number {
    if (tiers.has(id)) return tiers.get(id)!
    if (visited.has(id)) return 0
    visited.add(id)
    const n = r.nodes.find((x) => x.id === id)
    if (!n || !n.depends_upon.length) {
      tiers.set(id, 0)
      return 0
    }
    const m = Math.max(...n.depends_upon.map(getTier))
    tiers.set(id, m + 1)
    return m + 1
  }
  r.nodes.forEach((n) => getTier(n.id))
  const counts = new Map<number, number>()
  r.nodes.forEach((n) => {
    const t = tiers.get(n.id)!
    counts.set(t, (counts.get(t) ?? 0) + 1)
  })
  const used = new Map<number, number>()
  const nodes: Node<AnyNodeData>[] = r.nodes.map((n) => {
    const tier = tiers.get(n.id) ?? 0
    const count = counts.get(tier) ?? 1
    const idx = used.get(tier) ?? 0
    used.set(tier, idx + 1)
    return {
      id: String(n.id),
      type: "flowNode",
      draggable: true,
      position: { x: idx * 280 - ((count - 1) * 280) / 2, y: tier * 180 },
      data: { kind: "flow", node: n } as FlowNodeData,
    }
  })
  const edges: Edge[] = []
  const seen = new Set<string>()
  r.nodes.forEach((n) =>
    n.depends_upon.forEach((pid) => {
      const k = `${pid}-${n.id}`
      if (seen.has(k)) return
      seen.add(k)
      edges.push({
        id: `e${k}`,
        source: String(pid),
        target: String(n.id),
        ...edgeBase,
      })
    })
  )
  return { nodes, edges }
}

function mindmapToFlow(r: MindmapResponse) {
  const root = r.nodes.find((n) => n.level === 0)
  const branches = r.nodes.filter((n) => n.level === 1)
  const leaves = r.nodes.filter((n) => n.level === 2)
  const nodes: Node<AnyNodeData>[] = []
  const edges: Edge[] = []
  if (root) {
    nodes.push({
      id: String(root.id),
      type: "mindmapNode",
      draggable: true,
      position: { x: 0, y: 0 },
      data: { kind: "mindmap", node: root } as MindmapNodeData,
    })
  }
  branches.forEach((b, i) => {
    const angle = (i / branches.length) * 2 * Math.PI - Math.PI / 2
    const x = Math.cos(angle) * 380
    const y = Math.sin(angle) * 280
    nodes.push({
      id: String(b.id),
      type: "mindmapNode",
      draggable: true,
      position: { x, y },
      data: { kind: "mindmap", node: b } as MindmapNodeData,
    })
    if (b.parent_id != null)
      edges.push({
        id: `e${b.parent_id}-${b.id}`,
        source: String(b.parent_id),
        target: String(b.id),
        ...edgeBase,
      })
    const myLeaves = leaves.filter((l) => l.parent_id === b.id)
    myLeaves.forEach((l, j) => {
      const spread = (j - (myLeaves.length - 1) / 2) * 160
      const lx =
        x + Math.cos(angle) * 220 + Math.cos(angle + Math.PI / 2) * spread
      const ly =
        y + Math.sin(angle) * 180 + Math.sin(angle + Math.PI / 2) * spread
      nodes.push({
        id: String(l.id),
        type: "mindmapNode",
        draggable: true,
        position: { x: lx, y: ly },
        data: { kind: "mindmap", node: l } as MindmapNodeData,
      })
      edges.push({
        id: `e${b.id}-${l.id}`,
        source: String(b.id),
        target: String(l.id),
        type: "smoothstep",
        style: { stroke: "#2d2d45", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#2d2d45" },
      })
    })
  })
  return { nodes, edges }
}

function timelineToFlow(r: TimelineResponse) {
  const nodes: Node<AnyNodeData>[] = r.nodes.map((n, i) => ({
    id: String(n.id),
    type: "timelineNode",
    draggable: true,
    position: { x: i % 2 === 0 ? -320 : 320, y: i * 160 },
    data: { kind: "timeline", node: n } as TimelineNodeData,
  }))
  const edges: Edge[] = []
  const seen = new Set<string>()
  r.nodes.forEach((n, i) => {
    if (i === 0) return
    const prev = r.nodes[i - 1]
    const k = `spine-${prev.id}-${n.id}`
    if (seen.has(k)) return
    seen.add(k)
    edges.push({
      id: k,
      source: String(prev.id),
      target: String(n.id),
      ...edgeBase,
    })
  })
  return { nodes, edges }
}

function comparisonToFlow(r: ComparisonResponse) {
  const nodes: Node<AnyNodeData>[] = r.items.map((item, i) => ({
    id: String(item.id),
    type: "comparisonNode",
    draggable: true,
    position: { x: 0, y: i * 140 },
    data: {
      kind: "comparison",
      category: item.category,
      option_a: item.option_a,
      option_b: item.option_b,
      winner: item.winner,
      id: item.id,
    } as ComparisonNodeData,
  }))
  return { nodes, edges: [] }
}

export function toFlow(response: AnyResponse): {
  nodes: Node<AnyNodeData>[]
  edges: Edge[]
} {
  switch (response.type) {
    case "schema":
      return schemaToFlow(response)
    case "flow":
      return flowToFlow(response)
    case "mindmap":
      return mindmapToFlow(response)
    case "timeline":
      return timelineToFlow(response)
    case "comparison":
      return comparisonToFlow(response)
  }
}
