import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import connectDB from "./config/db.js";
import { authRoutes } from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
// Increase body size limit to 50MB for video uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
let allowedOrigins = [];

if (process.env.CORS_ORIGINS) {
  allowedOrigins = process.env.CORS_ORIGINS.split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
    .map(origin => origin.replace(/\/$/, '')); // Remover barra final si existe
} else {
  allowedOrigins = ['http://localhost:3000'];
}

// En desarrollo, permitir localhost
if (process.env.NODE_ENV !== 'production') {
  if (!allowedOrigins.includes('http://localhost:3000')) {
    allowedOrigins.push('http://localhost:3000');
  }
  if (!allowedOrigins.includes('http://localhost:3001')) {
    allowedOrigins.push('http://localhost:3001');
  }
}

// Debug: Mostrar configuración de CORS
console.log('🌐 CORS Configuration:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  CORS_ORIGINS env:', process.env.CORS_ORIGINS);
console.log('  Allowed Origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('  ✅ CORS: Allowing request without origin');
      return callback(null, true);
    }
    
    // Normalizar origin: remover barra final si existe
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Verificar coincidencia exacta
    if (allowedOrigins.indexOf(normalizedOrigin) !== -1) {
      console.log(`  ✅ CORS: Allowing origin (exact match): ${normalizedOrigin}`);
      return callback(null, true);
    }
    
    // Verificar wildcards (ej: https://*.vercel.app)
    for (const allowedOrigin of allowedOrigins) {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(normalizedOrigin)) {
          console.log(`  ✅ CORS: Allowing origin (wildcard match): ${normalizedOrigin} matches ${allowedOrigin}`);
          return callback(null, true);
        }
      }
    }
    
    console.log(`  ❌ CORS: Blocked origin: ${normalizedOrigin}`);
    console.log(`  Allowed origins: ${allowedOrigins.join(', ')}`);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With", 
    "Accept", 
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers"
  ],
  exposedHeaders: ["Content-Length", "Content-Type"],
  credentials: true,
  optionsSuccessStatus: 200, // Para navegadores legacy
  preflightContinue: false,
};

// Aplicar CORS a todas las rutas ANTES de cualquier otra ruta
app.use(cors(corsOptions));

// Manejar preflight requests explícitamente para todas las rutas
// Esto es importante para requests con Content-Type: multipart/form-data
app.options('*', cors(corsOptions));

// Conectar DB
connectDB();

// Servir archivos estáticos de videos
app.use("/api/users/uploads/videos", express.static(path.join(process.cwd(), 'uploads/videos')));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.json({ message: "API de Evaluación de Habilidades funcionando" });
});

const PORT = process.env.PORT || 20352;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

