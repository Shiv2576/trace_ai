import { Hono } from "hono"
import { handle } from "hono/vercel"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"
import { getAuth } from "@clerk/nextjs/server"

import { fetchVisualization } from "@/lib/groq"
import { MOCK_DATA } from "@/lib/mockData"

const app = new Hono()

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(1, "1 h"),
})

app.post("/api/visualize", async (c) => {
  try {
    const { userId } = getAuth(c.req.raw)

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const { success, remaining } = await ratelimit.limit(userId)

    if (!success) {
      return c.json({ error: "Rate limit exceeded (10 req/hour)" }, 429)
    }

    const { question } = await c.req.json()

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length < 3
    ) {
      return c.json({ error: "Question is required." }, 400)
    }

    const data = await fetchVisualization(question.trim())

    return c.json({
      data,
      mock: false,
      remaining,
    })
  } catch (err: unknown) {
    console.error("Visualize API error:", err)

    return c.json({
      data: MOCK_DATA,
      mock: true,
      warning: err instanceof Error ? err.message : "API call failed.",
    })
  }
})

export const POST = handle(app)
