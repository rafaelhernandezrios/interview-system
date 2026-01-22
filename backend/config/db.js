import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    // Verificar que MONGO_URI esté configurado
    if (!process.env.MONGO_URI) {
      console.error('❌ ERROR: MONGO_URI no está configurado en las variables de entorno');
      console.error('Por favor, verifica que el archivo .env contenga MONGO_URI');
      process.exit(1);
    }

    const mongoUri = process.env.MONGO_URI;
    console.log('🔄 Intentando conectar a MongoDB...');
    console.log('📍 URI:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Ocultar credenciales en el log

    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 30000, // 30 segundos timeout
      socketTimeoutMS: 45000, // 45 segundos socket timeout
      connectTimeoutMS: 30000, // 30 segundos para conectar
      maxPoolSize: 10, // Mantener hasta 10 conexiones en el pool
    });
    
    console.log('✅ MongoDB conectado exitosamente');
    console.log('📊 Base de datos:', mongoose.connection.db.databaseName);
    console.log('🔌 Estado de conexión:', mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado');
    
    // Manejar eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB desconectado');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconectado');
    });
    
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error.message);
    console.error('Detalles del error:', error);
    console.error('\n🔍 Verifica:');
    console.error('1. Que MONGO_URI esté correctamente configurado en .env');
    console.error('2. Que las credenciales sean correctas');
    console.error('3. Que la IP esté en la whitelist de MongoDB Atlas (si usas Atlas)');
    console.error('4. Que tengas conexión a internet');
    process.exit(1);
  }
};

export default connectDB;

