# 💻 Ejemplos de Código Reutilizables

Este documento contiene ejemplos de código específicos que puedes reutilizar directamente en tu nuevo proyecto.

---

## 🔐 1. Autenticación con MongoDB

### 1.1 Modelo de Usuario Base

```javascript
// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, required: true },
    academic_level: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
```

### 1.2 Conexión a MongoDB

```javascript
// backend/config/db.js
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ MongoDB conectado");
  } catch (error) {
    console.error("Error al conectar a MongoDB", error);
    process.exit(1);
  }
};

export default connectDB;
```

### 1.3 Registro de Usuario

```javascript
// backend/routes/authRoutes.js
import bcrypt from "bcryptjs";
import User from "../models/User.js";

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, dob, gender, academic_level } = req.body;

    // Validaciones
    if (!name || !email || !password || !dob || !gender || !academic_level) {
      return res.status(400).json({ message: "Faltan campos requeridos." });
    }

    // Normalizar email
    const normalizedEmail = String(email).toLowerCase().trim();

    // Verificar duplicados
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: "El correo ya está registrado." });
    }

    // Hash de contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear usuario
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      dob,
      gender,
      academic_level,
      isActive: false, // Cuentas nuevas inactivas
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
```

### 1.4 Login de Usuario

```javascript
// backend/routes/authRoutes.js
import jwt from "jsonwebtoken";

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Usuario no encontrado" });
    }

    // Comparar contraseñas
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Contraseña incorrecta" });
    }

    // Verificar cuenta activa
    if (!user.isActive) {
      return res.status(403).json({ 
        message: "Tu cuenta está inactiva. Contacta al administrador." 
      });
    }

    // Generar JWT
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
    res.status(500).json({ message: "Error en el login", error });
  }
});
```

### 1.5 Middleware de Autenticación

```javascript
// backend/routes/authRoutes.js
const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ message: "Acceso denegado, token requerido" });
  }

  try {
    const cleanToken = token.replace("Bearer ", "").trim();
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    
    // Verificar usuario activo
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

export { router as authRoutes, authMiddleware };
```

---

## 📄 2. Subida y Análisis de CV

### 2.1 Configuración de Upload a S3

```javascript
// backend/middleware/upload.js
import { S3Client } from "@aws-sdk/client-s3";
import multerS3 from "multer-s3";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const fileName = `${Date.now()}_${file.originalname}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos PDF"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export default upload;
```

### 2.2 Endpoint de Subida de CV

```javascript
// backend/routes/userRoutes.js
import upload from "../middleware/upload.js";
import { authMiddleware } from "../routes/authRoutes.js";

