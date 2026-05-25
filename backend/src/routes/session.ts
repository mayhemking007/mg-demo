import { Router } from "express";
import { clearPersistedSession } from "../sessionStore.js";

const router = Router();

router.delete("/", async (req, res) => {
  const { sessionId } = req.query as { sessionId: string };

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  try {
    await clearPersistedSession(sessionId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Clear session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
