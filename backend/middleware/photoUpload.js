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

// Crear carpeta de uploads de fotos solo si se usa almacenamiento local
const photosDir = path.join(__dirname, '../uploads/photos');
if (STORAGE_TYPE === 'local') {
  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }
}

let photoUpload;

if (STORAGE_TYPE === 's3' && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  // Configuración para AWS S3
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  photoUpload = multer({
    storage: multerS3({
      s3: s3Client,
      bucket: process.env.AWS_BUCKET_NAME,
      acl: 'public-read',
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        // Guardar en la carpeta photos/ del bucket
        const fileName = `photos/profile_${Date.now()}_${req.userId || 'unknown'}.${file.mimetype.split('/')[1]}`;
        cb(null, fileName);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"), false);
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });
} else {
  // Configuración para almacenamiento local
  photoUpload = multer({
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, photosDir);
      },
      filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const fileName = `profile_${Date.now()}_${req.userId || 'unknown'}${ext}`;
        cb(null, fileName);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"), false);
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });
}

export default photoUpload;
export { STORAGE_TYPE };

