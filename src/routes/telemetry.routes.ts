import { Router } from "express";
import { authenticate } from "#middleware/auth.js";
import telemetryController from "#controllers/telemetry.controller.js";

const router = Router();

// Protect all telemetry routes with authentication
router.use(authenticate);

// Telemetry routes
router.get("/cattle", telemetryController.getAllCattleTelemetry.bind(telemetryController));
router.get("/cattle/:cattleId", telemetryController.getRecentTelemetry.bind(telemetryController));
router.get("/cattle/:cattleId/stats", telemetryController.getTelemetryStats.bind(telemetryController));

export default router;
