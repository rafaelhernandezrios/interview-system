# Mirai Intervieweb - Sistema de Evaluación de Habilidades

Sistema completo de evaluación de habilidades con análisis de CV mediante IA, entrevistas automatizadas y cuestionarios de habilidades blandas y duras.

## 🚀 Características

- ✅ Autenticación completa con JWT
- ✅ Subida y análisis de CV con IA (OpenAI GPT-4o-mini)
- ✅ Sistema de entrevista con evaluación automática y estilo "Estudio Virtual"
- ✅ Transcripción de audio automática
- ✅ Cuestionarios de habilidades blandas (160 preguntas)
- ✅ Cuestionarios de habilidades duras - Inteligencias Múltiples (35 preguntas)
- ✅ Panel de administración moderno con glassmorphism
- ✅ Almacenamiento de CVs en AWS S3 (opcional, con fallback local)
- ✅ Guardado automático de progreso de entrevista
- ✅ Sistema de Digital ID único por usuario (formato: PROGRAMNAME-YEAR-USERNUMBER)
- ✅ Subida de foto de perfil
- ✅ Diseño moderno con Glassmorphism y Bento Grid
- ✅ Interfaz de usuario premium con efectos visuales avanzados

## 📋 Requisitos Previos

- Node.js 18+
- MongoDB (local o MongoDB Atlas)
- API Key de OpenAI
- (Opcional) Cuenta de AWS para S3
- (Opcional) Cuenta de Gmail para envío de emails

## 🛠️ Instalación

### Backend

1. Navega a la carpeta backend:
```bash
cd backend
```

2. Instala las dependencias:
```bash
npm install
```

3. Crea un archivo `.env` basado en `env.example.txt`:
```env
MONGO_URI=mongodb+srv://username:password@miraiinnovation.mongodb.net/mirai-interviews?retryWrites=true&w=majority
JWT_SECRET=your_secret_key_here
PORT=20352
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
STORAGE_TYPE=local
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_BUCKET_NAME=your_bucket
OPENAI_API_KEY=your_openai_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:3000
```

4. Inicia el servidor:
```bash
npm start
# o para desarrollo con watch
npm run dev
```

### Frontend

