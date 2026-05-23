import "dotenv/config";
import cors from "cors";
import express from "express";
import chatRouter from "./routes/chat.js";
import recallRouter from "./routes/recall.js";
import snapshotRouter from "./routes/snapshot.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/chat", chatRouter);
app.use("/recall", recallRouter);
app.use("/snapshot", snapshotRouter);

app.listen(PORT, () => {
  console.log(`Dev Memory Assistant backend running on port ${PORT}`);
});
