import express from "express";
import User from "../models/User.js";
import Application from "../models/Application.js";
import { authMiddleware } from "./authRoutes.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Aplicar ambos middlewares a todas las rutas
router.use(authMiddleware);
router.use(adminMiddleware);

// Listar usuarios
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", role = "", isActive = "" } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    if (role) query.role = role;
    if (isActive !== "") query.isActive = isActive === "true";

    const users = await User.find(query)
      .select("-password")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
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

export default router;

