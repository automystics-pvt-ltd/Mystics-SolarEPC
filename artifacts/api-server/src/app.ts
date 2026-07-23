import express, { type Express } from "express";
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// SLA escalation: run every 15 minutes
const SLA_INTERVAL_MS = 15 * 60 * 1000;
setTimeout(() => {
  slaEscalationJob();
  setInterval(slaEscalationJob, SLA_INTERVAL_MS);
}, 30_000); // 30s delay after startup so DB connections are ready

export default app;
