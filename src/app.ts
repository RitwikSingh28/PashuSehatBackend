import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import authRoutes from "#routes/auth/index.js";
import adminRoutes from "#routes/admin.routes.js";
import cattleRoutes from "#routes/cattle.routes.js";
import telemetryRoutes from "#routes/telemetry.routes.js";
import alertRoutes from "#routes/alert.routes.js";
import { errorHandler } from "#middleware/error-handler.js";

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cattle", cattleRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/alerts", alertRoutes);

// Error handling
app.use(errorHandler);

export default app;
