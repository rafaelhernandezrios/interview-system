# 📋 Revisión Completa del Proyecto - Sistema de Evaluación de Habilidades

## 🎯 Resumen Ejecutivo

Este documento proporciona una revisión completa del proyecto actual para servir como base para un nuevo sistema de evaluación de estudiantes. El proyecto incluye funcionalidades de autenticación, análisis de CV con IA, cuestionarios de habilidades, y evaluación integral.

---

## 🏗️ Arquitectura del Proyecto

### Stack Tecnológico

**Backend:**
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Base de Datos:** MongoDB con Mongoose
- **Autenticación:** JWT (JSON Web Tokens)
- **Almacenamiento:** AWS S3 (para CVs)
- **IA:** OpenAI GPT-4o-mini
- **Email:** Nodemailer (Gmail)

**Frontend:**
- **Framework:** React 18.2.0
- **Routing:** React Router DOM 7.1.3
- **Estilos:** Tailwind CSS + Bootstrap
- **Gráficos:** Chart.js, Recharts
- **PDF:** React-PDF, jsPDF

---

## 🔐 1. Sistema de Autenticación con MongoDB

### Estructura de Usuario (Modelo)

**Ubicación:** `backend/models/User.js`

**Campos Principales:**
```javascript
{
  name: String (requerido)
  email: String (único, requerido)
  password: String (hasheado con bcryptjs)
  dob: Date (fecha de nacimiento)
  gender: String
  academic_level: String
  role: String (enum: 'user', 'admin')
  isActive: Boolean (default: false)
  resetPasswordToken: String
  resetPasswordExpires: Date
}
```

### Funcionalidades de Autenticación

**Ubicación:** `backend/routes/authRoutes.js`

#### 1.1 Registro de Usuario
- **Endpoint:** `POST /api/auth/register`
- **Validaciones:**
  - Verifica duplicados por email
  - Hash de contraseña con bcryptjs (salt rounds: 10)
  - Normalización de email (lowercase, trim)
- **Características:**
  - Cuentas nuevas inactivas por defecto (`isActive: false`)
  - Validación de campos requeridos
  - Manejo de errores de validación de Mongoose

#### 1.2 Login de Usuario
- **Endpoint:** `POST /api/auth/login`
- **Proceso:**
  1. Busca usuario por email
  2. Compara contraseña con bcryptjs
  3. Verifica que la cuenta esté activa
  4. Genera JWT token (expiración: 8 horas)
- **Respuesta:**
  ```json
  {
    "token": "jwt_token_here",
    "userId": "user_id",
    "name": "User Name",
    "role": "user"
  }
  ```

#### 1.3 Middleware de Autenticación
- **Función:** `authMiddleware`
- **Ubicación:** `backend/routes/authRoutes.js`
- **Funcionalidad:**
  - Verifica token JWT en header `Authorization`
  - Extrae `userId` del token
  - Verifica que el usuario existe y está activo
  - Agrega `req.userId` para uso en rutas protegidas

#### 1.4 Recuperación de Contraseña
- **Endpoints:**
  - `POST /api/auth/forgot-password` - Solicitar recuperación
  - `POST /api/auth/reset-password` - Restablecer contraseña
  - `GET /api/auth/verify-reset-token/:token` - Verificar token
- **Proceso:**
  1. Genera token aleatorio (32 bytes, hex)
  2. Guarda token y expiración (1 hora) en DB
  3. Envía email con enlace de recuperación
  4. Valida token al restablecer
  5. Hash de nueva contraseña
  6. Envía email de confirmación

#### 1.5 Configuración de Base de Datos
- **Ubicación:** `backend/config/db.js`
- **Conexión:** Mongoose con MongoDB
- **Variables de Entorno:**
  - `MONGO_URI`: String de conexión completa

---

## 📄 2. Sistema de Subida y Análisis de CV con IA

### 2.1 Subida de CV

**Ubicación:** `backend/routes/userRoutes.js`
**Endpoint:** `POST /api/users/upload-cv`

**Middleware de Upload:**
- **Ubicación:** `backend/middleware/upload.js`
- **Configuración:**
  - Almacenamiento: AWS S3
  - Tipo de archivo: Solo PDF
  - Tamaño máximo: 5MB
  - ACL: public-read
  - Nombre de archivo: `timestamp_originalname.pdf`

