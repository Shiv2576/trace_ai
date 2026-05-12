"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
  EdgeLabelRenderer,
  BaseEdge,
  getBezierPath,
  EdgeProps,
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
  base: "backdrop-blur-xl bg-card border border-border",
  hover: "hover:bg-accent hover:border-accent",
  selected:
    "bg-accent border-primary shadow-[0_0_0_2px_rgba(124,106,247,0.3),0_8px_40px_rgba(124,106,247,0.15)]",
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
        "flex items-center gap-2 border-b border-border px-3 py-2 transition-colors hover:bg-muted/50",
        isPK && "bg-emerald-50 dark:bg-emerald-950/20",
        isFK && "bg-violet-50 dark:bg-violet-950/20"
      )}
    >
      <span className="w-4 shrink-0 text-center text-xs select-none">
        {isPK ? "🔑" : isFK ? "🔗" : isUnique ? "◆" : "·"}
      </span>

      <span
        className={cn(
          "flex-1 truncate font-mono text-xs font-medium",
          isPK
            ? "text-emerald-700 dark:text-emerald-400"
            : isFK
              ? "text-violet-700 dark:text-violet-400"
              : "text-foreground"
        )}
      >
        {col.name}
      </span>

      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
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
                "h-4 px-1.5 py-0 font-mono text-[9px]",
                c === "PK" &&
                  "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                c === "FK" &&
                  "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-400",
                c === "UNIQUE" &&
                  "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                !["PK", "FK", "UNIQUE"].includes(c) &&
                  "border-border bg-muted text-muted-foreground"
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
  background: "rgb(124,106,247)",
  border: "2px solid rgba(124,106,247,0.4)",
  width: 10,
  height: 10,
}

/* ─────────────────────────────────────────
   CUSTOM EDGE WITH VISIBLE LABEL
───────────────────────────────────────── */
function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: "rgb(124,106,247)",
          strokeWidth: 2,
          filter: "drop-shadow(0 0 4px rgba(124,106,247,0.3))",
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <div className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground shadow-lg ring-1 ring-primary/20">
              {data.label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
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
        style={{ ...handleStyle, top: -5 }}
      />
      <Card
        className={cn(
          "w-[280px] overflow-hidden border-2 transition-all duration-200",
          glass.base,
          selected ? glass.selected : "shadow-lg"
        )}
      >
        <CardHeader className="flex-row items-center gap-2 space-y-0 border-b bg-muted/50 px-4 py-3">
          <span className="text-lg">🗂</span>
          <span className="flex-1 truncate font-mono text-sm font-bold text-foreground">
            {table.table_name}
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {table.columns.length} cols
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {table.columns.map((col) => (
            <ColumnRow key={col.name} col={col} />
          ))}
          <div className="border-t bg-muted/30 px-4 py-2.5">
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {table.description}
            </p>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...handleStyle, bottom: -5 }}
      />
    </>
  )
}

/* ─────────────────────────────────────────
   FLOW NODE
───────────────────────────────────────── */
const CATEGORY_COLORS: Record<
  string,
  { text: string; bg: string; border: string; badge: string }
> = {
  input: {
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    badge:
      "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  process: {
    text: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200 dark:border-violet-800",
    badge:
      "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  output: {
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    badge:
      "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  decision: {
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-800",
    badge: "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  default: {
    text: "text-foreground",
    bg: "bg-muted/50",
    border: "border-border",
    badge: "border-border bg-muted text-muted-foreground",
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
        style={{ ...handleStyle, top: -5, background: "rgb(124,106,247)" }}
      />
      <Card
        className={cn(
          "w-[260px] overflow-hidden border-2 transition-all duration-200",
          glass.base,
          selected ? glass.selected : "shadow-lg"
        )}
      >
        <div className={cn("border-b px-4 py-2", cat.bg, cat.border)}>
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[10px] tracking-wider uppercase",
              cat.badge
            )}
          >
            {node.category ?? "step"}
          </Badge>
        </div>
        <CardContent className="px-4 py-3">
          <p className="mb-1.5 text-sm font-bold text-foreground">
            {node.title}
          </p>
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {node.description}
          </p>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...handleStyle, bottom: -5, background: "rgb(124,106,247)" }}
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
        style={{ ...handleStyle, left: -5 }}
      />
      <div
        className={cn(
          "border-2 text-center transition-all duration-200",
          isRoot
            ? "rounded-2xl px-6 py-4"
            : isBranch
              ? "rounded-xl px-4 py-3"
              : "rounded-lg px-3 py-2",
          glass.base,
          selected ? glass.selected : "shadow-lg",
          isRoot && "border-primary/50 bg-primary/5 shadow-primary/10"
        )}
        style={{
          maxWidth: isRoot ? 220 : isBranch ? 200 : 180,
        }}
      >
        <p
          className={cn(
            "font-sans",
            isRoot
              ? "text-sm font-bold text-primary"
              : isBranch
                ? "text-xs font-semibold text-foreground"
                : "text-[11px] text-muted-foreground"
          )}
        >
          {node.label}
        </p>
        {node.detail && !isRoot && (
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground/70">
            {node.detail}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ ...handleStyle, right: -5 }}
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
        style={{ ...handleStyle, top: -5 }}
      />
      <Card
        className={cn(
          "w-[240px] overflow-hidden border-2 transition-all duration-200",
          glass.base,
          selected ? glass.selected : "shadow-lg"
        )}
      >
        <div className="flex items-center gap-2 border-b bg-blue-50 px-4 py-2 dark:bg-blue-950/30">
          <span className="text-sm">📅</span>
          <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
            {node.date_label}
          </span>
        </div>
        <CardContent className="px-4 py-3">
          <p className="mb-1.5 text-sm font-bold text-foreground">
            {node.title}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {node.description}
          </p>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...handleStyle, bottom: -5 }}
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
        "w-[480px] overflow-hidden rounded-xl border-2 transition-all duration-200",
        glass.base,
        selected ? glass.selected : "shadow-lg"
      )}
    >
      <div className="grid grid-cols-[180px_1fr_1fr]">
        <div className="flex items-center border-r bg-muted/50 px-4 py-3">
          <span className="font-mono text-xs font-semibold text-foreground">
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
              "px-4 py-3 transition-colors",
              i === 0 && "border-r",
              opt.win && "bg-emerald-50 dark:bg-emerald-950/20"
            )}
          >
            <p
              className={cn(
                "text-xs leading-snug font-medium",
                opt.win
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-foreground"
              )}
            >
              {opt.win && <span className="mr-1.5">✓</span>}
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
   EDGE TYPES
