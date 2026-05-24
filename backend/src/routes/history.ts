import { Router } from "express";
import { getSessionHistory } from "../sessionStore.js";

const router = Router();

router.get("/", async (req, res) => {
  const { sessionId } = req.query as { sessionId: string };

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  try {
    const messages = await getSessionHistory(sessionId);
    res.json({ messages });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
