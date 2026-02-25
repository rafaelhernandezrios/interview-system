import express from "express";
import Application from "../models/Application.js";
import User from "../models/User.js";
import { authMiddleware } from "./authRoutes.js";
import { streamAcceptanceLetterPdf } from "../utils/acceptanceLetterPdf.js";
import { streamInvoicePdf } from "../utils/invoicePdf.js";

const router = express.Router();

// Get application status
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const application = await Application.findOne({ userId: req.userId });
    const user = await User.findById(req.userId).select("interviewCompleted cvAnalyzed");
    const effectiveStep2Completed = !!(application?.step2Completed || user?.interviewCompleted);
    const effectiveCurrentStep = Math.max(application?.currentStep || 1, effectiveStep2Completed ? 3 : 1);
    
    if (!application) {
      return res.json({
        exists: false,
        currentStep: effectiveCurrentStep,
        step1Completed: false,
        step2Completed: effectiveStep2Completed,
        step3Completed: false,
        step4Completed: false,
        acceptanceLetterGeneratedAt: null,
        invoiceDateRange: null,
        invoiceStatus: null,
        scholarshipPercentage: null,
        invoiceApprovedAt: null,
      });
    }

    res.json({
      exists: true,
      currentStep: effectiveCurrentStep,
      step1Completed: application.step1Completed,
      step2Completed: effectiveStep2Completed,
      step3Completed: application.step3Completed,
      step4Completed: application.step4Completed,
      acceptanceLetterGeneratedAt: application.acceptanceLetterGeneratedAt || null,
      isDraft: application.isDraft,
      lastSavedAt: application.lastSavedAt,
      scheduledMeeting: application.scheduledMeeting || null,
      invoiceDateRange: application.invoiceDateRange || null,
      invoiceStatus: application.invoiceStatus || null,
      scholarshipPercentage: application.scholarshipPercentage ?? null,
      invoiceApprovedAt: application.invoiceApprovedAt || null,
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

// Download acceptance letter (user) - available when admin has generated it (no screening/application steps required).
router.get("/acceptance-letter", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const application = await Application.findOne({ userId: req.userId });
    if (!application) {
      return res.status(403).json({
        message: "Acceptance letter is not available yet. The admin has not generated your letter.",
      });
    }
    if (!application.acceptanceLetterGeneratedAt) {
      return res.status(403).json({
        message: "Acceptance letter is not available yet. The admin has not generated your letter.",
      });
    }

    // Mark step 4 as completed when user downloads the letter (so dashboard shows green indicator)
    await Application.findOneAndUpdate(
      { userId: req.userId },
      { step4Completed: true, currentStep: 4 }
    );

    // Use the program type stored in the application (default to MIRI for backward compatibility)
    const programType = application.acceptanceLetterProgramType || 'MIRI';
    streamAcceptanceLetterPdf(res, user, application, programType);
  } catch (error) {
    console.error("Error downloading acceptance letter:", error);
    res.status(500).json({ message: "Error downloading acceptance letter" });
  }
});

// MIRI only: submit date range for invoice (available after acceptance letter downloaded)
router.post("/confirm-dates", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("program");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.program !== "MIRI") {
      return res.status(403).json({ message: "Confirm dates is only available for MIRI program." });
    }

    const application = await Application.findOne({ userId: req.userId });
    if (!application || !application.step4Completed) {
      return res.status(403).json({
        message: "Please download your acceptance letter first to confirm your dates.",
      });
    }
    if (application.invoiceStatus === "approved") {
      return res.status(400).json({
        message: "Your dates are already approved. Contact support if you need to change them.",
      });
    }

    const { dateRangeStart, dateRangeEnd } = req.body;
    if (!dateRangeStart || !dateRangeEnd) {
      return res.status(400).json({ message: "Start and end dates are required." });
    }
    const start = new Date(dateRangeStart);
    const end = new Date(dateRangeEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }
    if (end <= start) {
      return res.status(400).json({ message: "End date must be after start date." });
    }

    const updated = await Application.findOneAndUpdate(
      { userId: req.userId },
      {
        invoiceDateRange: { startDate: start, endDate: end },
        invoiceStatus: "pending",
        scholarshipPercentage: null,
        invoiceApprovedAt: null,
      },
      { new: true }
    );
    res.json({
      message: "Dates submitted. An admin will verify and approve them.",
      invoiceDateRange: updated.invoiceDateRange,
      invoiceStatus: updated.invoiceStatus,
    });
  } catch (error) {
    console.error("Error confirming dates:", error);
    res.status(500).json({ message: "Error submitting dates" });
  }
});

