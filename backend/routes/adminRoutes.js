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
    
    // Get user and application data
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const application = await Application.findOne({ userId: userId });
    
    // Check if user has scheduled screening
    if (!application || !application.scheduledMeeting || !application.scheduledMeeting.dateTime) {
      return res.status(400).json({ 
        message: "User has not scheduled a screening interview yet. Cannot generate acceptance letter." 
      });
    }

    // Get user's full name (from application or user model)
    const fullName = application?.firstName && application?.lastName
      ? `${application.firstName} ${application.lastName}`
      : user.name;

    // Get registration code (digitalId)
    const regCode = user.digitalId || `MIRI-2026-01-${String(userId).slice(-3).padStart(3, '0')}`;

    // Get program name for subject
    const programNames = {
      'MIRI': 'Mirai Innovation Research Immersion (MIRI) Program 2026',
      'EMFUTECH': 'Emerging Future Technologies Program 2026',
      'JCTI': 'Japan-China Technology Innovation Program 2026',
      'MIRAITEACH': 'Mirai Teaching Program 2026',
      'FUTURE_INNOVATORS_JAPAN': 'Future Innovators Japan Program 2026',
      'OTHER': 'Mirai Innovation Research Immersion Program 2026'
    };
    const programName = programNames[user.program] || 'Mirai Innovation Research Immersion (MIRI) Program 2026';

    // Create PDF with A4 size
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 72,
        bottom: 72,
        left: 72,
        right: 72
      }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Acceptance_Letter_${fullName.replace(/\s+/g, '_')}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header section
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
    
    const headerY = 72;
    const headerLeftX = 72;
    const headerRightX = doc.page.width - 72 - 100; // Space for logo (100px width)
    
    // Left side: Address information
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text('Mirai Innovation Research Institute', headerLeftX, headerY, { width: headerRightX - headerLeftX - 20 })
       .font('Helvetica')
       .fontSize(10)
       .text('[Headquarters] Minamihonmachi 2-3-12 Edge Honmachi', headerLeftX, headerY + 20, { width: headerRightX - headerLeftX - 20 })
       .text('Chuo-ku, Osaka-shi, Osaka, Japan. 5410054', headerLeftX, headerY + 35, { width: headerRightX - headerLeftX - 20 })
       .text('contact@mirai-innovation-lab.com', headerLeftX, headerY + 50, { width: headerRightX - headerLeftX - 20 });
    
    // Right side: Logo
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, headerRightX + 20, headerY, { width: 100, height: 100, fit: [100, 100] });
      } catch (err) {
        console.log('Could not add logo:', err.message);
      }
    }

    // Date at top right (above logo area)
    const today = new Date();
    const day = today.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                   day === 2 || day === 22 ? 'nd' :
                   day === 3 || day === 23 ? 'rd' : 'th';
    const formattedDate = today.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }).replace(/\d+/, day + suffix);
    
    doc.fontSize(11)
       .font('Helvetica')
       .text(formattedDate, headerRightX + 20, headerY + 110, { width: 100, align: 'right' });

    // Move down after header
    const startY = headerY + 115; // Un poco más arriba para ganar espacio
    doc.y = startY;
    doc.x = 72; // Reset cursor X to left margin

    // Calculate text width (page width minus left and right margins)
    const textWidth = doc.page.width - 144; // 72 (left) + 72 (right)

    // Subject line - Bold and centered (only for MIRI program)
    if (user.program === 'MIRI') {
      doc.fontSize(11) // Bajamos un punto para ahorrar espacio
         .font('Helvetica-Bold')
         .text(`Subject: Official Final Decision for ${programName}`, { 
           align: 'center',
           width: textWidth
         });
      doc.moveDown(1);
    }

    // Body text - Justified
    doc.fontSize(11) // Fuente 11 es estándar y ahorra mucho espacio
       .font('Helvetica')
       .text(`Dear ${fullName},`, { align: 'left' });
    doc.moveDown(0.5);

    // First paragraph
    doc.text(
      'On behalf of the evaluation committee of the Mirai Innovation Research Immersion Program (MIRI) 2026 at the Mirai Innovation Research Institute, it is a great pleasure to inform you that you have been accepted to participate in our short-term academic immersion program in Osaka, Japan, for a duration of ',
      { 
        align: 'justify', 
        continued: true,
        width: textWidth
      }
    )
    .font('Helvetica-Bold')
    .text('4 to 12 weeks', { 
      continued: true,
      width: textWidth
    })
    .font('Helvetica')
    .text('.', {
      width: textWidth
    });

    doc.moveDown(0.6); // Espaciado entre párrafos más ajustado

    // Second paragraph
    doc.text(
      'Your acceptance is valid for the year ',
      { 
        align: 'justify', 
        continued: true,
        width: textWidth
      }
    )
    .font('Helvetica-Bold')
    .text('2026', { 
      continued: true,
      width: textWidth
    })
    .font('Helvetica')
    .text(', and your participation must begin after ', {
      continued: true,
      width: textWidth
    })
    .font('Helvetica-Bold')
    .text('January 2026', { 
      continued: true,
      width: textWidth
    })
    .font('Helvetica')
    .text(' and conclude before ', {
      continued: true,
      width: textWidth
    })
    .font('Helvetica-Bold')
    .text('December 2026', { 
      continued: true,
      width: textWidth
    })
    .font('Helvetica')
    .text('. The exact starting date is flexible, allowing you to select the period that best fits your academic or professional schedule.', {
      width: textWidth
    });

    doc.moveDown(0.6);

    // Third paragraph
    doc.text(
      'Below you will find your registration code for the program. Please use the registration link provided to select your preferred participation dates and duration:',
      { 
        align: 'justify',
        width: textWidth
      }
    );

    doc.moveDown(0.4);
    
    // Registration Code - Bold
    doc.font('Helvetica-Bold')
       .text(`Registration Code: ${regCode}`, { width: textWidth });
    
    // Registration Link
    doc.font('Helvetica')
       .text('Registration Link: ', { 
         align: 'left', 
         continued: true,
         width: textWidth
       })
       .fillColor('blue')
       .text('https://www.mirai-innovation-lab.com/miri-program-registration-form', { 
         link: 'https://www.mirai-innovation-lab.com/miri-program-registration-form',
         width: textWidth
       })
       .fillColor('black');

    doc.moveDown(0.6);

    // Fourth paragraph
    doc.text(
      'To confirm your participation, please ensure you complete your registration within ',
      { 
        align: 'justify', 
        continued: true,
        width: textWidth
      }
    )
    .font('Helvetica-Bold')
    .text('1 week', { 
      continued: true,
      width: textWidth
    })
    .font('Helvetica')
    .text(' after receiving this acceptance letter.', {
      width: textWidth
    });

    doc.moveDown(0.6);

    // Fifth paragraph
    doc.text(
      'After completing your registration, you will receive detailed information regarding the program venue, logistics, and preparation guidelines. Additionally, you will be scheduled for a new online meeting, where we will discuss your potential project, provide guidance on how to prepare and acquire the necessary skills before beginning your MIRI training, and answer any questions you may have regarding your upcoming travel to Japan.',
      { 
        align: 'justify',
        width: textWidth
      }
    );

    doc.moveDown(0.6);

    // Sixth paragraph
    doc.text(
      'We are excited to welcome you to Japan—a place where innovation, creativity, and cultural enrichment come together in inspiring ways. We trust that your experience at Mirai Innovation will expand your vision, strengthen your skills, and open meaningful opportunities for your professional and academic future.',
      { 
        align: 'justify',
        width: textWidth
      }
    );

    doc.y += 12; // Move down (reduced spacing)
    doc.x = 72; // Reset X to left margin

    // Seventh paragraph
    doc.text(
      'If you have any questions or require further assistance, please feel free to contact us.',
      { 
        align: 'justify',
        width: textWidth
      }
    );

    doc.moveDown(1.5); // Espacio para la firma

    // Closing - Centered
    doc.font('Helvetica')
       .text('Evaluation Committee', { align: 'center', width: textWidth });
    doc.font('Helvetica-Bold')
       .text('Mirai Innovation Research Institute', { align: 'center', width: textWidth });

    // Sello (Hanko) - Red circular seal pegado al texto de cierre
    const sealRadius = 25;
    const sealX = doc.page.width / 2; // Centrado horizontalmente
    const sealY = doc.y + 20; // Justo después del texto de cierre

    // Draw red circle
    doc.save();
    doc.circle(sealX, sealY, sealRadius)
       .fillColor('#DC143C') // Crimson red
       .fill();

    // Add text inside circle (white) - centered
    doc.fontSize(7)
       .font('Helvetica-Bold')
       .fillColor('white');
    
    doc.text('株式会社', sealX - 25, sealY - 12, { width: 50, align: 'center' })
       .fontSize(5)
       .text('Mirai Innovation', sealX - 25, sealY - 2, { width: 50, align: 'center' })
       .fontSize(6)
       .text('研究所', sealX - 25, sealY + 6, { width: 50, align: 'center' });
    
    doc.restore();
    doc.fillColor('black');

    // Footer section - Position absoluta al final
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 85;

    // Footer text
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('black')
       .text('[Lab Address] ATC blg, ITM sec. 6th floor Rm. M-1-3 Nankoukita 2-1-10, Suminoe-ku, Osaka, Japan. 559-0034.', 72, footerY, { align: 'left' })
       .text('Tel.: +81 06-6616-7897 | www.mirai-innovation-lab.com', 72, footerY + 12, { align: 'left' });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating acceptance letter:', error);
    res.status(500).json({ message: "Error generating acceptance letter" });
  }
});

export default router;

