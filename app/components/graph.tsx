"use client"

import { useEffect, useRef, useState } from "react"
import ReactFlow, {
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
  ReactFlowProvider,
  Node,
  Edge,
  NodeProps,
  useNodesState,
  useEdgesState,
} from "reactflow"
import "reactflow/dist/style.css"
import {
  AnyNodeData,
  TableNodeData,
  FlowNodeData,
  MindmapNodeData,
  TimelineNodeData,
  ComparisonNodeData,
} from "@/lib/parse"
import { Column } from "@/lib/groq"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  Unlock,
  Map as MapIcon,
} from "lucide-react"

const glass = {
  base: "backdrop-blur-xl bg-white/[0.04] border border-white/[0.08]",
  hover: "hover:bg-white/[0.07] hover:border-white/[0.14]",
  selected:
    "bg-white/[0.08] border-white/20 shadow-[0_0_0_1px_rgba(124,106,247,0.4),0_8px_40px_rgba(124,106,247,0.15)]",
}

/* ─────────────────────────────────────────
   COLUMN ROW
───────────────────────────────────────── */
function ColumnRow({ col }: { col: Column }) {
  const isPK = col.constraints?.includes("PK")
  const isFK = col.constraints?.includes("FK")
  const isUnique = col.constraints?.includes("UNIQUE")

  return (
    <div
      className={cn(
        "py-1.25px flex items-center gap-2 border-b border-white/5 px-3 transition-colors",
        isPK && "bg-emerald-500/4",
        isFK && "bg-violet-500/4"
      )}
    >
      <span className="w-3.5 shrink-0 text-center text-[10px] select-none">
        {isPK ? "🔑" : isFK ? "🔗" : isUnique ? "◆" : "·"}
      </span>

      <span
        className={cn(
          "flex-1 truncate font-mono text-[11px]",
          isPK
            ? "font-semibold text-emerald-400"
            : isFK
              ? "font-semibold text-violet-300"
              : "text-white/70"
        )}
      >
        {col.name}
      </span>

      <span className="shrink-0 font-mono text-[10px] text-white/25">
        {col.type}
      </span>

      <div className="flex shrink-0 gap-1">
        {(col.constraints ?? [])
          .filter((c) => c !== "NOT NULL")
          .map((c) => (
            <Badge
              key={c}
              variant="outline"
              className={cn(
                "h-4 border px-1.5 py-0 font-mono text-[8px]",
                c === "PK" &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                c === "FK" &&
                  "border-violet-500/30 bg-violet-500/10 text-violet-300",
                c === "UNIQUE" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-400",
                !["PK", "FK", "UNIQUE"].includes(c) &&
                  "border-white/10 bg-white/5 text-white/30"
              )}
            >
              {c}
            </Badge>
          ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   SHARED HANDLE STYLE
───────────────────────────────────────── */
const handleStyle = {
  background: "rgba(124,106,247,0.8)",
  border: "1.5px solid rgba(124,106,247,0.4)",
  width: 9,
  height: 9,
  backdropFilter: "blur(4px)",
}

/* ─────────────────────────────────────────
   TABLE NODE
───────────────────────────────────────── */
function TableNode({ data, selected }: NodeProps<AnyNodeData>) {
  const { table } = data as TableNodeData
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ ...handleStyle, top: -4.5 }}
      />
      <Card
        className={cn(
          "w-70px overflow-hidden rounded-xl border transition-all duration-200",
          glass.base,
          selected ? glass.selected : "shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        )}
        style={{ background: "rgba(10,10,22,0.7)" }}
      >
        <CardHeader className="flex-row items-center gap-2 space-y-0 border-b border-white/6 bg-white/2 px-3 py-2.5">
          <span className="text-sm">🗂</span>
          <span className="flex-1 truncate font-mono text-[13px] font-bold text-white/90">
            {table.table_name}
          </span>
          <Badge
            variant="outline"
            className="border-white/10 bg-white/3 font-mono text-[9px] text-white/30"
          >
            {table.columns.length} cols
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {table.columns.map((col) => (
            <ColumnRow key={col.name} col={col} />
          ))}
          <div className="border-t border-white/5 bg-black/20 px-3 py-2">
            <p className="line-clamp-2 text-[10px] leading-relaxed text-white/25">
              {table.description}
            </p>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...handleStyle, bottom: -4.5 }}
      />
    </>
  )
}

/* ─────────────────────────────────────────
   FLOW NODE
───────────────────────────────────────── */
const CATEGORY_COLORS: Record<
  string,
  { text: string; glow: string; badge: string }
> = {
  input: {
    text: "#2de2a0",
    glow: "rgba(45,226,160,0.15)",
    badge: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  process: {
    text: "#a599ff",
    glow: "rgba(124,106,247,0.15)",
    badge: "text-violet-300 border-violet-500/30 bg-violet-500/10",
  },
  output: {
    text: "#f7a84a",
    glow: "rgba(247,168,74,0.15)",
    badge: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  decision: {
    text: "#e26d6d",
    glow: "rgba(226,109,109,0.15)",
    badge: "text-red-400 border-red-500/30 bg-red-500/10",
  },
  default: {
    text: "#7a7a9a",
    glow: "rgba(122,122,154,0.1)",
    badge: "text-white/40 border-white/10 bg-white/5",
  },
}

function FlowNode({ data, selected }: NodeProps<AnyNodeData>) {
  const { node } = data as FlowNodeData
  const cat =
    CATEGORY_COLORS[node.category ?? "default"] ?? CATEGORY_COLORS.default

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ ...handleStyle, top: -4.5, background: cat.text + "cc" }}
      />
      <Card
        className={cn(
          "w-60 overflow-hidden rounded-xl border transition-all duration-200",
          glass.base,
          selected ? glass.selected : "shadow-[0_6px_24px_rgba(0,0,0,0.4)]"
        )}
        style={{ background: `rgba(10,10,22,0.75)` }}
      >
        <div
          className="border-b border-white/6 px-3 py-1.5"
          style={{ background: cat.glow }}
        >
          <Badge
            variant="outline"
            className={cn(
              "h-4 border px-1.5 py-0 font-mono text-[9px] tracking-widest uppercase",
              cat.badge
            )}
          >
            {node.category ?? "step"}
          </Badge>
        </div>
        <CardContent className="px-3 py-2.5">
          <p className="mb-1.5 font-sans text-[12px] font-bold text-white/90">
            {node.title}
          </p>
          <p className="line-clamp-3 text-[11px] leading-relaxed text-white/40">
            {node.description}
          </p>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...handleStyle, bottom: -4.5, background: cat.text + "cc" }}
      />
    </>
  )
}