// MIRI: download invoice PDF (only when admin has approved)
router.get("/invoice", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.program !== "MIRI") {
      return res.status(403).json({ message: "Invoice is only available for MIRI program." });
    }

    const application = await Application.findOne({ userId: req.userId });
    if (!application) {
      return res.status(403).json({ message: "Invoice is not available." });
    }
    if (application.invoiceStatus !== "approved") {
      return res.status(403).json({
        message: application.invoiceStatus === "pending"
          ? "Your dates are pending admin approval. You will be able to download the invoice after approval."
          : "Invoice is not available.",
      });
    }
    if (!application.invoiceDateRange?.startDate || !application.invoiceDateRange?.endDate) {
      return res.status(403).json({ message: "Invoice data is incomplete." });
    }

    streamInvoicePdf(res, user, application);
  } catch (error) {
    console.error("Error downloading invoice:", error);
    res.status(500).json({ message: "Error downloading invoice" });
  }
});

// Schedule screening interview
router.post("/schedule-screening", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const application = await Application.findOne({ userId: req.userId });
    if (!application || !application.step1Completed) {
      return res.status(400).json({ 
        message: "Please complete Step 1 (Application Form) first" 
      });
    }

    // In production, require step 2 to be completed
    if (process.env.NODE_ENV === 'production' && !application.step2Completed) {
      return res.status(400).json({ 
        message: "Please complete Step 2 (AI Interview) first" 
      });
    }

    const { dateTime, timezone, additionalNotes } = req.body;

    if (!dateTime) {
      return res.status(400).json({ message: "Date and time are required" });
    }

    const meetingDateTime = new Date(dateTime);
    if (meetingDateTime < new Date()) {
      return res.status(400).json({ message: "Please select a future date and time" });
    }

    // Create Zoom meeting
    let zoomMeeting = null;
    try {
      zoomMeeting = await createZoomMeeting({
        topic: `Screening Interview - ${user.name}`,
        startTime: meetingDateTime.toISOString(),
        duration: 30, // 30 minutes
        timezone: timezone || 'UTC',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: false,
          waiting_room: true,
        }
      });
    } catch (zoomError) {
      console.error('Error creating Zoom meeting:', zoomError);
      // Continue even if Zoom fails, we can still create Google Calendar event
    }

    // Create Google Calendar event
    let googleCalendarEvent = null;
    let calendarError = null;
    try {
      googleCalendarEvent = await createGoogleCalendarEvent({
        summary: `Screening Interview - ${user.name}`,
        description: `Screening interview for ${user.name}${additionalNotes ? `\n\nAdditional Notes: ${additionalNotes}` : ''}`,
        start: meetingDateTime,
        end: new Date(meetingDateTime.getTime() + 30 * 60000), // 30 minutes later
        timezone: timezone || 'UTC',
        attendees: [user.email],
        location: zoomMeeting ? (zoomMeeting.join_url || 'Online') : 'Online',
      });
    } catch (calError) {
      calendarError = calError.message || calError.toString();
      console.error('Error creating Google Calendar event:', calendarError);
      // Continue even if Google Calendar fails - Zoom meeting is the priority
    }

    // Update application with scheduled meeting
    const scheduledMeeting = {
      dateTime: meetingDateTime,
      timezone: timezone || 'UTC',
      additionalNotes: additionalNotes || '',
      zoomMeeting: zoomMeeting ? {
        meetingId: zoomMeeting.id.toString(),
        joinUrl: zoomMeeting.join_url,
        password: zoomMeeting.password || '',
        startUrl: zoomMeeting.start_url || '',
      } : null,
      googleCalendarEvent: googleCalendarEvent ? {
        eventId: googleCalendarEvent.id,
        htmlLink: googleCalendarEvent.htmlLink,
        iCalUID: googleCalendarEvent.iCalUID,
      } : null,
    };

    application.scheduledMeeting = scheduledMeeting;
    application.step3Completed = true;
    application.currentStep = 4; // Move to next step
    await application.save();

    // Include warning if Google Calendar failed but Zoom succeeded
    const responseMessage = calendarError 
      ? `Screening interview scheduled successfully. Zoom meeting created. Note: Google Calendar event could not be created (${calendarError}).`
      : "Screening interview scheduled successfully";

    res.json({
      message: responseMessage,
      meeting: scheduledMeeting,
      warnings: calendarError ? [calendarError] : undefined,
    });
  } catch (error) {
    console.error("Error scheduling screening:", error);
    res.status(500).json({ 
      message: "Error scheduling screening interview", 
      error: error.message 
    });
  }
});

