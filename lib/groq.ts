import { z } from "zod"

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions"

export type QueryType =
  | "schema"
  | "flow"
  | "mindmap"
  | "timeline"
  | "comparison"

// ─── Zod Schemas ───────────────────────────────────────────────────────────
// Each schema uses .transform() so the OUTPUT type (what z.infer gives you)
// is fully concrete — no undefined leaking, no optional fields.
// This is what makes the switch() return type satisfy AnyResponse.

export const ColumnSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    constraints: z.array(z.string()).nullish(),
    references: z.string().nullish(),
  })
  .transform((c) => ({
    name: c.name,
    type: c.type,
    constraints: c.constraints ?? null,
    references: c.references ?? null,
  }))

export const TableSchema = z
  .object({
    id: z.number(),
    table_name: z.string(),
    description: z.string(),
    columns: z.array(ColumnSchema).default([]),
    depends_upon: z.array(z.number()).default([]),
  })
  .transform((t) => ({
    id: t.id,
    table_name: t.table_name,
    description: t.description,
    columns: t.columns,
    depends_upon: t.depends_upon,
  }))

export const SchemaResponseSchema = z.object({
  type: z.literal("schema"),
  tables: z.array(TableSchema).min(1),
})

export const FlowNodeSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    description: z.string(),
    depends_upon: z.array(z.number()).default([]),
    category: z.string().optional(),
  })
  .transform((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    depends_upon: n.depends_upon,
    category: n.category,
  }))

export const FlowResponseSchema = z.object({
  type: z.literal("flow"),
  nodes: z.array(FlowNodeSchema).min(1),
})

export const MindmapNodeSchema = z
  .object({
    id: z.number(),
    label: z.string(),
    detail: z.string(),
    parent_id: z.number().nullable(),
    level: z.number(),
  })
  .transform((n) => ({
    id: n.id,
    label: n.label,
    detail: n.detail,
    parent_id: n.parent_id,
    level: n.level,
  }))

export const MindmapResponseSchema = z.object({
  type: z.literal("mindmap"),
  nodes: z.array(MindmapNodeSchema).min(1),
})

export const TimelineNodeSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    description: z.string(),
    date_label: z.string(),
    depends_upon: z.array(z.number()).default([]),
  })
  .transform((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    date_label: n.date_label,
    depends_upon: n.depends_upon,
  }))

export const TimelineResponseSchema = z.object({
  type: z.literal("timeline"),
  nodes: z.array(TimelineNodeSchema).min(1),
})

export const ComparisonItemSchema = z
  .object({
    id: z.number(),
    category: z.string(),
    option_a: z.string(),
    option_b: z.string(),
    winner: z.string().nullable(),
  })
  .transform((i) => ({
    id: i.id,
    category: i.category,
    option_a: i.option_a,
    option_b: i.option_b,
    winner: i.winner,
  }))

export const ComparisonResponseSchema = z.object({
  type: z.literal("comparison"),
  title_a: z.string(),
  title_b: z.string(),
  items: z.array(ComparisonItemSchema).min(1),
  verdict: z.string(),
})

// ─── Types ─────────────────────────────────────────────────────────────────
// z.infer gives the TRANSFORMED output type — fully concrete, no undefined.

export type Column = z.infer<typeof ColumnSchema>
export type Table = z.infer<typeof TableSchema>
export type SchemaResponse = z.infer<typeof SchemaResponseSchema>
export type FlowNode = z.infer<typeof FlowNodeSchema>
export type FlowResponse = z.infer<typeof FlowResponseSchema>
export type MindmapNode = z.infer<typeof MindmapNodeSchema>
export type MindmapResponse = z.infer<typeof MindmapResponseSchema>
export type TimelineNode = z.infer<typeof TimelineNodeSchema>
export type TimelineResponse = z.infer<typeof TimelineResponseSchema>
export type ComparisonResponse = z.infer<typeof ComparisonResponseSchema>

export type AnyResponse =
  | SchemaResponse
  | FlowResponse
  | MindmapResponse
  | TimelineResponse
  | ComparisonResponse