───────────────────────────────────────── */
const EDGE_TYPES = {
  custom: CustomEdge,
}

/* ─────────────────────────────────────────
   CUSTOM CONTROLS
───────────────────────────────────────── */
function GlassControls() {
  const [locked, setLocked] = useState(false)

  return (
    <TooltipProvider delay={300}>
      <div className="absolute bottom-5 left-5 z-10 flex flex-col gap-1 rounded-xl border bg-card p-1.5 shadow-lg">
        {[
          {
            icon: <ZoomIn className="h-4 w-4" />,
            label: "Zoom in",
            className: "react-flow__controls-zoomin",
          },
          {
            icon: <ZoomOut className="h-4 w-4" />,
            label: "Zoom out",
            className: "react-flow__controls-zoomout",
          },
          {
            icon: <Maximize2 className="h-4 w-4" />,
            label: "Fit view",
            className: "react-flow__controls-fitview",
          },
        ].map(({ icon, label, className: cls }) => (
          <Tooltip key={label}>
            <TooltipTrigger>
              <Button
                size="icon"
                variant="ghost"
                className={cn(cls, "h-8 w-8 rounded-lg")}
              >
                {icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator />

        <Tooltip>
          <TooltipTrigger>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLocked((l) => !l)}
              className={cn(
                "react-flow__controls-interactive h-8 w-8 rounded-lg",
                locked && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {locked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {locked ? "Unlock" : "Lock"} nodes
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

/* ─────────────────────────────────────────
   MINIMAP
───────────────────────────────────────── */
function GlassMiniMap() {
  return (
    <div className="absolute right-5 bottom-5 z-10 overflow-hidden rounded-xl border bg-card shadow-lg">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5">
        <MapIcon className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          minimap
        </span>
      </div>
      <MiniMap
        nodeColor={(n) => {
          if (n.type === "tableNode") return "rgb(124,106,247)"
          if (n.type === "flowNode") return "rgb(99,102,241)"
          if (n.type === "mindmapNode") return "rgb(168,85,247)"
          if (n.type === "timelineNode") return "rgb(59,130,246)"
          return "rgb(148,163,184)"
        }}
        maskColor="rgba(0,0,0,0.3)"
        style={{
          background: "transparent",
          border: "none",
          borderRadius: 0,
          margin: 0,
          width: 180,
          height: 120,
        }}
      />
    </div>
  )
}

/* ─────────────────────────────────────────
   EDGE DEFAULTS
───────────────────────────────────────── */
const EDGE_DEFAULTS = {
  type: "custom",
  style: {
    stroke: "rgb(124,106,247)",
    strokeWidth: 2,
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

  const styledEdges = edges.map((e) => ({
    ...e,
    ...EDGE_DEFAULTS,
    style: {
      ...EDGE_DEFAULTS.style,
      ...e.style,
    },
    data: {
      ...e.data,
      label: e.label || e.data?.label,
    },
  }))

  return (
    <>
      <style>{`
        .react-flow__controls { display: none; }
        .react-flow__minimap { display: none; }
        .react-flow__edge:hover .react-flow__edge-path {
          stroke: rgb(168,85,247) !important;
          stroke-width: 3 !important;
        }
        .react-flow__edge.selected .react-flow__edge-path {
          stroke: rgb(236,72,153) !important;
          stroke-width: 3 !important;
        }
      `}</style>

      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick(node.data)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.5}
        defaultEdgeOptions={EDGE_DEFAULTS}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#94a3b8"
          gap={20}
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
        className="h-full w-full bg-background"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--muted)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {ready && <FlowCanvas {...props} />}
      </div>
    </ReactFlowProvider>
  )
}
