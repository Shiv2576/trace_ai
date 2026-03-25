"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, ArrowUp, CornerDownLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

import { useUser } from "@clerk/nextjs"

interface Props {
  onSubmit: (question: string) => void
  loading: boolean
  disabled: boolean
}

export default function PromptInput({ onSubmit, loading, disabled }: Props) {
  const [question, setQuestion] = useState("")
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { isSignedIn, isLoaded } = useUser()
  const isDisabled = !isLoaded || !isSignedIn || loading

  const isReady = (question?.trim().length ?? 0) >= 3

  const handleSubmit = () => {
    const trimmed = question?.trim() ?? ""

    if (loading || trimmed.length < 3) return

    onSubmit(trimmed)
    setQuestion("")
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [question])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border transition-all duration-300",
          "backdrop-blur-xl",
          focused
            ? "border-white/20 shadow-[0_0_0_1px_rgba(124,106,247,0.3),0_8px_40px_rgba(124,106,247,0.12)]"
            : "border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
        )}
        style={{ background: "rgba(10,10,22,0.75)" }}
      >
        {/* Focused top gradient line */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-px transition-opacity duration-300",
            focused ? "opacity-100" : "opacity-0"
          )}
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(124,106,247,0.6), rgba(45,226,160,0.4), transparent)",
          }}
        />

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={
            !isSignedIn
              ? "Sign in to start asking..."
              : "What question should I reason through?\ne.g. Should I move my startup to San Francisco?"
          }
          rows={3}
          className={cn(
            "w-full resize-none border-0 bg-transparent px-5 pt-4 pb-2",
            "font-sans text-[14px] leading-relaxed text-white/85 placeholder:text-white/20",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "max-h-[200px] min-h-[90px] overflow-y-auto",
            "scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          )}
        />

        {/* Footer row */}
        <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-white/20">
            <CornerDownLeft className="h-3 w-3" />
            <span className="font-mono text-[11px]">
              Enter for new line · ⌘↵ to run
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={isDisabled || !isReady}
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full border transition-all duration-200",
                isReady && !loading
                  ? "border-white/20 bg-white/10 text-white/60 hover:border-white/30 hover:bg-white/15 hover:text-white/80"
                  : "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-white/20"
              )}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