// Helper function to create Zoom meeting
async function createZoomMeeting(options) {
  const { ZOOM_API_KEY, ZOOM_API_SECRET, ZOOM_ACCOUNT_ID } = process.env;

  if (!ZOOM_API_KEY || !ZOOM_API_SECRET || !ZOOM_ACCOUNT_ID) {
    throw new Error('Zoom API credentials not configured');
  }

  // For Server-to-Server OAuth, you need to generate an access token
  // This is a simplified version - in production, you should implement proper OAuth flow
  const axios = (await import('axios')).default;
  
  // Generate access token using Server-to-Server OAuth
  const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`;
  const tokenResponse = await axios.post(
    tokenUrl,
    {},
    {
      auth: {
        username: ZOOM_API_KEY,
        password: ZOOM_API_SECRET,
      },
    }
  );

  const accessToken = tokenResponse.data.access_token;

  // Create meeting
  const meetingResponse = await axios.post(
    'https://api.zoom.us/v2/users/me/meetings',
    {
      topic: options.topic,
      type: 2, // Scheduled meeting
      start_time: options.startTime,
      duration: options.duration,
      timezone: options.timezone,
      settings: options.settings,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return meetingResponse.data;
}

// Helper function to create Google Calendar event
async function createGoogleCalendarEvent(options) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google Calendar API credentials not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in your .env file');
  }

  try {
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for installed apps
    );

    oauth2Client.setCredentials({
      refresh_token: GOOGLE_REFRESH_TOKEN,
    });

    // Try to refresh the access token first to validate credentials
    try {
      const tokenResponse = await oauth2Client.getAccessToken();
      if (!tokenResponse.token) {
        throw new Error('Failed to obtain access token');
      }
    } catch (tokenError) {
      console.error('Error refreshing Google OAuth token:', {
        message: tokenError.message,
        code: tokenError.code,
        response: tokenError.response?.data
      });
      
      // Provide helpful error message based on error type
      let errorMsg = 'Google Calendar authentication failed. ';
      if (tokenError.response?.data?.error === 'unauthorized_client') {
        errorMsg += 'Invalid Client ID or Client Secret. Please verify your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.';
      } else if (tokenError.response?.data?.error === 'invalid_grant') {
        errorMsg += 'Invalid or expired Refresh Token. Please generate a new GOOGLE_REFRESH_TOKEN using OAuth 2.0 Playground.';
      } else {
        errorMsg += `Error: ${tokenError.message}. Please verify your GOOGLE_REFRESH_TOKEN is valid and has the correct scopes (https://www.googleapis.com/auth/calendar). See GOOGLE_CALENDAR_SETUP.md for instructions.`;
      }
      throw new Error(errorMsg);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: options.summary,
      description: options.description,
      start: {
        dateTime: options.start.toISOString(),
        timeZone: options.timezone,
      },
      end: {
        dateTime: options.end.toISOString(),
        timeZone: options.timezone,
      },
      attendees: options.attendees.map(email => ({ email })),
      location: options.location,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 15 }, // 15 minutes before
        ],
      },
    };

    const calendarId = GOOGLE_CALENDAR_ID || 'primary';
    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: event,
      sendUpdates: 'all', // Send email notifications to attendees
    });

    return response.data;
  } catch (error) {
    // Provide more detailed error information
    if (error.response) {
      const errorDetails = error.response.data || {};
      console.error('Google Calendar API Error:', {
        status: error.response.status,
        error: errorDetails.error || error.message,
        description: errorDetails.error_description || errorDetails.message
      });
      throw new Error(`Google Calendar API error (${error.response.status}): ${errorDetails.error_description || errorDetails.error || error.message}`);
    }
    throw error;
  }
}

export default router;

