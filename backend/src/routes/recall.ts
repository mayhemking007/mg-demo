import { Router } from "express";
import { getOrCreateAgent } from "../sessionStore.js";

const router = Router();

router.get("/", async (req, res) => {
  const { q, sessionId } = req.query as { q: string; sessionId: string };

  if (!q || !sessionId) {
    res.status(400).json({ error: "q and sessionId are required" });
    return;
  }

  try {
    const agent = await getOrCreateAgent(sessionId);
    const result = await agent.recall(q, {
      limit: 8,
      minSimilarity: 0.4,
    });

    res.json(result);
  } catch (err) {
    console.error("Recall error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
