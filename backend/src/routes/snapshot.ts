import { Router } from "express";
import { getOrCreateAgent } from "../sessionStore.js";

const router = Router();

router.get("/", async (req, res) => {
  const { sessionId } = req.query as { sessionId: string };

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  try {
    const agent = await getOrCreateAgent(sessionId);
    const snapshot = await agent.getGraphSnapshot();
    res.json(snapshot);
  } catch (err) {
    console.error("Snapshot error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
