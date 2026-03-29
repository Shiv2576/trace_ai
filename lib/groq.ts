import { z } from "zod"

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions"

export type QueryType =
  | "schema"
  | "flow"
  | "mindmap"
  | "timeline"
  | "comparison"

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const ColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  constraints: z.array(z.string()).nullable().catch(null),
  references: z.string().nullable().catch(null),
})

export const TableSchema = z.object({
  id: z.number(),
  table_name: z.string(),
  description: z.string(),
  columns: z.array(ColumnSchema).catch([]),
  depends_upon: z.array(z.number()).catch([]),
})

export const SchemaResponseSchema = z.object({
  type: z.literal("schema"),
  tables: z.array(TableSchema).min(1),
})

export const FlowNodeSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  depends_upon: z.array(z.number()).catch([]),
  category: z.string().optional(),
})

export const FlowResponseSchema = z.object({
  type: z.literal("flow"),
  nodes: z.array(FlowNodeSchema).min(1),
})

export const MindmapNodeSchema = z.object({
  id: z.number(),
  label: z.string(),
  detail: z.string(),
  parent_id: z.number().nullable(),
  level: z.number(),
})

export const MindmapResponseSchema = z.object({
  type: z.literal("mindmap"),
  nodes: z.array(MindmapNodeSchema).min(1),
})

export const TimelineNodeSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  date_label: z.string(),
  depends_upon: z.array(z.number()).catch([]),
})

export const TimelineResponseSchema = z.object({
  type: z.literal("timeline"),
  nodes: z.array(TimelineNodeSchema).min(1),
})

export const ComparisonItemSchema = z.object({
  id: z.number(),
  category: z.string(),
  option_a: z.string(),
  option_b: z.string(),
  winner: z.string().nullable(),
})