**Variables de Entorno Requeridas:**
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_BUCKET_NAME=your_bucket
```

**Proceso:**
1. Usuario sube PDF mediante `multipart/form-data`
2. Archivo se sube a S3
3. URL de S3 se guarda en `user.cvPath`
4. Retorna URL del archivo

### 2.2 Extracción de Texto del PDF

**Ubicación:** `backend/utils/cvUtils.js`
**Función:** `extractTextFromPdf(pdfUrl)`

**Proceso:**
1. Descarga PDF desde URL de S3 usando `axios`
2. Convierte a Buffer
3. Usa `pdf.js-extract` para extraer texto
4. Concatena texto de todas las páginas
5. Retorna texto plano

### 2.3 Análisis de CV con IA

**Ubicación:** `backend/utils/cvUtils.js`
**Función:** `analyzeCvText(text)`

**Proceso:**
1. Envía texto del CV a OpenAI GPT-4o-mini
2. Prompt: "Extrae habilidades duras y blandas así como experiencia relevante"
3. Retorna análisis estructurado
4. Convierte análisis a array de habilidades

**Variables de Entorno:**
```env
OPENAI_API_KEY=your_openai_key
```

### 2.4 Generación de Preguntas de Entrevista

**Ubicación:** `backend/utils/cvUtils.js`
**Función:** `generateQuestions(skills)`

**Proceso:**
1. Filtra habilidades duras y blandas
2. Genera 10 preguntas (5 duras + 5 blandas) usando GPT
3. Formato: Lista numerada de preguntas
4. Guarda preguntas en `user.questions`

### 2.5 Análisis de CV (Endpoint Completo)

**Endpoint:** `POST /api/users/analyze-cv`

**Proceso Completo:**
1. Verifica que el usuario tenga CV subido
2. Extrae texto del PDF
3. Analiza con GPT
4. Convierte análisis a array de habilidades
5. Genera preguntas de entrevista
6. Calcula score inicial (basado en cantidad de habilidades)
7. Guarda todo en base de datos:
   - `cvText`: Texto extraído
   - `analysis`: Análisis de GPT
   - `skills`: Array de habilidades
   - `questions`: Array de preguntas
   - `score`: Puntaje inicial
   - `cvAnalyzed`: true

---

## 🗣️ 3. Sistema de Entrevista con IA

### 3.1 Envío de Respuestas de Entrevista

**Endpoint:** `POST /api/users/submit-interview`
**Body:**
```json
{
  "answers": ["respuesta1", "respuesta2", ...]
}
```

**Proceso:**
1. Valida que número de respuestas coincida con preguntas
2. Llama a `calculateScoreBasedOnAnswers(questions, answers)`
3. GPT evalúa cada respuesta (0-100 puntos)
4. Calcula promedio de puntajes
5. Genera análisis detallado por pregunta
6. Guarda en DB:
   - `interviewResponses`: Array de respuestas
   - `interviewScore`: Puntaje promedio
   - `interviewAnalysis`: Array con score y explicación por pregunta
   - `interviewCompleted`: true

### 3.2 Evaluación de Respuestas con IA

**Ubicación:** `backend/utils/cvUtils.js`
**Función:** `calculateScoreBasedOnAnswers(questions, answers)`

**Proceso:**
1. Construye prompt con preguntas y respuestas
2. Solicita a GPT evaluación 0-100 por respuesta
3. Formato de respuesta esperado: JSON array
4. Calcula promedio de todos los scores
5. Retorna:
   ```javascript
   {
     total_score: 85,
     evaluations: [
       { score: 90, explanation: "..." },
       { score: 80, explanation: "..." }
     ]
   }
   ```

### 3.3 Obtención de Resultados de Entrevista

**Endpoint:** `GET /api/users/interview-responses`

**Respuesta:**
```json
{
  "questions": ["pregunta1", ...],
  "responses": ["respuesta1", ...],
  "analysis": [{ score: 85, explanation: "..." }, ...],
  "score": 85
}
```

---

## 📊 4. Cuestionarios de Habilidades Blandas y Duras

### 4.1 Cuestionario de Habilidades Blandas

**Endpoint:** `POST /api/users/submit-soft-skills`
**Body:**
```json
{
  "responses": { "1": "5", "2": "4", ... }
}
```

**Evaluación:**
- **Ubicación:** `backend/utils/cvUtils.js`
- **Función:** `evaluateSoftSkills(responses)`

**Estructura de Evaluación:**
- **8 Competencias Principales:**
  1. Cognitiva (3 habilidades)
  2. Afectiva (2 habilidades)
  3. Social (3 habilidades)
  4. Moral (2 habilidades)
  5. Acometimiento (3 habilidades)
  6. Directriz (3 habilidades)
  7. Gestión (2 habilidades)
  8. Alto potencial (2 habilidades)

- **Total:** 160 preguntas
- **Escala:** 1-5 puntos por pregunta
- **Niveles:** Muy bajo, Bajo, Medio, Alto, Muy alto
- **Nivel Institucional:** Calculado sobre total de 800 puntos

**Resultado:**
```javascript
{
  totalScore: 650,
  institutionalLevel: "Nivel alto",
  results: {
    "Cognitiva": {
      score: 85,
      level: "Nivel alto",
      skills: { "Pensamiento Analítico": { score: 30 }, ... }
    },
    ...
  }
}
```

**Guardado en DB:**
- `softSkillsResults`: Objeto completo de resultados
- `softSkillsSurveyCompleted`: true

### 4.2 Cuestionario de Habilidades Duras (Inteligencias Múltiples)

**Endpoint:** `POST /api/users/submit-hard-skills`
**Body:**
```json
{
  "responses": { "1": "5", "2": "3", ... }
}
```

**Evaluación:**
- **Ubicación:** `backend/utils/cvUtils.js`
- **Función:** `evaluateMultipleIntelligences(responses)`

**7 Inteligencias Evaluadas:**
1. Inteligencia Comunicativa
2. Inteligencia Matemática
3. Inteligencia Visual
4. Inteligencia Motriz
5. Inteligencia Rítmica
6. Inteligencia de Autoconocimiento
7. Inteligencia Social

**Total:** 35 preguntas (5 por inteligencia)
**Escala:** Verdadero (5) / Falso (otro valor)
**Niveles:** Bajo (2 verdaderos), Medio (3 verdaderos), Alto (4-5 verdaderos)

**Resultado:**
```javascript
{
  totalScore: 120,
  results: {
    "Inteligencia Comunicativa": { score: 20, level: "Nivel alto" },
    ...
  }
}
```

**Guardado en DB:**
- `hardSkillsResults`: Objeto de resultados
- `hardSkillsSurveyCompleted`: true

### 4.3 Otros Cuestionarios Incluidos

El proyecto también incluye:
- **Detección de Adicciones:** `evaluateAddictionDetection()`
- **Orientación Vocacional Secundaria:** `evaluateVocationalSecundary()`
- **Orientación Vocacional Universidad:** `evaluateVocationalUniversity()`
- **Detección de Bullying:** `evaluateBullying()`
- **Cuestionario Demográfico:** Datos personales e institucionales

---

## 📈 5. Sistema de Evaluación de CV y Cuestionarios

### 5.1 Evaluación de CV

**Componentes de Evaluación:**
1. **Análisis de Texto:** Extracción de habilidades y experiencia
2. **Score Inicial:** Basado en cantidad de habilidades detectadas
3. **Preguntas Generadas:** Personalizadas según habilidades
4. **Entrevista:** Evaluación de respuestas con IA

**Score Final del CV:**
- Score inicial: `Math.min(skills.length * 10, 100)`
- Score de entrevista: Promedio de evaluación GPT (0-100)
- Ambos se guardan por separado en el modelo User

### 5.2 Evaluación de Cuestionarios

**Habilidades Blandas:**
- Score total: Suma de todas las respuestas (máx 800)
- Nivel por competencia: Basado en rangos predefinidos
- Nivel institucional: Basado en score total

**Habilidades Duras:**
- Score por inteligencia: Cantidad de respuestas verdaderas × 5
- Nivel: Basado en cantidad de verdaderos (2/3/4-5)
- Score total: Suma de todas las inteligencias

### 5.3 Generación de CV Mejorado con IA

**Endpoint:** `POST /api/users/generate-cv`

**Proceso:**
1. Recolecta todos los datos del usuario:
   - Datos personales
   - Análisis de CV original
   - Resultados de habilidades blandas (solo positivos)
   - Resultados de habilidades duras (solo positivos)
   - Resultados vocacionales
   - Análisis de entrevista
2. Construye prompt para GPT
3. Genera CV profesional en texto plano
4. Guarda en `user.generatedCV`
5. Retorna CV generado

**Características:**
- Solo incluye aspectos positivos
- Formato: Texto plano, párrafos separados
- Incluye recomendaciones profesionales
- Omite secciones sin datos relevantes

---

## 🛡️ 6. Sistema de Roles y Permisos

### 6.1 Roles de Usuario

**Modelo User:**
- `role`: String (enum: 'user', 'admin')
- `isActive`: Boolean (default: false)

### 6.2 Middleware de Admin

**Ubicación:** `backend/middleware/adminMiddleware.js`
**Uso:** Protege rutas que solo admins pueden acceder

**Verificación:**
1. Usuario debe estar autenticado (authMiddleware)
2. Usuario debe tener `role === 'admin'`
3. Usuario debe estar activo

### 6.3 Funcionalidades de Admin

**Endpoints Admin:** `backend/routes/adminRoutes.js`

**Funcionalidades:**
- `GET /api/admin/users` - Listar todos los usuarios (con filtros)
- `GET /api/admin/stats` - Estadísticas generales
- `GET /api/admin/risk-stats` - Estadísticas de riesgo
- `GET /api/admin/users/:userId` - Detalles de usuario
- `GET /api/admin/users/:userId/survey-results` - Resultados de encuestas
- `DELETE /api/admin/users/:userId` - Eliminar usuario
- `PATCH /api/admin/users/:userId/role` - Cambiar rol
- `PATCH /api/admin/users/:userId/toggle-status` - Activar/Desactivar usuario
- `GET /api/admin/survey-summary` - Resumen completo de encuestas

---

## 📧 7. Sistema de Email

**Ubicación:** `backend/config/email.js`

**Configuración:**
- Servicio: Gmail (SMTP)
- Puerto: 587
- Seguridad: TLS

**Funciones:**
1. `sendPasswordResetEmail(email, resetToken)` - Email de recuperación
2. `sendPasswordChangeConfirmation(email, userName)` - Confirmación de cambio

**Variables de Entorno:**
```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:3000
```

---

## 🔒 8. Seguridad y Validaciones

### 8.1 Seguridad de Contraseñas
- Hash con bcryptjs (10 salt rounds)
- Validación de longitud mínima (6 caracteres)
- Tokens de recuperación con expiración (1 hora)

### 8.2 Validación de Tokens
- JWT con expiración (8 horas)
- Verificación de usuario activo en cada request
- Limpieza de tokens después de uso

### 8.3 Validación de Archivos
- Solo PDF permitido
- Tamaño máximo: 5MB
- Validación de tipo MIME

### 8.4 CORS
- Configuración por variables de entorno
- Soporte para múltiples orígenes
- Credenciales habilitadas

---

## 📁 9. Estructura de Archivos Clave

```
backend/
├── config/
│   ├── db.js              # Conexión MongoDB
│   └── email.js            # Configuración Nodemailer
├── middleware/
│   ├── adminMiddleware.js  # Verificación de admin
│   └── upload.js          # Configuración Multer-S3
├── models/
│   └── User.js            # Modelo de Usuario
├── routes/
│   ├── authRoutes.js      # Autenticación
│   ├── userRoutes.js      # CV, cuestionarios, entrevista
│   ├── surveyRoutes.js    # Endpoints de encuestas
│   └── adminRoutes.js     # Panel de administración
├── utils/
│   └── cvUtils.js         # Funciones de análisis y evaluación
└── index.js               # Servidor Express

