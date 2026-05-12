import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"
import { fetchVisualization } from "@/lib/groq"
import { MOCK_DATA } from "@/lib/mockData"

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
        { error: "Question is required." },
        { status: 400 }
      )
    }

    const data = await fetchVisualization(question.trim())

    return NextResponse.json({
      data,
      mock: false,
      remaining,
    })
  } catch (err: unknown) {
    console.error("Visualize API error:", err)

    return NextResponse.json({
      data: MOCK_DATA,
      mock: true,
      warning: err instanceof Error ? err.message : "API call failed.",
    })
  }
}
