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
  console.log('✅ Using AWS S3 for video storage');
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
        console.log('📤 [VIDEO UPLOAD] File metadata:', {
          fieldName: file.fieldname,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        });
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        // Guardar en la carpeta videos/ del bucket
        const fileName = `videos/interview_${Date.now()}_${req.userId || 'unknown'}.webm`;
        console.log('📤 [VIDEO UPLOAD] S3 key:', fileName);
        console.log('📤 [VIDEO UPLOAD] User ID:', req.userId);
        cb(null, fileName);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
    fileFilter: (req, file, cb) => {
      console.log('📤 [VIDEO UPLOAD] File filter check:', {
        mimetype: file.mimetype,
        originalName: file.originalname
      });
      // Aceptar videos webm y otros formatos comunes
      if (file.mimetype.startsWith('video/') || file.mimetype === 'application/octet-stream') {
        console.log('✅ [VIDEO UPLOAD] File accepted');
        cb(null, true);
      } else {
        console.log('❌ [VIDEO UPLOAD] File rejected - invalid mimetype');
        cb(new Error("Only video files are allowed"), false);
      }
    },
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
  });
  
  // Add logging after upload
  const originalSingle = videoUpload.single.bind(videoUpload);
  const originalAny = videoUpload.any.bind(videoUpload);
  
  videoUpload.single = function(fieldname) {
    const middleware = originalSingle(fieldname);
    return (req, res, next) => {
      middleware(req, res, (err) => {
        if (err) {
          console.error('❌ [VIDEO UPLOAD] Upload error:', err);
          return next(err);
        }
        if (req.file) {
          console.log('✅ [VIDEO UPLOAD] File uploaded successfully:');
          console.log('   - Location:', req.file.location);
          console.log('   - Key:', req.file.key);
          console.log('   - Bucket:', req.file.bucket);
          console.log('   - Size:', req.file.size);
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
          console.error('❌ [VIDEO UPLOAD] Upload error:', err);
          return next(err);
        }
        if (req.files && req.files.length > 0) {
          console.log(`✅ [VIDEO UPLOAD] ${req.files.length} file(s) uploaded successfully:`);
          req.files.forEach((file, index) => {
            console.log(`   File ${index + 1}:`);
            console.log('   - Fieldname:', file.fieldname);
            console.log('   - Location:', file.location);
            console.log('   - Key:', file.key);
            console.log('   - Bucket:', file.bucket);
            console.log('   - Size:', file.size);
          });
        }
        next();
      });
    };
  };
} else {
  // Configuración para almacenamiento local
  if (STORAGE_TYPE === 's3') {
    console.log('⚠️  Using LOCAL storage for videos (not S3)');
    console.log('   Reason: Missing AWS credentials or configuration');
  }
  videoUpload = multer({
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, videosDir);
      },
      filename: function (req, file, cb) {
        const fileName = `interview_${Date.now()}_${req.userId || 'unknown'}.webm`;
        cb(null, fileName);
      },
    }),
    fileFilter: (req, file, cb) => {
      // Aceptar videos webm y otros formatos comunes
      if (file.mimetype.startsWith('video/') || file.mimetype === 'application/octet-stream') {
        cb(null, true);
      } else {
        cb(new Error("Only video files are allowed"), false);
      }
    },
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
  });
}

export default videoUpload;
export { STORAGE_TYPE };