// ─── Sanitizer ─────────────────────────────────────────────────────────────

const NUMERIC_ARRAY_KEYS = new Set(["depends_upon"])

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return Math.floor(v)
  if (typeof v === "string") {
    const n = Number(v.trim())
    return isNaN(n) ? null : Math.floor(n)
  }
  return null
}

function sanitize(data: unknown, key?: string): unknown {
  if (Array.isArray(data)) {
    const items = data.filter((x) => x != null).map((item) => sanitize(item))
    if (key && NUMERIC_ARRAY_KEYS.has(key)) {
      return items
        .map((v) => toNumber(v))
        .filter((v): v is number => v !== null)
    }
    return items
  }

  if (data !== null && typeof data === "object") {
    const obj = data as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj)) {
      if (k === "references") {
        out[k] = typeof obj[k] === "string" ? obj[k] : null
      } else if (k === "constraints") {
        out[k] = Array.isArray(obj[k])
          ? (obj[k] as unknown[]).filter((v) => v != null).map((v) => String(v))
          : []
      } else if (NUMERIC_ARRAY_KEYS.has(k)) {
        const arr = Array.isArray(obj[k]) ? obj[k] : []
        out[k] = (arr as unknown[])
          .map((v) => toNumber(v))
          .filter((v): v is number => v !== null)
      } else if (k === "winner") {
        out[k] = typeof obj[k] === "string" ? obj[k] : null
      } else if (k === "parent_id") {
        out[k] = toNumber(obj[k])
      } else if (k === "id" || k === "level") {
        const n = toNumber(obj[k])
        out[k] = n !== null ? n : 0
      } else {
        out[k] = sanitize(obj[k], k)
      }
    }
    return out
  }

  return data
}

