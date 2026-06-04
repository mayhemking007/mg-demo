import { Router } from "express";
import { ingestPlainText } from "../memoGrafter/memoGrafterService.js";

const router = Router();

router.post("/", async (req, res) => {
  const { sessionId, text, options } = req.body as {
    sessionId?: string;
    text?: string;
    options?: {
      replace?: boolean;
      label?: string;
      source?: string;
    };
  };

  if (!sessionId || !text) {
    res.status(400).json({ error: "sessionId and text are required" });
    return;
  }

  try {
    const snapshot = await ingestPlainText(sessionId, text, options);
    res.json({ snapshot });
  } catch (err) {
    console.error("Text ingest error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
