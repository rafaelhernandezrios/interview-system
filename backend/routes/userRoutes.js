import express from "express";
import User from "../models/User.js";
import Application from "../models/Application.js";
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
import { sendCompletionNotificationToAdmins } from "../config/email.js";
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
    let transcription;
    try {
      transcription = await transcribeVideoAudio(filePathToTranscribe);
    } catch (transcriptionError) {
      throw transcriptionError;
    }
    
    if (!transcription || transcription.trim().length === 0) {
      transcription = '';
    }

    // Delete temporary file after transcription
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        // Error deleting temp file (silent)
      }
    } else if (req.file && req.file.path && VIDEO_STORAGE_TYPE === 'local') {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        // Error deleting local file (silent)
      }
    }

    return res.json({ transcription });
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        // Error deleting temp file (silent)
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

    res.json({
      uploadUrl: presignedUrl,
      s3Key: s3Key,
      publicUrl: publicUrl,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
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
    // Check if we have an S3 URL (direct upload) or a file upload
    if (req.body.s3Url) {
      // Direct S3 upload - use the URL directly
      s3Url = req.body.s3Url;
      
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
      
      // Download from S3 with timeout and retry logic
      let downloadSuccess = false;
      let downloadAttempts = 0;
      const maxDownloadAttempts = 3;
      
      while (!downloadSuccess && downloadAttempts < maxDownloadAttempts) {
        try {
          downloadAttempts++;
          
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
          filePathToTranscribe = tempFilePath;
        } catch (downloadError) {
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
            return res.status(400).json({ message: err.message || "Error uploading file" });
          }
          
          if (!req.file) {
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
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        return res.status(400).json({ message: "Video file is too small. Please ensure the recording contains audio." });
      }
      
      if (stats.size > 50 * 1024 * 1024) {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        return res.status(400).json({ message: "Video file is too large. Maximum size is 50MB." });
      }
    } else {
      // Traditional file upload path - handle with multer
      return new Promise((resolve, reject) => {
        videoUpload.single('video')(req, res, async (err) => {
          if (err) {
            return res.status(400).json({ message: err.message || "Error uploading file" });
          }
          
          if (!req.file) {
            return res.status(400).json({ message: "No video file provided. Either upload a file or provide an s3Url." });
          }
          
          // Validate file size
          if (req.file.size < 1024) {
            return res.status(400).json({ message: "Video file is too small. Please ensure the recording contains audio." });
          }
          
          if (req.file.size > 50 * 1024 * 1024) {
            return res.status(400).json({ message: "Video file is too large. Maximum size is 50MB." });
          }
          
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
    // Try to delete temp file even on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        // Error deleting temp file (silent)
      }
    } else if (req.file && req.file.path && VIDEO_STORAGE_TYPE === 'local') {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        // Error deleting local file (silent)
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
// Acepta tanto archivos subidos tradicionalmente como URLs de S3
router.post("/submit-interview", authMiddleware, async (req, res) => {
  let videoFile = null;
  let s3VideoUrl = null;
  
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { answers, s3VideoUrl: bodyS3VideoUrl, videoTranscription } = req.body;
    
    // Check if we have an S3 URL (direct upload) or need to process file upload
    if (bodyS3VideoUrl) {
      // Video was uploaded directly to S3
      s3VideoUrl = bodyS3VideoUrl;
    } else {
      // Traditional file upload - use multer middleware
      return new Promise((resolve, reject) => {
        videoUpload.any()(req, res, async (err) => {
          if (err) {
            return res.status(400).json({ message: err.message || "Error uploading file" });
          }
          
          // Find the main video file (for final video question)
          videoFile = req.files?.find(f => f.fieldname === 'video') || null;
          
          try {
            await processSubmitInterview(req, res, videoFile, null, req.body.videoTranscription);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    
    // Process with S3 URL
    await processSubmitInterview(req, res, null, s3VideoUrl, videoTranscription);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
});

// Helper function to process interview submission
async function processSubmitInterview(req, res, videoFile, s3VideoUrl, videoTranscription = null) {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { answers } = req.body;

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
      "What is your motivation for applying to this program and joining Mirai Innovation Research Institute?",
      "What is your plan to finance your tuition, travel expenses, and accommodation during your stay in Japan?"
    ];

    const generatedQuestions = user.questions || [];
    const allQuestions = [...generatedQuestions, ...defaultQuestions];
    
    // Separate text answers from video
    const textAnswers = videoFile ? parsedAnswers : parsedAnswers;

    // Validate that we have the correct number of answers
    if (textAnswers.length !== allQuestions.length) {
      return res.status(400).json({ 
        message: `Number of answers (${textAnswers.length}) does not match the number of questions (${allQuestions.length}). Please make sure all ${allQuestions.length} text questions are answered.` 
      });
    }

    // Evaluate text answers only (not the video)
    const { total_score, evaluations } = await calculateScoreBasedOnAnswers(allQuestions, textAnswers);

    user.interviewResponses = textAnswers;
    
    // Handle video - either from file upload or S3 URL
    if (s3VideoUrl) {
      // Video was uploaded directly to S3
      user.interviewVideo = s3VideoUrl;
      // Save video transcription if provided
      if (videoTranscription) {
        user.interviewVideoTranscription = videoTranscription;
      }
    } else if (videoFile) {
      // Video was uploaded traditionally
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

    // Update Application model - Mark Step 2 as completed
    try {
      await Application.findOneAndUpdate(
        { userId: req.userId },
        {
          step2Completed: true,
          currentStep: 3, // Move to next step
        },
        { upsert: false } // Don't create if doesn't exist (Step 1 must be completed first)
      );
    } catch (appError) {
      // Log error but don't fail the request
      console.error('Error updating application status:', appError);
    }

    // Check if both CV and Interview are completed, then notify admins
    if (user.cvAnalyzed && user.interviewCompleted) {
      try {
        // Get all admin users
        const admins = await User.find({ role: 'admin' });
        
        // Send notification email to each admin
        for (const admin of admins) {
          if (admin.email) {
            await sendCompletionNotificationToAdmins(
              admin.email,
              user.name,
              user.email,
              user.digitalId,
              user.program
            );
          }
        }
      } catch (emailError) {
        // Log error but don't fail the request
        console.error('Error sending completion notification to admins:', emailError);
      }
    }

    return res.json({
      message: "Interview evaluated and stored successfully",
      total_score,
      evaluations,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Guardar progreso de entrevista automáticamente
router.post("/save-interview-progress", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { answers, currentQuestionIndex, s3VideoUrl, videoTranscription } = req.body;

    // Don't save if interview is already completed
    if (user.interviewCompleted) {
      return res.json({ message: "Interview already completed" });
    }

    // Save answers temporarily (don't mark as completed)
    user.interviewResponses = answers || [];
    
    // Save video if provided (for presentation video)
    if (s3VideoUrl) {
      user.interviewVideo = s3VideoUrl;
      if (videoTranscription) {
        user.interviewVideoTranscription = videoTranscription;
      }
    }
    
    await user.save();

    return res.json({ 
      message: "Progress saved successfully",
      currentQuestionIndex: currentQuestionIndex || 0
    });
  } catch (error) {
    return res.status(500).json({ message: "Error saving progress" });
  }
});

// Text-to-Speech using Eleven Labs
router.post("/text-to-speech", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ message: "Text is required" });
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel

    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ 
        message: "Eleven Labs API key not configured",
        error: "ELEVENLABS_API_KEY environment variable is missing"
      });
    }

    // Call Eleven Labs API
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text: text,
        model_id: "eleven_multilingual_v2", // Multilingual model for better quality
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        responseType: 'arraybuffer' // Get audio as binary data
      }
    );

    // Convert arraybuffer to base64 for sending to frontend
    const audioBuffer = Buffer.from(response.data);
    const base64Audio = audioBuffer.toString('base64');

    res.json({
      audio: base64Audio,
      mimeType: 'audio/mpeg'
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Error generating speech",
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null
    });
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
      "What is your motivation for applying to this program and joining Mirai Innovation Research Institute?",
      "What is your plan to finance your tuition, travel expenses, and accommodation during your stay in Japan?"
    ];

    const allQuestions = [...(user.questions || []), ...defaultQuestions];

    // Si el usuario no es admin, no devolver el score ni los scores individuales en el análisis
    const responseData = {
      questions: allQuestions,
      responses: user.interviewResponses || [],
      video: user.interviewVideo || null,
      videoTranscription: user.interviewVideoTranscription || null,
      analysis: user.interviewAnalysis || []
    };

    // Solo incluir el score si el usuario es admin
    if (user.role === 'admin') {
      responseData.score = user.interviewScore || 0;
    }

    // Si no es admin, remover los scores del análisis
    if (user.role !== 'admin' && Array.isArray(responseData.analysis)) {
      responseData.analysis = responseData.analysis.map(item => {
        if (typeof item === 'object' && item !== null) {
          const { score, ...rest } = item;
          return rest;
        }
        return item;
      });
    }

    res.json(responseData);
  } catch (error) {
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

    // Si el usuario no es admin, no devolver los scores
    const userData = user.toObject();
    if (user.role !== 'admin') {
      delete userData.score;
      delete userData.interviewScore;
    }

    res.json(userData);
  } catch (error) {
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
    return res.status(500).json({ message: "Error uploading photo" });
  }
});

export default router;

