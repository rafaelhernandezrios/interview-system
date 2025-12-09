import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    // Verificar que MONGO_URI esté configurado
    if (!process.env.MONGO_URI) {
      process.exit(1);
    }

    const mongoUri = process.env.MONGO_URI;

    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 30000, // 30 segundos timeout
      socketTimeoutMS: 45000, // 45 segundos socket timeout
      connectTimeoutMS: 30000, // 30 segundos para conectar
      maxPoolSize: 10, // Mantener hasta 10 conexiones en el pool
    });
    
  } catch (error) {
    process.exit(1);
  }
};

export default connectDB;

