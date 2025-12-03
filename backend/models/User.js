import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, required: true },
    academic_level: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    
    // CV y análisis
    cvPath: { type: String },
    cvText: { type: String },
    analysis: { type: String },
    skills: [{ type: String }],
    questions: [{ type: String }],
    score: { type: Number },
    cvAnalyzed: { type: Boolean, default: false },
    
    // Entrevista
    interviewResponses: [{ type: String }],
    interviewVideo: { type: String }, // Video file path
    interviewScore: { type: Number },
    interviewAnalysis: [{ 
      score: { type: Number },
      explanation: { type: String }
    }],
    interviewCompleted: { type: Boolean, default: false },
    
    // Cuestionarios
    softSkillsResults: {
      results: { type: mongoose.Schema.Types.Mixed },
      totalScore: { type: Number },
      institutionalLevel: { type: String }
    },
    softSkillsSurveyCompleted: { type: Boolean, default: false },
    
    hardSkillsResults: {
      results: { type: mongoose.Schema.Types.Mixed },
      totalScore: { type: Number }
    },
    hardSkillsSurveyCompleted: { type: Boolean, default: false },
    
    // CV generado
    generatedCV: { type: String },
  },
  { timestamps: true }
);

// Especificar explícitamente la colección "users" en la base de datos "mirai-interviews"
const User = mongoose.model("User", userSchema, "users");
export default User;