export const ComparisonResponseSchema = z.object({
  type: z.literal("comparison"),
  title_a: z.string(),
  title_b: z.string(),
  items: z.array(ComparisonItemSchema).min(1),
  verdict: z.string(),
})

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
// Coerces LLM quirks: string IDs → numbers, missing arrays → [], etc.

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
        out[k] = toNumber(obj[k]) // null is valid for root
      } else if (k === "id") {
        const n = toNumber(obj[k])
        out[k] = n !== null ? n : 0
      } else if (k === "level") {
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
// Handles: markdown fences, leading text, BOM, truncation

function extractJson(raw: string): unknown {
  if (!raw || typeof raw !== "string") {
    throw new Error("extractJson: received empty or non-string input")
  }

  let text = raw
    .replace(/^\uFEFF/, "") // BOM
    .replace(/^```(?:json)?\s*/i, "") // opening fence
    .replace(/\s*```\s*$/i, "") // closing fence
    .trim()

  // If there's prose before the JSON, find the first { or [
  const jsonStart = text.search(/[{[]/)
  if (jsonStart > 0) {
    text = text.slice(jsonStart)
  }

  // Find the last matching closing bracket to handle trailing prose
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

  if (lastClose !== -1) {
    text = text.slice(0, lastClose + 1)
  }

  if (!text)
    throw new Error("extractJson: no JSON object/array found in response")

  try {
    return JSON.parse(text)
  } catch (err) {
    console.error(
      "[extractJson] Parse failed. First 400 chars:",
      text.slice(0, 400)
    )
    console.error("[extractJson] Last 200 chars:", text.slice(-200))
    throw new Error(
      `JSON parse error: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

// ─── Type detection ────────────────────────────────────────────────────────

function detectType(question: string): QueryType {
  const q = question.toLowerCase()

  // Comparison: explicit vs/compare signals
  if (
    /\bvs\.?\b|versus|\bcompare\b|\bdifference between\b|\bpros.{0,10}cons\b|\bbetter\b/.test(
      q
    )
  )
    return "comparison"

  // Schema: database/SQL signals
  if (
    /\bdatabase\b|\bschema\b|\btable\b|\bsql\b|\bpostgres\b|\bmysql\b|\bsupabase\b|\berd\b|\brelational\b|\bentity\b/.test(
      q
    )
  )
    return "schema"

  // Timeline: history/chronology signals
  if (
    /\bhistory\b|\btimeline\b|\bevolution\b|\bwhen did\b|\bover time\b|\bchronolog\b|\bcentury\b|\bdecade\b|\byears?\b|\bera\b|\bperiod\b/.test(
      q
    )
  )
    return "timeline"

  // Flow: process/mechanism signals
  if (
    /\bhow does\b|\bhow do\b|\bprocess\b|\bsteps?\b|\bcycle\b|\bmechanism\b|\bworkflow\b|\bpipeline\b|\bexplain how\b|\bwhat happens\b/.test(
      q
    )
  )
    return "flow"

  // Default: mindmap for broad concept exploration
  return "mindmap"
}

// ─── Prompts ───────────────────────────────────────────────────────────────

const PROMPTS: Record<QueryType, string> = {
  schema: `You are a senior database architect. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.

The JSON must match this exact structure:
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

RULES:
- id and all values inside depends_upon MUST be plain integers (e.g. 1, 2, 3). Never strings.
- depends_upon lists the id values of tables this table references via FK.
- references is either null or a string like "other_table.column_name".
- constraints is always an array of strings.
- Include 5–9 tables with realistic SQL column types.`,

  flow: `You are an expert educator. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.

The JSON must match this exact structure:
{
  "type": "flow",
  "nodes": [
    {
      "id": 1,
      "title": "Short step title",
      "description": "Detailed explanation (2–3 sentences).",
      "depends_upon": [],
      "category": "input"
    }
  ]
}

RULES:
- id and all values inside depends_upon MUST be plain integers. Never strings.
- depends_upon contains the id values of steps that must happen before this one.
- category is exactly one of: input | process | output | decision
- Include 6–10 nodes covering the full process.`,

  mindmap: `You are an expert educator. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.

The JSON must match this exact structure:
{
  "type": "mindmap",
  "nodes": [
    { "id": 1, "label": "Root Topic", "detail": "One-sentence overview.", "parent_id": null, "level": 0 },
    { "id": 2, "label": "Branch A", "detail": "Description.", "parent_id": 1, "level": 1 },
    { "id": 3, "label": "Leaf detail", "detail": "Specific detail.", "parent_id": 2, "level": 2 }
  ]
}

RULES:
- id and parent_id MUST be plain integers. Never strings.
- Exactly 1 root node with level 0 and parent_id null.
- 3–5 branch nodes with level 1 and parent_id pointing to root.
- 2–3 leaf nodes per branch with level 2 and parent_id pointing to their branch.`,

  timeline: `You are a historian. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.

The JSON must match this exact structure:
{
  "type": "timeline",
  "nodes": [
    {
      "id": 1,
      "title": "Event title",
      "description": "What happened and why it matters (2–3 sentences).",
      "date_label": "1969",
      "depends_upon": []
    }
  ]
}

RULES:
- id and all values inside depends_upon MUST be plain integers. Never strings.
- Nodes must be in strict chronological order.
- Include 6–10 events.`,

  comparison: `You are an expert analyst. Output ONLY a raw JSON object. No markdown, no explanation, no code fences.

The JSON must match this exact structure:
{
  "type": "comparison",
  "title_a": "Option A name",
  "title_b": "Option B name",
  "items": [
    {
      "id": 1,
      "category": "Performance",
      "option_a": "Description for A in this category.",
      "option_b": "Description for B in this category.",
      "winner": "a"
    }
  ],
  "verdict": "Overall recommendation in 2 sentences."
}

RULES:
- id MUST be a plain integer. Never a string.
- winner is exactly "a", "b", or null for a tie.
- Include 6–8 comparison categories.`,
}

// ─── Zod parse with helpful errors ─────────────────────────────────────────

function parseWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  label: string
): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  const issues = result.error.issues
    .slice(0, 5)
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n")

  console.error(`[groq] Zod validation failed for ${label}:\n${issues}`)
  console.error(`[groq] Sanitized data:`, JSON.stringify(data).slice(0, 400))

  throw new Error(`Schema validation failed for ${label}:\n${issues}`)
}

// ─── Main fetch ────────────────────────────────────────────────────────────

export async function fetchVisualization(
  question: string
): Promise<AnyResponse> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error("GROQ_API_KEY is not set")

  const queryType = detectType(question)
  console.log(`[groq] Detected type: ${queryType} for question: "${question}"`)

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
      // ✅ NO response_format here — llama-3.3-70b-versatile does not
      //    reliably support json_object on Groq in production/edge runtimes.
      //    The prompts enforce JSON-only output instead.
      messages: [
        { role: "system", content: PROMPTS[queryType] },
        {
          role: "user",
          content: `Topic: "${question}"\n\nRemember: output ONLY the raw JSON object. No markdown fences, no explanation. All id and depends_upon values must be numbers.`,
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
    throw new Error(`Failed to parse Groq HTTP response as JSON: ${err}`)
  }

  const raw = (data as Record<string, unknown>)?.choices
  if (!Array.isArray(raw) || raw.length === 0) {
    console.error(
      "[groq] Unexpected response shape:",
      JSON.stringify(data).slice(0, 400)
    )
    throw new Error("Groq returned no choices")
  }

  const content = (raw[0] as Record<string, unknown>)?.message
  const rawText = (content as Record<string, unknown>)?.content

  if (typeof rawText !== "string" || rawText.trim() === "") {
    console.error("[groq] Empty or non-string content:", rawText)
    throw new Error("Groq returned empty content")
  }

  console.log(`[groq] Raw response length: ${rawText.length} chars`)

  // Extract and parse JSON robustly
  let parsed: unknown
  try {
    parsed = extractJson(rawText)
  } catch (err) {
    throw new Error(
      `Could not extract JSON from Groq response: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // Sanitize LLM quirks (string IDs, missing arrays, etc.)
  const safe = sanitize(parsed) as Record<string, unknown>

  // Force the type field to match what we asked for — LLM sometimes omits it
  safe.type = queryType

  // Validate with Zod using safeParse (no hard throws)
  switch (queryType) {
    case "schema":
      return parseWithSchema(SchemaResponseSchema, safe, "schema")
    case "flow":
      return parseWithSchema(FlowResponseSchema, safe, "flow")
    case "mindmap":
      return parseWithSchema(MindmapResponseSchema, safe, "mindmap")
    case "timeline":
      return parseWithSchema(TimelineResponseSchema, safe, "timeline")
    case "comparison":
      return parseWithSchema(ComparisonResponseSchema, safe, "comparison")
  }
}
