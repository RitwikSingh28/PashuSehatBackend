import { Router } from "express";
import { authenticate } from "#middleware/auth.js";
import { isAdmin } from "#middleware/admin.middleware.js";
import adminController from "#controllers/admin.controller.js";
import type { RequestHandler } from "express";

const router = Router();

// Protect all admin routes with authentication and admin check
router.use(authenticate);
router.use(isAdmin);

// Debug endpoint
router.get("/debug", (req, res) => {
  res.json({
    user: req.user,
    message: "If you see this, you are an admin!",
  });
});

// Tag management routes
const registerTagsHandler: RequestHandler = async (req, res, next) => {
  await adminController.registerTags(req, res, next);
};

const listTagsHandler: RequestHandler = async (req, res, next) => {
  await adminController.listTags(req, res, next);
};

router.post("/tags", registerTagsHandler);
router.get("/tags", listTagsHandler);

export default router;
