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

// ─── Safe Parsing Utility ──────────────────────────────────────────────────
// Use this wherever you call JSON.parse on LLM/API output.
// Strips markdown code fences that models sometimes emit in production.

export function safeParseLLMJson<T = unknown>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === "object") return raw as T // already parsed

  if (typeof raw !== "string") return null

  let text = raw.trim()

  // Strip ```json ... ``` or ``` ... ``` fences (common in production LLM output)
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  // Strip a leading BOM or stray unicode that Vercel edge might inject
  text = text.replace(/^\uFEFF/, "")

  // Truncated response guard — if it doesn't end with } or ] it's incomplete
  if (!/[}\]]$/.test(text)) {
    console.error(
      "[safeParseLLMJson] Response appears truncated:",
      text.slice(-120)
    )
    return null
  }

  try {
    return JSON.parse(text) as T
  } catch (err) {
    console.error("[safeParseLLMJson] JSON.parse failed:", err)
    console.error(
      "[safeParseLLMJson] Raw text (first 500):",
      text.slice(0, 500)
    )
    console.error("[safeParseLLMJson] Raw text (last 200):", text.slice(-200))
    return null
  }
}

// ─── Guards ────────────────────────────────────────────────────────────────

function isPositiveInt(v: unknown): v is number {
  return (
    typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0
  )
}

function safeString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v
  if (v == null) return fallback
  // Coerce numbers/booleans that an LLM might emit instead of a string
  return String(v)
}

function safeStringOrNull(v: unknown): string | null {
  if (typeof v === "string") return v
  if (v == null) return null
  return String(v)
}

function safeNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return v.filter(isPositiveInt)
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v.filter((x) => x != null) as T[]) : []
}

// ─── Tier computation (cycle-safe) ─────────────────────────────────────────

function buildTierMap(
  ids: number[],
  getDeps: (id: number) => number[]
): Map<number, number> {
  const tiers = new Map<number, number>()
  const visiting = new Set<number>()

  function getTier(id: number): number {
    if (tiers.has(id)) return tiers.get(id)!
    if (visiting.has(id)) {
      console.warn(`[toFlow] Cycle detected at node id=${id}; breaking cycle.`)
      return 0
    }
    visiting.add(id)
    const deps = getDeps(id).filter((dep) => dep !== id)
    const tier = deps.length === 0 ? 0 : Math.max(...deps.map(getTier)) + 1
    visiting.delete(id)
    tiers.set(id, tier)
    return tier
  }

  ids.forEach(getTier)
  return tiers
}

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
  const tables = safeArray<Table>(r?.tables)

  const validTables = tables.filter(
    (t): t is Table & { id: number } => t != null && isPositiveInt(t?.id)
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

    const columns = safeArray<{ name?: unknown; references?: unknown }>(
      t?.columns
    )
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
  const flowNodes = safeArray<FlowNode>(r?.nodes)

  const validNodes = flowNodes.filter(
    (n): n is FlowNode & { id: number } => n != null && isPositiveInt(n?.id)
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
  const allNodes = safeArray<MindmapNode>(r?.nodes)

  const validNodes = allNodes.filter(
    (n): n is MindmapNode & { id: number } =>
      n != null && isPositiveInt(n?.id) && isPositiveInt(n?.level)
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
        : -Math.PI / 2
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
  const allNodes = safeArray<TimelineNode>(r?.nodes)

  const validNodes = allNodes.filter(
    (n): n is TimelineNode & { id: number } => n != null && isPositiveInt(n?.id)
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
  const items = safeArray<{
    id?: unknown
    category?: unknown
    option_a?: unknown
    option_b?: unknown
    winner?: unknown
  }>(r?.items)

  const nodes: Node<AnyNodeData>[] = items
    .filter((item) => item != null && isPositiveInt(item?.id))
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
        id: item.id as number,
      } satisfies ComparisonNodeData,
    }))

  return { nodes, edges: [] as Edge[] }
}

// ─── Entry point ───────────────────────────────────────────────────────────

export function toFlow(response: unknown): {
  nodes: Node<AnyNodeData>[]
  edges: Edge[]
} {
  // ── 1. Handle null/undefined ──────────────────────────────────────────
  if (response == null) {
    console.warn("[toFlow] Received null/undefined response")
    return { nodes: [], edges: [] }
  }

  // ── 2. If it came in as a raw string (e.g. from edge runtime), parse it ─
  //       This is the most common Vercel-production failure mode.
  let parsed: AnyResponse
  if (typeof response === "string") {
    const result = safeParseLLMJson<AnyResponse>(response)
    if (result == null) {
      console.error("[toFlow] Could not parse string response")
      return { nodes: [], edges: [] }
    }
    parsed = result
  } else {
    parsed = response as AnyResponse
  }

  // ── 3. Validate the `type` discriminator ─────────────────────────────
  if (
    typeof parsed !== "object" ||
    !("type" in parsed) ||
    typeof parsed.type !== "string"
  ) {
    console.error(
      "[toFlow] Response missing `type` field:",
      JSON.stringify(parsed).slice(0, 200)
    )
    return { nodes: [], edges: [] }
  }

  // ── 4. Dispatch ───────────────────────────────────────────────────────
  try {
    switch (parsed.type) {
      case "schema":
        return schemaToFlow(parsed as SchemaResponse)
      case "flow":
        return flowToFlow(parsed as FlowResponse)
      case "mindmap":
        return mindmapToFlow(parsed as MindmapResponse)
      case "timeline":
        return timelineToFlow(parsed as TimelineResponse)
      case "comparison":
        return comparisonToFlow(parsed as ComparisonResponse)
      default:
        console.warn(
          "[toFlow] Unknown response type:",
          (parsed as AnyResponse).type
        )
        return { nodes: [], edges: [] }
    }
  } catch (err) {
    console.error("[toFlow] Uncaught error during conversion:", err)
    return { nodes: [], edges: [] }
  }
}