/* ─────────────────────────────────────────
   MINDMAP NODE
───────────────────────────────────────── */
function MindmapNode({ data, selected }: NodeProps<AnyNodeData>) {
  const { node } = data as MindmapNodeData
  const isRoot = node.level === 0
  const isBranch = node.level === 1

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ ...handleStyle, left: -4.5 }}
      />
      <div
        className={cn(
          "border text-center transition-all duration-200",
          isRoot
            ? "rounded-2xl px-5 py-3.5"
            : isBranch
              ? "rounded-xl px-4 py-2.5"
              : "rounded-lg px-3 py-1.5",
          glass.base,
          selected ? glass.selected : "shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
          isRoot &&
            "border-violet-500/30 shadow-[0_0_40px_rgba(124,106,247,0.2)]"
        )}
        style={{
          maxWidth: isRoot ? 200 : isBranch ? 180 : 160,
          background: isRoot ? "rgba(124,106,247,0.08)" : "rgba(10,10,22,0.75)",
        }}
      >
        <p
          className={cn(
            "font-sans",
            isRoot
              ? "text-[14px] font-bold text-violet-300"
              : isBranch
                ? "text-[12px] font-semibold text-white/85"
                : "text-[11px] text-white/55"
          )}
        >
          {node.label}
        </p>
        {node.detail && !isRoot && (
          <p className="mt-1 text-[10px] leading-snug text-white/25">
            {node.detail}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ ...handleStyle, right: -4.5 }}
      />
    </>
  )
}

