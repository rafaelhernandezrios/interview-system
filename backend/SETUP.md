# 🚀 Guía Rápida de Configuración

## Paso 1: Crear el archivo .env

Ejecuta el siguiente comando para crear el archivo `.env`:

```bash
npm run create-env
```

O manualmente, crea un archivo `.env` en la carpeta `backend/` con este contenido:

```env
# Base de Datos MongoDB - Cluster MiraiInnovation
MONGO_URI=mongodb+srv://username:password@miraiinnovation.mongodb.net/mirai-interviews?retryWrites=true&w=majority

# JWT
JWT_SECRET=tu_clave_secreta_muy_segura_aqui

# Servidor
PORT=20352
NODE_ENV=development

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# AWS S3 (opcional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_BUCKET_NAME=your_bucket

# OpenAI (requerido para análisis de CV)
OPENAI_API_KEY=sk-tu_api_key_de_openai

# Email (opcional)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:3000
```

## Paso 2: Obtener la Connection String de MongoDB Atlas

1. Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Inicia sesión y selecciona tu cluster "MiraiInnovation"
3. Haz clic en "Connect"
4. Selecciona "Connect your application"
5. Copia la connection string
6. Reemplaza en `MONGO_URI`:
   - `<password>` → tu contraseña de MongoDB Atlas
   - `<dbname>` → `mirai-interviews`

Ejemplo:
```
mongodb+srv://miUsuario:miPassword123@miraiinnovation.xxxxx.mongodb.net/mirai-interviews?retryWrites=true&w=majority
```

## Paso 3: Configurar Network Access

1. En MongoDB Atlas, ve a "Network Access"
2. Haz clic en "Add IP Address"
3. Para desarrollo, puedes usar "Allow Access from Anywhere" (`0.0.0.0/0`)
4. Para producción, agrega solo las IPs necesarias

## Paso 4: Configurar JWT_SECRET

Genera una clave secreta segura. Puedes usar:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O usa cualquier string aleatorio y seguro.

## Paso 5: Iniciar el servidor

```bash
npm start
```

Deberías ver:
```
✅ MongoDB conectado al cluster: miraiinnovation-xxxxx.mongodb.net
📊 Base de datos: mirai-interviews
📦 Colección de usuarios: users
🚀 Servidor corriendo en puerto 20352
```

## ❌ Solución de Problemas

### Error: "MONGO_URI no está configurado"
- Asegúrate de que el archivo `.env` existe en la carpeta `backend/`
- Verifica que `MONGO_URI` esté escrito correctamente (sin espacios)

### Error: "connect ECONNREFUSED"
- Verifica que la URI de MongoDB Atlas sea correcta
- Verifica que tu IP esté en la lista de Network Access
- Verifica que el username y password sean correctos

### Error: "Authentication failed"
- Verifica que el usuario de MongoDB Atlas tenga permisos
- Verifica que la contraseña no tenga caracteres especiales que necesiten encoding

