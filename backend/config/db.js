import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    // Verificar que MONGO_URI esté configurado
    if (!process.env.MONGO_URI) {
      console.error("❌ Error: MONGO_URI no está configurado");
      console.error("📝 En Vercel: Ve a Settings → Environment Variables");
      console.error("   Agrega: MONGO_URI = tu_connection_string");
      console.error("   Formato: mongodb+srv://username:password@cluster.mongodb.net/mirai-interviews?retryWrites=true&w=majority");
      process.exit(1);
    }

    // Debug: Mostrar información de conexión (sin mostrar la contraseña)
    const mongoUri = process.env.MONGO_URI;
    const maskedUri = mongoUri.replace(/:[^:@]+@/, ':****@'); // Ocultar contraseña
    console.log('🔌 Intentando conectar a MongoDB...');
    console.log('   URI:', maskedUri);
    console.log('   NODE_ENV:', process.env.NODE_ENV);

    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 30000, // 30 segundos timeout
      socketTimeoutMS: 45000, // 45 segundos socket timeout
      connectTimeoutMS: 30000, // 30 segundos para conectar
      maxPoolSize: 10, // Mantener hasta 10 conexiones en el pool
    });
    
    const dbName = mongoose.connection.db.databaseName;
    const clusterName = mongoose.connection.host || 'cluster';
    console.log(`✅ MongoDB conectado al cluster: ${clusterName}`);
    console.log(`📊 Base de datos: ${dbName}`);
    console.log(`📦 Colección de usuarios: users`);
  } catch (error) {
    console.error("❌ Error al conectar a MongoDB");
    console.error("\n💡 Pasos para solucionar:");
    console.error("\n1️⃣  Configurar Network Access en MongoDB Atlas:");
    console.error("   - Ve a https://cloud.mongodb.com/");
    console.error("   - Network Access → Add IP Address");
    console.error("   - Selecciona 'Allow Access from Anywhere' (0.0.0.0/0)");
    console.error("   - Esto permite que Vercel se conecte desde cualquier IP");
    console.error("\n2️⃣  Verificar MONGO_URI en Vercel:");
    console.error("   - Settings → Environment Variables");
    console.error("   - Verifica que MONGO_URI esté configurado");
    console.error("   - Formato: mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority");
    console.error("   - Environment: Production, Preview, Development (todas)");
    console.error("\n3️⃣  Verificar credenciales:");
    console.error("   - Usuario y contraseña correctos");
    console.error("   - El usuario tiene permisos de lectura/escritura");
    console.error("\n📋 Error detallado:", error.message);
    
    // Si es error de autenticación, dar más detalles
    if (error.message.includes('authentication')) {
      console.error("\n⚠️  Error de autenticación:");
      console.error("   - Verifica usuario y contraseña");
      console.error("   - Asegúrate de que el usuario tenga permisos");
    }
    
    // Si es error de red/IP, dar más detalles
    if (error.message.includes('whitelist') || error.message.includes('IP')) {
      console.error("\n⚠️  Error de Network Access:");
      console.error("   - Agrega 0.0.0.0/0 en Network Access de MongoDB Atlas");
      console.error("   - Espera 1-2 minutos después de agregar la IP");
    }
    
    process.exit(1);
  }
};

export default connectDB;

