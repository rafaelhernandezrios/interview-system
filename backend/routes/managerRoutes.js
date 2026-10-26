import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Application from "../models/Application.js";
import { authMiddleware } from "./authRoutes.js";
import { managerMiddleware } from "../middleware/managerMiddleware.js";
import { sendManagerInterviewReportToAdmins } from "../config/email.js";

const router = express.Router();
router.use(authMiddleware);
router.use(managerMiddleware);

const MAX_COMMENTS_LENGTH = 3000;

// Student list for managers: only the basics they need to report interviews
router.get("/students", async (req, res) => {
  try {
    const students = await User.find({ role: "user" })
      .select("name email program createdAt managerReview")
      .sort({ createdAt: -1 })
      .lean();

    const letters = await Application.find({
      userId: { $in: students.map((s) => s._id) },
      acceptanceLetterGeneratedAt: { $ne: null },
    })
      .select("userId acceptanceLetterGeneratedAt")
      .lean();
    const letterByUser = new Map(letters.map((a) => [String(a.userId), a.acceptanceLetterGeneratedAt]));

    res.json({
      students: students.map((s) => ({
        _id: s._id,
        name: s.name,
        email: s.email,
        program: s.program || null,
        registeredAt: s.createdAt,
        managerReview: s.managerReview?.reportedAt ? s.managerReview : null,
        decisionLetterSentAt: letterByUser.get(String(s._id)) || null,
      })),
    });
  } catch (error) {
    console.error("Error listing students for manager:", error);
    res.status(500).json({ message: "Error loading students" });
  }
});

// Save the manager's report: interviewed yes/no and comments.
// Admins get an email when a student is newly reported as interviewed.
router.put("/students/:userId/review", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid student" });
    }

    const { interviewed } = req.body || {};
    if (typeof interviewed !== "boolean") {
      return res.status(400).json({ message: "Please select whether you interviewed this student." });
    }
    const comments = typeof req.body.comments === "string" ? req.body.comments.trim() : "";
    if (comments.length > MAX_COMMENTS_LENGTH) {
      return res.status(400).json({ message: `Comments are too long (max ${MAX_COMMENTS_LENGTH} characters).` });
    }

    const student = await User.findOne({ _id: userId, role: "user" });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const wasInterviewed = student.managerReview?.interviewed === true;
    const now = new Date();
    student.managerReview = {
      interviewed,
      comments: comments || null,
      reportedById: req.currentUser._id,
      reportedByName: req.currentUser.name,
      reportedAt: student.managerReview?.reportedAt || now,
      updatedAt: now,
    };
    student.markModified("managerReview");
    await student.save();

    let adminsNotified = false;
    if (interviewed && !wasInterviewed) {
      const admins = await User.find({ role: "admin" }).select("email").lean();
      const results = await Promise.all(
        admins
          .filter((a) => a.email)
          .map((a) =>
            sendManagerInterviewReportToAdmins(a.email, {
              studentName: student.name,
              studentEmail: student.email,
              program: student.program,
              managerName: req.currentUser.name,
              comments,
            })
          )
      );
      adminsNotified = results.some((r) => r?.success);
      if (!adminsNotified && results.length) {
        console.error("Manager interview report: no admin email could be sent", results);
      }
    }

    res.json({
      message: "Report saved.",
      managerReview: student.managerReview,
      adminsNotified,
    });
  } catch (error) {
    console.error("Error saving manager review:", error);
    res.status(500).json({ message: "Error saving the report" });
  }
});

export default router;
