import { PDFExtract } from 'pdf.js-extract';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extracción de texto del PDF
export async function extractTextFromPdf(pdfPathOrUrl) {
  try {
    let pdfBuffer;
    
    // Determinar si es una URL (S3) o una ruta local
    if (pdfPathOrUrl.startsWith('http://') || pdfPathOrUrl.startsWith('https://')) {
      // Es una URL (S3 o servidor remoto)
      const response = await axios.get(pdfPathOrUrl, {
        responseType: 'arraybuffer'
      });
      pdfBuffer = Buffer.from(response.data);
    } else if (pdfPathOrUrl.startsWith('/api/users/uploads/')) {
      // Es una ruta relativa del servidor, convertir a ruta absoluta
      const fileName = path.basename(pdfPathOrUrl);
      const filePath = path.join(__dirname, '../uploads/cvs', fileName);
      if (!fs.existsSync(filePath)) {
        throw new Error('Archivo no encontrado en el servidor');
      }
      pdfBuffer = fs.readFileSync(filePath);
    } else {
      // Asumir que es una ruta de archivo local absoluta
      if (!fs.existsSync(pdfPathOrUrl)) {
        throw new Error('Archivo no encontrado');
      }
      pdfBuffer = fs.readFileSync(pdfPathOrUrl);
    }
    
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extractBuffer(pdfBuffer, {});
    const text = data.pages
      .map(page => page.content.map(item => item.str).join(' '))
      .join('\n');
    
    return text.trim();
  } catch (error) {
    console.error('Error al extraer texto del PDF:', error);
    throw error;
  }
}

// Normalización de nombres de habilidades
function normalizeSkillName(skill) {
  if (!skill || typeof skill !== 'string') return null;
  
  // Remover caracteres especiales y espacios extra
  let normalized = skill
    .trim()
    .replace(/\*\*/g, '') // Remove markdown bold
    .replace(/[-•]\s*/g, '') // Remove bullets
    .replace(/\n/g, ' ') // Replace newlines
    .replace(/\s+/g, ' ') // Multiple spaces to one
    .trim();
  
  // Normalizar nombres comunes de habilidades
  const skillNormalizations = {
    // Programming languages
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'c++': 'C++',
    'c#': 'C#',
    '.net': '.NET',
    'ai/ml': 'Machine Learning',
    'ml': 'Machine Learning',
    'ai': 'Artificial Intelligence',
    'ros': 'ROS (Robot Operating System)',
    
    // Soft skills
    'team work': 'Teamwork',
    'team-work': 'Teamwork',
    'project management': 'Project Management',
    'time management': 'Time Management',
    'problem solving': 'Problem Solving',
    'critical thinking': 'Critical Thinking',
    'communication skills': 'Communication',
    'public speaking': 'Public Speaking',
    
    // Technical skills
    'cad': 'CAD',
    'solidworks': 'SolidWorks',
    'fusion 360': 'Fusion 360',
    'web development': 'Web Development',
    'mobile development': 'Mobile Development',
  };
  
  const lowerSkill = normalized.toLowerCase();
  if (skillNormalizations[lowerSkill]) {
    normalized = skillNormalizations[lowerSkill];
  }
  
  // Capitalizar primera letra de cada palabra (Title Case)
  normalized = normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  // Validar que sea una habilidad válida
  if (normalized.length < 2 || normalized.length > 50) {
    return null;
  }
  
  return normalized;
}

