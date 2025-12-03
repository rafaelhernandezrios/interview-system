import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear carpeta de videos si no existe
const videosDir = path.join(__dirname, '../uploads/videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

// Configuración para almacenamiento local de videos
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, videosDir);
    },
    filename: function (req, file, cb) {
      const fileName = `interview_${Date.now()}_${req.userId}.webm`;
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

export default videoUpload;

