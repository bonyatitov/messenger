import "express-async-errors";
import express from "express";
import cors from "cors";
import { env } from "./env.js";
import authRouter from "./routes/auth.js";
import { chatsRouter, familyRouter, usersRouter } from "./routes/chats.js";
import { pushRouter } from "./routes/push.js";

const app = express();

app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json({ limit: "15mb" }));
app.use("/uploads", express.static(env.uploadDir));

app.use("/api/auth", authRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/family", familyRouter);
app.use("/api/users", usersRouter);
app.use("/api/push", pushRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});
