const express = require("express");
const router  = express.Router();
const placementController = require("../controllers/placement.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const checkRole = require("../middlewares/checkRole");

// ── Public ────────────────────────────────────────────────
router.get("/",      placementController.getPlacements);

// ── Admin ─────────────────────────────────────────────────
router.get("/admin", verifyToken, checkRole("admin"), placementController.getPlacementsAdmin);
router.post("/",     verifyToken, checkRole("admin"), placementController.createPlacement);
router.put("/reorder", verifyToken, checkRole("admin"), placementController.reorderPlacements);
router.put("/:id",   verifyToken, checkRole("admin"), placementController.updatePlacement);
router.post("/:id/reset-stock", verifyToken, checkRole("admin"), placementController.resetStock);
router.delete("/bulk", verifyToken, checkRole("admin"), placementController.deleteBulk);
router.delete("/:id",  verifyToken, checkRole("admin"), placementController.deletePlacement);

module.exports = router;