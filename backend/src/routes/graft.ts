import { Router } from "express";
import {
  getPersistedSnapshot,
  graftTopicsWithMemories,
} from "../sessionStore.js";

const router = Router();

router.post("/", async (req, res) => {
  const { sourceSessionId, targetSessionId, topicIds } = req.body as {
    sourceSessionId: string;
    targetSessionId: string;
    topicIds: string[];
  };

  if (!sourceSessionId || !targetSessionId || !Array.isArray(topicIds)) {
    res.status(400).json({
      error: "sourceSessionId, targetSessionId, and topicIds are required",
    });
    return;
  }

  if (sourceSessionId === targetSessionId) {
    res.status(400).json({ error: "source and target sessions must differ" });
    return;
  }

  if (topicIds.length === 0) {
    res.status(400).json({ error: "at least one topic id is required" });
    return;
  }

  try {
    const graftedNodes = await graftTopicsWithMemories(
      sourceSessionId,
      targetSessionId,
      topicIds,
    );
    const snapshot = await getPersistedSnapshot(targetSessionId);

    res.json({ graftedNodes, snapshot });
  } catch (err) {
    console.error("Graft error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
