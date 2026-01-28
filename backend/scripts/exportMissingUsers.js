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
// SCRIPT PARA BUSCAR USUARIOS FALTANTES
// ============================================
// Este script busca usuarios específicos con búsqueda flexible

const SEARCH_NAMES = [
  'David de Jesus Garcia Jimenez',
  'Maximiliano Barajas Sanchez'
];

// Variaciones posibles de los nombres
const NAME_VARIATIONS = {
  'David de Jesus Garcia Jimenez': [
    'David de Jesus Garcia Jimenez',
    'David de Jesús Garcia Jimenez',
    'David de Jesus García Jimenez',
    'David de Jesús García Jimenez',
    'David Garcia Jimenez',
    'David García Jimenez',
    'David Garcia',
    'David García',
    'Garcia Jimenez',
    'García Jimenez'
  ],
  'Maximiliano Barajas Sanchez': [
    'Maximiliano Barajas Sanchez',
    'Maximiliano Barajas Sánchez',
    'Maximiliano Barajas',
    'Barajas Sanchez',
    'Barajas Sánchez',
    'Maximiliano Sanchez',
    'Maximiliano Sánchez'
  ]
};

async function findMissingUsers() {
  try {
    // Conectar a la base de datos
    await connectDB();
    console.log('\n📊 Conectado a la base de datos\n');

    const foundUsers = [];
    const notFoundUsers = [];

    // Buscar cada usuario con diferentes estrategias
    for (const searchName of SEARCH_NAMES) {
      console.log(`\n🔍 Buscando: "${searchName}"`);
      console.log('-'.repeat(60));

      let found = false;
      const variations = NAME_VARIATIONS[searchName] || [searchName];

      // Estrategia 1: Búsqueda exacta
      let users = await User.find({
        name: { $in: variations }
      })
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .lean();

      if (users.length > 0) {
        console.log(`   ✅ Encontrado con búsqueda exacta:`);
        users.forEach(u => {
          console.log(`      - ${u.name} (${u.email})`);
          if (!foundUsers.find(fu => fu.email === u.email)) {
            foundUsers.push(u);
          }
        });
        found = true;
      }

      // Estrategia 2: Búsqueda por partes del nombre
      if (!found) {
        const nameParts = searchName.toLowerCase().split(' ').filter(p => p.length > 2);
        const regexPatterns = nameParts.map(part => new RegExp(part, 'i'));
        
        users = await User.find({
          $or: regexPatterns.map(pattern => ({ name: pattern }))
        })
        .select('-password -resetPasswordToken -resetPasswordExpires')
        .lean();

        // Filtrar resultados más relevantes
        const relevantUsers = users.filter(u => {
          if (!u.name) return false;
          const userName = u.name.toLowerCase();
          const searchLower = searchName.toLowerCase();
          
          // Debe contener al menos 2 palabras del nombre buscado
          const matchingWords = nameParts.filter(part => userName.includes(part));
          return matchingWords.length >= 2;
        });

        if (relevantUsers.length > 0) {
          console.log(`   ✅ Encontrado con búsqueda por partes:`);
          relevantUsers.forEach(u => {
            console.log(`      - ${u.name} (${u.email})`);
            if (!foundUsers.find(fu => fu.email === u.email)) {
              foundUsers.push(u);
            }
          });
          found = true;
        }
      }

      // Estrategia 3: Búsqueda flexible (normalizada)
      if (!found) {
        const normalizedSearch = searchName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remover acentos
          .trim();

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

          // Buscar coincidencias parciales significativas
          const searchWords = normalizedSearch.split(' ').filter(w => w.length > 3);
          const userWords = normalizedUser.split(' ').filter(w => w.length > 3);
          
          // Debe tener al menos 2 palabras en común
          const commonWords = searchWords.filter(sw => 
            userWords.some(uw => uw.includes(sw) || sw.includes(uw))
          );
          
          return commonWords.length >= 2 || 
                 normalizedUser.includes(normalizedSearch) || 
                 normalizedSearch.includes(normalizedUser);
        });

        if (matches.length > 0) {
          console.log(`   ✅ Posibles coincidencias:`);
          matches.forEach(m => {
            console.log(`      - ${m.name} (${m.email})`);
          });
          
          // Obtener datos completos de los matches
          const fullMatches = await User.find({
            email: { $in: matches.map(m => m.email) }
          })
          .select('-password -resetPasswordToken -resetPasswordExpires')
          .lean();

          fullMatches.forEach(u => {
            if (!foundUsers.find(fu => fu.email === u.email)) {
              foundUsers.push(u);
            }
          });
          found = true;
        }
      }

      if (!found) {
        console.log(`   ❌ No encontrado`);
        notFoundUsers.push(searchName);
      }
    }

    if (foundUsers.length === 0) {
      console.log('\n❌ No se encontraron usuarios');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`\n\n✅ Total usuarios encontrados: ${foundUsers.length}\n`);

    // Preparar datos para exportación
    const exportData = foundUsers.map(user => {
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
    const jsonFileName = `missing_users_export_${Date.now()}.json`;
    const jsonFilePath = path.join(outputDir, jsonFileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(exportData, null, 2));
    console.log(`✅ Datos JSON exportados: ${jsonFileName}`);

    // ============================================
    // EXPORTAR A EXCEL
    // ============================================
    // Preparar datos para Excel (formato plano)
    const excelData = foundUsers.map(user => {
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

    // Preparar datos de preguntas y respuestas
    const questionsAnswersData = [];
    
    foundUsers.forEach(user => {
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
    const excelFileName = `missing_users_export_${Date.now()}.xlsx`;
    const excelFilePath = path.join(outputDir, excelFileName);
    XLSX.writeFile(workbook, excelFilePath);
    console.log(`✅ Datos Excel exportados: ${excelFileName}`);

    // ============================================
    // REPORTE
    // ============================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 REPORTE DE EXPORTACIÓN\n');
    console.log(`✅ Total usuarios encontrados: ${foundUsers.length}`);
    console.log(`📁 Archivos guardados en: ${outputDir}\n`);
    console.log('Archivos generados:');
    console.log(`  1. ${jsonFileName} - Datos en formato JSON`);
    console.log(`  2. ${excelFileName} - Resumen y preguntas/respuestas en Excel\n`);

    if (notFoundUsers.length > 0) {
      console.log(`⚠️  ${notFoundUsers.length} usuarios no encontrados:`);
      notFoundUsers.forEach(name => console.log(`   - ${name}`));
      console.log('');
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
findMissingUsers();
