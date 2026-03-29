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

// ─── Guards ────────────────────────────────────────────────────────────────

function isPositiveInt(v: unknown): v is number {
  return (
    typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0
  )
}

function safeString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback
}

function safeStringOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

function safeNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return v.filter(isPositiveInt)
}

// ─── Tier computation (cycle-safe) ─────────────────────────────────────────

/**
 * Computes a topological tier for each node ID.
 * Uses a "visiting" set to detect and break cycles rather than
 * silently looping or returning 0 for all nodes in a cycle.
 */
function buildTierMap(
  ids: number[],
  getDeps: (id: number) => number[]
): Map<number, number> {
  const tiers = new Map<number, number>()
  const visiting = new Set<number>() // cycle detection

  function getTier(id: number): number {
    if (tiers.has(id)) return tiers.get(id)!
    if (visiting.has(id)) {
      // Cycle detected — cap this branch at 0 to avoid infinite recursion
      console.warn(`[toFlow] Cycle detected at node id=${id}; breaking cycle.`)
      return 0
    }
    visiting.add(id)
    const deps = getDeps(id).filter((dep) => dep !== id) // drop self-references
    const tier = deps.length === 0 ? 0 : Math.max(...deps.map(getTier)) + 1
    visiting.delete(id)
    tiers.set(id, tier)
    return tier
  }

  ids.forEach(getTier)
  return tiers
}

/**
 * Given a tier map, returns per-tier counts and a positional index
 * factory so callers can compute x/y without mutating shared state.
 */
function buildTierLayout(tiers: Map<number, number>) {
  const counts = new Map<number, number>()
  for (const tier of tiers.values()) {
    counts.set(tier, (counts.get(tier) ?? 0) + 1)
  }
  const used = new Map<number, number>()

  function nextIndex(tier: number): number {
    const idx = used.get(tier) ?? 0
    used.set(tier, idx + 1)
    return idx
  }

  function countForTier(tier: number): number {
    return counts.get(tier) ?? 1
  }

  return { nextIndex, countForTier }
}

// ─── Schema ────────────────────────────────────────────────────────────────