// Análisis de CV con OpenAI
export async function analyzeCvText(text) {
  try {
    const systemPrompt = `You are an expert CV analyst specialized in extracting technical and soft skills consistently.

Your task is to extract ONLY skill names from CVs. Follow these strict rules:

1. Extract BOTH hard skills (technical) AND soft skills (interpersonal)
2. Each skill must be a SINGLE, CLEAR skill name (2-50 characters)
3. Use standard, professional skill names (e.g., "Python", "JavaScript", "Leadership", "Project Management")
4. Do NOT include:
   - Descriptions or explanations
   - Company names or locations
   - Job titles or positions
   - Years of experience
   - Technologies mentioned in passing
   - Generic terms like "experience" or "knowledge"
5. Group similar skills under the most common name (e.g., use "JavaScript" not "JS" or "Javascript")
6. Extract 15-30 relevant skills maximum
7. Prioritize skills that are:
   - Explicitly mentioned in the CV
   - Part of job descriptions
   - Listed in skills sections
   - Demonstrated through projects

Return ONLY a JSON object with this exact format:
{"skills": ["Skill1", "Skill2", "Skill3", ...]}

Example output:
{"skills": ["Python", "JavaScript", "React", "Node.js", "MongoDB", "Leadership", "Project Management", "Teamwork", "Problem Solving", "Communication"]}`;

    const userPrompt = `Analyze the following CV text and extract all relevant hard and soft skills.

CV Text:
${text.substring(0, 8000)}${text.length > 8000 ? '\n[... text truncated ...]' : ''}

Return the skills as a JSON object with a 'skills' array.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.2, // Lower temperature for more consistency
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content.trim();
    
    // Clean content if it has markdown
    let cleanedContent = content;
    if (content.startsWith('```json')) {
      cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (content.startsWith('```')) {
      cleanedContent = content.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(cleanedContent);
    let skills = parsed.skills || [];
    
    // Normalizar y limpiar habilidades
    const normalizedSkills = skills
      .map(skill => normalizeSkillName(skill))
      .filter(skill => skill !== null && skill.length > 0)
      .filter((skill, index, self) => self.indexOf(skill) === index); // Remove duplicates
    
    // Ordenar habilidades: primero hard skills (técnicas), luego soft skills
    const hardSkillsKeywords = [
      'python', 'javascript', 'java', 'c++', 'c#', 'react', 'node', 'sql', 'mongodb',
      'aws', 'docker', 'kubernetes', 'git', 'linux', 'cad', 'solidworks', 'tensorflow',
      'machine learning', 'artificial intelligence', 'ros', 'robotics', 'programming',
      'development', 'design', 'engineering', 'data', 'analytics', 'cloud', 'devops'
    ];
    
    const sortedSkills = normalizedSkills.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aIsHard = hardSkillsKeywords.some(keyword => aLower.includes(keyword));
      const bIsHard = hardSkillsKeywords.some(keyword => bLower.includes(keyword));
      
      if (aIsHard && !bIsHard) return -1;
      if (!aIsHard && bIsHard) return 1;
      return a.localeCompare(b);
    });
    
    return sortedSkills;
  } catch (error) {
    console.error("Error in analyzeCvText:", error);
    return [];
  }
}

