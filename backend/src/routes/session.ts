import { Router } from "express";
import { clearSession } from "../memoGrafter/memoGrafterService.js";

const router = Router();

router.delete("/", async (req, res) => {
  const { sessionId } = req.query as { sessionId: string };

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  try {
    await clearSession(sessionId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Clear session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
