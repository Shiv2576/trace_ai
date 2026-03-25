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

interface Props {
  node: AnyNodeData | null
  onClose: () => void
}

export default function NodeDetails({ node, onClose }: Props) {
  if (!node) return null

  const content = (() => {
    switch (node.kind) {
      case "schema": {
        const { table } = node as TableNodeData
        return (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>🗂</span>
              <span
                style={{
                  color: "#e2e2f0",
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                {table.table_name}
              </span>
            </div>
            <p
              style={{
                margin: "0 0 12px",
                color: "#7a7a9a",
                fontSize: 12,
                lineHeight: 1.6,
                fontFamily: "sans-serif",
              }}
            >
              {table.description}
            </p>
            <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: 10 }}>
              {table.columns.map((col) => {
                const isPK = col.constraints?.includes("PK")
                const isFK = col.constraints?.includes("FK")
                return (
                  <div
                    key={col.name}
                    style={{
                      display: "flex",
                      gap: 8,
                      padding: "5px 0",
                      borderBottom: "1px solid #111120",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 11 }}>
                      {isPK ? "🔑" : isFK ? "🔗" : "·"}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: isPK ? "#2de2a0" : isFK ? "#a599ff" : "#c8c8e0",
                        flex: 1,
                      }}
                    >
                      {col.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        color: "#4a4a6a",
                      }}
                    >
                      {col.type}
                    </span>
                    {col.references && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "#4a3a8a",
                          fontFamily: "monospace",
                        }}
                      >
                        → {col.references}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )
      }
      case "flow": {
        const { node: n } = node as FlowNodeData
        const color =
          (
            {
              input: "#2de2a0",
              process: "#7c6af7",
              output: "#f7a84a",
              decision: "#e26d6d",
            } as Record<string, string>
          )[n.category ?? "process"] ?? "#7c6af7"
        return (
          <>
            <span
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                color,
                textTransform: "uppercase" as const,
                letterSpacing: "0.1em",
              }}
            >
              {n.category}
            </span>
            <p
              style={{
                margin: "8px 0",
                color: "#e2e2f0",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "sans-serif",
              }}
            >
              {n.title}
            </p>
            <p
              style={{
                margin: 0,
                color: "#7a7a9a",
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: "sans-serif",
              }}
            >
              {n.description}
            </p>
          </>
        )
      }
      case "mindmap": {
        const { node: n } = node as MindmapNodeData
        return (
          <>
            <p
              style={{
                margin: "0 0 8px",
                color: "#a599ff",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "sans-serif",
              }}
            >
              {n.label}
            </p>
            <p
              style={{
                margin: 0,
                color: "#7a7a9a",
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: "sans-serif",
              }}
            >
              {n.detail}
            </p>
          </>
        )
      }
      case "timeline": {
        const { node: n } = node as TimelineNodeData
        return (
          <>
            <span
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "#7c6af7",
              }}
            >
              📅 {n.date_label}
            </span>
            <p
              style={{
                margin: "8px 0",
                color: "#e2e2f0",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "sans-serif",
              }}
            >
              {n.title}
            </p>
            <p
              style={{
                margin: 0,
                color: "#7a7a9a",
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: "sans-serif",
              }}
            >
              {n.description}
            </p>
          </>
        )
      }
      case "comparison": {
        const d = node as ComparisonNodeData
        return (
          <>
            <p
              style={{
                margin: "0 0 12px",
                color: "#7c6af7",
                fontSize: 12,
                fontFamily: "monospace",
                textTransform: "uppercase" as const,
              }}
            >
              {d.category}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: d.winner === "a" ? "#2de2a0" : "#1e1e2e",
                  background:
                    d.winner === "a" ? "rgba(45,226,160,0.05)" : "transparent",
                }}
              >
                <p
                  style={{
                    margin: "0 0 4px",
                    color: d.winner === "a" ? "#2de2a0" : "#7a7a9a",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                >
                  OPTION A {d.winner === "a" ? "✓" : ""}
                </p>
                <p
                  style={{
                    margin: 0,
                    color: "#c8c8e0",
                    fontSize: 12,
                    fontFamily: "sans-serif",
                    lineHeight: 1.4,
                  }}
                >
                  {d.option_a}
                </p>
              </div>
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: d.winner === "b" ? "#2de2a0" : "#1e1e2e",
                  background:
                    d.winner === "b" ? "rgba(45,226,160,0.05)" : "transparent",
                }}
              >
                <p
                  style={{
                    margin: "0 0 4px",
                    color: d.winner === "b" ? "#2de2a0" : "#7a7a9a",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                >
                  OPTION B {d.winner === "b" ? "✓" : ""}
                </p>
                <p
                  style={{
                    margin: 0,
                    color: "#c8c8e0",
                    fontSize: 12,
                    fontFamily: "sans-serif",
                    lineHeight: 1.4,
                  }}
                >
                  {d.option_b}
                </p>
              </div>
            </div>
          </>
        )
      }
    }
  })()

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 360,
        zIndex: 20,
        animation: "slideIn 0.15s ease-out",
      }}
    >
      <style>{`@keyframes slideIn { from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)} }`}</style>
      <div
        style={{
          background: "#0d0d18",
          border: "1px solid #1e1e2e",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.8),0 0 0 1px rgba(124,106,247,0.08)",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #1e1e2e",
            display: "flex",
            justifyContent: "space-between",
            background: "rgba(124,106,247,0.06)",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "#4a4a6a",
              fontSize: 10,
              fontFamily: "monospace",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {
              (
                {
                  schema: "Table",
                  flow: "Step",
                  mindmap: "Concept",
                  timeline: "Event",
                  comparison: "Dimension",
                } as Record<string, string>
              )[node.kind]
            }
          </span>
          <Button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#4a4a6a",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </Button>
        </div>
        <div
          style={{ padding: "14px 16px", maxHeight: 400, overflowY: "auto" }}
        >
          {content}
        </div>
      </div>
    </div>
  )
}
