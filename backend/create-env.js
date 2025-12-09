// Script para crear el archivo .env si no existe
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
const examplePath = path.join(__dirname, 'env.example.txt');

if (fs.existsSync(envPath)) {
  process.exit(0);
}

if (fs.existsSync(examplePath)) {
  const exampleContent = fs.readFileSync(examplePath, 'utf8');
  fs.writeFileSync(envPath, exampleContent);
} else {
  // Crear un .env básico si no existe el ejemplo
  const basicEnv = `# Base de Datos MongoDB - Cluster MiraiInnovation
MONGO_URI=mongodb+srv://username:password@miraiinnovation.mongodb.net/mirai-interviews?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_secret_key_here_change_in_production

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
`;
  fs.writeFileSync(envPath, basicEnv);
}

