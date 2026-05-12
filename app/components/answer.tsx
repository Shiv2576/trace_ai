"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import {
  ArrowLeft,
  MessageSquare,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TriangleAlert,
} from "lucide-react"
import { useState } from "react"
import ReactMarkdown from "react-markdown"

interface AnswerViewProps {
  question: string
  response: string | null
  visualizationReady?: boolean
  warning?: string | null
  onBack: () => void
  onViewVisualization?: () => void
}

export default function AnswerView({
  question,
  response,
  visualizationReady = false,
  warning,
  onBack,
  onViewVisualization,
}: AnswerViewProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!response) return
    await navigator.clipboard.writeText(response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Topbar - Fixed */}
      <header className="z-20 flex h-[52px] shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
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
          <Badge variant="outline" className="gap-1 text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            AI Answer
          </Badge>

          {visualizationReady && onViewVisualization && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewVisualization}
              className="h-7 gap-1.5 text-xs"
            >
              <ExternalLink className="h-3 w-3" />
              View Visualization
            </Button>
          )}
        </div>
      </header>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="mx-auto max-w-4xl px-6 py-8">
            {/* Question Card */}
            <Card className="mb-6 border-muted bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Your Question
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {question}
                  </p>
                </div>
              </div>
            </Card>

            {/* Answer Content */}
            <Card className="relative border-border/50 shadow-sm">
              {/* Answer Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card/95 p-4 backdrop-blur-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Answer
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 gap-1.5 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              {/* Answer Body */}
              <div className="p-6">
                {response ? (
                  <div className="prose prose-sm dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-base prose-p:leading-relaxed prose-p:text-foreground/90 prose-ul:my-4 prose-li:my-1 prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-primary prose-pre:border prose-pre:border-border prose-pre:bg-muted prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{response}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <p className="text-sm text-muted-foreground">
                        Generating answer...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Related Actions */}
            {visualizationReady && onViewVisualization && (
              <Card className="mt-4 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
                <button
                  type="button"
                  onClick={onViewVisualization}
                  className="group flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                      <ExternalLink className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">
                        View Interactive Visualization
                      </p>
                      <p className="text-xs text-muted-foreground">
                        See this information as an interactive diagram
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
                </button>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>
      {warning && (
        <div className="absolute top-16 left-1/2 z-30 -translate-x-1/2 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs whitespace-nowrap text-amber-700 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-400">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {warning}
          </div>
        </div>
      )}
    </div>
  )
}