/* ─────────────────────────────────────────
   TIMELINE NODE
───────────────────────────────────────── */
function TimelineNode({ data, selected }: NodeProps<AnyNodeData>) {
  const { node } = data as TimelineNodeData
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ ...handleStyle, top: -4.5 }}
      />
      <Card
        className={cn(
          "w-65px overflow-hidden rounded-xl border transition-all duration-200",
          glass.base,
          selected ? glass.selected : "shadow-[0_6px_24px_rgba(0,0,0,0.4)]"
        )}
        style={{ background: "rgba(10,10,22,0.75)" }}
      >
        <div className="flex items-center gap-2 border-b border-white/6 bg-violet-500/6 px-3 py-2">
          <span className="text-[11px]">📅</span>
          <span className="font-mono text-[11px] font-bold text-violet-300">
            {node.date_label}
          </span>
        </div>
        <CardContent className="px-3 py-2.5">
          <p className="mb-1.5 text-[12px] font-bold text-white/90">
            {node.title}
          </p>
          <p className="text-[11px] leading-relaxed text-white/40">
            {node.description}
          </p>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...handleStyle, bottom: -4.5 }}
      />
    </>
  )
}

/* ─────────────────────────────────────────
   COMPARISON NODE
───────────────────────────────────────── */
function ComparisonNode({ data, selected }: NodeProps<AnyNodeData>) {
  const d = data as ComparisonNodeData
  const winA = d.winner === "a"
  const winB = d.winner === "b"

  return (
    <div
      className={cn(
        "w-160px overflow-hidden rounded-xl border transition-all duration-200",
        glass.base,
        selected ? glass.selected : "shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      )}
      style={{ background: "rgba(10,10,22,0.75)" }}
    >
      <div className="grid grid-cols-[180px_1fr_1fr]">
        <div className="flex items-center border-r border-white/6 bg-white/2 px-3.5 py-2.5">
          <span className="font-mono text-[11px] text-white/35">
            {d.category}
          </span>
        </div>

        {[
          { label: d.option_a, win: winA },
          { label: d.option_b, win: winB },
        ].map((opt, i) => (
          <div
            key={i}
            className={cn(
              "px-3.5 py-2.5 transition-colors",
              i === 0 && "border-r border-white/6",
              opt.win && "bg-emerald-500/6"
            )}
          >
            <p
              className={cn(
                "text-[11px] leading-snug",
                opt.win ? "text-emerald-400" : "text-white/60"
              )}
            >
              {opt.win && <span className="mr-1">✓</span>}
              {opt.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   NODE TYPES
───────────────────────────────────────── */
const NODE_TYPES = {
  tableNode: TableNode,
  flowNode: FlowNode,
  mindmapNode: MindmapNode,
  timelineNode: TimelineNode,
  comparisonNode: ComparisonNode,
}

/* ─────────────────────────────────────────
   CUSTOM CONTROLS (shadcn buttons)
───────────────────────────────────────── */
function GlassControls() {
  const [locked, setLocked] = useState(false)

  return (
    <TooltipProvider delay={300}>
      <div
        className={cn(
          "absolute bottom-5 left-5 z-10 flex flex-col gap-1 rounded-xl border p-1.5",
          glass.base
        )}
        style={{ background: "rgba(8,8,18,0.8)" }}
      >
        {[
          {
            icon: <ZoomIn className="h-3.5 w-3.5" />,
            label: "Zoom in",
            className: "react-flow__controls-zoomin",
          },
          {
            icon: <ZoomOut className="h-3.5 w-3.5" />,
            label: "Zoom out",
            className: "react-flow__controls-zoomout",
          },
          {
            icon: <Maximize2 className="h-3.5 w-3.5" />,
            label: "Fit view",
            className: "react-flow__controls-fitview",
          },
        ].map(({ icon, label, className: cls }) => (
          <Tooltip key={label}>
            <TooltipTrigger>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  cls,
                  "h-7 w-7 rounded-lg text-white/40 transition-all hover:bg-white/8 hover:text-white/80"
                )}
              >
                {icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="border-white/10 bg-black/80 text-xs text-white/70"
            >
              {label}
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator className="my-0.5 bg-white/6" />

        <Tooltip>
          <TooltipTrigger>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLocked((l) => !l)}
              className={cn(
                "react-flow__controls-interactive h-7 w-7 rounded-lg transition-all",
                locked
                  ? "bg-violet-500/10 text-violet-400 hover:bg-violet-500/15 hover:text-violet-300"
                  : "text-white/40 hover:bg-white/8 hover:text-white/80"
              )}
            >
              {locked ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Unlock className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="border-white/10 bg-black/80 text-xs text-white/70"
          >
            {locked ? "Unlock" : "Lock"} nodes
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

/* ─────────────────────────────────────────
   GLASS MINIMAP
───────────────────────────────────────── */
function GlassMiniMap() {
  return (
    <div
      className={cn(
        "absolute right-5 bottom-5 z-10 overflow-hidden rounded-xl border",
        glass.base
      )}
      style={{ background: "rgba(8,8,18,0.8)" }}
    >
      <div className="flex items-center gap-2 border-b border-white/6 px-3 py-1.5">
        <MapIcon className="h-3 w-3 text-white/30" />
        <span className="font-mono text-[10px] tracking-widest text-white/25 uppercase">
          minimap
        </span>
      </div>
      <MiniMap
        nodeColor={() => "rgba(124,106,247,0.3)"}
        maskColor="rgba(5,5,12,0.75)"
        style={{
          background: "transparent",
          border: "none",
          borderRadius: 0,
          margin: 0,
          width: 160,
          height: 100,
        }}
      />
    </div>
  )
}

/* ─────────────────────────────────────────
   EDGE DEFAULTS
───────────────────────────────────────── */
const EDGE_DEFAULTS = {
  style: {
    stroke: "rgba(124,106,247,0.35)",
    strokeWidth: 1.5,
    filter: "drop-shadow(0 0 3px rgba(124,106,247,0.25))",
  },
  animated: false,
}

/* ─────────────────────────────────────────
   FLOW CANVAS
───────────────────────────────────────── */
interface GraphProps {
  nodes: Node<AnyNodeData>[]
  edges: Edge[]
  onNodeClick: (data: AnyNodeData) => void
}

function FlowCanvas({
  nodes: initNodes,
  edges: initEdges,
  onNodeClick,
}: GraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)

  useEffect(() => {
    setNodes(initNodes)
  }, [initNodes, setNodes])
  useEffect(() => {
    setEdges(initEdges)
  }, [initEdges, setEdges])

  const styledEdges = edges.map((e) => ({ ...e, ...EDGE_DEFAULTS }))

  return (
    <>
      <style>{`
        @keyframes dashmove { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
        .react-flow__edge-path {
          stroke-dasharray: 6 3 !important;
          animation: dashmove 2s linear infinite !important;
        }
        .react-flow__controls { display: none; }
        .react-flow__minimap { display: none; }
      `}</style>

      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick(node.data)}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(255,255,255,0.04)"
          gap={28}
          size={1}
        />
        <GlassControls />
        <GlassMiniMap />
      </ReactFlow>
    </>
  )
}

/* ─────────────────────────────────────────
   ROOT EXPORT
───────────────────────────────────────── */
export default function Graph(props: GraphProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (wrapperRef.current) {
        const { width, height } = wrapperRef.current.getBoundingClientRect()
        if (width > 0 && height > 0) setReady(true)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <ReactFlowProvider>
      <div
        ref={wrapperRef}
        className="h-full w-full"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(124,106,247,0.06) 0%, transparent 60%), radial-gradient(ellipse at 75% 80%, rgba(45,226,160,0.04) 0%, transparent 55%), #05050c",
        }}
      >
        {ready && <FlowCanvas {...props} />}
      </div>
    </ReactFlowProvider>
  )
}
