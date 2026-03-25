"use client"

import { useState, useCallback } from "react"
import PromptInput from "./components/promptinput"
import NodeDetails from "./components/nodedetails"
import Graph from "./components/graph"
import { toFlow, AnyNodeData } from "@/lib/parse"
import { AnyResponse } from "@/lib/groq"
import { Node, Edge } from "reactflow"
import { MOCK_EXAMPLES } from "@/lib/mockData"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ArrowLeft, TriangleAlert, GitBranch } from "lucide-react"
import { useUser, SignInButton, UserButton } from "@clerk/nextjs"

type View = "home" | "graph"
const TOPBAR_H = 52

const TYPE_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  schema: { label: "Database Schema", variant: "outline" },
  flow: { label: "Process Flow", variant: "outline" },
  mindmap: { label: "Mind Map", variant: "outline" },
  timeline: { label: "Timeline", variant: "outline" },
  comparison: { label: "Comparison", variant: "outline" },
}

const EXAMPLES = [
  { q: "Twitter database schema", hint: "schema" },
  { q: "How does photosynthesis work?", hint: "flow" },
  { q: "React vs Vue vs Angular", hint: "comparison" },
  { q: "History of the internet", hint: "timeline" },
  { q: "Machine learning concepts", hint: "mindmap" },
]

export default function Home() {
  const [view, setView] = useState<View>("home")
  const [loading, setLoading] = useState(false)
  const [nodes, setNodes] = useState<Node<AnyNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selected, setSelected] = useState<AnyNodeData | null>(null)
  const [isMock, setIsMock] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [question, setQuestion] = useState("")
  const [vizType, setVizType] = useState<string>("flow")

  const { isSignedIn } = useUser()

  const handleSubmit = useCallback(async (q: string) => {
    setLoading(true)
    setWarning(null)
    setQuestion(q)
    try {
      const res = await fetch("/api/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Unknown error")
      const response: AnyResponse = json.data
      const { nodes: n, edges: e } = toFlow(response)
      setNodes(n)
      setEdges(e)
      setVizType(response.type)
      setIsMock(json.mock ?? false)
      setWarning(json.warning ?? null)
      setSelected(null)
      setView("graph")
    } catch (err) {
      setWarning(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleMockExample = useCallback(
    (q: string, hint: string) => {
      const mockResponse = MOCK_EXAMPLES[hint]
      if (!mockResponse) {
        handleSubmit(q)
        return
      }
      const { nodes: n, edges: e } = toFlow(mockResponse)
      setNodes(n)
      setEdges(e)
      setVizType(mockResponse.type)
      setQuestion(q)
      setIsMock(true)
      setWarning(null)
      setSelected(null)
      setView("graph")
    },
    [handleSubmit]
  )

  /* ── Graph view ─────────────────────────────────── */
  if (view === "graph") {
    const meta = TYPE_LABELS[vizType] ?? TYPE_LABELS.flow

    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
        {/* Topbar */}
        <header
          className="z-10 flex shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm"
          style={{ height: TOPBAR_H }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setView("home")
                setSelected(null)
              }}
              className="h-8 shrink-0 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Back</span>
            </Button>

            <Separator orientation="vertical" className="h-4" />

            <p className="min-w-0 truncate text-sm text-muted-foreground">
              &ldquo;{question}&rdquo;
            </p>
          </div>

          <div className="ml-3 flex shrink-0 items-center gap-2">
            <Badge variant={meta.variant} className="text-xs font-medium">
              {meta.label}
            </Badge>
            {isMock && (
              <Badge variant="secondary" className="text-xs">
                Demo
              </Badge>
            )}
            <Separator orientation="vertical" className="h-4" />
          </div>
        </header>

        {/* Canvas */}
        <div className="absolute inset-0" style={{ top: TOPBAR_H }}>
          <Graph nodes={nodes} edges={edges} onNodeClick={setSelected} />
          <NodeDetails node={selected} onClose={() => setSelected(null)} />

          {!selected && (
            <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
              <p className="rounded-full border bg-background/90 px-4 py-1.5 text-xs whitespace-nowrap text-muted-foreground shadow-sm backdrop-blur-sm">
                Click any node to inspect · Drag to rearrange
              </p>
            </div>
          )}

          {warning && (
            <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs whitespace-nowrap text-amber-700 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-400">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                {warning}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── Home view ──────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-foreground">
              <GitBranch className="h-3.5 w-3.5 text-background" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Trace.ai
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isSignedIn ? (
              <SignInButton mode="modal">
                <Button size="sm" variant="outline">
                  Sign In
                </Button>
              </SignInButton>
            ) : (
              <UserButton afterSwitchSessionUrl="/" />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-24 pb-16">
        {/* Hero */}
        <div className="mb-12 max-w-xl text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground">
            Visualize any idea
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Ask anything and get an interactive visual — schemas, flows,
            timelines, mind maps, and comparisons.
          </p>

          {/* Type pills */}
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <Badge
                key={k}
                variant="secondary"
                className="text-xs font-normal"
              >
                {v.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div className="w-full max-w-2xl">
          <PromptInput
            onSubmit={handleSubmit}
            loading={loading}
            disabled={!isSignedIn}
          />
        </div>

        {/* Warning */}
        {warning && (
          <div className="mt-4 flex max-w-xl items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-400">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {warning}
          </div>
        )}

        {/* Examples */}
        <div className="mt-8 w-full max-w-2xl">
          <p className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Try an example
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map(({ q, hint }) => (
              <Button
                key={q}
                variant="outline"
                size="sm"
                onClick={() => handleMockExample(q, hint)}
                disabled={loading || !isSignedIn}
                className={cn(
                  "h-8 rounded-lg text-xs font-normal text-muted-foreground",
                  "transition-colors hover:bg-accent hover:text-foreground",
                  "disabled:opacity-40"
                )}
              >
                {q}
              </Button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