export function schemaToFlow(r: SchemaResponse) {
  const tables = Array.isArray(r.tables) ? r.tables : []

  const validTables = tables.filter(
    (t): t is Table & { id: number } => t != null && isPositiveInt(t.id)
  )

  const idSet = new Set(validTables.map((t) => t.id))

  const tiers = buildTierMap(
    validTables.map((t) => t.id),
    (id) => {
      const t = validTables.find((x) => x.id === id)
      return safeNumberArray(t?.depends_upon).filter((dep) => idSet.has(dep))
    }
  )

  const { nextIndex, countForTier } = buildTierLayout(tiers)

  const nodes: Node<AnyNodeData>[] = validTables.map((t) => {
    const tier = tiers.get(t.id) ?? 0
    const count = countForTier(tier)
    const idx = nextIndex(tier)
    return {
      id: String(t.id),
      type: "tableNode",
      draggable: true,
      position: {
        x: idx * GAP_X - ((count - 1) * GAP_X) / 2,
        y: tier * GAP_Y,
      },
      data: { kind: "schema", table: t } satisfies TableNodeData,
    }
  })

  const edges: Edge[] = []
  const seen = new Set<string>()

  for (const t of validTables) {
    // Tier-based dependency edges
    for (const pid of safeNumberArray(t.depends_upon)) {
      if (!idSet.has(pid) || pid === t.id) continue
      const k = `${pid}-${t.id}`
      if (seen.has(k)) continue
      seen.add(k)
      edges.push({
        id: `e${k}`,
        source: String(pid),
        target: String(t.id),
        ...edgeBase,
      })
    }

    // Column-level foreign-key edges
    const columns = Array.isArray(t.columns) ? t.columns : []
    for (const col of columns) {
      if (!col?.references || typeof col.references !== "string") continue
      const refTableName = col.references.split(".")[0]
      if (!refTableName) continue
      const ref = validTables.find((x) => x.table_name === refTableName)
      if (!ref || ref.id === t.id) continue

      const k = `fk-${ref.id}-${t.id}-${safeString(col.name, "col")}`
      if (seen.has(k)) continue
      seen.add(k)
      edges.push({
        id: k,
        source: String(ref.id),
        target: String(t.id),
        label: safeString(col.name),
        labelStyle: { fill: "#7c6af7", fontSize: 10, fontFamily: "monospace" },
        labelBgStyle: { fill: "#0d0d14", fillOpacity: 0.9 },
        type: "smoothstep",
        style: { stroke: "#4a3a8a", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#4a3a8a" },
      })
    }
  }

  return { nodes, edges }
}

// ─── Flow ──────────────────────────────────────────────────────────────────

function flowToFlow(r: FlowResponse) {
  const flowNodes = Array.isArray(r.nodes) ? r.nodes : []

  const validNodes = flowNodes.filter(
    (n): n is FlowNode & { id: number } => n != null && isPositiveInt(n.id)
  )

  const idSet = new Set(validNodes.map((n) => n.id))

  const tiers = buildTierMap(
    validNodes.map((n) => n.id),
    (id) => {
      const n = validNodes.find((x) => x.id === id)
      return safeNumberArray(n?.depends_upon).filter((dep) => idSet.has(dep))
    }
  )

  const { nextIndex, countForTier } = buildTierLayout(tiers)

  const nodes: Node<AnyNodeData>[] = validNodes.map((n) => {
    const tier = tiers.get(n.id) ?? 0
    const count = countForTier(tier)
    const idx = nextIndex(tier)
    return {
      id: String(n.id),
      type: "flowNode",
      draggable: true,
      position: {
        x: idx * 280 - ((count - 1) * 280) / 2,
        y: tier * 180,
      },
      data: { kind: "flow", node: n } satisfies FlowNodeData,
    }
  })

  const edges: Edge[] = []
  const seen = new Set<string>()

  for (const n of validNodes) {
    for (const pid of safeNumberArray(n.depends_upon)) {
      if (!idSet.has(pid) || pid === n.id) continue
      const k = `${pid}-${n.id}`
      if (seen.has(k)) continue
      seen.add(k)
      edges.push({
        id: `e${k}`,
        source: String(pid),
        target: String(n.id),
        ...edgeBase,
      })
    }
  }

  return { nodes, edges }
}

// ─── Mindmap ───────────────────────────────────────────────────────────────

function mindmapToFlow(r: MindmapResponse) {
  const allNodes = Array.isArray(r.nodes) ? r.nodes : []

  const validNodes = allNodes.filter(
    (n): n is MindmapNode & { id: number } =>
      n != null && isPositiveInt(n.id) && isPositiveInt(n.level)
  )

  const root = validNodes.find((n) => n.level === 0) ?? null
  const branches = validNodes.filter((n) => n.level === 1)
  const leaves = validNodes.filter((n) => n.level === 2)

  const nodes: Node<AnyNodeData>[] = []
  const edges: Edge[] = []

  if (root) {
    nodes.push({
      id: String(root.id),
      type: "mindmapNode",
      draggable: true,
      position: { x: 0, y: 0 },
      data: { kind: "mindmap", node: root } satisfies MindmapNodeData,
    })
  }

  const branchCount = branches.length
  branches.forEach((b, i) => {
    const angle =
      branchCount > 1
        ? (i / branchCount) * 2 * Math.PI - Math.PI / 2
        : -Math.PI / 2 // single branch: point upward
    const x = Math.cos(angle) * 380
    const y = Math.sin(angle) * 280

    nodes.push({
      id: String(b.id),
      type: "mindmapNode",
      draggable: true,
      position: { x, y },
      data: { kind: "mindmap", node: b } satisfies MindmapNodeData,
    })

    if (isPositiveInt(b.parent_id)) {
      edges.push({
        id: `e${b.parent_id}-${b.id}`,
        source: String(b.parent_id),
        target: String(b.id),
        ...edgeBase,
      })
    }

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
        data: { kind: "mindmap", node: l } satisfies MindmapNodeData,
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

// ─── Timeline ──────────────────────────────────────────────────────────────

function timelineToFlow(r: TimelineResponse) {
  const allNodes = Array.isArray(r.nodes) ? r.nodes : []

  const validNodes = allNodes.filter(
    (n): n is TimelineNode & { id: number } => n != null && isPositiveInt(n.id)
  )

  const nodes: Node<AnyNodeData>[] = validNodes.map((n, i) => ({
    id: String(n.id),
    type: "timelineNode",
    draggable: true,
    position: { x: i % 2 === 0 ? -320 : 320, y: i * 160 },
    data: { kind: "timeline", node: n } satisfies TimelineNodeData,
  }))

  const edges: Edge[] = []
  const seen = new Set<string>()

  for (let i = 1; i < validNodes.length; i++) {
    const prev = validNodes[i - 1]
    const curr = validNodes[i]
    const k = `spine-${prev.id}-${curr.id}`
    if (seen.has(k)) continue
    seen.add(k)
    edges.push({
      id: k,
      source: String(prev.id),
      target: String(curr.id),
      ...edgeBase,
    })
  }

  return { nodes, edges }
}

// ─── Comparison ────────────────────────────────────────────────────────────

function comparisonToFlow(r: ComparisonResponse) {
  const items = Array.isArray(r.items) ? r.items : []

  const nodes: Node<AnyNodeData>[] = items
    .filter((item) => item != null && isPositiveInt(item.id))
    .map((item, i) => ({
      id: String(item.id),
      type: "comparisonNode",
      draggable: true,
      position: { x: 0, y: i * 140 },
      data: {
        kind: "comparison",
        category: safeString(item.category),
        option_a: safeString(item.option_a),
        option_b: safeString(item.option_b),
        winner: safeStringOrNull(item.winner),
        id: item.id,
      } satisfies ComparisonNodeData,
    }))

  return { nodes, edges: [] as Edge[] }
}

// ─── Entry point ───────────────────────────────────────────────────────────

export function toFlow(response: AnyResponse): {
  nodes: Node<AnyNodeData>[]
  edges: Edge[]
} {
  if (response == null) {
    console.warn("[toFlow] Received null/undefined response")
    return { nodes: [], edges: [] }
  }

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
    default: {
      // Exhaustiveness check — TypeScript will error if a case is missing
      const _exhaustive: never = response
      console.warn(
        "[toFlow] Unknown response type:",
        (_exhaustive as AnyResponse).type
      )
      return { nodes: [], edges: [] }
    }
  }
}
