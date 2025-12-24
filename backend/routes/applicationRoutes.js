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
      scheduledMeeting: application.scheduledMeeting || null,
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

