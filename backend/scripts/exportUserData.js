import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/db.js';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ============================================
// SCRIPT PARA EXPORTAR DATOS DE USUARIOS
// ============================================
// Este script extrae información de usuarios específicos de la base de datos

const USER_NAMES = [
  'Alexander Züst',
  'Amuchie Chizitara Princewill',
  'Antony Ramírez Montero',
  'Aylin Louisa Kitte',
  'Barret Smith Feusi',
  'Brittany Nsongo',
  'David de Jesus Garcia Jimenez',
  'Jatniel Azai Maldonado Cevallos',
  'Jesus Dassaef Lopez Barrios',
  'Manuela Gomez Correa',
  'Maximiliano Barajas Sanchez',
  'Oscar Henry Sarmiento Sanchez',
  'Pablo Bermejo Hernández',
  'Pawat Sukkasem',
  'Soham Kothari',
  'Sum Po Ava Chan'
];

async function exportUserData() {
  try {
    // Conectar a la base de datos
    await connectDB();
    console.log('\n📊 Conectado a la base de datos\n');

    // Buscar usuarios por nombre exacto primero
    let users = await User.find({
      name: { $in: USER_NAMES }
    })
    .select('-password -resetPasswordToken -resetPasswordExpires')
    .lean();

    const foundNames = users.map(u => u.name);
    const notFound = USER_NAMES.filter(name => !foundNames.includes(name));

    // Intentar búsqueda flexible para los no encontrados
    if (notFound.length > 0) {
      console.log(`⚠️  Buscando ${notFound.length} usuarios no encontrados con búsqueda flexible...\n`);
      
      for (const searchName of notFound) {
        // Normalizar nombre para búsqueda (remover acentos, espacios extra, etc.)
        const normalizedSearch = searchName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remover acentos
          .trim();
        
        // Buscar todos los usuarios y comparar nombres normalizados
        const allUsers = await User.find({})
          .select('name email')
          .lean();
        
        const matches = allUsers.filter(u => {
          if (!u.name) return false;
          const normalizedUser = u.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
          
          // Buscar coincidencias parciales
          return normalizedUser.includes(normalizedSearch) || 
                 normalizedSearch.includes(normalizedUser) ||
                 normalizedUser === normalizedSearch;
        });
        
        if (matches.length > 0) {
          console.log(`   🔍 "${searchName}" podría ser:`);
          matches.forEach(m => console.log(`      - ${m.name} (${m.email})`));
        }
      }
      console.log('');
    }

    if (users.length === 0) {
      console.log('❌ No se encontraron usuarios con esos nombres');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`✅ Encontrados ${users.length} usuarios de ${USER_NAMES.length} buscados\n`);

    if (notFound.length > 0) {
      console.log('⚠️  Usuarios no encontrados (exacto):');
      notFound.forEach(name => console.log(`   - ${name}`));
      console.log('');
    }

    // Preparar datos para exportación
    const exportData = users.map(user => {
      // Construir preguntas completas
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

      return {
        // Información básica
        name: user.name || '',
        email: user.email || '',
        digitalId: user.digitalId || '',
        program: user.program || '',
        academic_level: user.academic_level || '',
        gender: user.gender || '',
        dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
        
        // CV Analysis
        cvAnalyzed: user.cvAnalyzed || false,
        cvScore: user.score || null,
        skills: (user.skills || []).join(', '),
        cvAnalysis: user.analysis || '',
        
        // Interview
        interviewCompleted: user.interviewCompleted || false,
        interviewScore: user.interviewScore || null,
        interviewRecommendations: user.interviewRecommendations || '',
        
        // Questions and Answers
        questions: allQuestions,
        answers: user.interviewResponses || [],
        interviewAnalysis: user.interviewAnalysis || [],
        
        // Video
        interviewVideo: user.interviewVideo || '',
        interviewVideoTranscription: user.interviewVideoTranscription || '',
        
        // Additional info
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : '',
        updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : '',
        role: user.role || 'user',
        isActive: user.isActive || false
      };
    });

    // Crear directorio de salida si no existe
    const outputDir = path.join(__dirname, '../user_exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // ============================================
    // EXPORTAR A JSON
    // ============================================
    const jsonFileName = `user_data_export_${Date.now()}.json`;
    const jsonFilePath = path.join(outputDir, jsonFileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(exportData, null, 2));
    console.log(`✅ Datos JSON exportados: ${jsonFileName}`);

    // ============================================
    // EXPORTAR A EXCEL
    // ============================================
    // Preparar datos para Excel (formato plano)
    const excelData = users.map(user => {
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

      return {
        'Nombre': user.name || '',
        'Email': user.email || '',
        'Digital ID': user.digitalId || '',
        'Programa': user.program || '',
        'Nivel Académico': user.academic_level || '',
        'Género': user.gender || '',
        'Fecha de Nacimiento': user.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
        'CV Analizado': user.cvAnalyzed ? 'Sí' : 'No',
        'Score CV': user.score !== undefined && user.score !== null ? user.score : 'N/A',
        'Habilidades': (user.skills || []).join(', '),
        'Entrevista Completada': user.interviewCompleted ? 'Sí' : 'No',
        'Score Entrevista': user.interviewScore !== undefined && user.interviewScore !== null ? user.interviewScore : 'N/A',
        'Tiene Recomendaciones': user.interviewRecommendations ? 'Sí' : 'No',
        'Número de Preguntas': allQuestions.length,
        'Número de Respuestas': answers.length,
        'Tiene Video': user.interviewVideo ? 'Sí' : 'No',
        'Fecha de Creación': user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : '',
        'Rol': user.role || 'user',
        'Activo': user.isActive ? 'Sí' : 'No'
      };
    });

    // ============================================
    // PREPARAR DATOS DE PREGUNTAS Y RESPUESTAS PARA EXCEL
    // ============================================
    const questionsAnswersData = [];
    
    users.forEach(user => {
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
      
      // Agregar una fila por cada pregunta/respuesta
      allQuestions.forEach((question, index) => {
        questionsAnswersData.push({
          'Nombre': user.name || '',
          'Email': user.email || '',
          'Número de Pregunta': index + 1,
          'Pregunta': question,
          'Respuesta': answers[index] || 'Sin respuesta',
          'Análisis': user.interviewAnalysis && user.interviewAnalysis[index] 
            ? (typeof user.interviewAnalysis[index] === 'string' 
                ? user.interviewAnalysis[index] 
                : user.interviewAnalysis[index].explanation || '')
            : 'Sin análisis',
          'Score Individual': user.interviewAnalysis && user.interviewAnalysis[index] && typeof user.interviewAnalysis[index] === 'object'
            ? (user.interviewAnalysis[index].score || 'N/A')
            : 'N/A'
        });
      });
    });

    // Crear workbook de Excel con múltiples hojas
    const workbook = XLSX.utils.book_new();
    
    // Hoja 1: Resumen de usuarios
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen Usuarios');

    // Ajustar anchos de columna para resumen
    const columnWidths = [
      { wch: 25 }, // Nombre
      { wch: 30 }, // Email
      { wch: 15 }, // Digital ID
      { wch: 20 }, // Programa
      { wch: 18 }, // Nivel Académico
      { wch: 10 }, // Género
      { wch: 15 }, // Fecha de Nacimiento
      { wch: 12 }, // CV Analizado
      { wch: 10 }, // Score CV
      { wch: 40 }, // Habilidades
      { wch: 18 }, // Entrevista Completada
      { wch: 15 }, // Score Entrevista
      { wch: 18 }, // Tiene Recomendaciones
      { wch: 15 }, // Número de Preguntas
      { wch: 15 }, // Número de Respuestas
      { wch: 12 }, // Tiene Video
      { wch: 15 }, // Fecha de Creación
      { wch: 8 },  // Rol
      { wch: 8 }   // Activo
    ];
    worksheet['!cols'] = columnWidths;

    // Hoja 2: Preguntas y Respuestas
    const qaWorksheet = XLSX.utils.json_to_sheet(questionsAnswersData);
    XLSX.utils.book_append_sheet(workbook, qaWorksheet, 'Preguntas y Respuestas');
    
    // Ajustar anchos de columna para preguntas y respuestas
    const qaColumnWidths = [
      { wch: 25 }, // Nombre
      { wch: 30 }, // Email
      { wch: 12 }, // Número de Pregunta
      { wch: 50 }, // Pregunta
      { wch: 60 }, // Respuesta
      { wch: 50 }, // Análisis
      { wch: 15 }  // Score Individual
    ];
    qaWorksheet['!cols'] = qaColumnWidths;

    // Guardar archivo Excel
    const excelFileName = `user_data_export_${Date.now()}.xlsx`;
    const excelFilePath = path.join(outputDir, excelFileName);
    XLSX.writeFile(workbook, excelFilePath);
    console.log(`✅ Datos Excel exportados: ${excelFileName}`);

    // ============================================
    // EXPORTAR DETALLES COMPLETOS (JSON con todas las respuestas)
    // ============================================
    const detailedFileName = `user_data_detailed_${Date.now()}.json`;
    const detailedFilePath = path.join(outputDir, detailedFileName);
    fs.writeFileSync(detailedFilePath, JSON.stringify(exportData, null, 2));
    console.log(`✅ Datos detallados exportados: ${detailedFileName}`);

    // ============================================
    // REPORTE
    // ============================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 REPORTE DE EXPORTACIÓN\n');
    console.log(`✅ Total usuarios exportados: ${users.length}`);
    console.log(`📁 Archivos guardados en: ${outputDir}\n`);
    console.log('Archivos generados:');
    console.log(`  1. ${jsonFileName} - Datos en formato JSON`);
    console.log(`  2. ${excelFileName} - Resumen en formato Excel`);
    console.log(`  3. ${detailedFileName} - Datos completos con preguntas y respuestas\n`);

    if (notFound.length > 0) {
      console.log(`⚠️  ${notFound.length} usuarios no encontrados en la base de datos\n`);
    }

    console.log('✅ Exportación completada\n');
    
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Ejecutar el script
exportUserData();