frontend/
├── src/
│   ├── pages/             # Páginas principales
│   ├── components/        # Componentes reutilizables
│   ├── contexts/          # Context API (TokenExpiration)
│   ├── hooks/             # Custom hooks
│   └── utils/              # Utilidades (axios interceptor)
└── App.js                 # Configuración de rutas
```

---

## 🔑 10. Variables de Entorno Requeridas

### Backend (.env)
```env
# Base de Datos
MONGO_URI=mongodb://localhost:27017/habilities_evaluation

# JWT
JWT_SECRET=your_secret_key_here

# Servidor
PORT=20352
NODE_ENV=development

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_BUCKET_NAME=your_bucket

# OpenAI
OPENAI_API_KEY=your_openai_key

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:3000
```

---

## 🚀 11. Flujo Completo de Usuario

1. **Registro:**
   - Usuario se registra → Cuenta inactiva
   - Admin activa cuenta

2. **Login:**
   - Usuario inicia sesión → Recibe JWT token

3. **Subida de CV:**
   - Usuario sube PDF → Se guarda en S3
   - URL se guarda en `user.cvPath`

4. **Análisis de CV:**
   - Usuario solicita análisis → Extrae texto
   - Analiza con GPT → Genera habilidades
   - Genera preguntas de entrevista → Guarda todo

5. **Cuestionarios:**
   - Usuario completa cuestionarios → Se evalúan
   - Resultados se guardan en DB

6. **Entrevista:**
   - Usuario responde preguntas → Se evalúan con GPT
   - Score y análisis se guardan

7. **CV Generado:**
   - Usuario solicita CV mejorado → GPT genera CV
   - Se guarda en `user.generatedCV`

---

## 📝 12. Puntos Clave para Reutilización

### ✅ Funcionalidades Listas para Reutilizar:

1. **Autenticación Completa:**
   - Registro, login, recuperación de contraseña
   - JWT con verificación de usuario activo
   - Middleware de autenticación

2. **Sistema de CV:**
   - Subida a S3
   - Extracción de texto
   - Análisis con IA
   - Generación de preguntas

3. **Sistema de Entrevista:**
   - Evaluación con IA
   - Score y análisis detallado

4. **Cuestionarios:**
   - Estructura de evaluación
   - Funciones de cálculo de scores
   - Guardado en DB

5. **Panel de Admin:**
   - Gestión de usuarios
   - Estadísticas
   - Activación/Desactivación

### 🔧 Adaptaciones Necesarias:

1. **Modelo de Usuario:**
   - Ajustar campos según necesidades del nuevo proyecto
   - Agregar campos específicos de estudiantes

2. **Cuestionarios:**
   - Adaptar preguntas y evaluación
   - Ajustar rangos de scores

3. **Análisis de CV:**
   - Ajustar prompts de GPT según necesidades
   - Modificar criterios de evaluación

4. **Roles:**
   - Agregar roles adicionales si es necesario (ej: 'institute', 'teacher')

---

## 🎓 13. Mejores Prácticas Implementadas

1. **Seguridad:**
   - Contraseñas hasheadas
   - Tokens con expiración
   - Validación de entrada
   - Verificación de usuario activo

2. **Organización:**
   - Separación de responsabilidades
   - Middleware reutilizable
   - Funciones utilitarias modulares

3. **Manejo de Errores:**
   - Try-catch en todas las rutas
   - Mensajes de error descriptivos
   - Logging de errores

4. **Base de Datos:**
   - Validación con Mongoose
   - Índices únicos (email)
   - Timestamps automáticos

---

## 📚 14. Documentación Adicional

- `ENVIRONMENT_SETUP.md` - Configuración de entorno
- `SECURITY.md` - Consideraciones de seguridad
- `INSTITUTE_ROLE_README.md` - Funcionalidades de rol institucional
- `TOKEN_EXPIRATION_README.md` - Sistema de expiración de tokens

---

## 🎯 Conclusión

Este proyecto proporciona una base sólida para un sistema de evaluación de estudiantes con:
- ✅ Autenticación robusta con MongoDB
- ✅ Análisis de CV con IA
- ✅ Sistema de entrevistas con evaluación automática
- ✅ Cuestionarios estructurados de habilidades
- ✅ Panel de administración completo
- ✅ Sistema de roles y permisos

Todas las funcionalidades están implementadas y listas para ser adaptadas a las necesidades específicas del nuevo proyecto.