// Generación de preguntas de entrevista
export async function generateQuestions(skills) {
  try {
    const prompt = `
Based on the following skills extracted from the CV, generate 10 interview questions in English:
- 5 questions about hard skills.
- 5 questions about soft skills.

Skills found in the CV:
${skills.join(", ")}

Respond ONLY in the following format, without adding anything else:
1. Question about hard skill
2. Question about hard skill
3. Question about hard skill
4. Question about hard skill
5. Question about hard skill
6. Question about soft skill
7. Question about soft skill
8. Question about soft skill
9. Question about soft skill
10. Question about soft skill
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    let questions = response.choices[0].message.content
      .split("\n")
      .map(q => q.replace(/^\d+\.\s*/, "").trim())
      .filter(q => q.length > 0);

    return questions.slice(0, 10);
  } catch (error) {
    console.error("Error in generateQuestions:", error);
    return [];
  }
}

// Evaluación de respuestas de entrevista
export async function calculateScoreBasedOnAnswers(questions, answers) {
  try {
    if (!questions || !answers || questions.length !== answers.length) {
      throw new Error("Number of questions and answers do not match.");
    }

    const prompt = `
You are an expert evaluator of technical interviews and soft skills. 
Evaluate the following answers on a scale from 0 to 100 based on their quality, clarity, and relevance to the question. 

For each answer, provide:
1. A score between 0 and 100.
2. A brief explanation of the evaluation.

Here are the questions and answers:

${questions.map((q, i) => `Question ${i + 1}: ${q}\nAnswer ${i + 1}: ${answers[i]}\n`).join("\n")}

Respond ONLY in the following JSON format with an object containing an "evaluations" array:
{
  "evaluations": [
    { "score": 85, "explanation": "Clear and well-founded answer with examples." },
    { "score": 70, "explanation": "Good answer but lacks detail." }
  ]
}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    let content = response.choices[0].message.content.trim();
    // Limpiar el contenido si tiene markdown
    if (content.startsWith('```json')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(content);
    const evaluation = parsed.evaluations || [];

    const total_score = evaluation.length > 0
      ? evaluation.reduce((acc, item) => acc + item.score, 0) / evaluation.length
      : 0;

    return {
      total_score: Math.round(total_score),
      evaluations: evaluation,
    };
  } catch (error) {
    console.error("Error evaluating answers:", error);
    return {
      total_score: 0,
      evaluations: [],
      error: "Error evaluating answers",
    };
  }
}

// Evaluación de Habilidades Blandas
export const evaluateSoftSkills = (responses) => {
  const competencies = {
    "Cognitiva": {
      "Pensamiento Analítico": [1, 21, 41, 61, 81, 101, 121, 141],
      "Respuesta ante los problemas": [2, 22, 42, 62, 82, 102, 122, 142],
      "Iniciativa": [3, 23, 43, 63, 83, 103, 123, 143]
    },
    "Afectiva": {
      "Autoestima": [4, 24, 44, 64, 84, 104, 124, 144],
      "Motivación": [5, 25, 45, 65, 85, 105, 125, 145]
    },
    "Social": {
      "Comunicación": [6, 26, 46, 66, 86, 106, 126, 146],
      "Trabajo en equipo": [7, 27, 47, 67, 87, 107, 127, 147],
      "Liderazgo": [8, 28, 48, 68, 88, 108, 128, 148]
    },
    "Moral": {
      "Ética": [9, 29, 49, 69, 89, 109, 129, 149],
      "Responsabilidad": [10, 30, 50, 70, 90, 110, 130, 150]
    },
    "Acometimiento": {
      "Perseverancia": [11, 31, 51, 71, 91, 111, 131, 151],
      "Adaptabilidad": [12, 32, 52, 72, 92, 112, 132, 152],
      "Orientación a resultados": [13, 33, 53, 73, 93, 113, 133, 153]
    },
    "Directriz": {
      "Planificación": [14, 34, 54, 74, 94, 114, 134, 154],
      "Organización": [15, 35, 55, 75, 95, 115, 135, 155],
      "Control": [16, 36, 56, 76, 96, 116, 136, 156]
    },
    "Gestión": {
      "Gestión del tiempo": [17, 37, 57, 77, 97, 117, 137, 157],
      "Gestión de recursos": [18, 38, 58, 78, 98, 118, 138, 158]
    },
    "Alto potencial": {
      "Innovación": [19, 39, 59, 79, 99, 119, 139, 159],
      "Visión estratégica": [20, 40, 60, 80, 100, 120, 140, 160]
    }
  };

  const scoreLevels = {
    "Cognitiva": {
      "Nivel muy bajo": [24, 78],
      "Nivel bajo": [79, 85],
      "Nivel medio": [86, 105],
      "Nivel alto": [106, 115],
      "Nivel muy alto": [116, 120]
    },
    "Afectiva": {
      "Nivel muy bajo": [16, 52],
      "Nivel bajo": [53, 56],
      "Nivel medio": [57, 70],
      "Nivel alto": [71, 76],
      "Nivel muy alto": [77, 80]
    },
    "Social": {
      "Nivel muy bajo": [24, 78],
      "Nivel bajo": [79, 85],
      "Nivel medio": [86, 105],
      "Nivel alto": [106, 115],
      "Nivel muy alto": [116, 120]
    },
    "Moral": {
      "Nivel muy bajo": [16, 52],
      "Nivel bajo": [53, 56],
      "Nivel medio": [57, 70],
      "Nivel alto": [71, 76],
      "Nivel muy alto": [77, 80]
    },
    "Acometimiento": {
      "Nivel muy bajo": [24, 78],
      "Nivel bajo": [79, 85],
      "Nivel medio": [86, 105],
      "Nivel alto": [106, 115],
      "Nivel muy alto": [116, 120]
    },
    "Directriz": {
      "Nivel muy bajo": [24, 78],
      "Nivel bajo": [79, 85],
      "Nivel medio": [86, 105],
      "Nivel alto": [106, 115],
      "Nivel muy alto": [116, 120]
    },
    "Gestión": {
      "Nivel muy bajo": [16, 52],
      "Nivel bajo": [53, 56],
      "Nivel medio": [57, 70],
      "Nivel alto": [71, 76],
      "Nivel muy alto": [77, 80]
    },
    "Alto potencial": {
      "Nivel muy bajo": [16, 52],
      "Nivel bajo": [53, 56],
      "Nivel medio": [57, 70],
      "Nivel alto": [71, 76],
      "Nivel muy alto": [77, 80]
    }
  };

  let results = {};
  let totalScore = 0;

  for (const [competency, skills] of Object.entries(competencies)) {
    let competencyScore = 0;
    let skillResults = {};

    for (const [skill, questions] of Object.entries(skills)) {
      let sum = questions.reduce((acc, qNum) => {
        const responseValue = responses[qNum] || responses[qNum.toString()] || "0";
        return acc + (parseInt(responseValue) || 0);
      }, 0);
      competencyScore += sum;
      skillResults[skill] = { score: sum };
    }

    let level = "Nivel muy bajo";
    if (scoreLevels[competency]) {
      for (const [levelName, range] of Object.entries(scoreLevels[competency])) {
        if (competencyScore >= range[0] && competencyScore <= range[1]) {
          level = levelName;
          break;
        }
      }
    }

    results[competency] = {
      score: competencyScore,
      level,
      skills: skillResults
    };

    totalScore += competencyScore;
  }

  let institutionalLevel = "Nivel muy bajo";
  const institutionalLevels = {
    "Nivel muy bajo": [160, 561],
    "Nivel bajo": [562, 596],
    "Nivel medio": [597, 708],
    "Nivel alto": [709, 757],
    "Nivel muy alto": [758, 800]
  };

  for (const [levelName, range] of Object.entries(institutionalLevels)) {
    if (totalScore >= range[0] && totalScore <= range[1]) {
      institutionalLevel = levelName;
      break;
    }
  }

  return {
    totalScore,
    institutionalLevel,
    results
  };
};

// Evaluación de Habilidades Duras (Inteligencias Múltiples)
export const evaluateMultipleIntelligences = (responses) => {
  const intelligences = {
    "Inteligencia Comunicativa": [9, 10, 17, 22, 30],
    "Inteligencia Matemática": [5, 7, 15, 20, 25],
    "Inteligencia Visual": [1, 11, 14, 23, 27],
    "Inteligencia Motriz": [8, 16, 19, 21, 29],
    "Inteligencia Rítmica": [3, 4, 13, 24, 28],
    "Inteligencia de Autoconocimiento": [2, 6, 26, 31, 33],
    "Inteligencia Social": [12, 18, 32, 34, 35],
  };

  const scoreLevels = {
    "Nivel bajo": [2, 2],
    "Nivel medio": [3, 3],
    "Nivel alto": [4, 5],
  };

  let results = {};
  let totalScore = 0;

  for (const [intelligence, questionNumbers] of Object.entries(intelligences)) {
    let countTrue = questionNumbers.filter((qNum) => {
      const responseValue = responses[qNum] || responses[qNum.toString()] || "0";
      return responseValue === "5" || responseValue === 5;
    }).length;
    
    totalScore += countTrue * 5;

    let level = "Nivel bajo";
    for (const [levelName, range] of Object.entries(scoreLevels)) {
      if (countTrue >= range[0] && countTrue <= range[1]) {
        level = levelName;
        break;
      }
    }

    results[intelligence] = { 
      score: countTrue * 5, 
      level 
    };
  }

  return { totalScore, results };
};

// Transcribe audio from video using Whisper API
export async function transcribeVideoAudio(filePath) {
  try {
    // Create a readable stream from the file for OpenAI
    const fileStream = fs.createReadStream(filePath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    });

    return transcription.trim();
  } catch (error) {
    console.error('Error transcribing audio with Whisper:', error);
    throw new Error('Failed to transcribe audio');
  }
}

