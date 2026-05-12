"use client"
import {
  AnyNodeData,
  TableNodeData,
  FlowNodeData,
  MindmapNodeData,
  TimelineNodeData,
  ComparisonNodeData,
} from "@/lib/parse"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  X,
  Database,
  GitBranch,
  Brain,
  Clock,
  GitCompare,
  Key,
  Link,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  node: AnyNodeData | null
  onClose: () => void
}

export default function NodeDetails({ node, onClose }: Props) {
  if (!node) return null

  const kindConfig = {
    schema: {
      icon: Database,
      label: "Table Schema",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    flow: {
      icon: GitBranch,
      label: "Process Step",
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
    },
    mindmap: {
      icon: Brain,
      label: "Concept",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    timeline: {
      icon: Clock,
      label: "Event",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    comparison: {
      icon: GitCompare,
      label: "Comparison",
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
  } as const

  const config = kindConfig[node.kind] || kindConfig.flow
  const Icon = config.icon

  const content = (() => {
    switch (node.kind) {
      case "schema": {
        const { table } = node as TableNodeData
        return (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className={cn("rounded-lg p-2", config.bg)}>
                <Icon className={cn("h-5 w-5", config.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-mono text-sm font-bold text-foreground">
                  {table.table_name}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {table.description}
                </p>
              </div>
            </div>

            <Separator />

            {/* Columns */}
            <div>
              <h4 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Columns ({table.columns.length})
              </h4>
              <div className="space-y-1">
                {table.columns.map((col) => {
                  const isPK = col.constraints?.includes("PK")
                  const isFK = col.constraints?.includes("FK")
                  return (
                    <div
                      key={col.name}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors",
                        "hover:bg-muted/50",
                        isPK && "bg-emerald-500/5",
                        isFK && "bg-violet-500/5"
                      )}
                    >
                      {isPK ? (
                        <Key className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : isFK ? (
                        <Link className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                      ) : (
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
                      )}
                      <span
                        className={cn(
                          "flex-1 font-mono text-xs font-semibold",
                          isPK
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isFK
                              ? "text-violet-600 dark:text-violet-400"
                              : "text-foreground"
                        )}
                      >
                        {col.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 font-mono text-[10px]"
                      >
                        {col.type}
                      </Badge>
                      {col.references && (
                        <div className="flex items-center gap-1 text-[10px] text-violet-500">
                          <ArrowRight className="h-3 w-3" />
                          {col.references}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      }
      case "flow": {
        const { node: n } = node as FlowNodeData
        const categoryColors: Record<string, string> = {
          input: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          process: "text-violet-400 bg-violet-500/10 border-violet-500/20",
          output: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          decision: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        }
        const catColor =
          categoryColors[n.category ?? "process"] || categoryColors.process

        return (
          <div className="space-y-4">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold tracking-wider uppercase",
                catColor
              )}
            >
              {n.category || "process"}
            </Badge>
            <div>
              <h3 className="text-sm leading-snug font-bold text-foreground">
                {n.title}
              </h3>
              {n.description && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {n.description}
                </p>
              )}
            </div>
          </div>
        )
      }
      case "mindmap": {
        const { node: n } = node as MindmapNodeData
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <h3 className="text-sm font-bold text-foreground">{n.label}</h3>
            </div>
            {n.detail && (
              <p className="border-l-2 border-amber-500/20 pl-4 text-xs leading-relaxed text-muted-foreground">
                {n.detail}
              </p>
            )}
          </div>
        )
      }
      case "timeline": {
        const { node: n } = node as TimelineNodeData
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="font-mono text-xs font-semibold text-blue-400">
                {n.date_label}
              </span>
            </div>
            <div>
              <h3 className="text-sm leading-snug font-bold text-foreground">
                {n.title}
              </h3>
              {n.description && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {n.description}
                </p>
              )}
            </div>
          </div>
        )
      }
      case "comparison": {
        const d = node as ComparisonNodeData
        return (
          <div className="space-y-4">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold tracking-wider uppercase"
            >
              {d.category}
            </Badge>
            <div className="grid grid-cols-2 gap-3">
              <div
                className={cn(
                  "space-y-1.5 rounded-lg border p-3 transition-colors",
                  d.winner === "a"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-muted/30"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">
                    OPTION A
                  </span>
                  {d.winner === "a" && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </div>
                <p className="text-xs leading-relaxed font-medium text-foreground">
                  {d.option_a}
                </p>
              </div>
              <div
                className={cn(
                  "space-y-1.5 rounded-lg border p-3 transition-colors",
                  d.winner === "b"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-muted/30"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">
                    OPTION B
                  </span>
                  {d.winner === "b" && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </div>
                <p className="text-xs leading-relaxed font-medium text-foreground">
                  {d.option_b}
                </p>
              </div>
            </div>
          </div>
        )
      }
    }
  })()

  return (
    <div className="absolute top-3 right-3 z-20 w-[380px] animate-in duration-200 slide-in-from-right-2">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={cn("rounded-md p-1", config.bg)}>
              <Icon className={cn("h-3.5 w-3.5", config.color)} />
            </div>
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {config.label}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 rounded-full hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[450px]">
          <div className="p-4">{content}</div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="border-t border-border bg-muted/20 px-4 py-2">
          <p className="text-center text-[10px] text-muted-foreground">
            Press{" "}
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              Esc
            </kbd>{" "}
            to close
          </p>
        </div>
      </div>
    </div>
  )
}
