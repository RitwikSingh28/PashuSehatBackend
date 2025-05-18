import { Router } from "express";
import { authenticate } from "#middleware/auth.js";
import cattleController from "#controllers/cattle.controller.js";

const router = Router();

// Protect all cattle routes with authentication
router.use(authenticate);

// Cattle management routes
router.post("/", cattleController.createCattle.bind(cattleController));
router.get("/", cattleController.listCattle.bind(cattleController));
router.get("/:cattleId", cattleController.getCattle.bind(cattleController));
router.put("/:cattleId", cattleController.updateCattle.bind(cattleController));
router.post("/:cattleId/notes", cattleController.addNote.bind(cattleController));
router.delete("/:cattleId", cattleController.deleteCattle.bind(cattleController));

export default router;
