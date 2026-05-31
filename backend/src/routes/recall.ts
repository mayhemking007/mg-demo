import { Router } from "express";
import { recallMemories } from "../memoGrafter/memoGrafterService.js";

const router = Router();

router.get("/", async (req, res) => {
  const { q, sessionId } = req.query as { q: string; sessionId: string };

  if (!q || !sessionId) {
    res.status(400).json({ error: "q and sessionId are required" });
    return;
  }

  try {
    const result = await recallMemories(sessionId, q);

    res.json(result);
  } catch (err) {
    console.error("Recall error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
