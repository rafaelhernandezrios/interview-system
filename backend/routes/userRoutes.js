import express from "express";
import User from "../models/User.js";
import { authMiddleware } from "./authRoutes.js";
import upload, { STORAGE_TYPE } from "../middleware/upload.js";
import videoUpload, { STORAGE_TYPE as VIDEO_STORAGE_TYPE } from "../middleware/videoUpload.js";
import {
  extractTextFromPdf,
  analyzeCvText,
  generateQuestions,
  calculateScoreBasedOnAnswers,
  transcribeVideoAudio
} from "../utils/cvUtils.js";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

// Definir __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Servir archivos estáticos de CVs (solo para almacenamiento local)
if (STORAGE_TYPE === 'local') {
  router.use('/uploads/cvs', express.static(path.join(process.cwd(), 'uploads/cvs')));
}

// Subida de CV
router.post("/upload-cv", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Si ya existe un CV, borrar el anterior (solo para almacenamiento local)
    if (user.cvPath && STORAGE_TYPE === 'local') {
      try {
        const fileName = path.basename(user.cvPath);
        const filePath = path.join(__dirname, '../uploads/cvs', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error("Error deleting old CV file:", err);
      }
    }

    // Determinar la ruta del archivo según el tipo de almacenamiento
    let filePath;
    if (STORAGE_TYPE === 's3') {
      // Para S3, usar la URL del archivo
      filePath = req.file.location;
    } else {
      // Para almacenamiento local, crear una URL relativa
      const fileName = path.basename(req.file.path);
      filePath = `/api/users/uploads/cvs/${fileName}`;
    }

    // Resetear análisis si se sube un nuevo CV
    user.cvPath = filePath;
    user.cvText = undefined;
    user.analysis = undefined;
    user.skills = [];
    user.questions = [];
    user.score = undefined;
    user.cvAnalyzed = false;
    user.interviewResponses = [];
    user.interviewScore = undefined;
    user.interviewAnalysis = [];
    user.interviewCompleted = false;

    await user.save();

    return res.status(200).json({
      message: "CV uploaded successfully",
      filePath: user.cvPath,
      storageType: STORAGE_TYPE
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Borrar CV
router.delete("/cv", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.cvPath) {
      return res.status(400).json({ message: "No CV to delete" });
    }

    // Borrar archivo físico si es almacenamiento local
    if (STORAGE_TYPE === 'local') {
      try {
        const fileName = path.basename(user.cvPath);
        const filePath = path.join(__dirname, '../uploads/cvs', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error("Error deleting CV file:", err);
      }
    }

    // Limpiar datos del CV en la base de datos
    user.cvPath = undefined;
    user.cvText = undefined;
    user.analysis = undefined;
    user.skills = [];
    user.questions = [];
    user.score = undefined;
    user.cvAnalyzed = false;
    user.interviewResponses = [];
    user.interviewScore = undefined;
    user.interviewAnalysis = [];
    user.interviewCompleted = false;

    await user.save();

    return res.status(200).json({
      message: "CV deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting CV:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Análisis de CV
router.post("/analyze-cv", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.cvPath) {
      return res.status(404).json({ message: "No CV stored for analysis" });
    }

    const cvText = await extractTextFromPdf(user.cvPath);
    const allSkills = await analyzeCvText(cvText);

    // Ensure allSkills is an array
    const skillsArray = Array.isArray(allSkills) ? allSkills : [];

    const questions = await generateQuestions(skillsArray);
    const score = Math.min(skillsArray.length * 10, 100);

    user.cvText = cvText;
    user.analysis = skillsArray.join(", "); // Store as comma-separated string for backward compatibility
    user.skills = skillsArray;
    user.questions = questions;
    user.score = score;
    user.cvAnalyzed = true;

    await user.save();

    res.json({ 
      message: "CV analizado con éxito", 
      userId: user._id,
      questions,
      score,
      skills: allSkills
    });
  } catch (error) {
    console.error("Error procesando CV:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Transcribe video audio using Whisper
router.post("/transcribe-video", authMiddleware, videoUpload.single('video'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No video file provided" });
    }

    let filePathToTranscribe;
    
    // Si es S3, descargar el archivo temporalmente desde la URL pública
    if (VIDEO_STORAGE_TYPE === 's3' && req.file.location) {
      // En entornos serverless (Vercel), usar /tmp que es el único directorio escribible
      // En desarrollo local, usar la carpeta uploads/videos
      const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
      const tempDir = isServerless ? '/tmp' : path.join(__dirname, '../uploads/videos');
      
      // Crear el directorio si no existe (solo en local, /tmp siempre existe en serverless)
      if (!isServerless && !fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      tempFilePath = path.join(tempDir, `temp_${Date.now()}_${path.basename(req.file.key || 'video.webm')}`);
      
      const response = await axios({
        method: 'GET',
        url: req.file.location,
        responseType: 'stream'
      });
      
      const writeStream = fs.createWriteStream(tempFilePath);
      
      await new Promise((resolve, reject) => {
        response.data.pipe(writeStream);
        response.data.on('error', reject);
        writeStream.on('finish', resolve);
      });
      
      filePathToTranscribe = tempFilePath;
    } else {
      // Para almacenamiento local, usar el path directamente
      filePathToTranscribe = req.file.path;
    }

    // Transcribe using Whisper
    const transcription = await transcribeVideoAudio(filePathToTranscribe);

    // Delete temporary file after transcription
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error("Error deleting temp file:", err);
      }
    } else if (req.file.path && VIDEO_STORAGE_TYPE === 'local') {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Error deleting temp file:", err);
      }
    }

    return res.json({ transcription });
  } catch (error) {
    console.error("Error transcribing video:", error);
    // Try to delete temp file even on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error("Error deleting temp file:", err);
      }
    } else if (req.file && req.file.path && VIDEO_STORAGE_TYPE === 'local') {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Error deleting temp file:", err);
      }
    }
    return res.status(500).json({ message: "Error transcribing audio" });
  }
});

// Envío de respuestas de entrevista
router.post("/submit-interview", authMiddleware, videoUpload.any(), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { answers } = req.body;
    // Find the main video file (for final video question)
    // When using .any(), files are in req.files array
    const videoFile = req.files?.find(f => f.fieldname === 'video') || null;

    // Parse answers if it's a string (from FormData)
    let parsedAnswers = answers;
    if (typeof answers === 'string') {
      try {
        parsedAnswers = JSON.parse(answers);
      } catch (e) {
        parsedAnswers = [];
      }
    }

    if (!parsedAnswers || !Array.isArray(parsedAnswers) || parsedAnswers.length === 0) {
      return res.status(400).json({ message: "No valid answers were submitted" });
    }

    // Default questions
    const defaultQuestions = [
      "What is your motivation for wanting to come to Mirai Innovation Research Institute?",
      "How do you plan to finance your stay and the program in Japan?"
    ];

    const generatedQuestions = user.questions || [];
    const allQuestions = [...generatedQuestions, ...defaultQuestions];
    
    // Separate text answers from video
    const textAnswers = videoFile ? parsedAnswers : parsedAnswers;
    const hasVideo = !!videoFile;

    if (textAnswers.length !== allQuestions.length) {
      return res.status(400).json({ 
        message: "Number of answers does not match the number of questions." 
      });
    }

    // Evaluate text answers only (not the video)
    const { total_score, evaluations } = await calculateScoreBasedOnAnswers(allQuestions, textAnswers);

    user.interviewResponses = textAnswers;
    if (videoFile) {
      // Determinar la ruta del video según el tipo de almacenamiento
      let videoPath;
      if (VIDEO_STORAGE_TYPE === 's3') {
        // Para S3, usar la URL del archivo
        videoPath = videoFile.location;
      } else {
        // Para almacenamiento local, crear una URL relativa
        videoPath = `/api/users/uploads/videos/${path.basename(videoFile.path)}`;
      }
      user.interviewVideo = videoPath;
    }
    user.interviewScore = total_score;
    user.interviewAnalysis = evaluations;
    user.interviewCompleted = true;

    await user.save();

    return res.json({
      message: "Interview evaluated and stored successfully",
      total_score,
      evaluations,
    });
  } catch (error) {
    console.error("Error processing interview:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Guardar progreso de entrevista automáticamente
router.post("/save-interview-progress", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { answers, currentQuestionIndex } = req.body;

    // Don't save if interview is already completed
    if (user.interviewCompleted) {
      return res.json({ message: "Interview already completed" });
    }

    // Save answers temporarily (don't mark as completed)
    user.interviewResponses = answers || [];
    
    await user.save();

    return res.json({ 
      message: "Progress saved successfully",
      currentQuestionIndex: currentQuestionIndex || 0
    });
  } catch (error) {
    console.error("Error saving interview progress:", error);
    return res.status(500).json({ message: "Error saving progress" });
  }
});

// Obtener respuestas de entrevista
router.get("/interview-responses", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.interviewCompleted) {
      return res.status(404).json({ message: "Interview not completed" });
    }

    // Default questions
    const defaultQuestions = [
      "What is your motivation for wanting to come to Mirai Innovation Research Institute?",
      "How do you plan to finance your stay and the program in Japan?"
    ];

    const allQuestions = [...(user.questions || []), ...defaultQuestions];

    res.json({
      questions: allQuestions,
      responses: user.interviewResponses || [],
      video: user.interviewVideo || null,
      analysis: user.interviewAnalysis || [],
      score: user.interviewScore || 0
    });
  } catch (error) {
    console.error("Error fetching interview responses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Obtener perfil del usuario
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

export default router;

