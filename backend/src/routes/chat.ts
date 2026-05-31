import { Router } from "express";
import { checkRateLimit } from "../rateLimiter.js";
import { sendChatMessage } from "../memoGrafter/memoGrafterService.js";

const router = Router();
const DAILY_LIMIT = parseInt(process.env.DAILY_MESSAGE_LIMIT ?? "10", 10);
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === "true";

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

  const rateCheck = RATE_LIMIT_ENABLED
    ? checkRateLimit(browserId, DAILY_LIMIT)
    : {
        allowed: true,
        remaining: DAILY_LIMIT,
        resetAt: new Date().toISOString(),
      };

  if (!rateCheck.allowed) {
    res.status(429).json({
      error: "Daily message limit reached",
      remaining: 0,
      resetAt: rateCheck.resetAt,
    });
    return;
  }

  try {
    const { response, snapshot } = await sendChatMessage(sessionId, message);

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
