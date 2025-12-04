import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { sendPasswordResetEmail, sendPasswordChangeConfirmation } from "../config/email.js";

const router = express.Router();

// Middleware de autenticación
export const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ message: "Acceso denegado, token requerido" });
  }

  try {
    const cleanToken = token.replace("Bearer ", "").trim();
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ 
        message: "Tu cuenta está inactiva." 
      });
    }
    
    next();
  } catch (error) {
    console.error("Error verificando token:", error.message);
    res.status(401).json({ message: "Token inválido" });
  }
};

// Registro de usuario
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, dob, gender, academic_level, program } = req.body;

    if (!name || !email || !password || !dob || !gender || !academic_level || !program) {
      return res.status(400).json({ message: "Faltan campos requeridos." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: "El correo ya está registrado." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      dob,
      gender,
      academic_level,
      program,
      isActive: false,
    };

    const user = await User.create(userData);

    return res.status(201).json({ 
      message: "Usuario registrado con éxito", 
      userId: user._id 
    });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ 
        message: "Datos inválidos", 
        details: error.errors 
      });
    }
    console.error("Error en el registro:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
});

// Login de usuario
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email y contraseña requeridos" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: "Usuario no encontrado" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Contraseña incorrecta" });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        message: "Tu cuenta está inactiva. Contacta al administrador." 
      });
    }

    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: "8h" }
    );

    res.json({ 
      token, 
      userId: user._id, 
      name: user.name, 
      role: user.role 
    });
  } catch (error) {
    console.error("Error en el login:", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

// Recuperación de contraseña
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email requerido" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hora

    await user.save();

    const emailResult = await sendPasswordResetEmail(user.email, resetToken);
    
    if (emailResult.success) {
      res.json({ message: "Email de recuperación enviado" });
    } else {
      res.status(500).json({ message: "Error al enviar el email" });
    }
  } catch (error) {
    console.error("Error en forgot-password:", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

// Verificar token de recuperación
router.get("/verify-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Token inválido o expirado" });
    }

    res.json({ message: "Token válido" });
  } catch (error) {
    console.error("Error verificando token:", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

// Restablecer contraseña
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token y contraseña requeridos" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Token inválido o expirado" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    await sendPasswordChangeConfirmation(user.email, user.name);

    res.json({ message: "Contraseña restablecida exitosamente" });
  } catch (error) {
    console.error("Error en reset-password:", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

export { router as authRoutes };

