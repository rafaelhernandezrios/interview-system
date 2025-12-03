# 📦 Guía de Instalación - Mirai Intervieweb

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** 18 o superior ([Descargar](https://nodejs.org/))
- **MongoDB** ([Descargar](https://www.mongodb.com/try/download/community))
- **Git** (opcional)

## 🔧 Configuración del Backend

### Paso 1: Instalar Dependencias

```bash
cd backend
npm install
```

### Paso 2: Configurar Variables de Entorno

Crea un archivo `.env` en la carpeta `backend/` con el siguiente contenido:

```env
# Base de Datos MongoDB - Cluster MiraiInnovation
# Conecta al cluster "MiraiInnovation" en MongoDB Atlas
# Reemplaza username y password con tus credenciales de MongoDB Atlas
MONGO_URI=mongodb+srv://username:password@miraiinnovation.mongodb.net/mirai-interviews?retryWrites=true&w=majority

# Si prefieres usar MongoDB local en lugar de Atlas:
# MONGO_URI=mongodb://localhost:27017/mirai-interviews

# JWT - Cambia esto por una clave secreta segura
JWT_SECRET=tu_clave_secreta_muy_segura_aqui_cambiar_en_produccion

# Servidor
PORT=20352
NODE_ENV=development

# CORS - URLs permitidas para el frontend
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# AWS S3 - Para almacenar CVs
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
AWS_BUCKET_NAME=nombre_de_tu_bucket

# OpenAI - Para análisis de CV y evaluación
OPENAI_API_KEY=sk-tu_api_key_de_openai

# Email (Opcional pero recomendado)
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password_de_gmail
FRONTEND_URL=http://localhost:3000
```

### Paso 3: Configurar MongoDB Atlas

1. **Crear cuenta en MongoDB Atlas** (si no tienes una):
   - Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Crea una cuenta gratuita

2. **Crear un Cluster**:
   - Crea un cluster llamado "MiraiInnovation" (o usa el que ya tienes)
   - Selecciona la región más cercana a ti

3. **Configurar acceso a la base de datos**:
   - Ve a "Database Access" y crea un usuario de base de datos
   - Anota el username y password (los usarás en MONGO_URI)

4. **Configurar Network Access**:
   - Ve a "Network Access"
   - Agrega tu IP actual o usa `0.0.0.0/0` para permitir desde cualquier lugar (solo desarrollo)

5. **Obtener la Connection String**:
   - Ve a "Database" → "Connect"
   - Selecciona "Connect your application"
   - Copia la connection string y reemplaza `<password>` y `<dbname>` en tu `.env`

**Nota:** Si prefieres usar MongoDB local, puedes usar `mongodb://localhost:27017/mirai-interviews`

### Paso 4: Configurar AWS S3 (Opcional pero recomendado)

1. Crea una cuenta en AWS si no tienes una
2. Crea un bucket S3
3. Crea un usuario IAM con permisos de S3
4. Obtén las credenciales (Access Key ID y Secret Access Key)
5. Configúralas en el archivo `.env`

**Nota:** Si no quieres usar S3, puedes modificar el código para usar almacenamiento local, pero no está recomendado para producción.

### Paso 5: Obtener API Key de OpenAI

1. Ve a [OpenAI Platform](https://platform.openai.com/)
2. Crea una cuenta o inicia sesión
3. Ve a API Keys
4. Crea una nueva clave
5. Cópiala al archivo `.env`

### Paso 6: Iniciar el Backend

```bash
# Modo desarrollo (con watch)
npm run dev

# Modo producción
npm start
```

El servidor debería iniciar en `http://localhost:20352`

## 🎨 Configuración del Frontend

### Paso 1: Instalar Dependencias

```bash
cd frontend
npm install
```

### Paso 2: Iniciar el Frontend

```bash
npm run dev
```

El frontend debería iniciar en `http://localhost:3000`

## 🚀 Primeros Pasos

### 1. Crear un Usuario Administrador

Para crear el primer usuario administrador, puedes hacerlo de dos formas:

#### Opción A: Desde MongoDB Atlas directamente

1. Ve a MongoDB Atlas → "Database" → "Browse Collections"
2. Selecciona la base de datos "mirai-interviews"
3. Selecciona la colección "users"
4. Haz clic en "Insert Document" y agrega:

```json
{
  "name": "Admin",
  "email": "admin@example.com",
  "password": "$2a$10$...", // Hash de bcrypt de tu contraseña (usa bcryptjs para generar)
  "dob": ISODate("1990-01-01T00:00:00Z"),
  "gender": "Masculino",
  "academic_level": "Superior",
  "role": "admin",
  "isActive": true,
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

**Nota:** Para generar el hash de la contraseña, puedes usar este código Node.js:
```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('tu_contraseña', 10);
console.log(hash);
```

#### Opción B: Crear usuario normal y cambiar a admin

1. Regístrate desde el frontend
2. Ve a MongoDB y cambia el `role` a `"admin"` y `isActive` a `true`

### 2. Iniciar Sesión

1. Ve a `http://localhost:3000`
2. Inicia sesión con tu cuenta de administrador
3. Ya puedes usar el sistema

## 📝 Notas Importantes

### Seguridad

- **NUNCA** subas el archivo `.env` a Git
- Cambia `JWT_SECRET` por una clave segura en producción
- Usa variables de entorno en producción
- Configura HTTPS en producción

### Desarrollo

- El backend corre en el puerto `20352`
- El frontend corre en el puerto `3000`
- El frontend está configurado para hacer proxy de `/api` al backend

### Producción

Para producción, considera:

1. Usar un servidor web (Nginx) como reverse proxy
2. Configurar HTTPS
3. Usar variables de entorno del sistema
4. Configurar CORS correctamente
5. Usar un servicio de base de datos MongoDB gestionado (MongoDB Atlas)
6. Configurar backups automáticos

## 🐛 Solución de Problemas

### Error: "MongoDB no conectado"

**Para MongoDB Atlas:**
- Verifica que `MONGO_URI` tenga el formato correcto: `mongodb+srv://username:password@cluster.mongodb.net/database`
- Verifica que el username y password sean correctos
- Verifica que tu IP esté en la lista de Network Access en MongoDB Atlas
- Verifica que el cluster esté activo (no pausado)
- Verifica que el nombre del cluster en la URI coincida con tu cluster "MiraiInnovation"

**Para MongoDB local:**
- Verifica que MongoDB esté corriendo
- Verifica que `MONGO_URI` sea correcta
- Verifica que no haya otro proceso usando el puerto 27017

### Error: "AWS S3 error"

- Verifica las credenciales de AWS
- Verifica que el bucket exista
- Verifica los permisos del usuario IAM

### Error: "OpenAI API error"

- Verifica que la API key sea válida
- Verifica que tengas créditos en tu cuenta de OpenAI
- Verifica que la API key tenga los permisos correctos

### Error: "CORS error"

- Verifica que `CORS_ORIGINS` incluya la URL del frontend
- Verifica que el frontend esté corriendo en la URL correcta

## 📚 Recursos Adicionales

- [Documentación de MongoDB](https://docs.mongodb.com/)
- [Documentación de Express](https://expressjs.com/)
- [Documentación de React](https://react.dev/)
- [Documentación de OpenAI](https://platform.openai.com/docs/)
- [Documentación de AWS S3](https://docs.aws.amazon.com/s3/)

