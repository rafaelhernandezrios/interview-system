import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import connectDB from "./config/db.js";
import { authRoutes } from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";

dotenv.config();

const app = express();

// ============================================
// CORS CONFIGURATION - DEBE SER LO PRIMERO
// ============================================
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

// CORS Configuration (logs removidos para producción)

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Normalizar origin: remover barra final si existe
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Verificar coincidencia exacta
    const exactMatchIndex = allowedOrigins.indexOf(normalizedOrigin);
    if (exactMatchIndex !== -1) {
      return callback(null, true);
    }
    
    // Verificar coincidencia case-insensitive (por si acaso)
    const caseInsensitiveMatch = allowedOrigins.find(allowed => 
      allowed.toLowerCase() === normalizedOrigin.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      return callback(null, true);
    }
    
    // Verificar wildcards (ej: https://*.vercel.app)
    for (const allowedOrigin of allowedOrigins) {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(normalizedOrigin)) {
          return callback(null, true);
        }
      }
    }
    
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

// ============================================
// APLICAR CORS PRIMERO - ANTES DE CUALQUIER OTRO MIDDLEWARE
// ============================================

// Middleware de CORS manual como PRIMERA línea de defensa
// Esto asegura que los headers CORS se envíen SIEMPRE, incluso si hay errores
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Si el origin está en la lista de permitidos, agregar headers CORS SIEMPRE
  if (origin) {
    const normalizedOrigin = origin.replace(/\/$/, '');
    const isAllowed = allowedOrigins.includes(normalizedOrigin) || 
                     allowedOrigins.some(allowed => allowed.toLowerCase() === normalizedOrigin.toLowerCase());
    
    if (isAllowed) {
      // Establecer headers CORS SIEMPRE
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  }
  
  // Si es un preflight request (OPTIONS), responder inmediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Aplicar middleware de CORS de la librería cors (segunda línea de defensa)
app.use(cors(corsOptions));

// Manejar preflight requests explícitamente para todas las rutas
app.options('*', cors(corsOptions));

// ============================================
// OTROS MIDDLEWARES (después de CORS)
// ============================================

// Increase body size limit to 50MB for video uploads
// Nota: Vercel tiene un límite de 4.5MB para Hobby plan y 50MB para Pro plan
// Si el archivo es más grande, consideraremos subir directamente a S3 desde el frontend
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware para manejar errores de tamaño de body
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({ 
      error: 'File too large',
      message: 'The video file is too large. Maximum size is 50MB. Please record a shorter video or compress the file.',
      maxSize: '50MB'
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ 
      error: 'File too large',
      message: 'The video file is too large. Maximum size is 50MB. Please record a shorter video or compress the file.',
      maxSize: '50MB'
    });
  }
  next(err);
});

// Conectar DB
connectDB();

// Servir archivos estáticos de videos
app.use("/api/users/uploads/videos", express.static(path.join(process.cwd(), 'uploads/videos')));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/application", applicationRoutes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.json({ message: "API de Evaluación de Habilidades funcionando" });
});

// Exportar app para Vercel (serverless functions)
// Esto permite que Vercel use la app como serverless function
export default app;

// Solo iniciar el servidor si NO estamos en Vercel (desarrollo local)
// Vercel detecta automáticamente si hay un export default y usa eso
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 20352;
  app.listen(PORT, () => {
    // Server started (logs removidos)
  });
}

