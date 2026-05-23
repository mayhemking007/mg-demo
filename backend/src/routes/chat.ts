import { Router } from "express";
import { checkRateLimit } from "../rateLimiter.js";
import { getOrCreateAgent } from "../sessionStore.js";

const router = Router();
const DAILY_LIMIT = parseInt(process.env.DAILY_MESSAGE_LIMIT ?? "10", 10);

router.post("/", async (req, res) => {
  const { message, sessionId, browserId } = req.body as {
    message: string;
    sessionId: string;
    browserId: string;
  };

  if (!message || !sessionId || !browserId) {
    res
      .status(400)
      .json({ error: "message, sessionId, and browserId are required" });
    return;
  }

  const rateCheck = checkRateLimit(browserId, DAILY_LIMIT);

  if (!rateCheck.allowed) {
    res.status(429).json({
      error: "Daily message limit reached",
      remaining: 0,
      resetAt: rateCheck.resetAt,
    });
    return;
  }

  try {
    const agent = await getOrCreateAgent(sessionId);
    const response = await agent.invoke(message);
    const snapshot = await agent.getGraphSnapshot();

    res.json({
      response,
      snapshot,
      remaining: rateCheck.remaining,
      resetAt: rateCheck.resetAt,
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
