import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/db.js';
import { calculateScoreBasedOnAnswers } from '../utils/cvUtils.js';

dotenv.config();

// ============================================
// SCRIPT PARA GENERAR RECOMENDACIONES
// ============================================
// Este script genera recomendaciones para usuarios que ya completaron
// su entrevista pero no tienen el campo interviewRecommendations

async function generateRecommendations() {
  try {
    // Conectar a la base de datos
    await connectDB();
    console.log('\n📊 Conectado a la base de datos\n');

    // Buscar usuarios con entrevista completada pero sin recomendaciones
    const users = await User.find({
      interviewCompleted: true,
      interviewResponses: { $exists: true, $ne: [] },
      $or: [
        { interviewRecommendations: { $exists: false } },
        { interviewRecommendations: null },
        { interviewRecommendations: '' }
      ]
    })
    .select('name email questions interviewResponses program');

    if (users.length === 0) {
      console.log('✅ No se encontraron usuarios que necesiten recomendaciones generadas');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`✅ Encontrados ${users.length} usuarios que necesitan recomendaciones\n`);
    console.log('='.repeat(80));
    console.log('🔄 GENERANDO RECOMENDACIONES\n');

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Procesar cada usuario
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`\n👤 [${i + 1}/${users.length}] Usuario: ${user.name} (${user.email})`);

      try {
        // Construir todas las preguntas (generadas + default)
        const firstQuestion = "What is your motivation for applying to this program and joining Mirai Innovation Research Institute?";
        let lastQuestion;
        if (user.program === 'FUTURE_INNOVATORS_JAPAN') {
          lastQuestion = "Why do you deserve to be awarded this scholarship?";
        } else {
          lastQuestion = "What is your plan to finance your tuition, travel expenses, and accommodation during your stay in Japan?";
        }
        const defaultQuestions = [firstQuestion, lastQuestion];
        const generatedQuestions = user.questions || [];
        const allQuestions = [...generatedQuestions, ...defaultQuestions];
        const answers = user.interviewResponses || [];

        if (allQuestions.length !== answers.length) {
          console.log(`   ⚠️  Saltando: número de preguntas (${allQuestions.length}) y respuestas (${answers.length}) no coincide`);
          errorCount++;
          errors.push({
            user: user.email,
            error: `Mismatch: ${allQuestions.length} questions vs ${answers.length} answers`
          });
          continue;
        }

        if (answers.length === 0) {
          console.log(`   ⚠️  Saltando: no hay respuestas`);
          errorCount++;
          errors.push({
            user: user.email,
            error: 'No answers found'
          });
          continue;
        }

        console.log(`   🔄 Generando recomendaciones...`);

        // Generar recomendaciones usando la función existente
        // Solo necesitamos las recomendaciones, no las evaluaciones individuales
        const { recommendations } = await calculateScoreBasedOnAnswers(allQuestions, answers);

        if (!recommendations || recommendations.trim() === '') {
          console.log(`   ⚠️  No se generaron recomendaciones`);
          errorCount++;
          errors.push({
            user: user.email,
            error: 'Empty recommendations generated'
          });
          continue;
        }

        // Actualizar el usuario con las recomendaciones
        const updatedUser = await User.findByIdAndUpdate(
          user._id,
          { interviewRecommendations: recommendations },
          { new: true }
        );

        if (updatedUser) {
          console.log(`   ✅ Recomendaciones generadas y guardadas exitosamente`);
          successCount++;
        } else {
          console.log(`   ❌ Error al guardar recomendaciones`);
          errorCount++;
          errors.push({
            user: user.email,
            error: 'Failed to save recommendations'
          });
        }

        // Pequeña pausa para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`   ❌ Error procesando usuario: ${error.message}`);
        errorCount++;
        errors.push({
          user: user.email,
          error: error.message
        });
      }
    }

    // ============================================
    // REPORTE FINAL
    // ============================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 REPORTE FINAL\n');
    console.log(`✅ Usuarios procesados exitosamente: ${successCount}`);
    console.log(`❌ Usuarios con errores: ${errorCount}`);
    console.log(`📈 Total procesado: ${users.length}\n`);

    if (errors.length > 0) {
      console.log('⚠️  ERRORES ENCONTRADOS:');
      console.log('-'.repeat(80));
      errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.user}: ${err.error}`);
      });
      console.log('');
    }

    console.log('✅ Proceso completado\n');
    
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error general:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Ejecutar el script
generateRecommendations();
