import express from "express";
import User from "../models/User.js";
import { authMiddleware } from "./authRoutes.js";
import upload, { STORAGE_TYPE } from "../middleware/upload.js";
import videoUpload, { STORAGE_TYPE as VIDEO_STORAGE_TYPE } from "../middleware/videoUpload.js";
import photoUpload, { STORAGE_TYPE as PHOTO_STORAGE_TYPE } from "../middleware/photoUpload.js";
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
// Servir archivos estáticos de fotos (solo para almacenamiento local)
if (PHOTO_STORAGE_TYPE === 'local') {
  router.use('/uploads/photos', express.static(path.join(process.cwd(), 'uploads/photos')));
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
    console.log('🎥 [TRANSCRIBE] Video transcription request received');
    console.log('🎥 [TRANSCRIBE] Storage type:', VIDEO_STORAGE_TYPE);
    console.log('🎥 [TRANSCRIBE] File received:', req.file ? 'Yes' : 'No');
    
    if (!req.file) {
      console.error('❌ [TRANSCRIBE] No video file provided');
      return res.status(400).json({ message: "No video file provided" });
    }
    
    // Validate file size (should be at least 1KB and max 50MB)
    if (req.file.size < 1024) {
      console.error('❌ [TRANSCRIBE] File too small:', req.file.size);
      return res.status(400).json({ message: "Video file is too small. Please ensure the recording contains audio." });
    }
    
    if (req.file.size > 50 * 1024 * 1024) {
      console.error('❌ [TRANSCRIBE] File too large:', req.file.size);
      return res.status(400).json({ message: "Video file is too large. Maximum size is 50MB." });
    }
    
    // Log file MIME type for debugging
    console.log('🎥 [TRANSCRIBE] File MIME type:', req.file.mimetype || 'unknown');
    console.log('🎥 [TRANSCRIBE] File size:', req.file.size, 'bytes');

    // Log file details
    if (VIDEO_STORAGE_TYPE === 's3') {
      console.log('🎥 [TRANSCRIBE] S3 File details:');
      console.log('   - Location:', req.file.location);
      console.log('   - Key:', req.file.key);
      console.log('   - Bucket:', req.file.bucket);
      console.log('   - Size:', req.file.size);
    } else {
      console.log('🎥 [TRANSCRIBE] Local file details:');
      console.log('   - Path:', req.file.path);
      console.log('   - Size:', req.file.size);
    }

    let filePathToTranscribe;
    
    // Si es S3, descargar el archivo temporalmente desde la URL pública
    if (VIDEO_STORAGE_TYPE === 's3' && req.file.location) {
      console.log('🎥 [TRANSCRIBE] Downloading from S3 to temp location...');
      // En entornos serverless (Vercel), usar /tmp que es el único directorio escribible
      // En desarrollo local, usar la carpeta uploads/videos
      const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
      const tempDir = isServerless ? '/tmp' : path.join(__dirname, '../uploads/videos');
      
      // Crear el directorio si no existe (solo en local, /tmp siempre existe en serverless)
      if (!isServerless && !fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      tempFilePath = path.join(tempDir, `temp_${Date.now()}_${path.basename(req.file.key || 'video.webm')}`);
      console.log('🎥 [TRANSCRIBE] Temp file path:', tempFilePath);
      
      // Download from S3 with timeout and retry logic
      let downloadSuccess = false;
      let downloadAttempts = 0;
      const maxDownloadAttempts = 3;
      
      while (!downloadSuccess && downloadAttempts < maxDownloadAttempts) {
        try {
          downloadAttempts++;
          console.log(`🎥 [TRANSCRIBE] Download attempt ${downloadAttempts}/${maxDownloadAttempts}`);
          
          const response = await axios({
            method: 'GET',
            url: req.file.location,
            responseType: 'stream',
            timeout: 30000, // 30 seconds timeout for download
          });
          
          const writeStream = fs.createWriteStream(tempFilePath);
          
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              writeStream.destroy();
              reject(new Error('Download timeout'));
            }, 30000);
            
            response.data.pipe(writeStream);
            response.data.on('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
            writeStream.on('finish', () => {
              clearTimeout(timeout);
              resolve();
            });
            writeStream.on('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });
          
          downloadSuccess = true;
          console.log('✅ [TRANSCRIBE] File downloaded successfully');
        } catch (downloadError) {
          console.error(`❌ [TRANSCRIBE] Download attempt ${downloadAttempts} failed:`, downloadError.message);
          if (downloadAttempts >= maxDownloadAttempts) {
            throw new Error(`Failed to download video from S3 after ${maxDownloadAttempts} attempts: ${downloadError.message}`);
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * downloadAttempts));
        }
      }
      
      filePathToTranscribe = tempFilePath;
    } else {
      // Para almacenamiento local, usar el path directamente
      console.log('🎥 [TRANSCRIBE] Using local file path');
      filePathToTranscribe = req.file.path;
    }

    // Transcribe using Whisper
    console.log('🎥 [TRANSCRIBE] Starting transcription...');
    console.log('🎥 [TRANSCRIBE] File path:', filePathToTranscribe);
    
    let transcription;
    try {
      transcription = await transcribeVideoAudio(filePathToTranscribe);
      console.log('✅ [TRANSCRIBE] Transcription completed:', transcription ? `${transcription.length} characters` : 'empty');
    } catch (transcriptionError) {
      console.error('❌ [TRANSCRIBE] Transcription error:', transcriptionError.message);
      throw transcriptionError;
    }
    
    if (!transcription || transcription.trim().length === 0) {
      console.warn('⚠️ [TRANSCRIBE] Empty transcription result');
      // Return empty string instead of error - let user type manually
      transcription = '';
    }

    // Delete temporary file after transcription (only local temp, NOT S3 file)
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️  [TRANSCRIBE] Temp file deleted');
      } catch (err) {
        console.error("❌ [TRANSCRIBE] Error deleting temp file:", err);
      }
    } else if (req.file.path && VIDEO_STORAGE_TYPE === 'local') {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️  [TRANSCRIBE] Local file deleted');
      } catch (err) {
        console.error("❌ [TRANSCRIBE] Error deleting local file:", err);
      }
    }

    return res.json({ transcription });
  } catch (error) {
    console.error("❌ [TRANSCRIBE] Error transcribing video:", error);
    console.error("❌ [TRANSCRIBE] Error stack:", error.stack);
    
    // Try to delete temp file even on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️  [TRANSCRIBE] Temp file deleted after error');
      } catch (err) {
        console.error("❌ [TRANSCRIBE] Error deleting temp file:", err);
      }
    } else if (req.file && req.file.path && VIDEO_STORAGE_TYPE === 'local') {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️  [TRANSCRIBE] Local file deleted after error');
      } catch (err) {
        console.error("❌ [TRANSCRIBE] Error deleting temp file:", err);
      }
    }
    
    // Return more specific error messages
    let errorMessage = "Error transcribing audio";
    let statusCode = 500;
    
    if (error.message.includes('format') || error.message.includes('codec')) {
      errorMessage = "Video format not supported. Please try recording again with a different browser or device.";
      statusCode = 400;
    } else if (error.message.includes('timeout')) {
      errorMessage = "Transcription timeout. The video may be too long. Please try a shorter recording.";
      statusCode = 408;
    } else if (error.message.includes('too small') || error.message.includes('no audio')) {
      errorMessage = "The video appears to have no audio. Please ensure your microphone is working and try again.";
      statusCode = 400;
    } else if (error.message.includes('not found')) {
      errorMessage = "Video file not found. Please try recording again.";
      statusCode = 404;
    }
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Envío de respuestas de entrevista
router.post("/submit-interview", authMiddleware, videoUpload.any(), async (req, res) => {
  try {
    console.log('📝 [SUBMIT INTERVIEW] Interview submission received');
    console.log('📝 [SUBMIT INTERVIEW] Storage type:', VIDEO_STORAGE_TYPE);
    console.log('📝 [SUBMIT INTERVIEW] Files received:', req.files ? req.files.length : 0);
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { answers } = req.body;
    // Find the main video file (for final video question)
    // When using .any(), files are in req.files array
    const videoFile = req.files?.find(f => f.fieldname === 'video') || null;
    
    console.log('📝 [SUBMIT INTERVIEW] Video file found:', videoFile ? 'Yes' : 'No');
    if (videoFile) {
      if (VIDEO_STORAGE_TYPE === 's3') {
        console.log('📝 [SUBMIT INTERVIEW] S3 Video details:');
        console.log('   - Location:', videoFile.location);
        console.log('   - Key:', videoFile.key);
        console.log('   - Bucket:', videoFile.bucket);
        console.log('   - Size:', videoFile.size);
      } else {
        console.log('📝 [SUBMIT INTERVIEW] Local video details:');
        console.log('   - Path:', videoFile.path);
        console.log('   - Size:', videoFile.size);
      }
    }

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

    console.log('📝 [SUBMIT INTERVIEW] Total questions:', allQuestions.length);
    console.log('📝 [SUBMIT INTERVIEW] Total answers:', textAnswers.length);
    console.log('📝 [SUBMIT INTERVIEW] Has video:', hasVideo);
    console.log('📝 [SUBMIT INTERVIEW] Generated questions count:', generatedQuestions.length);
    console.log('📝 [SUBMIT INTERVIEW] Default questions count:', defaultQuestions.length);

    // Validate that we have the correct number of answers
    if (textAnswers.length !== allQuestions.length) {
      console.error('❌ [SUBMIT INTERVIEW] Mismatch detected:');
      console.error('   - Expected answers:', allQuestions.length);
      console.error('   - Received answers:', textAnswers.length);
      console.error('   - Generated questions:', generatedQuestions.length);
      console.error('   - Default questions:', defaultQuestions.length);
      return res.status(400).json({ 
        message: `Number of answers (${textAnswers.length}) does not match the number of questions (${allQuestions.length}). Please make sure all ${allQuestions.length} text questions are answered.` 
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
        console.log('✅ [SUBMIT INTERVIEW] Video saved to S3:', videoPath);
      } else {
        // Para almacenamiento local, crear una URL relativa
        videoPath = `/api/users/uploads/videos/${path.basename(videoFile.path)}`;
        console.log('✅ [SUBMIT INTERVIEW] Video saved locally:', videoPath);
      }
      user.interviewVideo = videoPath;
    } else {
      console.log('⚠️  [SUBMIT INTERVIEW] No video file provided');
    }
    user.interviewScore = total_score;
    user.interviewAnalysis = evaluations;
    user.interviewCompleted = true;

    await user.save();
    console.log('✅ [SUBMIT INTERVIEW] Interview saved successfully');

    return res.json({
      message: "Interview evaluated and stored successfully",
      total_score,
      evaluations,
    });
  } catch (error) {
    console.error("❌ [SUBMIT INTERVIEW] Error processing interview:", error);
    console.error("❌ [SUBMIT INTERVIEW] Error stack:", error.stack);
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

// Subir foto de perfil
router.post("/upload-photo", authMiddleware, photoUpload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Si ya existe una foto, borrar la anterior (solo para almacenamiento local)
    if (user.profilePhoto && PHOTO_STORAGE_TYPE === 'local') {
      try {
        const fileName = path.basename(user.profilePhoto);
        const filePath = path.join(__dirname, '../uploads/photos', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error("Error deleting old photo file:", err);
      }
    }

    // Determinar la ruta del archivo según el tipo de almacenamiento
    let filePath;
    if (PHOTO_STORAGE_TYPE === 's3') {
      // Para S3, usar la URL del archivo
      filePath = req.file.location;
    } else {
      // Para almacenamiento local, crear una URL relativa
      const fileName = path.basename(req.file.path);
      filePath = `/api/users/uploads/photos/${fileName}`;
    }

    user.profilePhoto = filePath;
    await user.save();

    return res.status(200).json({
      message: "Photo uploaded successfully",
      profilePhoto: filePath
    });
  } catch (error) {
    console.error("Error uploading photo:", error);
    return res.status(500).json({ message: "Error uploading photo" });
  }
});

export default router;

