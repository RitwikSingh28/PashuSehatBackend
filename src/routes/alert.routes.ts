import { Router } from "express";
import { authenticate } from "#middleware/auth.js";
import alertController from "#controllers/alert.controller.js";

const router = Router();

// Protect all alert routes with authentication
router.use(authenticate);

// Alert management routes
router.get("/", alertController.getUserAlerts.bind(alertController));
router.get("/cattle/:cattleId", alertController.getCattleAlerts.bind(alertController));
router.put("/:alertId/acknowledge", alertController.acknowledgeAlert.bind(alertController));

export default router;
