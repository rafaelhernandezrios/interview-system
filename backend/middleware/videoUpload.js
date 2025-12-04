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

// Crear carpeta de videos si no existe (para almacenamiento local)
const videosDir = path.join(__dirname, '../uploads/videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
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
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        // Guardar en la carpeta videos/ del bucket
        const fileName = `videos/interview_${Date.now()}_${req.userId || 'unknown'}.webm`;
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

