import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    // Verificar que MONGO_URI esté configurado
    if (!process.env.MONGO_URI) {
      console.error("❌ Error: MONGO_URI no está configurado en el archivo .env");
      console.error("📝 Crea un archivo .env en la carpeta backend/ con la siguiente configuración:");
      console.error("   MONGO_URI=mongodb+srv://username:password@miraiinnovation.mongodb.net/mirai-interviews?retryWrites=true&w=majority");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI, {
      retryWrites: true,
      w: 'majority'
    });
    
    const dbName = mongoose.connection.db.databaseName;
    const clusterName = mongoose.connection.host || 'cluster';
    console.log(`✅ MongoDB conectado al cluster: ${clusterName}`);
    console.log(`📊 Base de datos: ${dbName}`);
    console.log(`📦 Colección de usuarios: users`);
  } catch (error) {
    console.error("❌ Error al conectar a MongoDB");
    console.error("💡 Verifica que:");
    console.error("   1. El archivo .env existe en la carpeta backend/");
    console.error("   2. MONGO_URI está configurado correctamente");
    console.error("   3. Las credenciales de MongoDB Atlas son correctas");
    console.error("   4. Tu IP está en la lista de Network Access en MongoDB Atlas");
    console.error("\n📋 Error detallado:", error.message);
    process.exit(1);
  }
};

export default connectDB;

