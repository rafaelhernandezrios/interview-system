import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';

const Interview = () => {
  const [questions, setQuestions] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]); // Includes default questions
  const [answers, setAnswers] = useState([]);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes per question (180 seconds)
  const [timerActive, setTimerActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  
  // Unified recording refs
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // Unified recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [answerSaved, setAnswerSaved] = useState(false); // Track if answer was saved
  const [videoAnswers, setVideoAnswers] = useState([]); // Store video answers for each question

  // Default questions
  const defaultQuestions = [
    "What is your motivation for wanting to come to Mirai Innovation Research Institute?",
    "How do you plan to finance your stay and the program in Japan?"
  ];

  useEffect(() => {
    fetchProfile();
    
    // Prevent text selection and copy on the entire page
    const preventSelection = (e) => {
      // Allow selection only in textareas (for answers)
      if (e.target.tagName === 'TEXTAREA' || e.target.closest('textarea')) {
        return;
      }
      e.preventDefault();
    };

    const preventCopy = (e) => {
      // Allow copy only in textareas (for answers)
      if (e.target.tagName === 'TEXTAREA' || e.target.closest('textarea')) {
        return;
      }
      e.preventDefault();
    };

    const preventContextMenu = (e) => {
      // Allow context menu only in textareas (for answers)
      if (e.target.tagName === 'TEXTAREA' || e.target.closest('textarea')) {
        return;
      }
      e.preventDefault();
    };

    // Add event listeners
    document.addEventListener('selectstart', preventSelection);
    document.addEventListener('copy', preventCopy);
    document.addEventListener('contextmenu', preventContextMenu);

    return () => {
      // Cleanup timers
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      // Stop video stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Remove event listeners
      document.removeEventListener('selectstart', preventSelection);
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, []);

  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            handleNextQuestion();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerActive, timeRemaining]);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      
      // Check if interview is already completed
      if (response.data.interviewCompleted) {
        setInterviewCompleted(true);
        return;
      }
      
      if (response.data.questions && response.data.questions.length > 0) {
        const generatedQuestions = response.data.questions;
        // Combine generated questions with default questions
        const combinedQuestions = [...generatedQuestions, ...defaultQuestions];
        setQuestions(generatedQuestions);
        setAllQuestions(combinedQuestions);
        
        // Load saved answers if they exist
        if (response.data.interviewResponses && Array.isArray(response.data.interviewResponses)) {
          const savedAnswers = [...response.data.interviewResponses];
          // Ensure array has correct length
          while (savedAnswers.length < combinedQuestions.length) {
            savedAnswers.push('');
          }
          setAnswers(savedAnswers);
          
          // Find the first unanswered question
          const firstEmptyIndex = savedAnswers.findIndex(answer => !answer || answer.trim() === '');
          if (firstEmptyIndex !== -1) {
            setCurrentQuestionIndex(firstEmptyIndex);
          } else {
            // All questions answered, go to video question
            setCurrentQuestionIndex(combinedQuestions.length);
          }
        } else {
          setAnswers(new Array(combinedQuestions.length).fill(''));
        }
        
        setTimeRemaining(180); // Reset timer to 3 minutes
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const startTimer = () => {
    setTimerActive(true);
  };

  const startInterview = () => {
    setInterviewStarted(true);
    // If we have saved answers, start from where we left off
    // Otherwise start from the beginning
    if (answers.length > 0 && answers.some(a => a && a.trim() !== '')) {
      // Find first unanswered question or continue from current index
      const firstEmptyIndex = answers.findIndex(answer => !answer || answer.trim() === '');
      if (firstEmptyIndex !== -1) {
        setCurrentQuestionIndex(firstEmptyIndex);
      }
    } else {
      setCurrentQuestionIndex(0);
    }
    setTimeRemaining(180); // 3 minutes
    setTimerActive(true); // Start timer automatically
  };

  const handleAnswerChange = (value) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = value;
    setAnswers(newAnswers);
    // Auto-save answers
    saveAnswersAuto(newAnswers);
  };

  // Auto-save answers to backend
  const saveAnswersAuto = async (answersToSave) => {
    try {
      await api.post('/users/save-interview-progress', {
        answers: answersToSave,
        currentQuestionIndex: currentQuestionIndex
      });
    } catch (error) {
      console.error('Error auto-saving answers:', error);
      // Don't show error to user, just log it
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    alert('Pasting text is not allowed in this interview.');
  };

  const handleNextQuestion = () => {
    // Stop any active recordings before moving to next question
    if (isRecording) {
      stopUnifiedRecording();
    }
    
    // Cancel any ongoing transcription immediately
    setIsTranscribing(false);
    
    // Save current progress before moving to next question
    saveAnswersAuto(answers);
    
    // Reset ALL states for next question
    setRecordedVideo(null);
    setVideoBlob(null);
    setTranscribedText('');
    setIsReviewMode(false);
    setIsTranscribing(false);
    setAnswerSaved(false); // Reset answer saved flag
    setRecordingTime(0);
    setError('');
    setMessage('');
    
    // Clear video stream if exists
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear media recorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Clear video answers for current question before moving
    const newVideoAnswers = [...videoAnswers];
    newVideoAnswers[currentQuestionIndex] = null;
    setVideoAnswers(newVideoAnswers);
    
    if (currentQuestionIndex < allQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTimeRemaining(180); // Reset timer to 3 minutes for next question
      setTimerActive(true); // Auto-start timer for next question
    } else if (currentQuestionIndex === allQuestions.length - 1) {
      // Move to video question (final question)
      setCurrentQuestionIndex(allQuestions.length);
      setTimerActive(false); // No timer for video question
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      // Stop any active recordings
      if (isRecording) {
        stopUnifiedRecording();
      }
      
      // Reset states when going back
      setRecordedVideo(null);
      setVideoBlob(null);
      setTranscribedText('');
      setIsReviewMode(false);
      setIsTranscribing(false);
      setRecordingTime(0);
      setError('');
      setMessage('');
      
      // Clear video stream if exists
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear media recorder
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      
      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setTimeRemaining(180); // Reset timer to 3 minutes
      setTimerActive(true); // Auto-start timer when going back
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Unified recording function - starts video + audio recording with speech recognition
  const startUnifiedRecording = async () => {
    try {
      // Reset states
      setTranscribedText('');
      setIsReviewMode(false);
      setError('');

      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start video recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setVideoBlob(blob);
        const videoURL = URL.createObjectURL(blob);
        setRecordedVideo(videoURL);
        
        // Store video blob for current question
        const newVideoAnswers = [...videoAnswers];
        newVideoAnswers[currentQuestionIndex] = blob;
        setVideoAnswers(newVideoAnswers);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer (1 minute max)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopUnifiedRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error accessing camera/microphone:', error);
      setError('Could not access camera or microphone. Please check permissions.');
    }
  };

  const stopUnifiedRecording = () => {
    // Stop video recording
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Stop timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    setIsRecording(false);
    // Transcription will happen when videoBlob is ready (in useEffect)
  };

  // Transcribe video when blob is ready
  useEffect(() => {
    // Only transcribe if we have a video blob, not recording, not already transcribing, not in review mode, and answer not saved
    // Also check that we're not in the middle of changing questions
    if (videoBlob && !isReviewMode && !isRecording && !isTranscribing && !answerSaved && currentQuestionIndex !== undefined) {
      // Small delay to ensure state is stable
      const timeoutId = setTimeout(() => {
        if (videoBlob && !isTranscribing && !answerSaved) {
          transcribeVideo();
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [videoBlob, isRecording, isReviewMode, isTranscribing, answerSaved, currentQuestionIndex]);

  // Reset recording states when question changes
  useEffect(() => {
    // Reset recording-related states when question index changes
    // Only reset if not currently recording
    if (!isRecording) {
      setRecordedVideo(null);
      setVideoBlob(null);
      setTranscribedText('');
      setIsReviewMode(false);
      setIsTranscribing(false);
      setAnswerSaved(false); // Reset answer saved flag
      setRecordingTime(0);
      setError('');
      setMessage('');
      
      // Clear video stream if exists
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear media recorder
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      
      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [currentQuestionIndex, isRecording]);

  const transcribeVideo = async () => {
    if (!videoBlob || isTranscribing) return;

    // Store current question index to prevent transcription for wrong question
    const questionIndexAtStart = currentQuestionIndex;

    try {
      setIsTranscribing(true);
      setError('');
      setMessage('Transcribing audio with Whisper AI...');
      
      const formData = new FormData();
      const videoFile = new File([videoBlob], `recording_${Date.now()}.webm`, {
        type: 'video/webm'
      });
      formData.append('video', videoFile);

      const response = await api.post('/users/transcribe-video', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Only update if we're still on the same question
      if (currentQuestionIndex === questionIndexAtStart) {
        const transcription = response.data.transcription || '';
        setTranscribedText(transcription);
        handleAnswerChange(transcription);
        setMessage('');
        setIsTranscribing(false);
        
        // Enter review mode after transcription
        setIsReviewMode(true);
      } else {
        // Question changed during transcription, just cancel
        setIsTranscribing(false);
        setMessage('');
      }
    } catch (err) {
      console.error('Error transcribing:', err);
      // Only update if we're still on the same question
      if (currentQuestionIndex === questionIndexAtStart) {
        setError('Error transcribing audio. You can still type your answer manually.');
        setMessage('');
        setIsTranscribing(false);
        // Still allow review mode even if transcription fails
        setIsReviewMode(true);
        setTranscribedText('');
      } else {
        setIsTranscribing(false);
        setMessage('');
      }
    }
  };

  const retakeRecording = () => {
    // Cancel any ongoing transcription
    setIsTranscribing(false);
    setAnswerSaved(false); // Reset answer saved flag
    
    // Clear all recording states
    setRecordedVideo(null);
    setVideoBlob(null);
    setRecordingTime(0);
    setTranscribedText('');
    setIsReviewMode(false);
    setError('');
    setMessage('');
    
    // Clear video answers for current question
    const newVideoAnswers = [...videoAnswers];
    newVideoAnswers[currentQuestionIndex] = null;
    setVideoAnswers(newVideoAnswers);
    
    // Clear video stream if exists
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear media recorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Clear answer for current question
    handleAnswerChange('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      // Stop any active recordings
      if (isRecording) {
        stopUnifiedRecording();
      }

      // Prepare FormData for multipart/form-data submission
      const formData = new FormData();
      
      // Add text answers as JSON string
      formData.append('answers', JSON.stringify(answers));
      
      // Add final video question video if available (only for the final video question)
      if (videoBlob && isVideoQuestion) {
        const videoFile = new File([videoBlob], `interview_video_${Date.now()}.webm`, {
          type: 'video/webm'
        });
        formData.append('video', videoFile);
      }

      const response = await api.post('/users/submit-interview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setMessage('Interview submitted successfully');
      setResults(response.data);
      await fetchResults();
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting interview');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await api.get('/users/interview-responses');
      setResults(response.data);
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

  const isLastTextQuestion = currentQuestionIndex === allQuestions.length - 1;
  const isVideoQuestion = currentQuestionIndex >= allQuestions.length; // Video question is after all text questions
  const currentQuestion = isVideoQuestion 
    ? "Please introduce yourself in 1 minute, speaking directly about your projects and skills. Record a video using your webcam."
    : allQuestions[currentQuestionIndex];

  // Show completed message if interview is already completed
  if (interviewCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Interview Completed</h1>
                <p className="text-lg text-gray-600 mb-6">
                  You have already completed the interview. You cannot retake it.
                </p>
                <Link
                  to="/results"
                  className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-lg transition shadow-lg hover:shadow-xl"
                >
                  View Results
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (allQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-100 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded">
            <p className="font-semibold">CV Analysis Required</p>
            <p>You must upload and analyze your CV first to generate interview questions.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show start screen if interview hasn't started
  if (!interviewStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  {answers.length > 0 && answers.some(a => a && a.trim() !== '') 
                    ? 'Continue Interview' 
                    : 'Interview Ready'}
                </h1>
                {answers.length > 0 && answers.some(a => a && a.trim() !== '') ? (
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-green-800 font-semibold mb-2">✓ Progress Saved</p>
                    <p className="text-green-700 text-sm">
                      You have saved answers. You can continue from where you left off.
                    </p>
                  </div>
                ) : null}
                <p className="text-lg text-gray-600 mb-2">
                  You have <span className="font-semibold text-blue-600">{allQuestions.length + 1}</span> questions to answer
                </p>
                <p className="text-gray-500 mb-6">
                  Each question has a time limit of 3 minutes. The timer will start automatically when you begin.
                  {answers.length > 0 && answers.some(a => a && a.trim() !== '') && (
                    <span className="block mt-2 text-green-600 font-semibold">
                      Your progress is automatically saved as you answer.
                    </span>
                  )}
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Instructions:</h3>
                <ul className="text-left text-gray-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Answer each question within the 3-minute time limit</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Copying and pasting text is not allowed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>You can navigate between questions using Previous/Next buttons</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>The final question requires a 1-minute video introduction</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={startInterview}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-12 rounded-lg text-lg transition shadow-lg hover:shadow-xl"
              >
                Start Interview
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Interview Results</h1>

          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <div className="text-center mb-6">
              <p className="text-3xl font-bold text-blue-600">Score: {results.score}%</p>
            </div>

            {results.analysis && results.analysis.map((item, index) => (
              <div key={index} className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-semibold text-lg mb-2 text-gray-900">
                  Question {index + 1}: {results.questions[index]}
                </p>
                <p className="text-gray-600 mb-3">Your answer: {results.responses[index]}</p>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-blue-600">Score: {item.score}/100</span>
                </div>
                <p className="text-sm text-gray-700 mt-3">{item.explanation}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Interview</h1>
          <p className="text-lg text-gray-600">
            {isVideoQuestion 
              ? `Video Introduction (Final Question)`
              : `Question ${currentQuestionIndex + 1} of ${allQuestions.length + 1}`}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6">
            <p>{error}</p>
          </div>
        )}

        {message && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded mb-6">
            <p>{message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round(((isVideoQuestion ? allQuestions.length + 1 : currentQuestionIndex + 1) / (allQuestions.length + 1)) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${((isVideoQuestion ? allQuestions.length + 1 : currentQuestionIndex + 1) / (allQuestions.length + 1)) * 100}%` }}
              ></div>
            </div>
            {/* Questions Status Overview */}
            {!isVideoQuestion && allQuestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {allQuestions.map((_, index) => {
                  const hasAnswer = answers[index] && answers[index].trim() !== '';
                  return (
                    <div
                      key={index}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        index === currentQuestionIndex
                          ? 'ring-4 ring-blue-500 scale-110'
                          : ''
                      } ${
                        hasAnswer
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                      title={`Question ${index + 1}: ${hasAnswer ? 'Answered' : 'Not answered'}`}
                    >
                      {hasAnswer ? '✓' : index + 1}
                    </div>
                  );
                })}
                {/* Video question indicator */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isVideoQuestion
                      ? 'ring-4 ring-blue-500 scale-110'
                      : ''
                  } bg-purple-500 text-white`}
                  title="Video Introduction"
                >
                  🎥
                </div>
              </div>
            )}
          </div>

          {/* Timer */}
          {!isVideoQuestion && (
            <div className="mb-6 flex items-center justify-between bg-blue-50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Time remaining for this question:</p>
                <p className={`text-2xl font-bold ${timeRemaining < 60 ? 'text-red-600' : 'text-blue-600'}`}>
                  {formatTime(timeRemaining)}
                </p>
              </div>
            </div>
          )}

          {/* Question */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <label 
                className="block text-gray-900 text-xl font-bold select-none flex-1"
                style={{ 
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none'
                }}
                onContextMenu={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
              >
                {isVideoQuestion ? currentQuestion : `${currentQuestionIndex + 1}. ${currentQuestion}`}
              </label>
              {/* Answer Status Indicator */}
              {!isVideoQuestion && (
                <div className="flex-shrink-0">
                  {answers[currentQuestionIndex] && answers[currentQuestionIndex].trim() !== '' ? (
                    <div className="flex items-center gap-2 bg-green-100 border-2 border-green-500 rounded-full px-4 py-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-800 font-bold text-sm">Answer Saved</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-yellow-100 border-2 border-yellow-500 rounded-full px-4 py-2">
                      <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-yellow-800 font-bold text-sm">No Answer</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isVideoQuestion ? (
              <div className="space-y-4">
                {/* Video Preview/Recording */}
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  {recordedVideo ? (
                    <video
                      src={recordedVideo}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      className="w-full h-full object-contain"
                      style={{ display: isRecording ? 'block' : 'none' }}
                    />
                  )}
                  {!isRecording && !recordedVideo && (
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p className="text-lg">Camera preview will appear here</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recording Controls */}
                <div className="flex items-center justify-center gap-4">
                  {!isRecording && !recordedVideo && (
                    <button
                      type="button"
                      onClick={startUnifiedRecording}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      Start Recording
                    </button>
                  )}

                  {isRecording && (
                    <>
                      <button
                        type="button"
                        onClick={stopUnifiedRecording}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                        </svg>
                        Stop Recording ({60 - recordingTime}s)
                      </button>
                    </>
                  )}

                  {recordedVideo && (
                    <button
                      type="button"
                      onClick={retakeRecording}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                    >
                      Retake Video
                    </button>
                  )}
                </div>

                <p className="text-sm text-gray-600 text-center">
                  Maximum recording time: 1 minute. Please speak about your projects and skills.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Transcription Status - Show prominently when transcribing (BEFORE review mode) */}
                {isTranscribing && !isReviewMode && (
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 border-4 border-blue-300 rounded-xl p-8 text-center mb-6 shadow-2xl animate-pulse">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent"></div>
                        <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white mb-2">🔄 Transcribing Audio...</p>
                        <p className="text-lg text-blue-100">Using Whisper AI to convert your speech to text</p>
                        <p className="text-sm text-blue-200 mt-2">Please wait, this may take a few seconds</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Answer Saved Confirmation */}
                {answerSaved && !isReviewMode && !isTranscribing && (
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 border-4 border-green-300 rounded-xl p-6 text-center mb-6 shadow-2xl">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-2xl font-bold text-white mb-2">✓ Answer Saved Successfully!</p>
                        <p className="text-lg text-green-100">Your answer has been saved. You can now proceed to the next question.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Unified Recording Interface */}
                {!isReviewMode && !isTranscribing && !answerSaved ? (
                  <>
                    {/* Video Preview/Recording */}
                    <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        className="w-full h-full object-contain"
                        style={{ display: isRecording ? 'block' : 'none' }}
                      />
                      {!isRecording && !recordedVideo && (
                        <div className="absolute inset-0 flex items-center justify-center text-white">
                          <div className="text-center">
                            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <p className="text-lg">Camera preview will appear here</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Recording Controls */}
                    <div className="flex flex-col items-center gap-4">
                      {!isRecording && !recordedVideo && (
                        <button
                          type="button"
                          onClick={startUnifiedRecording}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg font-semibold transition shadow-lg hover:shadow-xl flex items-center gap-3 text-lg"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                          Start Recording (Video + Voice)
                        </button>
                      )}

                      {isRecording && (
                        <div className="w-full space-y-4">
                          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
                            <div className="flex items-center justify-center gap-3 mb-2">
                              <div className="w-4 h-4 bg-red-600 rounded-full animate-pulse"></div>
                              <span className="text-xl font-bold text-red-600">
                                Recording... {Math.floor((60 - recordingTime) / 60)}:{(60 - recordingTime) % 60 < 10 ? '0' : ''}{Math.abs((60 - recordingTime) % 60)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              Speak clearly. Your speech is being transcribed automatically.
                            </p>
                          </div>
                          
                          {/* Live transcription preview */}
                          {transcribedText && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <p className="text-sm font-semibold text-blue-800 mb-2">Live Transcription:</p>
                              <p className="text-gray-700">{transcribedText}</p>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={stopUnifiedRecording}
                            className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            Stop Recording
                          </button>
                        </div>
                      )}

                      {recordedVideo && !isReviewMode && (
                        <button
                          type="button"
                          onClick={retakeRecording}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                        >
                          Retake Recording
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 text-center">
                      {isRecording 
                        ? 'Recording will automatically stop after 1 minute. You can also stop manually.'
                        : 'Click "Start Recording" to begin. The recording will capture both video and audio, and transcribe your speech automatically.'}
                    </p>
                  </>
                ) : (
                  <>
                    {/* Review Mode - Show recorded video and editable transcription */}
                    {!isTranscribing && (
                      <>
                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="font-semibold text-green-800">Recording Complete! Review and edit your transcribed answer below.</p>
                          </div>
                        </div>

                        {/* Video Preview */}
                        {recordedVideo && (
                          <div className="mb-4">
                            <video
                              src={recordedVideo}
                              controls
                              className="w-full rounded-lg"
                              style={{ aspectRatio: '16/9' }}
                            />
                          </div>
                        )}

                        {/* Editable Transcription */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Review and edit your transcribed answer:
                          </label>
                          <textarea
                            value={answers[currentQuestionIndex] || transcribedText}
                            onChange={(e) => handleAnswerChange(e.target.value)}
                            onPaste={handlePaste}
                            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-green-500"
                            style={{ 
                              userSelect: 'text',
                              WebkitUserSelect: 'text',
                              MozUserSelect: 'text',
                              msUserSelect: 'text'
                            }}
                            rows="8"
                            required
                            placeholder="Your transcribed answer will appear here. You can edit any typos or mistakes..."
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            Please review the transcription and correct any errors. The video recording is saved and will be submitted with your answer.
                          </p>
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={retakeRecording}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                          >
                            Retake Recording
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              // Ensure the answer is saved from transcribed text or current answer
                              const answerToSave = answers[currentQuestionIndex] || transcribedText || '';
                              if (answerToSave) {
                                handleAnswerChange(answerToSave);
                              }
                              // Mark answer as saved and exit review mode
                              setAnswerSaved(true);
                              setIsTranscribing(false);
                              setIsReviewMode(false);
                              // Clear video blob to prevent re-transcription
                              setVideoBlob(null);
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                          >
                            Keep This Answer
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-6">
            <button
              type="button"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0 && !isVideoQuestion}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>

            {isVideoQuestion ? (
              <div className="flex items-center gap-4">
                {/* Video Answer Status Indicator */}
                <div className="flex-shrink-0">
                  {recordedVideo ? (
                    <div className="flex items-center gap-2 bg-green-100 border-2 border-green-500 rounded-full px-4 py-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-800 font-bold text-sm">Video Recorded</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-yellow-100 border-2 border-yellow-500 rounded-full px-4 py-2">
                      <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-yellow-800 font-bold text-sm">No Video</span>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting || !recordedVideo}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {submitting ? 'Submitting...' : 'Submit Interview'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={!answers[currentQuestionIndex] || answers[currentQuestionIndex].trim() === ''}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLastTextQuestion ? 'Continue to Video Introduction' : 'Next Question'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Interview;
