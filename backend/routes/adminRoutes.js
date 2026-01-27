import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { authMiddleware } from "./authRoutes.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import { sendBulkEmailToActiveUsers, sendReportResponseNotification } from "../config/email.js";
import * as XLSX from "xlsx";

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

    res.json(user);
  } catch (error) {
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

export default router;