router.post("/upload-cv", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se ha subido ningún archivo" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Guardar URL de S3
    user.cvPath = req.file.location;
    await user.save();

    return res.status(200).json({
      message: "CV subido correctamente",
      filePath: user.cvPath,
    });
  } catch (error) {
    console.error("Error al subir el archivo:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});
```

### 2.3 Extracción de Texto del PDF

```javascript
// backend/utils/cvUtils.js
import { PDFExtract } from 'pdf.js-extract';
import axios from 'axios';

export async function extractTextFromPdf(pdfUrl) {
  try {
    // Descargar desde S3
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer'
    });
    
    const pdfBuffer = Buffer.from(response.data);
    const pdfExtract = new PDFExtract();
    
    // Extraer texto
    const data = await pdfExtract.extractBuffer(pdfBuffer, {});
    const text = data.pages
      .map(page => page.content.map(item => item.str).join(' '))
      .join('\n');
    
    return text.trim();
  } catch (error) {
    console.error('Error al extraer texto del PDF:', error);
    throw error;
  }
}
```

### 2.4 Análisis de CV con OpenAI

```javascript
// backend/utils/cvUtils.js
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeCvText(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "Eres un experto en análisis de currículums." 
        },
        { 
          role: "user", 
          content: `Extrae las habilidades duras y blandas así como la experiencia más relevantes del siguiente CV:\n\n${text}` 
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error en analyzeCvText:", error);
    return "Error en el análisis del CV.";
  }
}
```

### 2.5 Generación de Preguntas de Entrevista

```javascript
// backend/utils/cvUtils.js
export async function generateQuestions(skills) {
  const prompt = `
Basado en las siguientes habilidades extraídas del CV, genera 10 preguntas de entrevista:
- 5 preguntas sobre habilidades duras.
- 5 preguntas sobre habilidades blandas.

Habilidades encontradas en el CV:
${skills.join(", ")}

Unicamente responde en el siguiente formato, sin agregar nada mas:
1. Pregunta sobre habilidad dura
2. Pregunta sobre habilidad dura
...
10. Pregunta sobre habilidad blanda
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });

  let questions = response.choices[0].message.content
    .split("\n")
    .map(q => q.trim())
    .filter(Boolean);

  return questions.slice(0, 10);
}
```

### 2.6 Endpoint Completo de Análisis

```javascript
// backend/routes/userRoutes.js
router.post("/analyze-cv", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.cvPath) {
      return res.status(404).json({ message: "No CV stored for analysis" });
    }

    // 1. Extraer texto
    const cvText = await extractTextFromPdf(user.cvPath);

    // 2. Analizar con GPT
    const analysisResult = await analyzeCvText(cvText);

    // 3. Convertir a array de habilidades
    const allSkills = analysisResult
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    // 4. Generar preguntas
    const questions = await generateQuestions(allSkills);

    // 5. Calcular score inicial
    const score = Math.min(allSkills.length * 10, 100);

    // 6. Guardar en DB
    user.cvText = cvText;
    user.analysis = analysisResult;
    user.skills = allSkills;
    user.questions = questions;
    user.score = score;
    user.cvAnalyzed = true;

    await user.save();

    res.json({ 
      message: "CV analizado con éxito", 
      userId: user._id,
      questions,
      score
    });
  } catch (error) {
    console.error("Error procesando CV:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
```

---

## 🗣️ 3. Sistema de Entrevista con IA

### 3.1 Evaluación de Respuestas con GPT

```javascript
// backend/utils/cvUtils.js
export async function calculateScoreBasedOnAnswers(questions, answers) {
  try {
    if (!questions || !answers || questions.length !== answers.length) {
      throw new Error("Número de preguntas y respuestas no coincide.");
    }

    const prompt = `
Eres un evaluador experto de entrevistas técnicas y de habilidades blandas. 
Evalúa las siguientes respuestas en una escala del 0 al 100 según su calidad, claridad y relevancia para la pregunta. 

Para cada respuesta, proporciona:
1. Un puntaje entre 0 y 100.
2. Una breve explicación de la evaluación.

Aquí están las preguntas y respuestas:

${questions.map((q, i) => `Pregunta: ${q}\nRespuesta: ${answers[i]}\n`).join("\n")}

Responde en el siguiente formato JSON:
[
  { "score": 85, "explanation": "Respuesta clara y bien fundamentada con ejemplos." },
  { "score": 70, "explanation": "Buena respuesta pero le falta detalle." },
  ...
]
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const evaluation = JSON.parse(response.choices[0].message.content);
    const total_score = evaluation.reduce((acc, item) => acc + item.score, 0) / evaluation.length;

    return {
      total_score: Math.round(total_score),
      evaluations: evaluation,
    };
  } catch (error) {
    console.error("Error al evaluar respuestas:", error);
    return {
      total_score: 0,
      evaluations: [],
      error: "Error en la evaluación de respuestas",
    };
  }
}
```

### 3.2 Endpoint de Envío de Entrevista

```javascript
// backend/routes/userRoutes.js
router.post("/submit-interview", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const { answers } = req.body;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "No se enviaron respuestas válidas" });
    }

    const questions = user.questions || [];
    if (questions.length !== answers.length) {
      return res.status(400).json({ 
        message: "Número de respuestas no coincide con las preguntas." 
      });
    }

    // Evaluar con GPT
    const { total_score, evaluations } = await calculateScoreBasedOnAnswers(questions, answers);

    // Guardar en DB
    user.interviewResponses = answers;
    user.interviewScore = total_score;
    user.interviewAnalysis = evaluations;
    user.interviewCompleted = true;

    await user.save();

    return res.json({
      message: "Entrevista evaluada y almacenada con éxito",
      total_score,
      evaluations,
    });
  } catch (error) {
    console.error("Error al procesar la entrevista:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});
```

---

## 📊 4. Cuestionarios de Habilidades

### 4.1 Evaluación de Habilidades Blandas

```javascript
// backend/utils/cvUtils.js
export const evaluateSoftSkills = (responses) => {
  const competencies = {
    "Cognitiva": {
      "Pensamiento Analítico": [1, 21, 41, 61, 81, 101, 121, 141],
      "Respuesta ante los problemas": [2, 22, 42, 62, 82, 102, 122, 142],
      "Iniciativa": [3, 23, 43, 63, 83, 103, 123, 143]
    },
    // ... más competencias
  };

  const scoreLevels = {
    "Cognitiva": {
      "Nivel muy bajo": [24, 78],
      "Nivel bajo": [79, 85],
      "Nivel medio": [86, 105],
      "Nivel alto": [106, 115],
      "Nivel muy alto": [116, 120]
    },
    // ... más niveles
  };

  let results = {};
  let totalScore = 0;

  // Evaluar cada competencia
  for (const [competency, skills] of Object.entries(competencies)) {
    let competencyScore = 0;
    let skillResults = {};

    for (const [skill, questions] of Object.entries(skills)) {
      let sum = questions.reduce((acc, qNum) => 
        acc + (parseInt(responses[qNum - 1]) || 0), 0
      );
      competencyScore += sum;
      skillResults[skill] = { score: sum };
    }

    // Determinar nivel
    let level = "Nivel muy bajo";
    for (const [levelName, range] of Object.entries(scoreLevels[competency])) {
      if (competencyScore >= range[0] && competencyScore <= range[1]) {
        level = levelName;
        break;
      }
    }

    results[competency] = {
      score: competencyScore,
      level,
      skills: skillResults
    };

    totalScore += competencyScore;
  }

  // Nivel institucional
  let institutionalLevel = "Nivel muy bajo";
  const institutionalLevels = {
    "Nivel muy bajo": [160, 561],
    "Nivel bajo": [562, 596],
    "Nivel medio": [597, 708],
    "Nivel alto": [709, 757],
    "Nivel muy alto": [758, 800]
  };

  for (const [levelName, range] of Object.entries(institutionalLevels)) {
    if (totalScore >= range[0] && totalScore <= range[1]) {
      institutionalLevel = levelName;
      break;
    }
  }

  return {
    totalScore,
    institutionalLevel,
    results
  };
};
```

### 4.2 Endpoint de Envío de Habilidades Blandas

```javascript
// backend/routes/userRoutes.js
router.post("/submit-soft-skills", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const { responses } = req.body;

    if (!responses) {
      return res.status(400).json({ message: "No se enviaron respuestas" });
    }

    // Evaluar
    const evaluation = evaluateSoftSkills(responses);

    // Guardar en DB
    user.softSkillsResults = {
      results: evaluation.results,
      totalScore: evaluation.totalScore,
      institutionalLevel: evaluation.institutionalLevel
    };
    user.softSkillsSurveyCompleted = true;

    await user.save();

    res.json({
      message: "Encuesta de habilidades blandas guardada exitosamente",
      ...evaluation
    });
  } catch (error) {
    console.error("Error al procesar la encuesta:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});
```

### 4.3 Evaluación de Habilidades Duras (Inteligencias Múltiples)

```javascript
// backend/utils/cvUtils.js
export const evaluateMultipleIntelligences = (responses) => {
  const intelligences = {
    "Inteligencia Comunicativa": [9, 10, 17, 22, 30],
    "Inteligencia Matemática": [5, 7, 15, 20, 25],
    "Inteligencia Visual": [1, 11, 14, 23, 27],
    "Inteligencia Motriz": [8, 16, 19, 21, 29],
    "Inteligencia Rítmica": [3, 4, 13, 24, 28],
    "Inteligencia de Autoconocimiento": [2, 6, 26, 31, 33],
    "Inteligencia Social": [12, 18, 32, 34, 35],
  };

  const scoreLevels = {
    "Nivel bajo": [2, 2],   // 2 respuestas verdaderas
    "Nivel medio": [3, 3],  // 3 respuestas verdaderas
    "Nivel alto": [4, 5],   // 4 o más respuestas verdaderas
  };

  let results = {};
  let totalScore = 0;

  for (const [intelligence, questionNumbers] of Object.entries(intelligences)) {
    let countTrue = questionNumbers.filter(
      (qNum) => responses[qNum] === "5"
    ).length;
    
    totalScore += countTrue * 5;

    // Asignar nivel
    let level = "Nivel bajo";
    for (const [levelName, range] of Object.entries(scoreLevels)) {
      if (countTrue >= range[0] && countTrue <= range[1]) {
        level = levelName;
        break;
      }
    }

    results[intelligence] = { 
      score: countTrue * 5, 
      level 
    };
  }

  return { totalScore, results };
};
```

---

## 🛡️ 5. Middleware de Admin

```javascript
// backend/middleware/adminMiddleware.js
import User from "../models/User.js";

export const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ 
        message: "Acceso denegado. Se requieren permisos de administrador." 
      });
    }

    next();
  } catch (error) {
    console.error("Error en adminMiddleware:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
```

---

## 📧 6. Sistema de Email

```javascript
// backend/config/email.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Recuperación de Contraseña',
      html: `
        <div>
          <h2>Recuperación de Contraseña</h2>
          <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
          <a href="${resetUrl}">Restablecer Contraseña</a>
          <p>Este enlace expirará en 1 hora.</p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error enviando email:', error);
    return { success: false, error: error.message };
  }
};
```

---

## 🚀 7. Configuración del Servidor Express

```javascript
// backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

dotenv.config();

const app = express();
app.use(express.json());

// CORS
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : [];

const corsOptions = {
  origin: allowedOrigins,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};

app.use(cors(corsOptions));

// Conectar DB
connectDB();

// Rutas
import { authRoutes } from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 20352;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 📝 8. Ejemplo de Uso Completo

### Flujo Completo de Usuario:

```javascript
// 1. Registro
POST /api/auth/register
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "password123",
  "dob": "2000-01-01",
  "gender": "Masculino",
  "academic_level": "Superior"
}

// 2. Login
POST /api/auth/login
{
  "email": "juan@example.com",
  "password": "password123"
}
// Respuesta: { token, userId, name, role }

// 3. Subir CV (con token en header)
POST /api/users/upload-cv
Headers: { Authorization: "Bearer <token>" }
Body: FormData con archivo PDF

// 4. Analizar CV
POST /api/users/analyze-cv
Headers: { Authorization: "Bearer <token>" }
// Respuesta: { questions, score }

// 5. Enviar respuestas de entrevista
POST /api/users/submit-interview
Headers: { Authorization: "Bearer <token>" }
{
  "answers": ["respuesta1", "respuesta2", ...]
}

// 6. Enviar cuestionario de habilidades blandas
POST /api/users/submit-soft-skills
Headers: { Authorization: "Bearer <token>" }
{
  "responses": { "1": "5", "2": "4", ... }
}
```

---

## 🔑 9. Variables de Entorno Mínimas

```env
# .env
MONGO_URI=mongodb://localhost:27017/your_database
JWT_SECRET=your_secret_key_here
PORT=3000
CORS_ORIGINS=http://localhost:3000

# AWS S3 (para CVs)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_BUCKET_NAME=your_bucket

# OpenAI (para análisis)
OPENAI_API_KEY=your_openai_key

# Email (opcional)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:3000
```

---

## ✅ Checklist de Implementación

- [ ] Configurar MongoDB y conexión
- [ ] Crear modelo de Usuario
- [ ] Implementar registro y login
- [ ] Configurar JWT y middleware de autenticación
- [ ] Configurar AWS S3 para subida de archivos
- [ ] Implementar extracción de texto de PDF
- [ ] Configurar OpenAI API
- [ ] Implementar análisis de CV
- [ ] Implementar generación de preguntas
- [ ] Implementar evaluación de entrevista
- [ ] Crear funciones de evaluación de cuestionarios
- [ ] Implementar endpoints de cuestionarios
- [ ] Configurar sistema de email (opcional)
- [ ] Implementar middleware de admin
- [ ] Crear panel de administración

---

Estos ejemplos proporcionan una base sólida para implementar todas las funcionalidades principales en tu nuevo proyecto.

