import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

export const runtime = "edge"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, "1 h"),
})

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { success, remaining } = await ratelimit.limit(userId)

    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded", remaining },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { question } = body

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length < 3
    ) {
      return NextResponse.json(
        { error: "Question must be at least 3 characters." },
        { status: 400 }
      )
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      )
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful, knowledgeable assistant. Provide clear, concise, and accurate answers.",
          },
          {
            role: "user",
            content: question.trim(),
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[chat] API error ${res.status}:`, errText)
      return NextResponse.json(
        { error: "Failed to get response from AI" },
        { status: 502 }
      )
    }

    const data: any = await res.json()
    const message = data?.choices?.[0]?.message

    if (!message?.content) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 502 }
      )
    }

    return NextResponse.json({
      answer: message.content.trim(),
      remaining,
    })
  } catch (err: unknown) {
    console.error("Chat API error:", err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Something went wrong",
      },
      { status: 500 }
    )
  }
}
