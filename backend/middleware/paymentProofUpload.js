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

const STORAGE_TYPE = process.env.STORAGE_TYPE || "local";

const uploadsDir = path.join(__dirname, "../uploads/payment-proofs");
if (STORAGE_TYPE === "local") {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

let paymentProofUpload;

if (STORAGE_TYPE === "s3" && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  paymentProofUpload = multer({
    storage: multerS3({
      s3: s3Client,
      bucket: process.env.AWS_BUCKET_NAME,
      acl: "public-read",
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        const userId = req.userId || "unknown";
        const fileName = `payment-proofs/${userId}_${Date.now()}_${file.originalname}`;
        cb(null, fileName);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error("Only PDF files are allowed"), false);
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });
} else {
  paymentProofUpload = multer({
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, uploadsDir);
      },
      filename: function (req, file, cb) {
        const userId = req.userId || "unknown";
        const safeName = (file.originalname || "proof").replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `${userId}_${Date.now()}_${safeName}`;
        cb(null, fileName);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error("Only PDF files are allowed"), false);
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });
}

export default paymentProofUpload;
