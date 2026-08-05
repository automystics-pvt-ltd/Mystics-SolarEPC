import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { slaEscalationJob } from "./jobs/slaEscalation";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

// 404 handler — must come after all routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler — catches any unhandled async errors thrown in routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
  logger.error({ err }, "Unhandled route error");
  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
});

// SLA escalation: run every 15 minutes
const SLA_INTERVAL_MS = 15 * 60 * 1000;
setTimeout(() => {
  Promise.resolve(slaEscalationJob()).catch((err: unknown) =>
    logger.error({ err }, "SLA escalation job failed on first run"),
  );
  setInterval(() => {
    Promise.resolve(slaEscalationJob()).catch((err: unknown) =>
      logger.error({ err }, "SLA escalation job failed"),
    );
  }, SLA_INTERVAL_MS);
}, 30_000); // 30s delay after startup so DB connections are ready

export default app;
