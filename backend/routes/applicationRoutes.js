import express from "express";
import Application from "../models/Application.js";
import User from "../models/User.js";
import { authMiddleware } from "./authRoutes.js";

const router = express.Router();

// Get application status
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const application = await Application.findOne({ userId: req.userId });
    
    if (!application) {
      return res.json({
        exists: false,
        currentStep: 1,
        step1Completed: false,
        step2Completed: false,
        step3Completed: false,
        step4Completed: false,
      });
    }

    res.json({
      exists: true,
      currentStep: application.currentStep,
      step1Completed: application.step1Completed,
      step2Completed: application.step2Completed,
      step3Completed: application.step3Completed,
      step4Completed: application.step4Completed,
      isDraft: application.isDraft,
      lastSavedAt: application.lastSavedAt,
    });
  } catch (error) {
    console.error("Error fetching application status:", error);
    res.status(500).json({ message: "Error fetching application status" });
  }
});

// Get application data
router.get("/", authMiddleware, async (req, res) => {
  try {
    const application = await Application.findOne({ userId: req.userId });
    
    if (!application) {
      return res.json(null);
    }

    res.json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    res.status(500).json({ message: "Error fetching application" });
  }
});

// Save draft (partial save without validation)
router.put("/save", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Merge form data with user email (always use user email from auth)
    const applicationData = {
      userId: req.userId,
      email: user.email, // Always pre-fill from auth
      ...req.body,
      email: user.email, // Ensure email is always from auth, not from form
      isDraft: true,
      lastSavedAt: new Date(),
    };

    // Remove step completion flags for draft saves
    delete applicationData.step1Completed;
    delete applicationData.step2Completed;
    delete applicationData.step3Completed;
    delete applicationData.step4Completed;

    const application = await Application.findOneAndUpdate(
      { userId: req.userId },
      applicationData,
      { new: true, upsert: true, runValidators: false } // No strict validation for drafts
    );

    res.json({
      message: "Draft saved successfully",
      application,
    });
  } catch (error) {
    console.error("Error saving draft:", error);
    res.status(500).json({ message: "Error saving draft", error: error.message });
  }
});

// Submit application (full validation required)
router.put("/submit", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      firstName,
      lastName,
      sex,
      dateOfBirth,
      countryOfCitizenship,
      countryOfResidency,
      primaryPhoneType,
      phoneNumber,
      institutionName,
      mainAcademicMajor,
      englishLevel,
      paymentSource,
      plagiarismCheckConfirmed,
      signature,
    } = req.body;

    // Validate required fields
    const requiredFields = {
      firstName: "First name is required",
      lastName: "Last name is required",
      sex: "Sex is required",
      dateOfBirth: "Date of birth is required",
      countryOfCitizenship: "Country of citizenship is required",
      countryOfResidency: "Country of residency is required",
      primaryPhoneType: "Primary phone type is required",
      phoneNumber: "Phone number is required",
      institutionName: "Institution name is required",
      mainAcademicMajor: "Main academic major is required",
      englishLevel: "English level is required",
      paymentSource: "Payment source is required",
      plagiarismCheckConfirmed: "Plagiarism check confirmation is required",
      signature: "Signature is required",
    };

    const missingFields = [];
    for (const [field, message] of Object.entries(requiredFields)) {
      if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === '')) {
        missingFields.push(message);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: missingFields,
      });
    }

    // Validate signature
    if (!signature || signature.trim().length < 3) {
      return res.status(400).json({
        message: "Signature must be at least 3 characters",
      });
    }

    // Validate plagiarism check
    if (!plagiarismCheckConfirmed) {
      return res.status(400).json({
        message: "Plagiarism check confirmation is required",
      });
    }

    // Merge form data with user email (always use user email from auth)
    const applicationData = {
      userId: req.userId,
      email: user.email, // Always pre-fill from auth
      ...req.body,
      email: user.email, // Ensure email is always from auth, not from form
      step1Completed: true,
      currentStep: 2, // Move to next step
      isDraft: false,
      lastSavedAt: new Date(),
    };

    const application = await Application.findOneAndUpdate(
      { userId: req.userId },
      applicationData,
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      message: "Application submitted successfully",
      application,
      nextStep: 2,
    });
  } catch (error) {
    console.error("Error submitting application:", error);
    res.status(500).json({ 
      message: "Error submitting application", 
      error: error.message 
    });
  }
});

export default router;

