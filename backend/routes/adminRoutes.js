import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Application from "../models/Application.js";
import { authMiddleware } from "./authRoutes.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import { sendBulkEmailToActiveUsers, sendReportResponseNotification } from "../config/email.js";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

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
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    if (role) query.role = role;
    if (isActive !== "") query.isActive = isActive === "true";

    console.log('Query de búsqueda:', JSON.stringify(query));

    const total = await User.countDocuments(query);
    console.log(`Total de usuarios encontrados: ${total}`);

    // Si no se especifica límite, devolver todos los usuarios
    let users;
    if (limit) {
      users = await User.find(query)
        .select("-password")
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });
    } else {
      // Sin límite, devolver todos
      users = await User.find(query)
        .select("-password")
        .sort({ createdAt: -1 });
    }

    console.log(`Usuarios obtenidos: ${users.length}`);

    res.json({
      users,
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

// Generate acceptance letter PDF
router.get("/users/:userId/acceptance-letter", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const application = await Application.findOne({ userId: userId });

    if (!application || !application.scheduledMeeting || !application.scheduledMeeting.dateTime) {
      return res.status(400).json({
        message: "User has not scheduled a screening interview yet. Cannot generate acceptance letter."
      });
    }

    const fullName = application?.firstName && application?.lastName
      ? `${application.firstName} ${application.lastName}`
      : user.name;

    const regCode = user.digitalId || `MIRI-2026-01-${String(userId).slice(-3).padStart(3, '0')}`;

    const programNames = {
      'MIRI': 'Mirai Innovation Research Immersion (MIRI) Program 2026',
      'EMFUTECH': 'Emerging Future Technologies Program 2026',
      'JCTI': 'Japan-China Technology Innovation Program 2026',
      'MIRAITEACH': 'Mirai Teaching Program 2026',
      'FUTURE_INNOVATORS_JAPAN': 'Future Innovators Japan Program 2026',
      'OTHER': 'Mirai Innovation Research Immersion Program 2026'
    };
    const programName = programNames[user.program] || 'Mirai Innovation Research Immersion (MIRI) Program 2026';

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: 72, right: 72 }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Acceptance_Letter_${fullName.replace(/\s+/g, '_')}.pdf"`);
    doc.pipe(res);

    // --- HEADER ---
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');

    const headerY = 60;
    const textWidth = doc.page.width - 144;

    // Dirección (Izquierda)
    doc.fontSize(10).font('Helvetica-Bold')
       .text('Mirai Innovation Research Institute', 72, headerY)
       .font('Helvetica').fontSize(9).fillColor('#444444')
       .text('[Headquarters] Minamihonmachi 2-3-12 Edge Honmachi')
       .text('Chuo-ku, Osaka-shi, Osaka, Japan. 5410054')
       .text('contact@mirai-innovation-lab.com');

    // Logo (Derecha)
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width - 72 - 80, headerY - 10, { width: 80 });
    }

    // Fecha dinámica
    const today = new Date();
    const day = today.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    const formattedDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).replace(/\d+/, day + suffix);

    // Fecha (Derecha)
    doc.fillColor('black').fontSize(11).font('Helvetica')
        .text(formattedDate, 72, headerY + 75, { align: 'right', width: textWidth });

    // Asunto (debajo de la fecha)
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11)
        .text('Subject: Official Final Decision for Mirai Innovation Research Immersion (MIRI) Program 2026', {
            align: 'right',
            width: textWidth
        });
    doc.moveDown(1.5);

    // --- CUERPO ---
    doc.font('Helvetica-Bold').fontSize(11).text(`Dear ${fullName},`, 72, doc.y, { align: 'left' });
    doc.moveDown(1);

    const bodyOptions = { align: 'justify', width: textWidth, lineGap: 2 };

    doc.font('Helvetica').text(
      'On behalf of the evaluation committee of the Mirai Innovation Research Immersion Program (MIRI) 2026 at the Mirai Innovation Research Institute, it is a great pleasure to inform you that you have been ',
      { ...bodyOptions, continued: true }
    )
    .font('Helvetica-Bold').text('accepted ', { continued: true })
    .font('Helvetica').text(' to participate in our short-term academic immersion program in Osaka, Japan, for a duration of ', { continued: true })
    .font('Helvetica-Bold').text('4 to 12 weeks.', { continued: false });
    doc.moveDown(0.8);

    const currentYear = today.getFullYear();

    doc.font('Helvetica')
       .text(
         `Your acceptance is valid for the year ${currentYear}, and your participation must begin after January ${currentYear} and conclude before December ${currentYear}. The exact starting date is flexible, allowing you to select the period that best fits your academic or professional schedule. Below you will find your `,
         { align: 'justify', width: textWidth, continued: true }
       )
       .font('Helvetica-Bold')
       .text('registration code ', { continued: true, align: 'justify', width: textWidth })
       .font('Helvetica')
       .text(
         'for the program. Please use the registration link provided to select your preferred participation dates and duration:',
         { align: 'justify', width: textWidth }
       );

    doc.moveDown(0.8);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text(`Registration Code: ${regCode}`, { width: textWidth });
    doc.font('Helvetica').text('', { continued: false }); // Ensures clean break

    doc.font('Helvetica').text('', { continued: false }); // Spacer if needed
    doc.font('Helvetica-Bold').text('Registration Link:', { continued: true, width: textWidth });
    doc.font('Helvetica').text(' ', { continued: true });
    doc.fillColor('blue').text('https://www.mirai-innovation-lab.com/miri-program-registration-form', {
        link: 'https://www.mirai-innovation-lab.com/miri-program-registration-form',
        continued: false
    }).fillColor('black');

    doc.moveDown(0.8);

    doc.font('Helvetica').text('To confirm your participation, please ensure you ', { ...bodyOptions, continued: true })
       .font('Helvetica-Bold').text('complete your registration within 1 week', { continued: false })
       .text(' after receiving this acceptance letter.', bodyOptions);

    doc.moveDown(0.8);

    doc
      .font('Helvetica')
      .text(
        'After completing your registration, you will receive detailed information regarding the ',
        { align: 'justify', width: textWidth, continued: true }
      )
      .font('Helvetica-Bold')
      .text(
        'program venue, logistics, and preparation guidelines',
        { align: 'justify', width: textWidth, continued: true }
      )
      .font('Helvetica')
      .text(
        '. Additionally, you will be scheduled for a ',
        { ...bodyOptions, continued: true }
      )
      .font('Helvetica-Bold')
      .text(
        'new online meeting',
        { ...bodyOptions, continued: true }
      )
      .font('Helvetica')
      .text(
        ', where we will discuss your potential project, provide guidance on how to prepare and acquire the necessary skills before beginning your MIRI training, and answer any questions you may have regarding your upcoming travel to Japan.',
        { ...bodyOptions, continued: false }
      );

    doc.moveDown(0.8);

    doc.font('Helvetica').text('We are excited to welcome you to Japan—a place where innovation, creativity, and cultural enrichment come together in inspiring ways. We trust that your experience at Mirai Innovation will expand your vision, strengthen your skills, and open meaningful opportunities for your professional and academic future.', bodyOptions);

    doc.moveDown(0.8);
    doc.text('If you have any questions or require further assistance, please feel free to contact us.', bodyOptions);

    // --- CIERRE Y SELLO ---
    doc.moveDown(1.5);
    const closingY = doc.y;
    const centerX = doc.page.width / 2;

    /*
    // Dibujar Hanko (Centrado detrás del nombre)
    const sealY = closingY + 40;
    doc.save();
    doc.circle(centerX, sealY, 32).lineWidth(1.2).strokeColor('#DC143C').stroke();
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#DC143C');
    doc.text('株式会社', centerX - 25, sealY - 14, { width: 50, align: 'center' });
    doc.fontSize(5).text('Mirai Innovation', centerX - 25, sealY - 2, { width: 50, align: 'center' });
    doc.fontSize(6).text('研究所', centerX - 25, sealY + 6, { width: 50, align: 'center' });
    doc.restore();
    */

    // Texto de cierre con Hanko (sello japonés) centrado detrás del texto

    // Definir coordenadas base
    const centerTextX = (doc.page.width - textWidth) / 2;
    const cierreY = doc.y; // Posición y actual antes de cierre

    // Ruta al hanko: backend/public/images/hanko.jpg (misma base que __dirname = backend/routes)
    const hankoPath = path.join(__dirname, '..', 'public', 'images', 'hanko.png');
    const hankoImgSize = 54;
    const hankoImgOffsetY = 17; // cuanto abajo del cierre

    // Hanko un poco a la derecha, casi al lado de "Institute"
    const hankoOffsetRight = 85; // puntos a la derecha del centro (ajustar si hace falta)
    const hankoCenterX = doc.page.width / 2 + hankoOffsetRight - hankoImgSize / 2;

    if (fs.existsSync(hankoPath)) {
      const hankoCenterY = cierreY + hankoImgOffsetY;
      doc.image(hankoPath, hankoCenterX, hankoCenterY, { width: hankoImgSize, height: hankoImgSize });
    }

    // Mueve el texto encima del sello y centrado
    const cierreTextYOffset = 10; // Puede ajustar para que no se superponga con la imagen
    doc.fillColor('black').font('Helvetica').fontSize(11)
       .text('Evaluation Committee', centerTextX, cierreY + cierreTextYOffset, { align: 'center', width: textWidth });

    doc.font('Helvetica-Bold')
       .text('Mirai Innovation Research Institute', centerTextX, doc.y, { align: 'center', width: textWidth });

    // --- FOOTER ---
    const footerY = doc.page.height - 100;

    // Línea gris
    doc.strokeColor('#d1d5db').lineWidth(0.5)
       .moveTo(72, footerY - 20).lineTo(doc.page.width - 72, footerY - 20).stroke();

    doc.fontSize(7.5).font('Helvetica').fillColor('#6b7280');
    doc.text('[Lab Address] ATC blg, ITM sec. 6th floor Rm. M-1-3 Nankoukita 2-1-10, Suminoe-ku, Osaka, Japan. 559-0034.', 72, footerY, { align: 'center', width: textWidth });
    doc.text('Tel.: +81 06-6616-7897', 72, footerY + 12, { align: 'center', width: textWidth });
    doc.text('www.mirai-innovation-lab.com', 72, footerY + 24, { align: 'center', width: textWidth });

    doc.end();

  } catch (error) {
    console.error('Error generating acceptance letter:', error);
    res.status(500).json({ message: "Error generating acceptance letter" });
  }
});

export default router;

