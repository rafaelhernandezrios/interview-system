import { S3Client } from "@aws-sdk/client-s3";
import multerS3 from "multer-s3";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración: 'local' o 's3'
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';

// Crear carpeta de videos solo si se usa almacenamiento local
const videosDir = path.join(__dirname, '../uploads/videos');
if (STORAGE_TYPE === 'local') {
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }
}

let videoUpload;

if (STORAGE_TYPE === 's3' && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  // Configuración para AWS S3
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  videoUpload = multer({
    storage: multerS3({
      s3: s3Client,
      bucket: process.env.AWS_BUCKET_NAME,
      acl: 'public-read',
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        // Determine file extension based on MIME type
        let extension = 'webm'; // default
        if (file.mimetype.includes('mp4')) {
          extension = 'mp4';
        } else if (file.mimetype.includes('quicktime') || file.mimetype.includes('mov')) {
          extension = 'mov';
        } else if (file.mimetype.includes('x-msvideo') || file.mimetype.includes('avi')) {
          extension = 'avi';
        } else if (file.mimetype.includes('webm')) {
          extension = 'webm';
        }
        
        // Guardar en la carpeta videos/ del bucket
        const fileName = `videos/interview_${Date.now()}_${req.userId || 'unknown'}.${extension}`;
        cb(null, fileName);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
    fileFilter: (req, file, cb) => {
      
      // Aceptar videos en formatos comunes (WebM, MP4, QuickTime, etc.)
      const allowedMimeTypes = [
        'video/webm',
        'video/mp4',
        'video/quicktime', // MOV files
        'video/x-msvideo', // AVI files
        'application/octet-stream' // Fallback for unknown types
      ];
      
      // Check if it's a video MIME type
      const isVideoMimeType = file.mimetype.startsWith('video/');
      
      // Check if it's in allowed list
      const isInAllowedList = allowedMimeTypes.includes(file.mimetype);
      
      // Check file extension as fallback (some browsers send wrong MIME type)
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      const videoExtensions = ['webm', 'mp4', 'mov', 'avi', 'mkv', 'm4v'];
      const hasVideoExtension = videoExtensions.includes(fileExtension || '');
      
      // Special case: if MIME type is text/plain but extension is video, accept it
      // This happens when browsers incorrectly detect MIME type
      const isMisdetectedVideo = file.mimetype === 'text/plain' && hasVideoExtension;
      
      const isValidVideo = isVideoMimeType || 
                           isInAllowedList || 
                           isMisdetectedVideo ||
                           file.mimetype === 'application/octet-stream';
      
      if (isValidVideo) {
        cb(null, true);
      } else {
        cb(new Error(`Only video files are allowed. Received: ${file.mimetype} (extension: ${fileExtension})`), false);
      }
    },
    limits: { fileSize: 150 * 1024 * 1024 }, // 150MB limit for videos when using S3
  });
  
  // Add logging after upload
  const originalSingle = videoUpload.single.bind(videoUpload);
  const originalAny = videoUpload.any.bind(videoUpload);
  
  videoUpload.single = function(fieldname) {
    const middleware = originalSingle(fieldname);
    return (req, res, next) => {
      middleware(req, res, (err) => {
        if (err) {
          return next(err);
        }
        if (req.file) {
        }
        next();
      });
    };
  };
  
  videoUpload.any = function() {
    const middleware = originalAny();
    return (req, res, next) => {
      middleware(req, res, (err) => {
        if (err) {
          return next(err);
        }
        if (req.files && req.files.length > 0) {
        }
        next();
      });
    };
  };
} else {
  // Configuración para almacenamiento local
  if (STORAGE_TYPE === 's3') {
  }
  videoUpload = multer({
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, videosDir);
      },
      filename: function (req, file, cb) {
        // Determine file extension based on MIME type
        let extension = 'webm'; // default
        if (file.mimetype.includes('mp4')) {
          extension = 'mp4';
        } else if (file.mimetype.includes('quicktime') || file.mimetype.includes('mov')) {
          extension = 'mov';
        } else if (file.mimetype.includes('x-msvideo') || file.mimetype.includes('avi')) {
          extension = 'avi';
        } else if (file.mimetype.includes('webm')) {
          extension = 'webm';
        }
        
        const fileName = `interview_${Date.now()}_${req.userId || 'unknown'}.${extension}`;
        cb(null, fileName);
      },
    }),
    fileFilter: (req, file, cb) => {
      // Aceptar videos en formatos comunes (WebM, MP4, QuickTime, etc.)
      const allowedMimeTypes = [
        'video/webm',
        'video/mp4',
        'video/quicktime', // MOV files
        'video/x-msvideo', // AVI files
        'application/octet-stream' // Fallback for unknown types
      ];
      
      const isValidVideo = file.mimetype.startsWith('video/') || 
                           allowedMimeTypes.includes(file.mimetype) ||
                           file.mimetype === 'application/octet-stream';
      
      if (isValidVideo) {
        cb(null, true);
      } else {
        cb(new Error(`Only video files are allowed. Received: ${file.mimetype}`), false);
      }
    },
    limits: { fileSize: 150 * 1024 * 1024 }, // 150MB limit for videos when using S3
  });
}

export default videoUpload;
export { STORAGE_TYPE };

