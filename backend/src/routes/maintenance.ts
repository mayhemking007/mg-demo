import { Router } from "express";
import { runMaintenance } from "../memoGrafter/memoGrafterService.js";

const router = Router();

router.post("/", async (req, res) => {
  const { sessionId } = req.body as { sessionId: string };

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  try {
    const result = await runMaintenance(sessionId);
    res.json(result);
  } catch (err) {
    console.error("Maintenance error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
