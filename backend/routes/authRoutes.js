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
    
    // ACTIVACIÓN POR ADMIN - COMENTADO: Se permite acceso sin verificar isActive
    // if (!user.isActive) {
    //   return res.status(403).json({ 
    //     message: "Tu cuenta está inactiva." 
    //   });
    // }
    
    next();
  } catch (error) {
    res.status(401).json({ message: "Token inválido" });
  }
};

// Registro de usuario
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, dob, gender, academic_level, program } = req.body;

    if (!name || !email || !password || !dob || !gender || !academic_level || !program) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Validate age requirement (must be at least 17 years old)
    const birthDate = new Date(dob);
    const today = new Date();
    
    // Validate date is valid
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ message: "Invalid date of birth. Please enter a valid date." });
    }
    
    // Validate date is not in the future
    if (birthDate > today) {
      return res.status(400).json({ message: "Date of birth cannot be in the future." });
    }
    
    // Validate date is reasonable (not before 1900)
    const minYear = 1900;
    if (birthDate.getFullYear() < minYear) {
      return res.status(400).json({ message: "Date of birth must be after 1900." });
    }
    
    // Calculate age
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    // Validate age is reasonable (not more than 120 years)
    if (age > 120) {
      return res.status(400).json({ message: "Please enter a valid date of birth." });
    }
    
    // Validate age requirement (must be at least 17 years old)
    if (age < 17) {
      return res.status(400).json({ message: "You must be at least 17 years old to register." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generar Digital ID: PROGRAMA-AÑO-NÚMERO
    const currentYear = new Date().getFullYear();
    const programCode = program.toUpperCase(); // Asegurar mayúsculas
    
    // Contar cuántos usuarios hay con este programa en este año
    const usersInProgramThisYear = await User.countDocuments({
      program: programCode,
      createdAt: {
        $gte: new Date(currentYear, 0, 1), // Desde el 1 de enero del año actual
        $lt: new Date(currentYear + 1, 0, 1) // Hasta el 1 de enero del año siguiente
      }
    });
    
    // El siguiente número será el contador + 1
    const userNumber = usersInProgramThisYear + 1;
    const digitalId = `${programCode}-${currentYear}-${userNumber}`;

    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      dob,
      gender,
      academic_level,
      program: programCode,
      digitalId: digitalId,
      // ACTIVACIÓN POR ADMIN - COMENTADO: Las cuentas nuevas se crean activas automáticamente
      // isActive: false,  // Descomentar esta línea para reactivar la activación por admin
      isActive: true,  // Cuentas activas automáticamente al registrarse
    };

    const user = await User.create(userData);

    return res.status(201).json({ 
      message: "User registered successfully", 
      userId: user._id 
    });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ 
        message: "Invalid data", 
        details: error.errors 
      });
    }
    return res.status(500).json({ message: "Server error" });
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

    // ACTIVACIÓN POR ADMIN - COMENTADO: Se permite login sin verificar isActive
    // if (!user.isActive) {
    //   return res.status(403).json({ 
    //     message: "Tu cuenta está inactiva. Contacta al administrador." 
    //   });
    // }

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
    res.status(500).json({ message: "Error en el servidor" });
  }
});

export { router as authRoutes };

