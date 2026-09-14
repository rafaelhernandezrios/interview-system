import express from "express";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import User from "../models/User.js";
import Application from "../models/Application.js";
import { authMiddleware } from "./authRoutes.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import { sendBulkEmailToActiveUsers, sendReportResponseNotification, sendAcceptanceLetterReadyNotification } from "../config/email.js";
import * as XLSX from "xlsx";
import archiver from "archiver";
import { streamAcceptanceLetterPdf, generateAcceptanceLetterPdfBuffer } from "../utils/acceptanceLetterPdf.js";
import { streamInvoicePdf } from "../utils/invoicePdf.js";
import { resolveStudentCode } from "../utils/studentCode.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const router = express.Router();

// Aplicar ambos middlewares a todas las rutas
router.use(authMiddleware);
router.use(adminMiddleware);

// Listar usuarios
router.get("/users", async (req, res) => {
  try {
    console.log('GET /admin/users - Iniciando consulta de usuarios');
    
    // Verificar conexión a la base de datos
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB no está conectado. Estado:', mongoose.connection.readyState);
      return res.status(500).json({ 
        message: "Error de conexión a la base de datos. Por favor, verifica la configuración de MongoDB." 
      });
    }

    const { page = 1, limit, search = "", role = "", isActive = "" } = req.query;
    
    const query = {};
    if (search) {
      // Escape special regex characters to prevent ReDoS
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } }
      ];
    }
    if (role) query.role = role;
    if (isActive !== "") query.isActive = isActive === "true";

    console.log('Query de búsqueda:', JSON.stringify(query));

    const total = await User.countDocuments(query);
    console.log(`Total de usuarios encontrados: ${total}`);

    // Only the fields the admin table renders. The full record (CV text, interview
    // answers, transcriptions, survey results, report threads) is many times larger
    // and is already fetched per user by GET /admin/users/:userId when a row is opened.
    // `reports.resolved` is enough for the unresolved-reports badge.
    const LIST_FIELDS =
      "name email profilePhoto role isActive program digitalId score interviewScore reports.resolved createdAt";

    // Si no se especifica límite, devolver todos los usuarios
    let users;
    if (limit) {
      users = await User.find(query)
        .select(LIST_FIELDS)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });
    } else {
      // Sin límite, devolver todos
      users = await User.find(query)
        .select(LIST_FIELDS)
        .sort({ createdAt: -1 });
    }

    console.log(`Usuarios obtenidos: ${users.length}`);

    // Add acceptance letter information: single query instead of N+1
    const userIds = users.map((u) => u._id);
    const applications = await Application.find({ userId: { $in: userIds } })
      .select(
        "userId acceptanceLetterGeneratedAt acceptanceLetterProgramType promotionalCode registrationCode " +
          "registrationFeeStatus registrationFeePaidAt paymentProofStatus paymentProofUploadedAt"
      )
      .lean();
    const appByUserId = new Map(applications.map((a) => [a.userId.toString(), a]));
    const usersWithAcceptanceLetter = users.map((user) => {
      const app = appByUserId.get(user._id.toString());
      const userObj = user.toObject();
      return {
        ...userObj,
        studentCode: resolveStudentCode(userObj, app),
        acceptanceLetterGeneratedAt: app?.acceptanceLetterGeneratedAt ?? null,
        acceptanceLetterProgramType: app?.acceptanceLetterProgramType ?? null,
        // Registration fee (Stripe) vs program payment (uploaded proof) — shown as separate indicators
        registrationFeeStatus: app?.registrationFeeStatus ?? null,
        registrationFeePaidAt: app?.registrationFeePaidAt ?? null,
        paymentProofStatus: app?.paymentProofStatus ?? null,
        paymentProofUploadedAt: app?.paymentProofUploadedAt ?? null,
      };
    });

    res.json({
      users: usersWithAcceptanceLetter,
      totalPages: limit ? Math.ceil(total / limit) : 1,
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error en GET /admin/users:', error);
    res.status(500).json({ 
      message: "Error interno del servidor",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Estadísticas generales
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const admins = await User.countDocuments({ role: "admin" });
    const cvAnalyzed = await User.countDocuments({ cvAnalyzed: true });
    const interviewCompleted = await User.countDocuments({ interviewCompleted: true });

    res.json({
      totalUsers,
      activeUsers,
      admins,
      cvAnalyzed,
      interviewCompleted
    });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Detalles de usuario
router.get("/users/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Fetch application data if it exists
    const application = await Application.findOne({ userId: req.params.userId });
    
    // Debug logging
    console.log('Admin fetching user details:', {
      userId: req.params.userId,
      applicationFound: !!application,
      step1Completed: application?.step1Completed,
      isDraft: application?.isDraft,
      currentStep: application?.currentStep
    });
    
    // Convert user to plain object and add application data
    const userObject = user.toObject();
    if (application) {
      userObject.application = application.toObject();
    } else {
      userObject.application = null;
    }

    res.json(userObject);
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Export users data to Excel/CSV
router.get("/export-users", async (req, res) => {
  try {
    const { format = 'xlsx' } = req.query; // 'xlsx' or 'csv'
    
    // Get all users with required fields
    const users = await User.find({})
      .select("name email score interviewScore")
      .sort({ name: 1 });
    
    // Prepare data for export
    const exportData = users.map(user => ({
      'Nombre': user.name || '',
      'Email': user.email || '',
      'Score CV': user.score !== undefined && user.score !== null ? user.score : 'N/A',
      'Score Interview': user.interviewScore !== undefined && user.interviewScore !== null ? user.interviewScore : 'N/A'
    }));
    
    if (format === 'csv') {
      // Generate CSV
      const headers = ['Nombre', 'Email', 'Score CV', 'Score Interview'];
      const csvRows = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ];
      
      const csv = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\ufeff' + csv); // Add BOM for Excel UTF-8 compatibility
    } else {
      // Generate Excel (XLSX)
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
      
      // Set column widths
      const columnWidths = [
        { wch: 30 }, // Nombre
        { wch: 35 }, // Email
        { wch: 12 }, // Score CV
        { wch: 15 }  // Score Interview
      ];
      worksheet['!cols'] = columnWidths;
      
      // Generate buffer
      const excelBuffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        cellStyles: true
      });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(excelBuffer);
    }
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).json({ message: "Error exporting users data" });
  }
});

// Resultados de encuestas de usuario
router.get("/users/:userId/survey-results", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({
      interview: {
        score: user.interviewScore,
        analysis: user.interviewAnalysis
      },
      cvScore: user.score
    });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Eliminar usuario
router.delete("/users/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await User.findByIdAndDelete(req.params.userId);
    res.json({ message: "Usuario eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Cambiar rol de usuario
router.patch("/users/:userId/role", async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Rol inválido" });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    user.role = role;
    await user.save();

    res.json({ message: "Rol actualizado exitosamente", user });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

const VALID_PROGRAMS = ['MIRI', 'EMFUTECH', 'JCTI', 'MIRAITEACH', 'FUTURE_INNOVATORS_JAPAN', 'OTHER'];

// Cambiar programa de usuario
router.patch("/users/:userId/program", async (req, res) => {
  try {
    const { program } = req.body;
    if (program !== undefined && program !== null && program !== '' && !VALID_PROGRAMS.includes(program)) {
      return res.status(400).json({ message: "Programa inválido" });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    user.program = program === '' ? undefined : program;
    await user.save();

    res.json({ message: "Programa actualizado exitosamente", user });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Activar/Desactivar usuario
router.patch("/users/:userId/toggle-status", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ 
      message: `Usuario ${user.isActive ? "activado" : "desactivado"} exitosamente`,
      user 
    });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Eliminar CV de usuario
router.delete("/users/:userId/cv", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Limpiar datos del CV
    user.cvPath = undefined;
    user.cvText = undefined;
    user.analysis = undefined;
    user.skills = [];
    user.questions = [];
    user.score = undefined;
    user.cvAnalyzed = false;
    
    // También limpiar datos de entrevista relacionados
    user.interviewResponses = [];
    user.interviewScore = undefined;
    user.interviewAnalysis = [];
    user.interviewRecommendations = undefined;
    user.interviewVideo = undefined;
    user.interviewVideoTranscription = undefined;
    user.interviewCompleted = false;

    await user.save();

    res.json({ message: "CV y datos relacionados eliminados exitosamente" });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Eliminar entrevista de usuario
router.delete("/users/:userId/interview", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Limpiar datos de entrevista
    user.interviewResponses = [];
    user.interviewScore = undefined;
    user.interviewAnalysis = [];
    user.interviewRecommendations = undefined;
    user.interviewVideo = undefined;
    user.interviewVideoTranscription = undefined;
    user.interviewCompleted = false;

    await user.save();

    res.json({ message: "Entrevista eliminada exitosamente" });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Eliminar/Resetear aplicación de usuario
router.delete("/users/:userId/application", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Eliminar la aplicación del usuario
    const deletedApplication = await Application.findOneAndDelete({ userId: req.params.userId });

    if (deletedApplication) {
      res.json({ 
        message: "Aplicación eliminada exitosamente. El usuario podrá completar el formulario nuevamente.",
        deleted: true
      });
    } else {
      res.json({ 
        message: "No se encontró una aplicación para este usuario.",
        deleted: false
      });
    }
  } catch (error) {
    console.error("Error deleting application:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Send bulk email to all active users
router.post("/send-bulk-email", async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }

    // Get all active users
    const activeUsers = await User.find({ isActive: true }).select("email name");
    
    if (activeUsers.length === 0) {
      return res.status(404).json({ message: "No active users found" });
    }

    const userEmails = activeUsers.map(user => user.email);

    // Create HTML version of the email
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #ffffff;">
        <table role="presentation" style="width: 600px; margin: 0 auto; border-collapse: collapse; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 30px; text-align: center; border-bottom: 3px solid #2563eb;">
              <h1 style="margin: 0; color: #1e40af; font-size: 24px; font-weight: bold;">
                Mirai Innovation Research Institute
              </h1>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">
                Evaluation and Selection System
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px; font-weight: 600;">
                ${subject}
              </h2>
              <div style="color: #475569; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">
                ${message.replace(/\n/g, '<br>')}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">
                <strong>Mirai Innovation Research Institute</strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                Edge Honmachi Bldg 3F<br>
                2-3-12 Minamihonmachi, Chuo-ku, Osaka, Japan 541-0054<br>
                <a href="mailto:contact@mirai-innovation-lab.com" style="color: #2563eb; text-decoration: none;">contact@mirai-innovation-lab.com</a>
              </p>
              <p style="margin: 15px 0 0 0; color: #cbd5e1; font-size: 11px;">
                This is an automated email, please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Create plain text version
    const textContent = `Mirai Innovation Research Institute - Evaluation and Selection System

${subject}

${message}

---
Mirai Innovation Research Institute
Edge Honmachi Bldg 3F
2-3-12 Minamihonmachi, Chuo-ku, Osaka, Japan 541-0054
contact@mirai-innovation-lab.com

This is an automated email, please do not reply to this message.`;

    // Send bulk email
    const result = await sendBulkEmailToActiveUsers(userEmails, subject, htmlContent, textContent);

    if (result.success) {
      res.json({
        message: `Email sent successfully to ${result.totalSent} users`,
        totalSent: result.totalSent,
        totalFailed: result.totalFailed,
        totalUsers: activeUsers.length
      });
    } else {
      res.status(500).json({
        message: "Error sending emails",
        error: result.error,
        totalSent: result.totalSent || 0,
        totalFailed: result.totalFailed || 0
      });
    }
  } catch (error) {
    console.error('Error in send-bulk-email:', error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Actualizar aplicación de usuario (Admin only)
router.patch("/users/:userId/application", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Find or create application
    let application = await Application.findOne({ userId: req.params.userId });
    
    if (!application) {
      // Create new application if it doesn't exist
      application = new Application({
        userId: req.params.userId,
        email: user.email
      });
    }

    // Update application with provided data
    Object.assign(application, req.body);
    await application.save();

    res.json({ 
      message: "Aplicación actualizada exitosamente",
      application
    });
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

// Admin respond to user report
router.post("/users/:userId/reports/:reportIndex/respond", async (req, res) => {
  try {
    const { userId, reportIndex } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: "Message is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.reports || !Array.isArray(user.reports) || user.reports.length === 0) {
      return res.status(404).json({ message: "User has no reports" });
    }

    const index = parseInt(reportIndex);
    if (isNaN(index) || index < 0 || index >= user.reports.length) {
      return res.status(400).json({ message: "Invalid report index" });
    }

    const report = user.reports[index];
    
    // Initialize messages array if it doesn't exist
    if (!report.messages) {
      report.messages = [];
    }

    // Get admin info
    const admin = await User.findById(req.userId);
    const adminName = admin ? admin.name : 'Admin';

    // Add admin response to messages
    report.messages.push({
      sender: 'admin',
      senderName: adminName,
      message: message.trim(),
      sentAt: new Date()
    });

    await user.save();

    // Send email notification to user
    try {
      console.log(`Attempting to send email notification to ${user.email} for report response`);
      const emailResult = await sendReportResponseNotification(
        user.email,
        user.name,
        report.subject || 'Your Report',
        message.trim(),
        adminName
      );
      
      if (emailResult.success) {
        console.log(`Email notification sent successfully to ${user.email}. Message ID: ${emailResult.messageId}`);
      } else {
        console.error(`Failed to send email notification to ${user.email}:`, emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      console.error('Error details:', {
        message: emailError.message,
        stack: emailError.stack,
        userEmail: user.email
      });
      // Don't fail the request if email fails
    }

    res.json({
      message: "Response sent successfully",
      report: report
    });
  } catch (error) {
    console.error('Error in respond to report:', error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Mark report as resolved
router.patch("/users/:userId/reports/:reportIndex/resolve", async (req, res) => {
  try {
    const { userId, reportIndex } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.reports || !Array.isArray(user.reports) || user.reports.length === 0) {
      return res.status(404).json({ message: "User has no reports" });
    }

    const index = parseInt(reportIndex);
    if (isNaN(index) || index < 0 || index >= user.reports.length) {
      return res.status(400).json({ message: "Invalid report index" });
    }

    const report = user.reports[index];
    
    // Get admin info
    const admin = await User.findById(req.userId);
    const adminName = admin ? admin.name : 'Admin';

    // Mark as resolved
    report.resolved = true;
    report.resolvedAt = new Date();
    report.resolvedBy = adminName;

    await user.save();

    res.json({
      message: "Report marked as resolved",
      report: report
    });
  } catch (error) {
    console.error('Error in resolve report:', error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ----- MIRI Invoice / Confirm dates -----
// Helpers for invoice stats (same logic as invoicePdf)
function getWeeksBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.ceil(diffDays / 7));
}
function getTuitionPerWeek(weeks) {
  return weeks >= 7 ? 300 : 350;
}
function computeInvoiceTotal(weeks, scholarshipPercentage = 0) {
  const tuitionPerWeek = getTuitionPerWeek(weeks);
  const before = weeks * tuitionPerWeek;
  const discount = before * ((scholarshipPercentage || 0) / 100);
  const subtotal = before - discount;
  const tax = Math.round(subtotal * 0.1 * 100) / 100;
  return Math.round((subtotal + tax) * 100) / 100;
}

// ----- Payment follow-up (admin notes on students who have not paid) -----
const FOLLOW_UP_STATUS_LABELS = {
  pending: "Pending decision",
  reschedule: "Reschedule dates",
  continuing: "Will continue",
  dropped_out: "Dropped out",
};
const FOLLOW_UP_CHECKLIST = [
  { key: "reminderEmailSent", label: "Payment reminder email sent" },
  { key: "studentReplied", label: "Student replied" },
  { key: "decisionCommunicated", label: "Decision communicated to student" },
];
const FOLLOW_UP_NOTE_MAX_LENGTH = 2000;

// Compact fields for the payment tables (button badge, tooltip and Excel export)
function summarizePaymentFollowUp(followUp) {
  const checklist = followUp?.checklist || {};
  const notes = followUp?.notes || [];
  return {
    followUpStatus: followUp?.status ?? null,
    followUpNotesCount: notes.length,
    followUpLatestNote: notes.length > 0 ? notes[notes.length - 1].text : null,
    followUpChecklistDone: FOLLOW_UP_CHECKLIST.filter(({ key }) => checklist[key]?.doneAt).length,
    followUpChecklistTotal: FOLLOW_UP_CHECKLIST.length,
  };
}

// Full follow-up for the notes modal, plus the summary so the table row can update in place
function paymentFollowUpResponse(application) {
  const plain = application?.toObject ? application.toObject() : application;
  const followUp = plain?.paymentFollowUp;
  const checklist = followUp?.checklist || {};
  return {
    followUp: {
      status: followUp?.status ?? null,
      statusUpdatedAt: followUp?.statusUpdatedAt ?? null,
      statusUpdatedBy: followUp?.statusUpdatedBy ?? null,
      checklist: FOLLOW_UP_CHECKLIST.map(({ key, label }) => ({
        key,
        label,
        done: !!checklist[key]?.doneAt,
        doneAt: checklist[key]?.doneAt ?? null,
        doneBy: checklist[key]?.doneBy ?? null,
      })),
      notes: [...(followUp?.notes || [])].reverse().map((note) => ({
        id: note._id,
        text: note.text,
        authorName: note.authorName ?? null,
        createdAt: note.createdAt,
      })),
    },
    summary: summarizePaymentFollowUp(followUp),
  };
}

// Shared: fetch invoice stats list + summary (for JSON and Excel export)
async function getInvoiceStatsData() {
  const applications = await Application.find({
    "invoiceDateRange.startDate": { $exists: true, $ne: null },
    "invoiceDateRange.endDate": { $exists: true, $ne: null },
  })
    .select(
      "userId invoiceDateRange invoiceStatus scholarshipPercentage paymentProofUrl " +
        "paymentProofStatus paymentProofUploadedAt promotionalCode registrationCode paymentFollowUp"
    )
    .populate("userId", "name email program digitalId")
    .sort({ "invoiceDateRange.startDate": 1 })
    .lean();

  const list = [];
  const revenueByMonth = {}; // { "YYYY-MM": total }
  const studentsByMonth = {}; // { "YYYY-MM": count }
  let totalApprovedRevenue = 0;
  let totalPendingRevenue = 0;

  for (const app of applications) {
    const user = app.userId;
    if (!user || user.program !== "MIRI") continue;

    const startDate = app.invoiceDateRange?.startDate;
    const endDate = app.invoiceDateRange?.endDate;
    if (!startDate || !endDate) continue;

    const start = new Date(startDate);
    const paymentDeadline = new Date(start);
    paymentDeadline.setMonth(paymentDeadline.getMonth() - 1);

    const weeks = getWeeksBetween(startDate, endDate);
    const scholarshipPercentage = app.scholarshipPercentage ?? 0;
    const total = computeInvoiceTotal(weeks, scholarshipPercentage);

    const startMonthKey = start.toISOString().slice(0, 7);
    const payMonthKey = paymentDeadline.toISOString().slice(0, 7);
    studentsByMonth[startMonthKey] = (studentsByMonth[startMonthKey] || 0) + 1;
    revenueByMonth[payMonthKey] = (revenueByMonth[payMonthKey] || 0) + total;

    if (app.invoiceStatus === "approved") totalApprovedRevenue += total;
    else if (app.invoiceStatus === "pending") totalPendingRevenue += total;

    list.push({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      studentCode: resolveStudentCode(user, app),
      startDate: startDate,
      endDate: endDate,
      paymentDeadline: paymentDeadline.toISOString(),
      weeks,
      scholarshipPercentage,
      total,
      invoiceStatus: app.invoiceStatus || "pending",
      paymentProofStatus: app.paymentProofStatus || null,
      hasPaymentProof: !!app.paymentProofUrl,
      paymentProofUploadedAt: app.paymentProofUploadedAt || null,
      isPaid: app.paymentProofStatus === "approved",
      ...summarizePaymentFollowUp(app.paymentFollowUp),
    });
  }

  const summary = {
    totalApprovedRevenue,
    totalPendingRevenue,
    totalInvoices: list.length,
    revenueByMonth: Object.entries(revenueByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, value })),
    studentsByMonth: Object.entries(studentsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
  };

  return { list, summary };
}

function formatDateForExport(d) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Invoice statistics: list of invoices + aggregates for charts (admin only)
router.get("/invoice-stats", async (req, res) => {
  try {
    const { list, summary } = await getInvoiceStatsData();
    res.json({ list, summary });
  } catch (error) {
    console.error("Error fetching invoice stats:", error);
    res.status(500).json({ message: "Error fetching invoice statistics" });
  }
});

// Export invoices list to Excel (admin only)
router.get("/invoice-stats/export", async (req, res) => {
  try {
    const { list } = await getInvoiceStatsData();
    const frontendBase = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
    const rows = list.map((row) => ({
      "User Name": row.userName ?? "—",
      "Student Code": row.studentCode ?? "—",
      "User Email": row.userEmail ?? "—",
      "Start Date": formatDateForExport(row.startDate),
      "End Date": formatDateForExport(row.endDate),
      Weeks: row.weeks ?? "—",
      "Scholarship %": row.scholarshipPercentage != null && row.scholarshipPercentage > 0 ? `${row.scholarshipPercentage}%` : "—",
      "Payment Deadline": formatDateForExport(row.paymentDeadline),
      "Total (USD)": row.total != null ? Number(row.total).toFixed(2) : "—",
      "Invoice Status": row.invoiceStatus ?? "—",
      "Payment Proof Status": row.paymentProofStatus ?? "—",
      Paid: row.isPaid ? "Yes" : "No",
      "Follow-up": FOLLOW_UP_STATUS_LABELS[row.followUpStatus] ?? "—",
      "Latest Note": row.followUpLatestNote ?? "—",
      "Invoice PDF (link)": frontendBase ? `${frontendBase}/admin/invoice-stats/download-pdf/${row.userId}` : "—",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    // Make "Invoice PDF (link)" column clickable hyperlinks where we have a URL
    const colIndex = Object.keys(rows[0] || {}).indexOf("Invoice PDF (link)");
    if (colIndex >= 0 && rows.length > 0) {
      const colLetter = XLSX.utils.encode_col(colIndex);
      rows.forEach((row, i) => {
        const url = row["Invoice PDF (link)"];
        if (url && url !== "—") {
          const ref = `${colLetter}${i + 2}`; // +2: 1-based row, and row 1 is header
          if (!ws[ref]) return;
          ws[ref].l = { Target: url, Tooltip: "Download invoice PDF" };
        }
      });
    }
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `MIRI_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (error) {
    console.error("Error exporting invoice stats to Excel:", error);
    res.status(500).json({ message: "Error exporting invoices to Excel" });
  }
});

// ----- Program payments (programs without the MIRI invoice flow, e.g. EMFUTECH) -----
// These users upload a payment proof right after their decision letter: there is no
// date range and no invoice amount, so this tracks payment state per student.
async function getProgramPaymentsData(program) {
  const users = await User.find({ program })
    .select("name email program digitalId createdAt")
    .sort({ name: 1 })
    .lean();

  const applications = await Application.find({ userId: { $in: users.map((u) => u._id) } })
    .select(
      "userId acceptanceLetterGeneratedAt paymentProofUrl paymentProofStatus " +
        "paymentProofUploadedAt paymentProofApprovedAt promotionalCode registrationCode paymentFollowUp"
    )
    .lean();
  const appByUserId = new Map(applications.map((a) => [a.userId.toString(), a]));

  const list = users.map((user) => {
    const app = appByUserId.get(user._id.toString());
    return {
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      studentCode: resolveStudentCode(user, app),
      acceptanceLetterGeneratedAt: app?.acceptanceLetterGeneratedAt ?? null,
      paymentProofStatus: app?.paymentProofStatus ?? null,
      paymentProofUploadedAt: app?.paymentProofUploadedAt ?? null,
      paymentProofApprovedAt: app?.paymentProofApprovedAt ?? null,
      hasPaymentProof: !!app?.paymentProofUrl,
      isPaid: app?.paymentProofStatus === "approved",
      ...summarizePaymentFollowUp(app?.paymentFollowUp),
    };
  });

  const summary = {
    program,
    totalStudents: list.length,
    paid: list.filter((r) => r.isPaid).length,
    pendingReview: list.filter((r) => r.paymentProofStatus === "pending").length,
    rejected: list.filter((r) => r.paymentProofStatus === "rejected").length,
    notUploaded: list.filter((r) => !r.hasPaymentProof).length,
    letterSent: list.filter((r) => r.acceptanceLetterGeneratedAt).length,
  };

  return { list, summary };
}

function resolveProgramParam(value) {
  const program = String(value || "").toUpperCase();
  return VALID_PROGRAMS.includes(program) ? program : null;
}

// Payment tracking for a given program (admin only)
router.get("/program-payments", async (req, res) => {
  try {
    const program = resolveProgramParam(req.query.program);
    if (!program) {
      return res.status(400).json({ message: "A valid 'program' query parameter is required." });
    }
    const { list, summary } = await getProgramPaymentsData(program);
    res.json({ list, summary });
  } catch (error) {
    console.error("Error fetching program payments:", error);
    res.status(500).json({ message: "Error fetching program payments" });
  }
});

// Export program payments to Excel (admin only)
router.get("/program-payments/export", async (req, res) => {
  try {
    const program = resolveProgramParam(req.query.program);
    if (!program) {
      return res.status(400).json({ message: "A valid 'program' query parameter is required." });
    }
    const { list } = await getProgramPaymentsData(program);
    const rows = list.map((row) => ({
      "User": row.userName ?? "—",
      "Email": row.userEmail ?? "—",
      "Student Code": row.studentCode ?? "—",
      "Decision Letter": row.acceptanceLetterGeneratedAt ? formatDateForExport(row.acceptanceLetterGeneratedAt) : "Not sent",
      "Payment Status": row.isPaid
        ? "Paid"
        : row.paymentProofStatus === "pending"
        ? "Pending review"
        : row.paymentProofStatus === "rejected"
        ? "Rejected"
        : "Not uploaded",
      "Proof Uploaded": row.paymentProofUploadedAt ? formatDateForExport(row.paymentProofUploadedAt) : "—",
      "Approved At": row.paymentProofApprovedAt ? formatDateForExport(row.paymentProofApprovedAt) : "—",
      "Follow-up": FOLLOW_UP_STATUS_LABELS[row.followUpStatus] ?? "—",
      "Latest Note": row.followUpLatestNote ?? "—",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `${program} Payments`.slice(0, 31));
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `${program}_Payments_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (error) {
    console.error("Error exporting program payments to Excel:", error);
    res.status(500).json({ message: "Error exporting program payments to Excel" });
  }
});

// List users awaiting decision letter (interview submitted, no acceptance letter yet)
router.get("/pending-decision-letters", async (req, res) => {
  try {
    // Find applications that are submitted (not draft), interview completed
    // and no acceptance letter has been generated yet.
    const applications = await Application.find({
      step1Completed: true,
      step2Completed: true,
      $or: [
        { acceptanceLetterGeneratedAt: null },
        { acceptanceLetterGeneratedAt: { $exists: false } },
      ],
    })
      .select("userId updatedAt")
      .populate("userId", "name email program cvAnalyzed interviewCompleted isActive")
      .sort({ updatedAt: -1 })
      .lean();

    const list = applications
      .filter((app) => app.userId) // skip orphan applications
      .filter((app) => ["MIRI", "EMFUTECH"].includes(app.userId?.program))
      .map((app) => ({
        userId: app.userId?._id,
        name: app.userId?.name,
        email: app.userId?.email,
        program: app.userId?.program,
        applicationSubmittedAt: app.updatedAt,
        applicationId: app._id,
      }));
    res.json({ pending: list });
  } catch (error) {
    console.error("Error listing pending decision letters:", error);
    res.status(500).json({ message: "Error listing pending decision letters" });
  }
});

// List pending invoice (date confirmation) requests
router.get("/invoice-requests", async (req, res) => {
  try {
    const applications = await Application.find({
      invoiceStatus: "pending",
      "invoiceDateRange.startDate": { $exists: true },
      "invoiceDateRange.endDate": { $exists: true },
    })
      .select("userId invoiceDateRange")
      .populate("userId", "name email program")
      .sort({ updatedAt: -1 });
    const list = applications.map((app) => ({
      userId: app.userId?._id,
      name: app.userId?.name,
      email: app.userId?.email,
      program: app.userId?.program,
      dateRangeStart: app.invoiceDateRange?.startDate,
      dateRangeEnd: app.invoiceDateRange?.endDate,
      applicationId: app._id,
    }));
    res.json({ pending: list });
  } catch (error) {
    console.error("Error listing invoice requests:", error);
    res.status(500).json({ message: "Error listing invoice requests" });
  }
});

// Approve invoice (dates + optional scholarship %)
router.patch("/users/:userId/invoice-approve", async (req, res) => {
  try {
    const { userId } = req.params;
    let { scholarshipPercentage } = req.body;
    if (scholarshipPercentage !== undefined) {
      const pct = Number(scholarshipPercentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ message: "Scholarship percentage must be between 0 and 100." });
      }
      scholarshipPercentage = pct;
    } else {
      scholarshipPercentage = 0;
    }

    const application = await Application.findOne({ userId, invoiceStatus: "pending" });
    if (!application) {
      return res.status(404).json({
        message: "No pending invoice request found for this user.",
      });
    }

    application.invoiceStatus = "approved";
    application.scholarshipPercentage = scholarshipPercentage;
    application.invoiceApprovedAt = new Date();
    await application.save();

    res.json({
      message: "Invoice approved.",
      invoiceStatus: application.invoiceStatus,
      scholarshipPercentage: application.scholarshipPercentage,
    });
  } catch (error) {
    console.error("Error approving invoice:", error);
    res.status(500).json({ message: "Error approving invoice" });
  }
});

// Update scholarship % on an already-approved invoice
router.patch("/users/:userId/invoice-scholarship", async (req, res) => {
  try {
    const { userId } = req.params;
    const { scholarshipPercentage } = req.body;

    if (scholarshipPercentage === undefined || scholarshipPercentage === null) {
      return res.status(400).json({ message: "Scholarship percentage is required." });
    }

    const pct = Number(scholarshipPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ message: "Scholarship percentage must be between 0 and 100." });
    }

    const application = await Application.findOne({ userId, invoiceStatus: "approved" });
    if (!application) {
      return res.status(404).json({
        message: "No approved invoice found for this user.",
      });
    }

    if (!application.invoiceDateRange?.startDate || !application.invoiceDateRange?.endDate) {
      return res.status(400).json({ message: "Invoice dates are required before updating scholarship." });
    }

    application.scholarshipPercentage = pct;
    await application.save();

    res.json({
      message: "Scholarship updated.",
      scholarshipPercentage: application.scholarshipPercentage,
    });
  } catch (error) {
    console.error("Error updating invoice scholarship:", error);
    res.status(500).json({ message: "Error updating invoice scholarship" });
  }
});

// Reject invoice (date confirmation)
router.patch("/users/:userId/invoice-reject", async (req, res) => {
  try {
    const { userId } = req.params;
    const application = await Application.findOne({ userId, invoiceStatus: "pending" });
    if (!application) {
      return res.status(404).json({
        message: "No pending invoice request found for this user.",
      });
    }
    application.invoiceStatus = "rejected";
    application.invoiceApprovedAt = null;
    await application.save();
    res.json({ message: "Invoice request rejected.", invoiceStatus: application.invoiceStatus });
  } catch (error) {
    console.error("Error rejecting invoice:", error);
    res.status(500).json({ message: "Error rejecting invoice" });
  }
});

// ----- MIRI Payment proof (comprobante de pago) -----
// List pending payment proof uploads for admin verification
router.get("/payment-proof-requests", async (req, res) => {
  try {
    const applications = await Application.find({
      paymentProofStatus: "pending",
      paymentProofUrl: { $exists: true, $ne: "" },
    })
      .select("userId paymentProofUploadedAt")
      .populate("userId", "name email program")
      .sort({ paymentProofUploadedAt: -1 })
      .lean();
    const list = applications.map((app) => ({
      userId: app.userId?._id,
      name: app.userId?.name,
      email: app.userId?.email,
      program: app.userId?.program,
      paymentProofUploadedAt: app.paymentProofUploadedAt,
      applicationId: app._id,
    }));
    res.json({ pending: list });
  } catch (error) {
    console.error("Error listing payment proof requests:", error);
    res.status(500).json({ message: "Error listing payment proof requests" });
  }
});

// Approve payment proof
router.patch("/users/:userId/payment-proof-approve", async (req, res) => {
  try {
    const { userId } = req.params;
    const application = await Application.findOne({
      userId,
      paymentProofStatus: "pending",
      paymentProofUrl: { $exists: true, $ne: "" },
    });
    if (!application) {
      return res.status(404).json({
        message: "No pending payment proof found for this user.",
      });
    }
    application.paymentProofStatus = "approved";
    application.paymentProofApprovedAt = new Date();
    await application.save();
    res.json({
      message: "Payment proof approved. Payment is now marked as paid.",
      paymentProofStatus: application.paymentProofStatus,
    });
  } catch (error) {
    console.error("Error approving payment proof:", error);
    res.status(500).json({ message: "Error approving payment proof" });
  }
});

// Reject payment proof (user can re-upload)
router.patch("/users/:userId/payment-proof-reject", async (req, res) => {
  try {
    const { userId } = req.params;
    const application = await Application.findOne({ userId });
    if (!application || !application.paymentProofUrl) {
      return res.status(404).json({ message: "No payment proof found for this user." });
    }
    application.paymentProofStatus = "rejected";
    application.paymentProofApprovedAt = null;
    await application.save();
    res.json({
      message: "Payment proof rejected. The user can upload a new one.",
      paymentProofStatus: application.paymentProofStatus,
    });
  } catch (error) {
    console.error("Error rejecting payment proof:", error);
    res.status(500).json({ message: "Error rejecting payment proof" });
  }
});

// ----- Manual payment corrections (admin) -----
// Registration fee (Stripe): set paid/unpaid by hand. Needed for users who paid
// before Stripe checkout existed, paid outside the platform, or were recorded wrong.
router.patch("/users/:userId/registration-fee", async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    if (!["paid", "unpaid"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'paid' or 'unpaid'." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    let application = await Application.findOne({ userId });
    if (!application) {
      application = new Application({ userId, email: user.email });
    }

    if (status === "paid") {
      application.registrationFeeStatus = "paid";
      application.registrationFeePaidAt = application.registrationFeePaidAt || new Date();
    } else {
      // Keep "pending" when a Stripe checkout was started, so the Stripe trail stays readable.
      application.registrationFeeStatus = application.stripeCheckoutSessionId ? "pending" : null;
      application.registrationFeePaidAt = null;
    }
    await application.save();

    res.json({
      message:
        status === "paid"
          ? "Registration fee marked as paid."
          : "Registration fee marked as unpaid.",
      registrationFeeStatus: application.registrationFeeStatus,
      registrationFeePaidAt: application.registrationFeePaidAt,
    });
  } catch (error) {
    console.error("Error updating registration fee status:", error);
    res.status(500).json({ message: "Error updating registration fee status" });
  }
});

// Program payment: mark as paid by hand, with or without an uploaded proof
// (payment received outside the platform, or proof approved elsewhere).
router.patch("/users/:userId/payment-proof-paid", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    let application = await Application.findOne({ userId });
    if (!application) {
      application = new Application({ userId, email: user.email });
    }
    application.paymentProofStatus = "approved";
    application.paymentProofApprovedAt = application.paymentProofApprovedAt || new Date();
    await application.save();

    res.json({
      message: "Program payment marked as paid.",
      paymentProofStatus: application.paymentProofStatus,
    });
  } catch (error) {
    console.error("Error marking program payment as paid:", error);
    res.status(500).json({ message: "Error marking program payment as paid" });
  }
});

// Mark payment as unpaid (revert an already-approved payment proof back to pending review)
router.patch("/users/:userId/payment-proof-unpaid", async (req, res) => {
  try {
    const { userId } = req.params;
    const application = await Application.findOne({ userId });
    if (!application) {
      return res.status(404).json({ message: "No application found for this user." });
    }
    // Keep the uploaded file: if there is one, it goes back to the pending review queue.
    application.paymentProofStatus = application.paymentProofUrl ? "pending" : null;
    application.paymentProofApprovedAt = null;
    await application.save();
    res.json({
      message: application.paymentProofUrl
        ? "Invoice marked as unpaid. The payment proof is pending review again."
        : "Invoice marked as unpaid.",
      paymentProofStatus: application.paymentProofStatus,
    });
  } catch (error) {
    console.error("Error marking payment as unpaid:", error);
    res.status(500).json({ message: "Error marking payment as unpaid" });
  }
});

// Students without an application yet (e.g. EMFUTECH) get one, as when marking a payment as paid
async function getApplicationForFollowUp(userId) {
  const user = await User.findById(userId).select("email").lean();
  if (!user) return null;
  return (await Application.findOne({ userId })) || new Application({ userId, email: user.email });
}

async function getAdminName(req) {
  const admin = await User.findById(req.userId).select("name email").lean();
  return admin?.name || admin?.email || "Admin";
}

// Payment follow-up: outcome, checklist and notes for a student (admin only)
router.get("/users/:userId/payment-follow-up", async (req, res) => {
  try {
    const application = await Application.findOne({ userId: req.params.userId })
      .select("paymentFollowUp")
      .lean();
    res.json(paymentFollowUpResponse(application));
  } catch (error) {
    console.error("Error fetching payment follow-up:", error);
    res.status(500).json({ message: "Error fetching payment follow-up" });
  }
});

// Update the follow-up outcome and/or checklist items: { status?, checklist?: { [key]: boolean } }
router.patch("/users/:userId/payment-follow-up", async (req, res) => {
  try {
    const { status, checklist } = req.body || {};
    if (status !== undefined && status !== null && !FOLLOW_UP_STATUS_LABELS[status]) {
      return res.status(400).json({ message: "Invalid follow-up status." });
    }
    const checklistKeys = FOLLOW_UP_CHECKLIST.map(({ key }) => key);
    if (
      checklist !== undefined &&
      (typeof checklist !== "object" || checklist === null || Object.keys(checklist).some((key) => !checklistKeys.includes(key)))
    ) {
      return res.status(400).json({ message: "Invalid checklist item." });
    }

    const application = await getApplicationForFollowUp(req.params.userId);
    if (!application) return res.status(404).json({ message: "User not found." });

    const adminName = await getAdminName(req);
    const now = new Date();
    if (status !== undefined) {
      application.set("paymentFollowUp.status", status);
      application.set("paymentFollowUp.statusUpdatedAt", now);
      application.set("paymentFollowUp.statusUpdatedBy", adminName);
    }
    for (const [key, done] of Object.entries(checklist || {})) {
      const path = `paymentFollowUp.checklist.${key}`;
      // Keep who checked it first when an already-done item is sent again
      if (done && !application.get(`${path}.doneAt`)) {
        application.set(path, { doneAt: now, doneBy: adminName });
      } else if (!done) {
        application.set(path, { doneAt: null, doneBy: null });
      }
    }
    await application.save();

    res.json(paymentFollowUpResponse(application));
  } catch (error) {
    console.error("Error updating payment follow-up:", error);
    res.status(500).json({ message: "Error updating payment follow-up" });
  }
});

// Add a follow-up note: { text }
router.post("/users/:userId/payment-follow-up/notes", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ message: "Note text is required." });
    if (text.length > FOLLOW_UP_NOTE_MAX_LENGTH) {
      return res.status(400).json({ message: `Notes can be at most ${FOLLOW_UP_NOTE_MAX_LENGTH} characters.` });
    }

    const application = await getApplicationForFollowUp(req.params.userId);
    if (!application) return res.status(404).json({ message: "User not found." });

    application.paymentFollowUp.notes.push({
      text,
      authorId: req.userId,
      authorName: await getAdminName(req),
      createdAt: new Date(),
    });
    await application.save();

    res.json(paymentFollowUpResponse(application));
  } catch (error) {
    console.error("Error adding payment follow-up note:", error);
    res.status(500).json({ message: "Error adding payment follow-up note" });
  }
});

router.delete("/users/:userId/payment-follow-up/notes/:noteId", async (req, res) => {
  try {
    const { userId, noteId } = req.params;
    const application = await Application.findOne({ userId });
    if (!application?.paymentFollowUp?.notes?.id(noteId)) {
      return res.status(404).json({ message: "Note not found." });
    }
    application.paymentFollowUp.notes.pull(noteId);
    await application.save();

    res.json(paymentFollowUpResponse(application));
  } catch (error) {
    console.error("Error deleting payment follow-up note:", error);
    res.status(500).json({ message: "Error deleting payment follow-up note" });
  }
});

// Admin: download user's payment proof PDF (works in deployment: proxy from S3 instead of redirect)
router.get("/users/:userId/payment-proof", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("name");
    if (!user) return res.status(404).json({ message: "User not found" });

    const application = await Application.findOne({ userId });
    if (!application || !application.paymentProofUrl) {
      return res.status(404).json({ message: "No payment proof uploaded for this user." });
    }

    const urlOrPath = application.paymentProofUrl;
    const isUrl = urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://");
    const fileName = `Payment_Proof_${(user.name || "User").replace(/\s+/g, "_")}.pdf`;
    const setPdfHeaders = () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    };

    // S3 full URL: fetch server-side and stream to client (avoids CORS / redirect issues in deployment)
    if (isUrl) {
      const response = await fetch(urlOrPath);
      if (!response.ok) {
        console.error("Payment proof fetch failed:", response.status, urlOrPath);
        return res.status(502).json({ message: "Payment proof file could not be retrieved from storage." });
      }
      setPdfHeaders();
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }

    // S3 key (e.g. payment-proofs/xxx.pdf) when STORAGE_TYPE is s3
    const storageType = process.env.STORAGE_TYPE || "local";
    if (storageType === "s3" && process.env.AWS_BUCKET_NAME) {
      const s3Key = urlOrPath.includes("/") ? urlOrPath : `payment-proofs/${urlOrPath}`;
      const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
      });
      const obj = await s3Client.send(command);
      const stream = obj.Body;
      if (!stream) return res.status(502).json({ message: "Payment proof stream not available." });
      setPdfHeaders();
      stream.pipe(res);
      return;
    }

    // Local file
    const filePath = path.join(process.cwd(), "uploads", "payment-proofs", path.basename(urlOrPath));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Payment proof file not found on server." });
    }
    setPdfHeaders();
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("Error downloading payment proof:", error);
    res.status(500).json({ message: "Error downloading payment proof" });
  }
});

// Admin: assign or change invoice dates (MIRI). Assign when user has no dates yet; change when they already have dates.
router.patch("/users/:userId/invoice-dates", async (req, res) => {
  try {
    const { userId } = req.params;
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    let application = await Application.findOne({ userId });
    const isAssign = !application || !application.invoiceDateRange?.startDate || !application.invoiceDateRange?.endDate;

    if (!application) {
      application = new Application({
        userId,
        email: user.email,
        invoiceDateRange: { startDate: start, endDate: end },
        invoiceStatus: "pending",
      });
      await application.save();
    } else {
      application.invoiceDateRange = { startDate: start, endDate: end };
      application.markModified("invoiceDateRange"); // required so Mongoose persists nested object changes
      if (isAssign) {
        application.invoiceStatus = "pending";
        application.invoiceApprovedAt = null;
      }
      await application.save();
    }

    res.json({
      message: isAssign
        ? "Invoice dates assigned. They will appear in 'Confirm dates (MIRI)' for approval; you can then approve and set scholarship %."
        : "Invoice dates updated. The user can download a new invoice with the updated period.",
      invoiceDateRange: application.invoiceDateRange,
      invoiceStatus: application.invoiceStatus,
    });
  } catch (error) {
    console.error("Error updating invoice dates:", error);
    const message =
      error.message ||
      (error.errors && Object.values(error.errors).map((e) => e.message).join(", ")) ||
      "Error updating invoice dates";
    res.status(500).json({ message });
  }
});

// Generate acceptance letter PDF (admin). Standalone: works even if user has no application/screening.
// Query param: programType (optional, default: 'MIRI') - 'MIRI' or 'FIJSE'
router.get("/users/:userId/acceptance-letter", async (req, res) => {
  try {
    const { userId } = req.params;
    const programType = ['FIJSE', 'EMFUTECH'].includes(req.query.programType) ? req.query.programType : 'MIRI';

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    let application = await Application.findOne({ userId: userId });
    if (!application) {
      application = new Application({
        userId,
        acceptanceLetterGeneratedAt: new Date(),
        acceptanceLetterProgramType: programType,
      });
      await application.save();
    } else {
      if (!application.acceptanceLetterGeneratedAt) {
        application.acceptanceLetterGeneratedAt = new Date();
      }
      application.acceptanceLetterProgramType = programType;
      await application.save();
    }

    streamAcceptanceLetterPdf(res, user, application, programType);
  } catch (error) {
    console.error('Error generating acceptance letter:', error);
    res.status(500).json({ message: "Error generating acceptance letter" });
  }
});

// Download invoice PDF for a user (admin can download any user's invoice if it exists)
router.get("/users/:userId/invoice", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    
    if (user.program !== "MIRI") {
      return res.status(403).json({ message: "Invoice is only available for MIRI program." });
    }

    const application = await Application.findOne({ userId });
    if (!application) {
      return res.status(404).json({ message: "Application not found for this user." });
    }
    
    if (!application.invoiceDateRange?.startDate || !application.invoiceDateRange?.endDate) {
      return res.status(400).json({ message: "Invoice data is incomplete. User has not selected dates yet." });
    }

    // Admin can download invoice regardless of approval status (for preview purposes)
    streamInvoicePdf(res, user, application);
  } catch (error) {
    console.error("Error downloading invoice:", error);
    res.status(500).json({ message: "Error downloading invoice" });
  }
});

// Notify user by email that acceptance letter is ready (standalone: no application/screening required; admin can send to anyone).
// Body param: programType (optional, default: 'MIRI') - 'MIRI' or 'FIJSE'
router.post("/users/:userId/acceptance-letter/notify", async (req, res) => {
  try {
    const { userId } = req.params;
    const programType = ['FIJSE', 'EMFUTECH'].includes(req.body.programType) ? req.body.programType : 'MIRI';

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    let application = await Application.findOne({ userId: userId });
    if (!application) {
      application = new Application({
        userId: userId,
        acceptanceLetterGeneratedAt: new Date(),
        acceptanceLetterProgramType: programType,
      });
      await application.save();
    } else {
      if (!application.acceptanceLetterGeneratedAt) {
        application.acceptanceLetterGeneratedAt = new Date();
      }
      application.acceptanceLetterProgramType = programType;
      await application.save();
    }

    const fullName =
      application.firstName && application.lastName
        ? `${application.firstName} ${application.lastName}`
        : user.name;

    // Use student portal URL for acceptance email so users always land on https://studentportal.mirai-education.tech
    const studentPortalBase = (process.env.STUDENT_PORTAL_URL || process.env.FRONTEND_URL || "https://studentportal.mirai-education.tech").replace(/\/$/, "");
    const dashboardUrl = `${studentPortalBase}/dashboard`;

    const emailResult = await sendAcceptanceLetterReadyNotification(
      user.email,
      fullName,
      dashboardUrl,
      programType
    );

    if (!emailResult.success) {
      return res.status(500).json({
        message: "Acceptance letter was marked as ready, but failed to send notification email.",
        error: emailResult.error
      });
    }

    res.json({
      message: "User has been notified by email. They can now download their acceptance letter from the dashboard."
    });
  } catch (error) {
    console.error("Error notifying user about acceptance letter:", error);
    res.status(500).json({ message: "Error sending acceptance letter notification" });
  }
});

// Bulk: generate acceptance letter and send notification to selected users (standalone: no application/screening required).
// Body param: userIds (array), programType (optional, default: 'MIRI') - 'MIRI' or 'FIJSE'
router.post("/acceptance-letter/notify-bulk", async (req, res) => {
  try {
    const { userIds, programType: bodyProgramType } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "userIds array is required and must not be empty." });
    }
    const programType = ['FIJSE', 'EMFUTECH'].includes(bodyProgramType) ? bodyProgramType : 'MIRI';

    // Use student portal URL for acceptance email so users always land on https://studentportal.mirai-education.tech
    const studentPortalBase = (process.env.STUDENT_PORTAL_URL || process.env.FRONTEND_URL || "https://studentportal.mirai-education.tech").replace(/\/$/, "");
    const dashboardUrl = `${studentPortalBase}/dashboard`;

    // Helper function to delay between emails (to avoid Gmail rate limits)
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const DELAY_BETWEEN_EMAILS = 2000; // 2 seconds between each email (30 emails/minute - safe for Gmail)

    const results = [];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      try {
        const user = await User.findById(userId).select("-password");
        if (!user) {
          results.push({ userId, email: null, success: false, reason: "User not found" });
          failed++;
          continue;
        }

        let application = await Application.findOne({ userId });
        const fullName =
          application?.firstName && application?.lastName
            ? `${application.firstName} ${application.lastName}`
            : user.name;

        // Send email first; only mark letter as sent when email succeeds
        const emailResult = await sendAcceptanceLetterReadyNotification(
          user.email,
          fullName,
          dashboardUrl,
          programType
        );

        if (!emailResult.success) {
          results.push({ userId, email: user.email, success: false, reason: emailResult.error });
          failed++;
          continue;
        }

        // Email sent successfully: now set acceptanceLetterGeneratedAt so dashboard shows "Sent"
        if (!application) {
          application = new Application({
            userId,
            acceptanceLetterGeneratedAt: new Date(),
            acceptanceLetterProgramType: programType,
          });
          await application.save();
        } else {
          if (!application.acceptanceLetterGeneratedAt) {
            application.acceptanceLetterGeneratedAt = new Date();
          }
          application.acceptanceLetterProgramType = programType;
          await application.save();
        }

        results.push({ userId, email: user.email, success: true });
        sent++;
      } catch (err) {
        console.error(`Bulk acceptance letter: error for user ${userId}:`, err);
        results.push({
          userId,
          email: null,
          success: false,
          reason: err.message || "Unknown error",
        });
        failed++;
      }

      // Add delay between emails to avoid Gmail rate limits (except after the last one)
      if (i < userIds.length - 1) {
        await delay(DELAY_BETWEEN_EMAILS);
      }
    }

    res.json({
      message: `Processed ${userIds.length} user(s): ${sent} notified, ${failed} failed.`,
      sent,
      failed,
      results,
    });
  } catch (error) {
    console.error("Error in bulk acceptance letter notify:", error);
    res.status(500).json({ message: "Error processing bulk acceptance letter notification" });
  }
});

// Download all users' acceptance letters as a ZIP file.
// Body param: programType (optional, default: 'MIRI') - 'MIRI' or 'FIJSE'
router.post("/acceptance-letter/download-all", async (req, res) => {
  try {
    const programType = ['FIJSE', 'EMFUTECH'].includes(req.body.programType) ? req.body.programType : 'MIRI';
    const users = await User.find({}).select("-password").lean();
    if (!users.length) {
      return res.status(400).json({ message: "No users found." });
    }

    const zipFilename = `acceptance_letters_${programType}_${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      res.status(500).end();
    });
    archive.pipe(res);

    let added = 0;
    let failed = 0;
    const seenNames = new Set();

    for (const user of users) {
      try {
        let application = await Application.findOne({ userId: user._id });
        if (!application) {
          application = await Application.create({
            userId: user._id,
            acceptanceLetterGeneratedAt: new Date(),
            acceptanceLetterProgramType: programType,
          });
        } else {
          application.acceptanceLetterProgramType = programType;
          if (!application.acceptanceLetterGeneratedAt) {
            application.acceptanceLetterGeneratedAt = new Date();
          }
          await application.save();
        }
        const fullName =
          (application.firstName && application.lastName
            ? `${application.firstName} ${application.lastName}`
            : user.name || "User").trim() || "User";
        const safeName = fullName.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_") || `user_${user._id}`;
        let fileName = `Acceptance_Letter_${programType}_${safeName}.pdf`;
        if (seenNames.has(fileName)) {
          fileName = `Acceptance_Letter_${programType}_${safeName}_${String(user._id).slice(-4)}.pdf`;
        }
        seenNames.add(fileName);

        const buffer = await generateAcceptanceLetterPdfBuffer(user, application, programType);
        archive.append(buffer, { name: fileName });
        added++;
      } catch (err) {
        console.error(`Download-all: error for user ${user._id}:`, err);
        failed++;
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error("Error in download-all acceptance letters:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error generating ZIP of acceptance letters." });
    }
  }
});

export default router;

