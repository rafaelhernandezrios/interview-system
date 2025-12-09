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
  const [videoBlobType, setVideoBlobType] = useState(null); // Store the MIME type of the video blob
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
          // Ensure array has exactly the correct length (trim if too long, pad if too short)
          if (savedAnswers.length > combinedQuestions.length) {
            // Trim to correct length if it has extra elements
            savedAnswers.splice(combinedQuestions.length);
          } else {
            // Pad with empty strings if it's too short
            while (savedAnswers.length < combinedQuestions.length) {
              savedAnswers.push('');
            }
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
      // Ensure we only save text answers (exactly allQuestions.length)
      const textAnswersToSave = answersToSave.slice(0, allQuestions.length);
      // Pad if necessary to ensure correct length
      while (textAnswersToSave.length < allQuestions.length) {
        textAnswersToSave.push('');
      }
      await api.post('/users/save-interview-progress', {
        answers: textAnswersToSave,
        currentQuestionIndex: currentQuestionIndex
      });
    } catch (error) {
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
    setVideoBlobType(null); // Reset MIME type
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
      setVideoBlobType(null); // Reset MIME type
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

  // Helper function to get supported MIME type for MediaRecorder
  const getSupportedMimeType = () => {
    // Check for iOS/Safari first (they don't support WebM)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // Preferred codecs in order of preference
    const codecs = [
      // For iOS/Safari, prefer H.264
      { mimeType: 'video/mp4;codecs=h264,aac', isIOS: true },
      { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', isIOS: true },
      { mimeType: 'video/mp4', isIOS: true },
      // For other browsers, prefer WebM
      { mimeType: 'video/webm;codecs=vp9,opus', isIOS: false },
      { mimeType: 'video/webm;codecs=vp8,opus', isIOS: false },
      { mimeType: 'video/webm', isIOS: false },
      // Fallback options
      { mimeType: 'video/mp4', isIOS: false },
    ];
    
    // Filter codecs based on platform
    const platformCodecs = codecs.filter(c => 
      isIOS || isSafari ? c.isIOS : !c.isIOS
    );
    
    // Check which codec is supported
    for (const codec of platformCodecs) {
      if (MediaRecorder.isTypeSupported(codec.mimeType)) {
        return codec.mimeType;
      }
    }
    
    // Last resort: use default (browser will choose)
    return '';
  };

  // Unified recording function - starts video + audio recording with speech recognition
  const startUnifiedRecording = async () => {
    try {
      // Reset states
      setTranscribedText('');
      setIsReviewMode(false);
      setError('');

      // Request camera and microphone access with better constraints
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Verify audio track exists
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available. Please ensure microphone access is granted.');
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays
        try {
          await videoRef.current.play();
        } catch (playError) {
        }
      }

      // Get supported MIME type
      const mimeType = getSupportedMimeType();
      
      // Create MediaRecorder with appropriate codec
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const chunks = [];
      let hasData = false;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
          hasData = true;
        }
      };

      mediaRecorder.onerror = (error) => {
        setError('Recording error occurred. Please try again.');
        setIsRecording(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.onstop = () => {
        if (!hasData || chunks.length === 0) {
          setError('No video data was recorded. Please try again.');
          setIsRecording(false);
          return;
        }
        
        // Use the actual MIME type from MediaRecorder, or fallback
        const recordedMimeType = mediaRecorder.mimeType || mediaRecorderRef.current?.mimeType || 'video/webm';
        const blob = new Blob(chunks, { type: recordedMimeType });
        
        // Validate blob size (should be at least 1KB)
        if (blob.size < 1024) {
          setError('Recorded video is too small. Please ensure camera and microphone are working.');
          setIsRecording(false);
          return;
        }
        
        // Store both blob and its type
        setVideoBlob(blob);
        setVideoBlobType(recordedMimeType);
        const videoURL = URL.createObjectURL(blob);
        setRecordedVideo(videoURL);
        
        // Store video blob for current question
        const newVideoAnswers = [...videoAnswers];
        newVideoAnswers[currentQuestionIndex] = blob;
        setVideoAnswers(newVideoAnswers);
      };

      // Start recording with timeslice to ensure data is available
      // Timeslice: request data every 1 second to avoid issues
      mediaRecorder.start(1000);
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
      setError('Could not access camera or microphone. Please check permissions.');
    }
  };

  const stopUnifiedRecording = () => {
    
    // Stop video recording
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        } else if (mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.resume();
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
      }
    }

    // Stop stream tracks (but don't set streamRef to null yet, wait for onstop)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
    }

    // Stop timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecording(false);
    // Transcription will happen when videoBlob is ready (in useEffect)
  };

  // Transcribe video when blob is ready
  useEffect(() => {
    // Calculate if this is a video question (must be done inside useEffect to avoid initialization error)
    const isVideoQuestion = currentQuestionIndex !== undefined && allQuestions.length > 0 && currentQuestionIndex >= allQuestions.length;
    
    // Skip if we don't have a video blob
    if (!videoBlob) {
      return;
    }
    
    // Skip if we're still recording
    if (isRecording) {
      return;
    }
    
    // Skip if already transcribing or in review mode
    if (isTranscribing || isReviewMode) {
      return;
    }
    
    // Skip if answer already saved
    if (answerSaved) {
      return;
    }
    
    // Skip if question index is invalid
    if (currentQuestionIndex === undefined) {
      return;
    }
    
    // For video-only question (final question), directly enter review mode without transcription
    if (isVideoQuestion) {
      setIsReviewMode(true);
      return;
    }
    
    // For text questions, transcribe the video
    // Add a small delay to ensure state is stable and blob is complete
    const timeoutId = setTimeout(() => {
      // Double-check all conditions before transcribing
      if (videoBlob && 
          !isRecording && 
          !isTranscribing && 
          !isReviewMode && 
          !answerSaved && 
          currentQuestionIndex !== undefined && 
          !isVideoQuestion) {
        transcribeVideo();
      } else {
      }
    }, 200);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [videoBlob, isRecording, isReviewMode, isTranscribing, answerSaved, currentQuestionIndex, allQuestions.length]);

  // Reset recording states when question changes
  useEffect(() => {
    // Reset recording-related states when question index changes
    // Only reset if not currently recording
    if (!isRecording) {
      
      // Cancel any ongoing transcription
      setIsTranscribing(false);
      setMessage('');
      
      // Reset all recording-related states
      setRecordedVideo(null);
      setVideoBlob(null);
      setVideoBlobType(null); // Reset MIME type
      setTranscribedText('');
      setIsReviewMode(false);
      setAnswerSaved(false); // Reset answer saved flag
      setRecordingTime(0);
      setError('');
      
      // Clear video stream if exists
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
      
      // Clear media recorder
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.stop();
          } catch (e) {
          }
        }
        mediaRecorderRef.current = null;
      }
      
      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        // Revoke any object URLs to free memory
        if (recordedVideo) {
          URL.revokeObjectURL(recordedVideo);
        }
      }
    } else {
    }
  }, [currentQuestionIndex, isRecording]);

  const transcribeVideo = async (retryCount = 0) => {
    if (!videoBlob || isTranscribing) {
      return;
    }

    // Validate blob before sending
    if (videoBlob.size < 1024) {
      setError('Recorded video is too small. Please record again.');
      setIsTranscribing(false);
      return;
    }

    // Check file size limit (50MB = 50 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (videoBlob.size > MAX_FILE_SIZE) {
      const sizeInMB = (videoBlob.size / (1024 * 1024)).toFixed(2);
      setError(`Video file is too large (${sizeInMB}MB). Maximum size is 50MB. Please record a shorter video.`);
      setIsTranscribing(false);
      return;
    }

    // Store current question index to prevent transcription for wrong question
    const questionIndexAtStart = currentQuestionIndex;
    const MAX_RETRIES = 2; // Maximum 2 retries (3 total attempts)

    try {
      setIsTranscribing(true);
      setError('');
      setMessage(retryCount > 0 
        ? `Transcribing audio... (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`
        : 'Transcribing audio...');
      
      // Use stored MIME type or fallback to blob type
      let mimeType = videoBlobType || videoBlob.type || 'video/webm';
      
      // Ensure we have a valid video MIME type
      if (!mimeType.startsWith('video/')) {
        // Try to detect from blob content or use default
        mimeType = 'video/webm';
      }
      
      // Determine file extension based on MIME type
      let fileExtension = 'webm';
      if (mimeType.includes('mp4')) {
        fileExtension = 'mp4';
        mimeType = 'video/mp4'; // Ensure correct MIME type
      } else if (mimeType.includes('webm')) {
        fileExtension = 'webm';
        mimeType = 'video/webm'; // Ensure correct MIME type
      } else if (mimeType.includes('quicktime') || mimeType.includes('mov')) {
        fileExtension = 'mov';
        mimeType = 'video/quicktime';
      }
      
      // Step 1: Get presigned URL from backend for direct S3 upload
      setMessage('Getting upload URL...');
      
      const uploadUrlResponse = await api.post('/users/get-upload-url', {
        fileName: `recording_${Date.now()}.${fileExtension}`,
        contentType: mimeType
      });
      
      const { uploadUrl, publicUrl } = uploadUrlResponse.data;
      
      // Step 2: Upload video directly to S3
      setMessage('Uploading video to S3...');
      
      const videoFile = new File([videoBlob], `recording_${Date.now()}.${fileExtension}`, {
        type: mimeType
      });
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: videoBlob,
        headers: {
          'Content-Type': mimeType,
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      
      // Step 3: Send S3 URL to backend for transcription
      setMessage('Transcribing audio...');
      
      const timeoutMs = 180000; // 3 minutes for transcription (longer since file is already uploaded)
      const response = await Promise.race([
        api.post('/users/transcribe-video', {
          s3Url: publicUrl
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: timeoutMs,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
        )
      ]);
      

      // Only update if we're still on the same question
      if (currentQuestionIndex === questionIndexAtStart) {
        const transcription = response.data.transcription || '';
        
        if (!transcription || transcription.trim().length === 0) {
          setError('Transcription returned empty. The video may not have audio. You can still type your answer manually.');
          setIsReviewMode(true);
        } else {
          setTranscribedText(transcription);
          handleAnswerChange(transcription);
        }
        
        setMessage('');
        setIsTranscribing(false);
        
        // Enter review mode after transcription (even if empty)
        setIsReviewMode(true);
      } else {
        // Question changed during transcription, just cancel
        setIsTranscribing(false);
        setMessage('');
      }
    } catch (err) {
      // Only update if we're still on the same question
      if (currentQuestionIndex === questionIndexAtStart) {
        // Check if it's a network error or timeout and we haven't exceeded retries
        const isNetworkError = err.code === 'ECONNABORTED' || 
                              err.code === 'ERR_NETWORK' || 
                              err.code === 'ECONNRESET' ||
                              err.message === 'Request timeout' ||
                              err.message.includes('timeout') ||
                              !err.response;
        
        const isServerError = err.response?.status >= 500;
        const isClientError = err.response?.status >= 400 && err.response?.status < 500;
        
        // Retry logic: retry on network errors or server errors
        if ((isNetworkError || isServerError) && retryCount < MAX_RETRIES) {
          // Retry after exponential backoff
          const retryDelay = 2000 * Math.pow(2, retryCount); // 2s, 4s, 8s
          setIsTranscribing(false);
          setMessage(`Retrying in ${retryDelay/1000} seconds...`);
          
          setTimeout(() => {
            if (currentQuestionIndex === questionIndexAtStart && videoBlob) {
              transcribeVideo(retryCount + 1);
            }
          }, retryDelay);
          return;
        }
        
        // If retries exhausted or client error, show specific error message
        let errorMessage = 'Error transcribing audio. You can still type your answer manually.';
        
        // Check for specific error codes
        if (err.response?.status === 413 || err.code === 'ERR_FAILED' && err.message?.includes('413')) {
          const sizeInMB = videoBlob ? (videoBlob.size / (1024 * 1024)).toFixed(2) : 'unknown';
          errorMessage = `Video file is too large (${sizeInMB}MB). Maximum size is 50MB. Please record a shorter video or the system will compress it automatically.`;
        } else if (isNetworkError) {
          errorMessage = 'Network error during transcription. Please check your connection and try recording again.';
        } else if (isClientError) {
          const serverMessage = err.response?.data?.message || err.response?.data?.error || '';
          if (serverMessage.includes('format') || serverMessage.includes('codec')) {
            errorMessage = 'Video format not supported. Please try recording again with a different browser.';
          } else {
            errorMessage = serverMessage || 'Error processing video. You can still type your answer manually.';
          }
        } else if (isServerError) {
          errorMessage = 'Server error during transcription. Please try again in a moment.';
        }
        
        setError(errorMessage);
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
    setVideoBlobType(null); // Reset MIME type
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

      // Only send text answers (exactly allQuestions.length, not including video question)
      // Ensure the answers array matches the number of text questions
      const textAnswers = answers.slice(0, allQuestions.length);
      
      // Validate that we have the correct number of answers
      if (textAnswers.length !== allQuestions.length) {
        setError(`Error: Expected ${allQuestions.length} text answers, but found ${textAnswers.length}. Please make sure all questions are answered.`);
        setSubmitting(false);
        return;
      }
      
      // Check if video was uploaded directly to S3 (we should have the publicUrl stored)
      // If videoBlob exists but we're using direct S3 upload, we need to upload it first
      let s3VideoUrl = null;
      
      if (videoBlob && isVideoQuestion) {
        // Upload video directly to S3 first
        setMessage('Uploading video to S3...');
        
        try {
          // Get presigned URL
          const uploadUrlResponse = await api.post('/users/get-upload-url', {
            fileName: `interview_video_${Date.now()}.webm`,
            contentType: videoBlobType || videoBlob.type || 'video/webm'
          });
          
          const { uploadUrl, publicUrl } = uploadUrlResponse.data;
          
          // Upload to S3
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            body: videoBlob,
            headers: {
              'Content-Type': videoBlobType || videoBlob.type || 'video/webm',
            },
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
          }
          
          s3VideoUrl = publicUrl;
        } catch (uploadError) {
          setError('Failed to upload video. Please try again.');
          setSubmitting(false);
          return;
        }
      }
      
      // Prepare request body (JSON if using S3 URL, FormData if traditional upload)
      let requestBody;
      let headers = {};
      
      if (s3VideoUrl) {
        // Use JSON if video is in S3
        requestBody = {
          answers: textAnswers,
          s3VideoUrl: s3VideoUrl
        };
        headers['Content-Type'] = 'application/json';
      } else {
        // Use FormData for traditional file upload (fallback)
        const formData = new FormData();
        formData.append('answers', JSON.stringify(textAnswers));
        
        if (videoBlob && isVideoQuestion) {
          let mimeType = videoBlobType || videoBlob.type || 'video/webm';
          let fileExtension = 'webm';
          
          if (mimeType.includes('mp4')) {
            fileExtension = 'mp4';
            mimeType = 'video/mp4';
          } else if (mimeType.includes('webm')) {
            fileExtension = 'webm';
            mimeType = 'video/webm';
          } else if (mimeType.includes('quicktime') || mimeType.includes('mov')) {
            fileExtension = 'mov';
            mimeType = 'video/quicktime';
          }
          
          const videoFile = new File([videoBlob], `interview_video_${Date.now()}.${fileExtension}`, {
            type: mimeType
          });
          
          formData.append('video', videoFile);
        }
        
        requestBody = formData;
        // Don't set Content-Type for FormData, let browser set it with boundary
      }

      setMessage('Submitting interview...');
      const response = await api.post('/users/submit-interview', requestBody, {
        headers: headers,
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
    <div className="min-h-screen bg-mesh-gradient relative">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 relative z-10">
        {/* Centered Container */}
        <div className="max-w-4xl mx-auto">
          {/* Progress Indicator - Top */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span className="font-medium">
                {isVideoQuestion 
                  ? `Video Introduction (Final Question)`
                  : `Question ${currentQuestionIndex + 1} of ${allQuestions.length + 1}`}
              </span>
              <span className="font-semibold">
                {Math.round(((isVideoQuestion ? allQuestions.length + 1 : currentQuestionIndex + 1) / (allQuestions.length + 1)) * 100)}%
              </span>
            </div>
            <div className="w-full bg-white/20 backdrop-blur-sm rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((isVideoQuestion ? allQuestions.length + 1 : currentQuestionIndex + 1) / (allQuestions.length + 1)) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Error/Message Alerts */}
          {error && (
            <div className="glass-card bg-red-50/80 border-red-200 text-red-700 p-4 rounded-xl mb-6">
              <p>{error}</p>
            </div>
          )}

          {message && (
            <div className="glass-card bg-green-50/80 border-green-200 text-green-700 p-4 rounded-xl mb-6">
              <p>{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Question Card (Teleprompter Style) */}
            <div className="glass-card bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                <label 
                  className="block text-gray-900 text-base sm:text-lg md:text-xl font-semibold select-none flex-1 leading-relaxed"
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
                {/* Timer Badge - Integrated in Question Card */}
                {!isVideoQuestion && (
                  <div className={`flex-shrink-0 flex items-center gap-2 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-bold text-sm sm:text-base md:text-lg ${
                    timeRemaining < 60 
                      ? 'bg-red-100/80 text-red-700 border border-red-300' 
                      : 'bg-blue-100/80 text-blue-700 border border-blue-300'
                  }`}>
                    <span>⏱️</span>
                    <span>{formatTime(timeRemaining)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Video Container (The Lens) - Renderizado Condicional Estricto */}
            {isReviewMode ? (
              /* Estado: Review - Solo muestra el video grabado */
              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-2 sm:border-4 border-white/20" style={{ aspectRatio: '16/9' }}>
                {recordedVideo && (
                  <video
                    src={recordedVideo}
                    controls
                    className="w-full h-full object-contain bg-black"
                  />
                )}
              </div>
            ) : (
              /* Estado: Recording/Idle - Solo muestra la cámara */
              <div className={`relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${
                isRecording 
                  ? 'ring-2 sm:ring-4 ring-red-500/50 animate-pulse border-2 sm:border-4 border-red-400' 
                  : 'border-2 sm:border-4 border-white/20'
              }`} style={{ aspectRatio: '16/9' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-full object-contain bg-black"
                  style={{ display: isRecording ? 'block' : 'none' }}
                />
                {!isRecording && (
                  <div className="absolute inset-0 flex items-center justify-center text-white bg-black/50 backdrop-blur-sm">
                    <div className="text-center">
                      <svg className="w-20 h-20 mx-auto mb-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-lg text-white/80">Camera preview will appear here</p>
                    </div>
                  </div>
                )}
                {/* Recording Indicator */}
                {isRecording && (
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex items-center gap-2 glass-card bg-red-500/90 backdrop-blur-md px-2 sm:px-4 py-1 sm:py-2 rounded-full">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full animate-pulse"></div>
                    <span className="text-white font-bold text-xs sm:text-sm">REC</span>
                  </div>
                )}
              </div>
            )}

            {/* Transcription Status - Overlay sutil y minimalista (pequeño, centrado sobre el video) */}
            {isTranscribing && !isReviewMode && !isVideoQuestion && (
              <div className="relative -mt-[calc(16/9*100%)] mb-6">
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <div className="glass-card bg-white/90 backdrop-blur-md border border-white/40 rounded-2xl px-6 py-4 text-center shadow-xl">
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                        <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Transcribing...</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Answer Saved Confirmation - Alto contraste */}
            {answerSaved && !isReviewMode && !isTranscribing && (
              <div className="glass-card bg-green-100 border-2 border-green-500 rounded-3xl p-6 text-center mb-6 shadow-2xl">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-16 h-16 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-2xl font-bold text-green-800 mb-2">✓ Answer Saved Successfully!</p>
                    <p className="text-lg text-green-700">Your answer has been saved. You can now proceed to the next question.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Control Dock (Floating Action Bar) - State Machine Unificado */}
            {(() => {
              // Si es Video Question, usar controles especiales
              if (isVideoQuestion) {
                // Estado: Review Mode para video question
                if (isReviewMode && !isTranscribing) {
                  return (
                    <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl -mt-4 sm:-mt-8 relative z-20">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
                        <button
                          type="button"
                          onClick={handlePreviousQuestion}
                          className="glass-card bg-white/40 hover:bg-white/60 border border-white/30 rounded-full px-4 sm:px-6 py-2 sm:py-3 font-medium text-gray-700 transition-all hover:scale-105 text-sm sm:text-base"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={retakeRecording}
                          className="glass-card bg-white/40 hover:bg-white/60 border border-white/30 text-gray-700 rounded-full px-4 sm:px-6 py-2 sm:py-3 font-semibold transition-all hover:scale-105 text-sm sm:text-base"
                        >
                          Retake
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || !recordedVideo}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-6 sm:px-8 py-2 sm:py-3 font-semibold transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                        >
                          {submitting ? 'Submitting...' : 'Submit Interview'}
                        </button>
                      </div>
                    </div>
                  );
                }
                
                // Estado: Recording/Idle para video question
                return (
                  <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl -mt-4 sm:-mt-8 relative z-20">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={handlePreviousQuestion}
                        className="glass-card bg-white/40 hover:bg-white/60 border border-white/30 rounded-full px-4 sm:px-6 py-2 sm:py-3 font-medium text-gray-700 transition-all hover:scale-105 text-sm sm:text-base w-full sm:w-auto"
                      >
                        Previous
                      </button>

                      {!isRecording && !recordedVideo ? (
                        <button
                          type="button"
                          onClick={startUnifiedRecording}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shadow-xl hover:shadow-2xl transition-all hover:scale-110"
                        >
                          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        </button>
                      ) : isRecording ? (
                        <button
                          type="button"
                          onClick={stopUnifiedRecording}
                          className="bg-red-600 hover:bg-red-700 text-white rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shadow-xl hover:shadow-2xl transition-all hover:scale-110 animate-pulse"
                        >
                          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                          </svg>
                        </button>
                      ) : null}

                      {/* Recording Time Display */}
                      {isRecording && (
                        <div className="text-center">
                          <p className="text-sm text-gray-600 font-medium">
                            {Math.floor((60 - recordingTime) / 60)}:{(60 - recordingTime) % 60 < 10 ? '0' : ''}{Math.abs((60 - recordingTime) % 60)} / 1:00
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Para preguntas de texto (no video question)
              // Estado: Answer Saved - Solo botón Next
              if (answerSaved && !isReviewMode && !isTranscribing) {
                return (
                  <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl -mt-4 sm:-mt-8 relative z-20">
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={handleNextQuestion}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-6 sm:px-8 py-3 sm:py-4 font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl transition-all hover:scale-105 flex items-center gap-2 sm:gap-3"
                      >
                        <span>Next Question</span>
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              }

              // Estado: Review Mode - Botones Retake y Keep
              if (isReviewMode && !isTranscribing) {
                // Para la pregunta de video final, mostrar botón de Submit directamente
                if (isVideoQuestion) {
                  return (
                    <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl -mt-4 sm:-mt-8 relative z-20">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
                        <button
                          type="button"
                          onClick={retakeRecording}
                          className="glass-card bg-white/40 hover:bg-white/60 border border-white/30 text-gray-700 rounded-full px-4 sm:px-6 py-2 sm:py-3 font-semibold transition-all hover:scale-105 text-sm sm:text-base"
                        >
                          Retake Recording
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-full px-6 sm:px-8 py-2 sm:py-3 font-semibold transition shadow-lg hover:shadow-xl text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? 'Submitting...' : 'Submit Interview'}
                        </button>
                      </div>
                    </div>
                  );
                }
                
                // Para preguntas de texto, mostrar botón "Keep This Answer"
                return (
                  <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl -mt-4 sm:-mt-8 relative z-20">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={retakeRecording}
                        className="glass-card bg-white/40 hover:bg-white/60 border border-white/30 text-gray-700 rounded-full px-4 sm:px-6 py-2 sm:py-3 font-semibold transition-all hover:scale-105 text-sm sm:text-base"
                      >
                        Retake Recording
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const answerToSave = answers[currentQuestionIndex] || transcribedText || '';
                          if (answerToSave) {
                            handleAnswerChange(answerToSave);
                          }
                          setAnswerSaved(true);
                          setIsTranscribing(false);
                          setIsReviewMode(false);
                          setVideoBlob(null);
                          setVideoBlobType(null); // Reset MIME type
                        }}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-6 sm:px-8 py-2 sm:py-3 font-semibold transition shadow-lg hover:shadow-xl text-sm sm:text-base"
                      >
                        Keep This Answer
                      </button>
                    </div>
                  </div>
                );
              }

              // Estado: Recording/Idle - Botones de grabación
              if (!isReviewMode && !isTranscribing && !answerSaved) {
                return (
                  <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl -mt-4 sm:-mt-8 relative z-20">
                    <div className="flex items-center justify-center gap-3 sm:gap-4">
                      {/* Main Record/Stop Button (Center) */}
                      {!isRecording && !recordedVideo ? (
                        <button
                          type="button"
                          onClick={startUnifiedRecording}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shadow-xl hover:shadow-2xl transition-all hover:scale-110"
                        >
                          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        </button>
                      ) : isRecording ? (
                        <button
                          type="button"
                          onClick={stopUnifiedRecording}
                          className="bg-red-600 hover:bg-red-700 text-white rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shadow-xl hover:shadow-2xl transition-all hover:scale-110 animate-pulse"
                        >
                          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                          </svg>
                        </button>
                      ) : null}

                      {/* Next Button (Right) - Solo visible si hay respuesta */}
                      {answers[currentQuestionIndex] && answers[currentQuestionIndex].trim() !== '' && (
                        <button
                          type="button"
                          onClick={handleNextQuestion}
                          className="glass-card bg-white/40 hover:bg-white/60 border border-white/30 rounded-full px-4 sm:px-6 py-2 sm:py-3 font-medium text-gray-700 transition-all hover:scale-105 text-sm sm:text-base"
                        >
                          Next
                        </button>
                      )}
                    </div>

                    {/* Recording Time Display */}
                    {isRecording && (
                      <div className="mt-4 text-center">
                        <p className="text-sm text-gray-600 font-medium">
                          Recording: {Math.floor((60 - recordingTime) / 60)}:{(60 - recordingTime) % 60 < 10 ? '0' : ''}{Math.abs((60 - recordingTime) % 60)} / 1:00
                        </p>
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })()}

            {/* Review Mode - Mensaje de confirmación (el video ya se muestra arriba) */}
            {isReviewMode && !isTranscribing && (
              <div className="glass-card bg-green-100 border-2 border-green-500 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="font-semibold text-green-800">
                    {isVideoQuestion 
                      ? 'Recording Complete! Review your video above. You can proceed to submit the interview.'
                      : 'Recording Complete! Review and edit your transcribed answer below.'}
                  </p>
                </div>
              </div>
            )}

            {/* Editable Transcription - Panel lateral/colapsable solo en Review Mode */}
            {/* Ocultar para la pregunta de video final (describe yourself) */}
            {isReviewMode && !isTranscribing && !isVideoQuestion && (
              <div className="glass-card bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-4 sm:p-6">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                  Review and edit your transcribed answer:
                </label>
                <textarea
                  value={answers[currentQuestionIndex] || transcribedText}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  onPaste={handlePaste}
                  className="glass-card bg-white/80 backdrop-blur-sm border border-white/40 rounded-xl w-full py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  style={{ 
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    MozUserSelect: 'text',
                    msUserSelect: 'text'
                  }}
                  rows="5"
                  required
                  placeholder="Your transcribed answer will appear here. You can edit any typos or mistakes..."
                />
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
};

export default Interview;
