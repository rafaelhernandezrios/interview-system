import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    
    // Application Status
    step1Completed: { type: Boolean, default: false },
    step2Completed: { type: Boolean, default: false },
    step3Completed: { type: Boolean, default: false },
    step4Completed: { type: Boolean, default: false },
    currentStep: { type: Number, default: 1 }, // 1-4
    
    // Section 1: Basic Info
    email: { type: String }, // Pre-filled from auth
    promotionalCode: { type: String },
    
    // Section 2: Personal & Contact
    firstName: { type: String },
    lastName: { type: String },
    sex: { type: String, enum: ['Man', 'Woman'] },
    dateOfBirth: { type: Date },
    countryOfCitizenship: { type: String },
    countryOfResidency: { type: String },
    primaryPhoneType: { type: String, enum: ['Mobile', 'Home', 'Work'] },
    phoneNumber: { type: String },
    linkedInProfileUrl: { type: String },
    hasMedicalCondition: { type: Boolean, default: false },
    medicalConditionDetails: { type: String },
    
    // Section 3: Academic Background
    cvUrl: { type: String },
    institutionName: { type: String },
    mainAcademicMajor: { type: String },
    otherStudiesCertifications: { type: String },
    currentSemester: { type: String },
    participationInChallenges: { type: String },
    awardsAndDistinctions: { type: String },
    portfolioUrl: { type: String },
    hasAcademicPublications: { type: Boolean, default: false },
    
    // Section 4: Language
    englishLevel: { 
      type: String, 
      enum: ['A0/A1', 'A2', 'B1', 'B2', 'C1', 'C2'] 
    },
    hasEnglishCertification: { type: Boolean, default: false },
    
    // Section 5: Program Specifics (EmFuTech)
    appliedBefore: { type: Boolean, default: false },
    paymentSource: { 
      type: String, 
      enum: ['Parents', 'Self', 'University', 'Scholarship', 'Other'] 
    },
    
    // Section 6: Legal & Submit
    plagiarismCheckConfirmed: { type: Boolean, default: false },
    signature: { type: String },
    
    // Draft status
    isDraft: { type: Boolean, default: true },
    lastSavedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Note: userId already has unique: true which automatically creates an index
// No need to add explicit index to avoid duplicate index warning

const Application = mongoose.model("Application", applicationSchema);
export default Application;

