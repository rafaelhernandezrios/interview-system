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
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

dotenv.config();

// Definir __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper function to transcribe and respond
async function transcribeAndRespond(filePathToTranscribe, tempFilePath, req, res) {
  try {
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
      transcription = '';
    }

    // Delete temporary file after transcription
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️  [TRANSCRIBE] Temp file deleted');
      } catch (err) {
        console.error("❌ [TRANSCRIBE] Error deleting temp file:", err);
      }
    } else if (req.file && req.file.path && VIDEO_STORAGE_TYPE === 'local') {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️  [TRANSCRIBE] Local file deleted');
      } catch (err) {
        console.error("❌ [TRANSCRIBE] Error deleting local file:", err);
      }
    }

    return res.json({ transcription });
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error("❌ [TRANSCRIBE] Error deleting temp file:", err);
      }
    }
    throw error;
  }
}

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

// Get presigned URL for direct S3 upload
router.post("/get-upload-url", authMiddleware, async (req, res) => {
  try {
    // Only allow if using S3 storage
    if (VIDEO_STORAGE_TYPE !== 's3') {
      return res.status(400).json({ 
        error: 'Direct upload not available',
        message: 'Direct S3 upload is only available when using S3 storage. Please use the regular upload endpoint.'
      });
    }

    const { fileName, contentType } = req.body;
    
    if (!fileName || !contentType) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'fileName and contentType are required'
      });
    }

    // Validate content type is a video
    if (!contentType.startsWith('video/')) {
      return res.status(400).json({ 
        error: 'Invalid content type',
        message: 'Only video files are allowed'
      });
    }

    // Determine file extension
    let extension = 'webm';
    if (contentType.includes('mp4')) {
      extension = 'mp4';
    } else if (contentType.includes('quicktime') || contentType.includes('mov')) {
      extension = 'mov';
    } else if (contentType.includes('webm')) {
      extension = 'webm';
    }

    // Generate S3 key
    const s3Key = `videos/interview_${Date.now()}_${req.userId || 'unknown'}.${extension}`;

    // Create S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
      ACL: 'public-read', // Make the file publicly readable
    });

    // Generate presigned URL (valid for 15 minutes)
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    // Generate the public URL where the file will be accessible
    const publicUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    console.log('✅ [PRESIGNED URL] Generated:', {
      s3Key,
      contentType,
      expiresIn: '15 minutes'
    });

    res.json({
      uploadUrl: presignedUrl,
      s3Key: s3Key,
      publicUrl: publicUrl,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
    console.error('❌ [PRESIGNED URL] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate upload URL',
      message: error.message 
    });
  }
});