// ─── JSON extraction ───────────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  let text = raw
    .replace(/^\uFEFF/, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()

  const jsonStart = text.search(/[{[]/)
  if (jsonStart > 0) text = text.slice(jsonStart)

  const isObject = text.startsWith("{")
  const openChar = isObject ? "{" : "["
  const closeChar = isObject ? "}" : "]"
  let depth = 0
  let lastClose = -1

  for (let i = 0; i < text.length; i++) {
    if (text[i] === openChar) depth++
    else if (text[i] === closeChar) {
      depth--
      if (depth === 0) {
        lastClose = i
        break
      }
    }
  }

  if (lastClose !== -1) text = text.slice(0, lastClose + 1)
  if (!text) throw new Error("No JSON object found in response")

  try {
    return JSON.parse(text)
  } catch (err) {
    console.error("[extractJson] failed, first 400:", text.slice(0, 400))
    throw new Error(
      `JSON parse error: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

// ─── Type detection ────────────────────────────────────────────────────────

function detectType(question: string): QueryType {
  const q = question.toLowerCase()
  if (
    /\bvs\.?\b|versus|\bcompare\b|\bdifference between\b|\bpros.{0,10}cons\b|\bbetter\b/.test(
      q
    )
  )
    return "comparison"
  if (
    /\bdatabase\b|\bschema\b|\btable\b|\bsql\b|\bpostgres\b|\bmysql\b|\bsupabase\b|\berd\b|\brelational\b/.test(
      q
    )
  )
    return "schema"
  if (
    /\bhistory\b|\btimeline\b|\bevolution\b|\bwhen did\b|\bover time\b|\bchronolog\b|\bcentury\b|\bdecade\b|\byears?\b|\bera\b/.test(
      q
    )
  )
    return "timeline"
  if (
    /\bhow does\b|\bhow do\b|\bprocess\b|\bsteps?\b|\bcycle\b|\bmechanism\b|\bworkflow\b|\bpipeline\b|\bwhat happens\b/.test(
      q
    )
  )
    return "flow"
  return "mindmap"
}

// ─── Prompts ───────────────────────────────────────────────────────────────

const PROMPTS: Record<QueryType, string> = {
  schema: `You are a senior database architect. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.
{
  "type": "schema",
  "tables": [
    {
      "id": 1,
      "table_name": "users",
      "description": "Stores user accounts.",
      "columns": [
        { "name": "id", "type": "UUID", "constraints": ["PK", "NOT NULL"], "references": null },
        { "name": "org_id", "type": "UUID", "constraints": ["FK", "NOT NULL"], "references": "organisations.id" }
      ],
      "depends_upon": []
    }
  ]
}
RULES: id and depends_upon values MUST be plain integers. references is null or "table.column". 5-9 tables.`,

  flow: `You are an expert educator. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.
{
  "type": "flow",
  "nodes": [
    { "id": 1, "title": "Step title", "description": "2-3 sentence explanation.", "depends_upon": [], "category": "input" }
  ]
}
RULES: id and depends_upon values MUST be plain integers. category is one of: input|process|output|decision. 6-10 nodes.`,

  mindmap: `You are an expert educator. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.
{
  "type": "mindmap",
  "nodes": [
    { "id": 1, "label": "Root Topic", "detail": "One-sentence overview.", "parent_id": null, "level": 0 },
    { "id": 2, "label": "Branch A", "detail": "Description.", "parent_id": 1, "level": 1 },
    { "id": 3, "label": "Leaf", "detail": "Specific detail.", "parent_id": 2, "level": 2 }
  ]
}
RULES: id and parent_id MUST be plain integers. Exactly 1 root (level 0), 3-5 branches (level 1), 2-3 leaves per branch (level 2).`,

  timeline: `You are a historian. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.
{
  "type": "timeline",
  "nodes": [
    { "id": 1, "title": "Event title", "description": "2-3 sentence explanation.", "date_label": "1969", "depends_upon": [] }
  ]
}
RULES: id and depends_upon values MUST be plain integers. Nodes in strict chronological order. 6-10 events.`,

  comparison: `You are an expert analyst. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.
{
  "type": "comparison",
  "title_a": "Option A name",
  "title_b": "Option B name",
  "items": [
    { "id": 1, "category": "Performance", "option_a": "Description for A.", "option_b": "Description for B.", "winner": "a" }
  ],
  "verdict": "Overall recommendation in 2 sentences."
}
RULES: id MUST be a plain integer. winner is exactly "a", "b", or null for a tie. 6-8 categories.`,
}

// ─── Main fetch ────────────────────────────────────────────────────────────

export async function fetchVisualization(
  question: string
): Promise<AnyResponse> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error("GROQ_API_KEY is not set")

  const queryType = detectType(question)
  console.log(`[groq] type="${queryType}" question="${question}"`)

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 6000,
      // No response_format — not reliably supported on Groq's edge runtime
      messages: [
        { role: "system", content: PROMPTS[queryType] },
        {
          role: "user",
          content: `Topic: "${question}"\n\nOutput ONLY the raw JSON object. No markdown. All id and depends_upon values must be numbers.`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[groq] API error ${res.status}:`, err)
    throw new Error(`Groq API error ${res.status}: ${err.slice(0, 300)}`)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch (err) {
    throw new Error(`Failed to parse Groq HTTP response: ${err}`)
  }

  const choices = (data as Record<string, unknown>)?.choices
  const content = (
    (Array.isArray(choices) ? choices[0] : null) as Record<string, unknown>
  )?.message as Record<string, unknown>

  const rawText = content?.content
  if (typeof rawText !== "string" || rawText.trim() === "") {
    console.error("[groq] Empty content:", JSON.stringify(data).slice(0, 400))
    throw new Error("Groq returned empty content")
  }

  const parsed = extractJson(rawText)
  const safe = sanitize(parsed) as Record<string, unknown>
  safe.type = queryType // force — never trust the LLM's own type field

  switch (queryType) {
    case "schema":
      return SchemaResponseSchema.parse(safe)
    case "flow":
      return FlowResponseSchema.parse(safe)
    case "mindmap":
      return MindmapResponseSchema.parse(safe)
    case "timeline":
      return TimelineResponseSchema.parse(safe)
    case "comparison":
      return ComparisonResponseSchema.parse(safe)
  }
}
