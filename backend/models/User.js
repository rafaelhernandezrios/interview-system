import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, required: true },
    academic_level: { type: String, required: true },
    program: { type: String, enum: ['MIRI', 'EMFUTECH', 'JCTI', 'MIRAITEACH', 'FUTURE_INNOVATORS_JAPAN', 'OTHER'], required: false },
    digitalId: { type: String, unique: true }, // Formato: PROGRAMA-AÑO-NÚMERO (ej: MIRI-2025-1)
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    profilePhoto: { type: String }, // URL or path to profile photo
    
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
    interviewVideoTranscription: { type: String }, // Transcription of the presentation video
    interviewScore: { type: Number },
    interviewAnalysis: [{ 
      score: { type: Number },
      explanation: { type: String }
    }],
    interviewRecommendations: { type: String }, // Analysis and recommendations for improvement
    interviewCompleted: { type: Boolean, default: false },
    retakeReason: { type: String }, // Reason for retaking the interview
    satisfactionSurvey: {
      rating: { type: Number }, // 1-5 rating
      comments: { type: String }, // Comments and improvements
      submittedAt: { type: Date }
    },
    reports: [{
      type: { type: String, enum: ['problem', 'survey', 'feedback'], required: true }, // Type of report
      subject: { type: String }, // Subject/title of the report
      message: { type: String, required: true }, // Report message
      submittedAt: { type: Date, default: Date.now }, // When the report was submitted
      resolved: { type: Boolean, default: false }, // Whether the report has been resolved
      resolvedAt: { type: Date }, // When the report was resolved
      resolvedBy: { type: String }, // Admin who resolved it
      messages: [{ // Thread of messages between user and admin
        sender: { type: String, enum: ['user', 'admin'], required: true }, // Who sent the message
        senderName: { type: String }, // Name of the sender (for admin responses)
        message: { type: String, required: true }, // Message content
        sentAt: { type: Date, default: Date.now } // When the message was sent
      }]
    }],
    
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
  },
  { timestamps: true }
);

// Especificar explícitamente la colección "users" en la base de datos "mirai-interviews"
const User = mongoose.model("User", userSchema, "users");
export default User;