1. Navega a la carpeta frontend:
```bash
cd frontend
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

## 📁 Estructura del Proyecto

```
Mirai-Intervieweb/
├── backend/
│   ├── config/
│   │   ├── db.js              # Conexión MongoDB
│   │   └── email.js           # Configuración Nodemailer
│   ├── middleware/
│   │   ├── adminMiddleware.js # Verificación de admin
│   │   ├── upload.js          # Configuración Multer-S3/Local
│   │   └── videoUpload.js     # Configuración para videos
│   ├── models/
│   │   └── User.js            # Modelo de Usuario
│   ├── routes/
│   │   ├── authRoutes.js      # Autenticación
│   │   ├── userRoutes.js      # CV, cuestionarios, entrevista
│   │   └── adminRoutes.js     # Panel de administración
│   ├── utils/
│   │   └── cvUtils.js         # Funciones de análisis y evaluación
│   ├── uploads/               # Archivos subidos (local storage)
│   │   ├── cvs/               # CVs en PDF
│   │   └── videos/            # Videos de entrevista
│   └── index.js               # Servidor Express
│
├── frontend/
│   ├── src/
│   │   ├── components/        # Componentes reutilizables
│   │   ├── contexts/          # Context API (AuthContext)
│   │   ├── pages/            # Páginas principales
│   │   └── utils/            # Utilidades (axios)
│   └── ...
│
└── README.md
```

## 🔑 Endpoints Principales

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login
- `POST /api/auth/forgot-password` - Recuperación de contraseña
- `POST /api/auth/reset-password` - Restablecer contraseña

### Usuario
- `POST /api/users/upload-cv` - Subir CV (PDF)
- `POST /api/users/analyze-cv` - Analizar CV con IA
- `POST /api/users/submit-interview` - Enviar respuestas de entrevista
- `POST /api/users/transcribe-video` - Transcribir video con Whisper
- `POST /api/users/save-interview-progress` - Guardar progreso automáticamente
- `POST /api/users/submit-soft-skills` - Enviar cuestionario habilidades blandas
- `POST /api/users/submit-hard-skills` - Enviar cuestionario habilidades duras
- `GET /api/users/profile` - Obtener perfil del usuario
- `GET /api/users/interview-responses` - Obtener respuestas de entrevista

### Administración
- `GET /api/admin/users` - Listar usuarios
- `GET /api/admin/stats` - Estadísticas generales
- `PATCH /api/admin/users/:userId/toggle-status` - Activar/Desactivar usuario
- `PATCH /api/admin/users/:userId/role` - Cambiar rol
- `DELETE /api/admin/users/:userId` - Eliminar usuario

## 🎯 Flujo de Usuario

1. **Registro**: El usuario se registra y recibe un Digital ID único (formato: PROGRAMNAME-YEAR-USERNUMBER)
2. **Login**: El usuario inicia sesión y recibe un token JWT
3. **Dashboard**: El usuario accede a su dashboard moderno con:
   - Vista de progreso con gráfico circular
   - Tarjetas de CV Analysis e Interview con estilo glassmorphism
   - Digital ID Card con opción de subir foto de perfil
4. **Subida de CV**: El usuario sube su CV en formato PDF con interfaz drag & drop
5. **Análisis**: El sistema analiza el CV con IA y genera preguntas personalizadas
   - Visualización de métricas y habilidades detectadas
   - Pills de habilidades con estilo glassmorphism
6. **Entrevista (Estudio Virtual)**: 
   - Interfaz centrada tipo teleprompter
   - Pregunta visible en tarjeta de cristal sobre el video
   - Timer integrado en la tarjeta de pregunta
   - Grabación con feedback visual (borde rojo pulsante)
   - Transcripción automática (solo para preguntas de texto)
   - Guardado automático de progreso
   - Si sale, puede continuar desde donde se quedó
7. **Cuestionarios**: El usuario completa los cuestionarios de habilidades
8. **Resultados**: El usuario puede ver sus resultados completos de todas las evaluaciones

## 🔒 Seguridad

- Contraseñas hasheadas con bcryptjs
- Tokens JWT con expiración (8 horas)
- Middleware de autenticación en rutas protegidas
- Validación de archivos (solo PDF, máximo 5MB para CVs, 150MB para videos cuando se usa S3)
- Verificación de usuario activo en cada request
- Prevención de copiar/pegar en entrevistas

## 📝 Notas

- **Digital ID**: Cada usuario recibe un ID único al registrarse (ej: MIRI-2025-1)
- **Foto de Perfil**: Los usuarios pueden subir una foto de perfil que se muestra en el dashboard y admin panel
- **Diseño Visual**: El sistema utiliza un diseño moderno con glassmorphism, bento grid y efectos visuales premium
- **Entrevista**: La última pregunta es de video solamente (no se transcribe), las demás preguntas se transcriben automáticamente
- El análisis de CV requiere una API key válida de OpenAI
- La subida de CVs puede usar AWS S3 o almacenamiento local (configurable con `STORAGE_TYPE`)
- El sistema de email es opcional pero recomendado para recuperación de contraseñas
- Las respuestas de entrevista se guardan automáticamente mientras el usuario responde
- Si la entrevista está completada, no se puede volver a iniciar

## 🛡️ Tecnologías Utilizadas

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT para autenticación
- OpenAI API (GPT-4o-mini, Whisper)
- AWS S3 (opcional)
- Nodemailer
- Multer para manejo de archivos

### Frontend
- React 18
- React Router DOM
- Tailwind CSS (con utilidades personalizadas de glassmorphism)
- Axios
- MediaRecorder API para grabación de video
- Diseño moderno con:
  - **Glassmorphism**: Efectos de vidrio esmerilado con backdrop-blur
  - **Bento Grid**: Layouts tipo grid con tarjetas de diferentes tamaños
  - **Mesh Gradients**: Fondos con gradientes suaves y orbes flotantes
  - **3D Icons**: Iconos PNG con efectos de sombra y profundidad
  - **Estudio Virtual**: Interfaz de entrevista centrada con teleprompter

## 📄 Licencia

ISC