// Transcribe video audio using Whisper
// Now supports both direct file upload and S3 URL
router.post("/transcribe-video", authMiddleware, async (req, res) => {
  let tempFilePath = null;
  let filePathToTranscribe = null;
  let s3Url = null;
  
  try {
    console.log('🎥 [TRANSCRIBE] Video transcription request received');
    console.log('🎥 [TRANSCRIBE] Storage type:', VIDEO_STORAGE_TYPE);
    console.log('🎥 [TRANSCRIBE] Request body keys:', Object.keys(req.body));
    console.log('🎥 [TRANSCRIBE] Request has file:', !!req.file);
    console.log('🎥 [TRANSCRIBE] Request has s3Url:', !!req.body.s3Url);
    
    // Check if we have an S3 URL (direct upload) or a file upload
    if (req.body.s3Url) {
      // Direct S3 upload - use the URL directly
      s3Url = req.body.s3Url;
      console.log('🎥 [TRANSCRIBE] Using S3 URL for transcription:', s3Url);
      
      if (!s3Url.startsWith('http://') && !s3Url.startsWith('https://')) {
        return res.status(400).json({ message: "Invalid S3 URL provided" });
      }
      
      // Download from S3 URL
      const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
      const tempDir = isServerless ? '/tmp' : path.join(__dirname, '../uploads/videos');
      
      if (!isServerless && !fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      tempFilePath = path.join(tempDir, `temp_${Date.now()}_transcribe.webm`);
      console.log('🎥 [TRANSCRIBE] Downloading from S3 URL to temp location:', tempFilePath);
      
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
            url: s3Url,
            responseType: 'stream',
            timeout: 60000, // 60 seconds timeout for download
          });
          
          const writeStream = fs.createWriteStream(tempFilePath);
          
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              writeStream.destroy();
              reject(new Error('Download timeout'));
            }, 60000);
            
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
          console.log('✅ [TRANSCRIBE] File downloaded successfully from S3');
          filePathToTranscribe = tempFilePath;
        } catch (downloadError) {
          console.error(`❌ [TRANSCRIBE] Download attempt ${downloadAttempts} failed:`, downloadError.message);
          if (downloadAttempts >= maxDownloadAttempts) {
            throw new Error(`Failed to download video from S3 after ${maxDownloadAttempts} attempts: ${downloadError.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * downloadAttempts));
        }
      }
    } else {
      // Traditional file upload - use multer middleware
      // We need to handle this with multer, but conditionally
      return new Promise((resolve, reject) => {
        videoUpload.single('video')(req, res, async (err) => {
          if (err) {
            console.error('❌ [TRANSCRIBE] Multer error:', err);
            return res.status(400).json({ message: err.message || "Error uploading file" });
          }
          
          if (!req.file) {
            console.error('❌ [TRANSCRIBE] No video file provided');
            return res.status(400).json({ message: "No video file provided. Either upload a file or provide an s3Url." });
          }
          
          try {
            // Continue with existing file upload logic
            await processFileUpload(req, res, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    
    // If we have a file path to transcribe (from S3 URL), continue with transcription
    if (filePathToTranscribe) {
      // Validate file exists and has reasonable size
      const stats = fs.statSync(filePathToTranscribe);
      if (stats.size < 1024) {
        console.error('❌ [TRANSCRIBE] File too small:', stats.size);
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        return res.status(400).json({ message: "Video file is too small. Please ensure the recording contains audio." });
      }
      
      if (stats.size > 50 * 1024 * 1024) {
        console.error('❌ [TRANSCRIBE] File too large:', stats.size);
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        return res.status(400).json({ message: "Video file is too large. Maximum size is 50MB." });
      }
      
      console.log('🎥 [TRANSCRIBE] File size:', stats.size, 'bytes');
    } else {
      // Traditional file upload path - handle with multer
      return new Promise((resolve, reject) => {
        videoUpload.single('video')(req, res, async (err) => {
          if (err) {
            console.error('❌ [TRANSCRIBE] Multer error:', err);
            return res.status(400).json({ message: err.message || "Error uploading file" });
          }
          
          if (!req.file) {
            console.error('❌ [TRANSCRIBE] No video file provided');
            return res.status(400).json({ message: "No video file provided. Either upload a file or provide an s3Url." });
          }
          
          // Validate file size
          if (req.file.size < 1024) {
            console.error('❌ [TRANSCRIBE] File too small:', req.file.size);
            return res.status(400).json({ message: "Video file is too small. Please ensure the recording contains audio." });
          }
          
          if (req.file.size > 50 * 1024 * 1024) {
            console.error('❌ [TRANSCRIBE] File too large:', req.file.size);
            return res.status(400).json({ message: "Video file is too large. Maximum size is 50MB." });
          }
          
          console.log('🎥 [TRANSCRIBE] File MIME type:', req.file.mimetype || 'unknown');
          console.log('🎥 [TRANSCRIBE] File size:', req.file.size, 'bytes');
          
          // Determine file path based on storage type
          if (VIDEO_STORAGE_TYPE === 's3' && req.file.location) {
            // Download from S3
            const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
            const tempDir = isServerless ? '/tmp' : path.join(__dirname, '../uploads/videos');
            
            if (!isServerless && !fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }
            
            tempFilePath = path.join(tempDir, `temp_${Date.now()}_${path.basename(req.file.key || 'video.webm')}`);
            
            let downloadSuccess = false;
            let downloadAttempts = 0;
            const maxDownloadAttempts = 3;
            
            while (!downloadSuccess && downloadAttempts < maxDownloadAttempts) {
              try {
                downloadAttempts++;
                const response = await axios({
                  method: 'GET',
                  url: req.file.location,
                  responseType: 'stream',
                  timeout: 60000,
                });
                
                const writeStream = fs.createWriteStream(tempFilePath);
                await new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => {
                    writeStream.destroy();
                    reject(new Error('Download timeout'));
                  }, 60000);
                  
                  response.data.pipe(writeStream);
                  response.data.on('error', reject);
                  writeStream.on('finish', () => {
                    clearTimeout(timeout);
                    resolve();
                  });
                  writeStream.on('error', reject);
                });
                
                downloadSuccess = true;
                filePathToTranscribe = tempFilePath;
              } catch (downloadError) {
                if (downloadAttempts >= maxDownloadAttempts) {
                  return res.status(500).json({ message: `Failed to download video: ${downloadError.message}` });
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * downloadAttempts));
              }
            }
          } else {
            filePathToTranscribe = req.file.path;
          }
          
          // Continue with transcription
          try {
            await transcribeAndRespond(filePathToTranscribe, tempFilePath, req, res);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
      return; // Exit early, multer will handle the response
    }

    // Transcribe using the file path we have
    await transcribeAndRespond(filePathToTranscribe, tempFilePath, req, res);
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

