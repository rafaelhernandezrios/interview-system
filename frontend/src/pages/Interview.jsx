import { useState, useEffect, useRef, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/axios';
import { AuthContext } from '../contexts/AuthContext';

const Interview = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [questions, setQuestions] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]); // Includes default questions
  const [answers, setAnswers] = useState([]);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(60); // 1 minute correction timer
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
  const [videoPresentationTranscription, setVideoPresentationTranscription] = useState(''); // Transcription for video presentation
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [answerSaved, setAnswerSaved] = useState(false); // Track if answer was saved
  const [videoAnswers, setVideoAnswers] = useState([]); // Store video answers for each question
  const [shouldAutoStartRecording, setShouldAutoStartRecording] = useState(false); // Flag to auto-start recording
  const [countdownBeforeRecord, setCountdownBeforeRecord] = useState(0); // Visible 5s countdown before recording
  const countdownIntervalRef = useRef(null);
  const [tutorialVideoUrl, setTutorialVideoUrl] = useState(null); // URL del video tutorial
  const [tutorialVideoError, setTutorialVideoError] = useState(null); // Error al cargar el video tutorial

  // ============================================================================
  // STATE MACHINE: TTS/STT Voice Interaction Control
  // ============================================================================
  // Estados posibles:
  // - IDLE: Estado inicial, sin actividad de voz
  // - READING_QUESTION: TTS está leyendo la pregunta (esperando onAudioEnd)
  // - RECORDING: Grabando audio del usuario
  // - TRANSCRIBING: Procesando transcripción (TTS completamente silenciado)
  // - REVIEW_MODE: Usuario revisando transcripción
  // ============================================================================
  const [voiceState, setVoiceState] = useState('IDLE'); // Estado de la máquina de estados
  const speechSynthesisRef = useRef(null); // Ref para el utterance actual de TTS (fallback)
  const audioRef = useRef(null); // Ref para el audio de Eleven Labs
  const ttsPromiseRef = useRef(null); // Ref para la Promise de TTS (para manejar onAudioEnd)
  const currentQuestionIndexRef = useRef(null); // Ref para rastrear pregunta actual sin causar re-renders
  const reviewEditRef = useRef(null); // Ref para el cuadro de Review and edit (para scroll automático)

  // Function to get default questions based on program
  const getDefaultQuestions = (program) => {
    const firstQuestion = "What is your motivation for applying to this program and joining Mirai Innovation Research Institute?";
    
    // Last question changes based on program
    let lastQuestion;
    if (program === 'FUTURE_INNOVATORS_JAPAN') {
      lastQuestion = "Why do you deserve to be awarded this scholarship?";
    } else {
      lastQuestion = "What is your plan to finance your tuition, travel expenses, and accommodation during your stay in Japan?";
    }
    
    return [firstQuestion, lastQuestion];
  };

  // Fetch tutorial video URL from backend
  const fetchTutorialVideoUrl = async () => {
    try {
      const response = await api.get('/users/tutorial-video-url');
      setTutorialVideoUrl(response.data.url);
      setTutorialVideoError(null);
    } catch (error) {
      // If 404, the video doesn't exist
      if (error.response?.status === 404) {
        setTutorialVideoError('Tutorial video not found. Please ensure the file exists in S3 at videos/tutorial.mp4');
      } else {
        // Fallback to constructed URL if API fails
        const bucketName = import.meta.env.VITE_AWS_BUCKET_NAME || 'mirai-interviews';
        const region = import.meta.env.VITE_AWS_REGION || 'us-east-1';
        const fallbackUrl = `https://${bucketName}.s3.${region}.amazonaws.com/videos/tutorial.mp4`;
        setTutorialVideoUrl(fallbackUrl);
      }
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchTutorialVideoUrl();
    
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
      // Stop any ongoing speech
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
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
        // Get default questions based on user's program
        const userProgram = response.data.program || '';
        const defaultQuestions = getDefaultQuestions(userProgram);
        // Combine generated questions with default questions
        const combinedQuestions = [...generatedQuestions, ...defaultQuestions];
        setQuestions(generatedQuestions);
        setAllQuestions(combinedQuestions);
        
        // Load saved answers if they exist
        // Nota: El video está en índice 0, las respuestas de texto en índices 1+
        // response.data.interviewVideo contiene el video (si existe)
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
          // savedAnswers contiene solo las respuestas de texto (no incluye el video)
          // Necesitamos agregar un elemento vacío al inicio para el video (índice 0)
          // para que answers[0] = '' (video), answers[1] = primera respuesta de texto, etc.
          const answersWithVideo = ['', ...savedAnswers];
          setAnswers(answersWithVideo);
          
            // Cargar video si existe (índice 0)
            if (response.data.interviewVideo) {
              const videoAnswersArray = [response.data.interviewVideo];
              setVideoAnswers(videoAnswersArray);
              // Si el video es una URL (string), establecerlo como recordedVideo para mostrarlo
              if (typeof response.data.interviewVideo === 'string') {
                setRecordedVideo(response.data.interviewVideo);
                setIsReviewMode(true); // Mostrar en modo review si ya está guardado
              }
              // Cargar transcripción del video si existe
              if (response.data.interviewVideoTranscription) {
                setVideoPresentationTranscription(response.data.interviewVideoTranscription);
              }
            }
          
          // Encontrar la primera pregunta sin respuesta para continuar desde ahí
          // Las respuestas guardadas (interviewResponses) solo contienen respuestas de texto
          // El video se guarda por separado en interviewVideo
          let startIndex = 0;
          
          // Verificar si el video está guardado
          const hasVideo = response.data.interviewVideo;
          
          if (hasVideo) {
            // Video está guardado, buscar primera pregunta de texto sin respuesta
            // savedAnswers[0] corresponde a la primera pregunta de texto (índice 1 en currentQuestionIndex)
            // savedAnswers[1] corresponde a la segunda pregunta de texto (índice 2 en currentQuestionIndex)
            // etc.
            let foundUnanswered = false;
            for (let i = 0; i < savedAnswers.length; i++) {
              if (!savedAnswers[i] || savedAnswers[i].trim() === '') {
                // Primera pregunta sin respuesta encontrada
                // savedAnswers[i] corresponde a currentQuestionIndex = i + 1
                startIndex = i + 1;
                foundUnanswered = true;
                break;
              }
            }
            // Si todas las respuestas están completas, ir a la última pregunta
            if (!foundUnanswered && savedAnswers.every(a => a && a.trim() !== '')) {
              startIndex = combinedQuestions.length; // Última pregunta
            }
          } else {
            // Video no está guardado, empezar desde el video (índice 0)
            startIndex = 0;
          }
          
          setCurrentQuestionIndex(startIndex);
        } else {
          // Inicializar answers con un elemento extra al inicio para el video (índice 0)
          // answers[0] = '' (video), answers[1+] = respuestas de texto
          setAnswers(new Array(combinedQuestions.length + 1).fill(''));
          setCurrentQuestionIndex(0); // Empezar con video (índice 0)
        }
        
        setTimeRemaining(60); // Correction window after transcription
      }
    } catch (error) {
    }
  };

  const startTimer = () => {
    setTimerActive(true);
  };

  // ============================================================================
  // ESTADO INICIAL: Inicio de entrevista
  // ============================================================================
  /**
   * REQUERIMIENTO 1: Estado Inicial
   * 1. Disparar inmediatamente TTS de Pregunta 1
   * 2. Esperar estrictamente a onAudioEnd
   * 3. Transición automática a RECORDING
   */
  const startInterview = async () => {
    setInterviewStarted(true);
    
    // Usar el currentQuestionIndex actual (que fue establecido en fetchProfile basado en respuestas guardadas)
    // Si no hay índice guardado, empezar desde 0 (video de presentación)
    const questionIndex = currentQuestionIndex !== undefined ? currentQuestionIndex : 0;
    
    setCurrentQuestionIndex(questionIndex);
    currentQuestionIndexRef.current = questionIndex;
    setTimeRemaining(60); // correction window will run after transcription
    setTimerActive(false); // timer starts after transcription, not at start
    
    // Limpiar estados previos solo si no hay respuestas guardadas
    if (questionIndex === 0) {
      setIsReviewMode(false);
      setRecordedVideo(null);
      setVideoBlob(null);
      setTranscribedText('');
      setError('');
      setMessage('');
    } else {
      // Si estamos continuando desde una pregunta de texto, limpiar solo estados de grabación
      setRecordedVideo(null);
      setVideoBlob(null);
      setTranscribedText('');
      setError('');
      setMessage('');
    }
    
    // Si estamos en la pregunta de video (índice 0)
    if (questionIndex === 0) {
      // Verificar si hay video guardado
      if (videoAnswers.length > 0 && videoAnswers[0]) {
        // Hay video guardado, mostrarlo en modo review
        if (typeof videoAnswers[0] === 'string') {
          // Es una URL (video guardado desde backend)
          setRecordedVideo(videoAnswers[0]);
          setIsReviewMode(true);
          setVoiceState('REVIEW_MODE');
        } else {
          // Es un Blob (video grabado en esta sesión)
          const videoURL = URL.createObjectURL(videoAnswers[0]);
          setRecordedVideo(videoURL);
          setVideoBlob(videoAnswers[0]);
          setIsReviewMode(true);
          setVoiceState('REVIEW_MODE');
        }
      } else {
        // No hay video guardado: leer pregunta con TTS, luego contador de 10s, luego grabar
        const videoQuestion = "Please introduce yourself in 1 minute, tell us about your background, projects and skills.";
        setIsReviewMode(false);
        
        // REQUERIMIENTO 2.3: Esperar estrictamente a onAudioEnd
        readQuestionAloud(videoQuestion).then(() => {
          // REQUERIMIENTO 2.4: Pausa de 10s visible antes de grabar
          setCountdownBeforeRecord(10);
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          countdownIntervalRef.current = setInterval(() => {
            setCountdownBeforeRecord(prev => {
              if (prev <= 1) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
                setCountdownBeforeRecord(0);
                startUnifiedRecording();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        });
      }
    } else {
      // Estamos continuando desde una pregunta de texto
      // Verificar si ya tiene respuesta guardada
      const answerIndex = questionIndex - 1; // Las respuestas de texto empiezan en índice 0
      if (answers[answerIndex] && answers[answerIndex].trim() !== '') {
        // Ya tiene respuesta, mostrar en modo review
        setTranscribedText(answers[answerIndex]);
        setIsReviewMode(true);
        setVoiceState('REVIEW_MODE');
      } else {
        // No tiene respuesta, el useEffect que maneja el cambio de pregunta se encargará de leer la pregunta
        setIsReviewMode(false);
      }
    }
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
      // answersToSave tiene tamaño allQuestions.length + 1
      // answersToSave[0] corresponde al video (no se guarda aquí)
      // answersToSave[1] corresponde a la primera pregunta de texto (allQuestions[0])
      // answersToSave[2] corresponde a la segunda pregunta de texto (allQuestions[1])
      // etc.
      // Solo extraer las respuestas de texto (índices 1+)
      const textAnswersToSave = answersToSave.length > allQuestions.length 
        ? answersToSave.slice(1, allQuestions.length + 1)
        : answersToSave.slice(0, allQuestions.length);
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

  const handleNextQuestion = async () => {
    // REQUERIMIENTO 2.1: Cancelar cualquier TTS activo (Estado de Transición)
    cancelTTS();
    
    // Detener grabación si está activa
    if (isRecording) {
      stopUnifiedRecording();
    }
    
    // Limpiar estado de transcripción
    setIsTranscribing(false);
    setVoiceState('IDLE'); // Reset estado antes de cambiar pregunta
    
    // Si estamos en la pregunta de video y hay transcripción editada, guardarla
    if (currentQuestionIndex === 0 && videoPresentationTranscription) {
      try {
        // Obtener la URL del video (puede ser string desde videoAnswers o desde recordedVideo)
        let videoUrl = null;
        if (videoAnswers[0] && typeof videoAnswers[0] === 'string') {
          videoUrl = videoAnswers[0];
        } else if (recordedVideo && typeof recordedVideo === 'string' && recordedVideo.startsWith('http')) {
          videoUrl = recordedVideo;
        }
        
        // Guardar la transcripción editada del video
        if (videoUrl) {
          const textAnswersOnly = answers.slice(1, allQuestions.length + 1);
          while (textAnswersOnly.length < allQuestions.length) {
            textAnswersOnly.push('');
          }
          await api.post('/users/save-interview-progress', {
            answers: textAnswersOnly,
            currentQuestionIndex: currentQuestionIndex,
            s3VideoUrl: videoUrl,
            videoTranscription: videoPresentationTranscription
          });
        }
      } catch (saveError) {
        console.error('[SAVE PROGRESS] Error guardando transcripción editada del video:', saveError);
      }
    }
    
    // Guardar progreso
    saveAnswersAuto(answers);
    
    // Reset estados
    setRecordedVideo(null);
    setVideoBlob(null);
    setVideoBlobType(null);
    setTranscribedText('');
    setIsReviewMode(false);
    setAnswerSaved(false);
    setRecordingTime(0);
    setError('');
    setMessage('');
    
    // Limpiar recursos
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Limpiar video answers
    const newVideoAnswers = [...videoAnswers];
    newVideoAnswers[currentQuestionIndex] = null;
    setVideoAnswers(newVideoAnswers);
    
    // Reset ref para permitir lectura de nueva pregunta
    currentQuestionIndexRef.current = null;
    
    // Avanzar a siguiente pregunta
    // Índice 0 = video, índices 1 a allQuestions.length = preguntas de texto
    if (currentQuestionIndex === 0) {
      // Desde video (0) ir a primera pregunta de texto (1)
      setCurrentQuestionIndex(1);
    setTimeRemaining(60);
    setTimerActive(false); // se activará tras la transcripción
    } else if (currentQuestionIndex < allQuestions.length) {
      // Avanzar a siguiente pregunta de texto
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    setTimeRemaining(60);
    setTimerActive(false); // se activará tras la transcripción
    } else if (currentQuestionIndex === allQuestions.length) {
      // Última pregunta de texto, no hay más preguntas
      setTimerActive(false);
    }
  };

  // Navigation disabled (Next/Previous removed)

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Helper to format remaining recording time (1 minute maximum)
  const formatRecordingTimeRemaining = (elapsedSeconds) => {
    const remaining = Math.max(0, 60 - elapsedSeconds); // Asegurar que no sea negativo
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

  // ============================================================================
  // TTS CONTROL: Text-to-Speech con máquina de estados
  // ============================================================================
  /**
   * Lee una pregunta en voz alta usando Eleven Labs API (natural voice)
   * REQUERIMIENTO: Debe esperar estrictamente a onAudioEnd antes de resolver
   * 
   * @param {string} questionText - Texto de la pregunta a leer
   * @returns {Promise<void>} - Resuelve cuando el audio termina de reproducirse
   */
  const readQuestionAloud = async (questionText) => {
    return new Promise(async (resolve, reject) => {
      // PROHIBICIÓN: No leer durante transcripción
      if (voiceState === 'TRANSCRIBING') {
        resolve(); // Resolver sin leer para no bloquear flujo
        return;
      }

      // LIMPIEZA: Cancelar cualquier TTS activo (Estado de Transición)
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (speechSynthesisRef.current || (window.speechSynthesis && window.speechSynthesis.speaking)) {
        window.speechSynthesis.cancel();
      }
      if (ttsPromiseRef.current) {
        ttsPromiseRef.current = null;
      }

      // TRANSICIÓN: IDLE/RECORDING → READING_QUESTION
      setVoiceState('READING_QUESTION');

      try {
        // Llamar al endpoint de Eleven Labs
        const response = await api.post('/users/text-to-speech', { text: questionText });
        
        // Verificar que la respuesta tenga audio
        if (!response.data || !response.data.audio) {
          throw new Error('No audio data received from server');
        }
        
        const { audio: base64Audio, mimeType } = response.data;

        // Convertir base64 a blob
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: mimeType || 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Crear elemento de audio
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        // REQUERIMIENTO CRÍTICO: Esperar estrictamente a onAudioEnd
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          ttsPromiseRef.current = null;
          setVoiceState('IDLE');
          resolve();
        };

        // Manejo de errores
        audio.onerror = (event) => {
          console.error('[TTS] Error reproduciendo audio:', event);
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          ttsPromiseRef.current = null;
          setVoiceState('IDLE');
          // Fallback a speechSynthesis si Eleven Labs falla
          fallbackToSpeechSynthesis(questionText, resolve);
        };

        // Guardar referencia
        ttsPromiseRef.current = { resolve, reject };

        // Reproducir audio
        await audio.play();
      } catch (error) {
        console.error('[TTS] Error con Eleven Labs:', error);
        console.error('[TTS] Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        
        // Si el error es 500 o no hay API key configurada, usar fallback
        
        // Fallback a speechSynthesis si Eleven Labs no está disponible
        fallbackToSpeechSynthesis(questionText, resolve);
      }
    });
  };

  /**
   * Fallback a Web Speech API si Eleven Labs falla
   */
  const fallbackToSpeechSynthesis = (questionText, resolve) => {
    if (!('speechSynthesis' in window)) {
      setVoiceState('IDLE');
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
    utterance.voice = englishVoices.length > 0 ? englishVoices[0] : voices[0];

    utterance.onend = () => {
      speechSynthesisRef.current = null;
      ttsPromiseRef.current = null;
      setVoiceState('IDLE');
      resolve();
    };

    utterance.onerror = (event) => {
      console.error('[TTS] Fallback error:', event.error);
      speechSynthesisRef.current = null;
      ttsPromiseRef.current = null;
      setVoiceState('IDLE');
      resolve();
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  /**
   * Cancela cualquier TTS activo (Eleven Labs o Speech Synthesis)
   * REQUERIMIENTO: Debe ejecutarse en Estado de Transición
   */
  const cancelTTS = () => {
    // Cancelar audio de Eleven Labs
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
    // Cancelar Speech Synthesis (fallback)
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.speaking || speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
      speechSynthesisRef.current = null;
    }
    
    if (ttsPromiseRef.current) {
      ttsPromiseRef.current = null;
    }
    setVoiceState('IDLE');
  };

  // Unified recording function - starts video + audio recording with speech recognition
  const startUnifiedRecording = async () => {
    // If a pre-recording countdown is running, stop it
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
      setCountdownBeforeRecord(0);
    }
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
      // TRANSICIÓN: IDLE/READING_QUESTION → RECORDING
      setVoiceState('RECORDING');

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

  // ============================================================================
  // ESTADO DE PROCESAMIENTO: Transcripción
  // ============================================================================
  /**
   * REQUERIMIENTO 3: Estado de Procesamiento
   * Contexto: Cuando videoBlob está listo y grabación terminó
   * 1. PROHIBICIÓN: Bajo ninguna circunstancia se debe leer pregunta (TTS silenciado)
   * 2. PROTECCIÓN: No interrumpir proceso de transcripción con nuevos eventos de audio
   */
  useEffect(() => {
    const isVideoQuestion = currentQuestionIndex === 0; // Video está en índice 0
    
    // Validaciones
    if (!videoBlob || isRecording || isTranscribing || isReviewMode || answerSaved) {
      return;
    }
    
    // REQUERIMIENTO 3.1: Transición a TRANSCRIBING (TTS completamente silenciado)
    setVoiceState('TRANSCRIBING');
    
    // REQUERIMIENTO 3.1: Cancelar cualquier TTS que pudiera estar activo
    cancelTTS();
    
    // Para pregunta de video, también transcribir
    if (isVideoQuestion) {
      // Iniciar transcripción para video de presentación
      const timeoutId = setTimeout(() => {
        if (videoBlob && 
            !isRecording && 
            !isTranscribing && 
            !isReviewMode && 
            !answerSaved && 
            currentQuestionIndex === 0) {
          transcribeVideo();
        }
      }, 200);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
    
    // Para preguntas de texto, iniciar transcripción
    const timeoutId = setTimeout(() => {
      if (videoBlob && 
          !isRecording && 
          !isTranscribing && 
          !isReviewMode && 
          !answerSaved && 
          currentQuestionIndex !== undefined && 
          currentQuestionIndex > 0) { // Preguntas de texto empiezan en índice 1
        transcribeVideo();
      }
    }, 200);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [videoBlob, isRecording, isReviewMode, isTranscribing, answerSaved, currentQuestionIndex, allQuestions.length]);

  // Load voices when component mounts (some browsers need this)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Load voices (some browsers need this to populate voices list)
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Scroll automático cuando termine la transcripción
  useEffect(() => {
    // Cuando la transcripción termina (isTranscribing pasa de true a false) y entra en review mode
    const isVideoQuestion = currentQuestionIndex === 0;
    if (!isTranscribing && isReviewMode && !isVideoQuestion && reviewEditRef.current) {
      // Pequeño delay para asegurar que el DOM se haya actualizado
      setTimeout(() => {
        reviewEditRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end' 
        });
      }, 300);
    }
  }, [isTranscribing, isReviewMode, currentQuestionIndex]);

  // ============================================================================
  // ESTADO DE TRANSICIÓN: Cambio de pregunta
  // ============================================================================
  /**
   * REQUERIMIENTO 2: Estado de Transición
   * Trigger: Cuando cambia currentQuestionIndex
   * 1. Ejecutar cancel() en cualquier audio activo
   * 2. Iniciar lectura de nueva pregunta completa
   * 3. Esperar estrictamente a onAudioEnd
   * 4. Transición automática a RECORDING
   */
  useEffect(() => {
    // Validaciones iniciales
    if (!interviewStarted) return;
    if (currentQuestionIndex === undefined) return;
    if (currentQuestionIndexRef.current === currentQuestionIndex) return; // Evitar re-ejecución

    // REQUERIMIENTO 3: PROHIBICIÓN durante transcripción
    if (voiceState === 'TRANSCRIBING' || isTranscribing) {
      return;
    }

    // Actualizar ref
    currentQuestionIndexRef.current = currentQuestionIndex;

    // Limpiar estados de grabación previos
    if (!isRecording) {
      setRecordedVideo(null);
      setVideoBlob(null);
      setVideoBlobType(null);
      setTranscribedText('');
      setIsReviewMode(false);
      setAnswerSaved(false);
      setRecordingTime(0);
      setError('');
      setMessage('');

      // Limpiar recursos de video
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.stop();
          } catch (e) {}
        }
        mediaRecorderRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        if (recordedVideo) {
          URL.revokeObjectURL(recordedVideo);
        }
      }

      // REQUERIMIENTO 2.1: Ejecutar cancel() en cualquier audio activo
      cancelTTS();

      // REQUERIMIENTO 2.2: Iniciar lectura de nueva pregunta o video
      if (currentQuestionIndex === 0) {
        // Video (índice 0): Leer pregunta con TTS y mostrar contador de 5s
        // Verificar si hay video guardado
        if (videoAnswers.length > 0 && videoAnswers[0]) {
          // Hay video guardado, mostrarlo en modo review
          if (typeof videoAnswers[0] === 'string') {
            // Es una URL (video guardado desde backend)
            setRecordedVideo(videoAnswers[0]);
            setIsReviewMode(true);
            setVoiceState('REVIEW_MODE');
          } else {
            // Es un Blob (video grabado en esta sesión)
            const videoURL = URL.createObjectURL(videoAnswers[0]);
            setRecordedVideo(videoURL);
            setVideoBlob(videoAnswers[0]);
            setIsReviewMode(true);
            setVoiceState('REVIEW_MODE');
          }
        } else {
          // No hay video guardado: leer pregunta con TTS, luego contador de 5s, luego grabar
          const videoQuestion = "Please introduce yourself in 1 minute, speaking directly about your projects and skills.";
          setIsReviewMode(false); // Asegurar que no esté en modo review
          
          // REQUERIMIENTO 2.3: Esperar estrictamente a onAudioEnd
          readQuestionAloud(videoQuestion).then(() => {
            // REQUERIMIENTO 2.4: Pausa de 10s visible antes de grabar
            setCountdownBeforeRecord(10);
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            countdownIntervalRef.current = setInterval(() => {
              setCountdownBeforeRecord(prev => {
                if (prev <= 1) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                  setCountdownBeforeRecord(0);
                  startUnifiedRecording();
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          });
        }
      } else if (currentQuestionIndex > 0 && currentQuestionIndex <= allQuestions.length) {
        // Pregunta de texto: índice 1 a allQuestions.length
        // La pregunta está en allQuestions[currentQuestionIndex - 1]
        const currentQuestion = allQuestions[currentQuestionIndex - 1];
        if (currentQuestion) {
          // REQUERIMIENTO 2.3: Esperar estrictamente a onAudioEnd
          readQuestionAloud(currentQuestion).then(() => {
            // REQUERIMIENTO 2.4: Pausa de 10s visible antes de grabar
            setCountdownBeforeRecord(10);
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            countdownIntervalRef.current = setInterval(() => {
              setCountdownBeforeRecord(prev => {
                if (prev <= 1) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                  setCountdownBeforeRecord(0);
                  startUnifiedRecording();
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          });
        }
      }
    }
  }, [currentQuestionIndex, interviewStarted, allQuestions.length]);

  const transcribeVideo = async (retryCount = 0) => {
    if (!videoBlob || isTranscribing) {
      return;
    }

    // REQUERIMIENTO 3: Asegurar que estamos en estado TRANSCRIBING
    setVoiceState('TRANSCRIBING');
    setIsTranscribing(true);

    // Validate blob before sending
    if (videoBlob.size < 1024) {
      setError('Recorded video is too small. Please record again.');
      setIsTranscribing(false);
      return;
    }

    // Check file size limit (150MB when using S3 direct upload)
    // Since we always use direct S3 upload, we allow up to 150MB
    const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB for S3 direct upload
    if (videoBlob.size > MAX_FILE_SIZE) {
      const sizeInMB = (videoBlob.size / (1024 * 1024)).toFixed(2);
      setError(`Video file is too large (${sizeInMB}MB). Maximum size is 150MB. Please record a shorter video.`);
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
      const uploadUrlResponse = await api.post('/users/get-upload-url', {
        fileName: `recording_${Date.now()}.${fileExtension}`,
        contentType: mimeType
      });
      
      const { uploadUrl, publicUrl } = uploadUrlResponse.data;
      
      // Step 2: Upload video directly to S3
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
      
      
      // REQUERIMIENTO 3: Mantener estado TRANSCRIBING durante todo el proceso
      // Step 3: Send S3 URL to backend for transcription
      setMessage('Transcribing audio...');
      
      const timeoutMs = 180000; // 3 minutes for transcription
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
      

      // Solo actualizar si seguimos en la misma pregunta
      if (currentQuestionIndex === questionIndexAtStart) {
        const transcription = response.data.transcription || '';
        
        if (!transcription || transcription.trim().length === 0) {
          setError('Transcription returned empty. The video may not have audio. You can still type your answer manually.');
          setIsReviewMode(true);
          setVoiceState('REVIEW_MODE');
        } else {
          // Si es video de presentación (índice 0), guardar transcripción por separado
          if (currentQuestionIndex === 0) {
            setVideoPresentationTranscription(transcription);
            // Guardar el video en el progreso después de transcribirlo
            // Para las respuestas de texto, solo enviar las respuestas de las preguntas de texto (índices 1+)
            // answers[0] no se usa porque corresponde al video, no a una respuesta de texto
            if (publicUrl) {
              try {
                // Extraer solo las respuestas de texto (desde índice 1 en adelante, que corresponden a las preguntas de texto)
                const textAnswersOnly = answers.slice(1, allQuestions.length + 1);
                // Asegurar que tenga la longitud correcta (allQuestions.length)
                while (textAnswersOnly.length < allQuestions.length) {
                  textAnswersOnly.push('');
                }
                await api.post('/users/save-interview-progress', {
                  answers: textAnswersOnly,
                  currentQuestionIndex: currentQuestionIndex,
                  s3VideoUrl: publicUrl,
                  videoTranscription: transcription
                });
              } catch (saveError) {
                console.error('[SAVE PROGRESS] Error guardando video:', saveError);
              }
            }
          } else {
            // Para preguntas de texto, usar el flujo normal
            setTranscribedText(transcription);
            handleAnswerChange(transcription);
          }
        }
        
        setMessage('');
        setIsTranscribing(false);
        
        // REQUERIMIENTO 3: Transición a REVIEW_MODE (TTS sigue silenciado)
        setIsReviewMode(true);
        setVoiceState('REVIEW_MODE');
        // Correction timer: 1 minute to edit after transcription (for all questions including video)
        setTimeRemaining(60);
        setTimerActive(true);
      } else {
        // Pregunta cambió durante transcripción, cancelar
        setIsTranscribing(false);
        setMessage('');
        setVoiceState('IDLE');
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
          errorMessage = `Video file is too large (${sizeInMB}MB). Maximum size is 150MB. Please record a shorter video or the system will compress it automatically.`;
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
      // answers[0] corresponde al video (no se envía), answers[1+] corresponden a las preguntas de texto
      const textAnswers = answers.length > allQuestions.length 
        ? answers.slice(1, allQuestions.length + 1)
        : answers.slice(0, allQuestions.length);
      
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
          s3VideoUrl: s3VideoUrl,
          videoTranscription: videoPresentationTranscription || null
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
      // Redirect to Results page (Summary) instead of showing results here
      navigate('/results');
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

  const isVideoQuestion = currentQuestionIndex === 0; // Video question is FIRST (index 0)
  const isLastTextQuestion = currentQuestionIndex === allQuestions.length; // Last text question is at index allQuestions.length
  const currentQuestion = isVideoQuestion 
    ? "Please introduce yourself in 1 minute, speaking directly about your projects and skills."
    : allQuestions[currentQuestionIndex - 1]; // Text questions start at index 1, so subtract 1 to get the question

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
                  View Summary
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
      <div className="min-h-screen bg-mesh-gradient relative">
        {/* Ambient Orbs */}
        <div className="ambient-orb-1"></div>
        <div className="ambient-orb-2"></div>
        <div className="ambient-orb-3"></div>
        
        <Navbar />
        <div className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl relative z-10">
          <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl shadow-2xl p-6 sm:p-8 md:p-12">
            {/* Icon and Title */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                {answers.length > 0 && answers.some(a => a && a.trim() !== '') 
                  ? 'Continue Interview' 
                  : 'Interview Ready'}
              </h1>
              
              {/* Progress Saved Banner */}
              {answers.length > 0 && answers.some(a => a && a.trim() !== '') ? (
                <div className="glass-card bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-4 sm:p-5 mb-6 shadow-lg">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-green-800 font-bold text-lg">Progress Saved</p>
                  </div>
                  <p className="text-green-700 text-sm sm:text-base">
                    You have saved answers. You can continue from where you left off.
                  </p>
                </div>
              ) : null}
              
              {/* Question Count */}
              <div className="mb-6">
                <p className="text-lg sm:text-xl text-gray-600 mb-2">
                  You have <span className="font-bold text-blue-600 text-2xl">{allQuestions.length + 1}</span> questions to answer
                </p>
                <p className="text-gray-500 text-sm sm:text-base">
                  Each question has a time limit of 1 minute. The timer will start automatically when you begin.
                </p>
                {answers.length > 0 && answers.some(a => a && a.trim() !== '') && (
                  <p className="mt-3 text-green-600 font-semibold text-sm sm:text-base">
                    Your progress is automatically saved as you answer.
                  </p>
                )}
              </div>
            </div>

            {/* Instructions Card */}
            <div className="glass-card bg-gradient-to-br from-blue-50/80 to-purple-50/80 border border-blue-200/50 rounded-2xl p-6 sm:p-8 mb-8">
              <h3 className="font-bold text-gray-900 mb-4 sm:mb-6 text-lg sm:text-xl flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How the Interview Works:
              </h3>
              <ul className="space-y-3 sm:space-y-4">
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-gray-700 text-sm sm:text-base">
                    <strong>Self Introduction (1 minute):</strong> Start by introducing yourself, your background, key projects, and relevant skills. This helps our selection committee get to know you better.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-gray-700 text-sm sm:text-base">
                    <strong>Personalized Questions:</strong>Based on your CV, you'll receive customized questions. Each question will be read aloud automatically. You  have 10 seconds to think your answer, and video recording will start  immediately after.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-gray-700 text-sm sm:text-base">
                    <strong>Answer Time (1 minute per question):</strong> You have up to 1 minute to answer each question. Speak naturally and clearly - your response will be automatically transcribed to text.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-gray-700 text-sm sm:text-base">
                    <strong>Review & Edit (1 minute):</strong> After your response has been transcribed, you'll have 1 minute to review and edit the text to ensure accuracy before proceeding to the next question.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-gray-700 text-sm sm:text-base">
                    <strong>Important:</strong> All responses are recorded on video for evaluation purposes. Copy and paste functionality is disabled to ensure authentic responses. Your progress is automatically saved as you complete each question.
                  </span>
                </li>
              </ul>
              <div className="mt-6 pt-4 border-t border-blue-200">
                <p className="text-sm text-gray-600 italic">
                  💡 <strong>Tip:</strong> Find a quiet, well-lit space and ensure your camera and microphone are working properly before starting.
                </p>
              </div>
            </div>

            {/* Video Tutorial */}
            <div className="glass-card bg-gradient-to-br from-blue-50/80 to-purple-50/80 border border-blue-200/50 rounded-2xl p-6 sm:p-8 mb-8">
              <h3 className="font-bold text-gray-900 mb-4 sm:mb-6 text-lg sm:text-xl flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Video Tutorial
              </h3>
              <p className="text-gray-700 text-sm sm:text-base mb-4">
                Watch this tutorial to learn how to complete the interview process:
              </p>
              <div className="w-full rounded-lg overflow-hidden bg-gray-900">
                {tutorialVideoError ? (
                  <div className="w-full h-64 flex flex-col items-center justify-center bg-gray-800 text-gray-300 p-4">
                    <svg className="w-12 h-12 text-yellow-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-center">{tutorialVideoError}</p>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      URL: {tutorialVideoUrl || 'Not available'}
                    </p>
                  </div>
                ) : tutorialVideoUrl ? (
                  <video
                    controls
                    className="w-full h-auto"
                    style={{ maxHeight: '500px' }}
                    src={tutorialVideoUrl}
                    onError={() => {
                      setTutorialVideoError('Failed to load tutorial video. Please check that the file exists and has public-read permissions in S3.');
                    }}
                    onCanPlay={() => {
                      setTutorialVideoError(null);
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="w-full h-64 flex items-center justify-center bg-gray-800 text-gray-400">
                    Loading tutorial video...
                  </div>
                )}
              </div>
            </div>

            {/* Start Button */}
            <div className="text-center">
              <button
                onClick={startInterview}
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white font-bold py-4 px-8 sm:px-12 rounded-xl text-lg sm:text-xl transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105 w-full sm:w-auto"
              >
                Start Interview
              </button>
            </div>
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
                  ? `Question 1 of ${allQuestions.length + 1} - Video Introduction`
                  : `Question ${currentQuestionIndex + 1} of ${allQuestions.length + 1}`}
              </span>
              <span className="font-semibold">
                {Math.round(((currentQuestionIndex + 1) / (allQuestions.length + 1)) * 100)}%
              </span>
            </div>
            <div className="w-full bg-white/20 backdrop-blur-sm rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((currentQuestionIndex + 1) / (allQuestions.length + 1)) * 100}%` }}
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
                <div className="flex-1 flex items-center gap-3">
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
                    {currentQuestion}
                  </label>
                  {/* Reading indicator - basado en máquina de estados */}
                  {voiceState === 'READING_QUESTION' && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                      <span className="text-sm font-medium">Reading question...</span>
                    </div>
                  )}
                  {/* Transcription indicator */}
                  {voiceState === 'TRANSCRIBING' && (
                    <div className="flex items-center gap-2 text-purple-600">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent"></div>
                      <span className="text-sm font-medium">Transcribing...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Video Container (The Lens) - Renderizado Condicional Estricto */}
            {/* Ocultar cámara durante transcripción - solo mostrar mensaje de transcripción */}
            {/* Ocultar cámara cuando está en review mode (para todas las preguntas) */}
            {/* Mostrar video grabado si está en review mode para video question */}
            {!isTranscribing && !answerSaved && !isReviewMode && (
              <>
                {isVideoQuestion ? (
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
                          {countdownBeforeRecord > 0 ? (
                            <>
                              <div className="mb-4">
                                <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto rounded-full bg-yellow-500/90 backdrop-blur-md flex items-center justify-center border-4 border-yellow-400 shadow-2xl">
                                  <span className="text-4xl sm:text-5xl md:text-6xl font-bold text-white">{countdownBeforeRecord}</span>
                                </div>
                              </div>
                              <p className="text-xl sm:text-2xl font-semibold text-white">Starting in {countdownBeforeRecord} second{countdownBeforeRecord !== 1 ? 's' : ''}</p>
                            </>
                          ) : (
                            <>
                              <svg className="w-20 h-20 mx-auto mb-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <p className="text-lg text-white/80">Camera preview will appear here</p>
                            </>
                          )}
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
                ) : !isVideoQuestion ? (
                  /* Para preguntas de texto, mostrar cámara solo si no está en review mode */
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
                          {countdownBeforeRecord > 0 ? (
                            <>
                              <div className="mb-4">
                                <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto rounded-full bg-yellow-500/90 backdrop-blur-md flex items-center justify-center border-4 border-yellow-400 shadow-2xl">
                                  <span className="text-4xl sm:text-5xl md:text-6xl font-bold text-white">{countdownBeforeRecord}</span>
                                </div>
                              </div>
                              <p className="text-xl sm:text-2xl font-semibold text-white">Starting in {countdownBeforeRecord} second{countdownBeforeRecord !== 1 ? 's' : ''}</p>
                            </>
                          ) : (
                            <>
                              <svg className="w-20 h-20 mx-auto mb-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <p className="text-lg text-white/80">Camera preview will appear here</p>
                            </>
                          )}
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
                ) : null}
              </>
            )}

            {/* Transcription Status - Mostrar solo durante transcripción (sin cámara visible) */}
            {isTranscribing && !isReviewMode && !isVideoQuestion && (
              <div className="glass-card bg-white/90 backdrop-blur-md border border-white/40 rounded-2xl px-8 py-6 text-center shadow-xl mb-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                    <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-700">Transcribing audio...</p>
                    {message && (
                      <p className="text-sm text-gray-600 mt-1">{message}</p>
                    )}
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
                // Estado: Review Mode para video question (PRIMERA pregunta, no la última)
                // Los botones se mostrarán después del cuadro de transcripción (ver más abajo)
                if (isReviewMode && !isTranscribing) {
                  return null; // Los botones se mostrarán después de la transcripción
                }
                
                // Estado: Recording/Idle para video question
                return (
                  <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl -mt-4 sm:-mt-8 relative z-20">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                      {/* Hide play button if auto-starting or if already recording */}
                      {!isRecording && !recordedVideo && !shouldAutoStartRecording ? (
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
                      ) : shouldAutoStartRecording ? (
                        // Show loading state while auto-starting
                        <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:h-10 border-2 border-blue-600 border-t-transparent"></div>
                        </div>
                      ) : null}

                      {/* Recording Time Display - Timer principal durante la grabación */}
                      {isRecording && (
                        <div className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-xs text-gray-500 font-medium">Remaining time</p>
                            <div className={`flex items-center gap-2 rounded-full px-4 sm:px-6 py-2 sm:py-3 font-bold text-lg sm:text-2xl md:text-3xl ${
                              (60 - recordingTime) <= 10
                                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50' 
                                : (60 - recordingTime) <= 20
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/50'
                                : 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                            }`}>
                              <span>⏱️</span>
                              <span>{formatRecordingTimeRemaining(recordingTime)}</span>
                              <span className="text-sm sm:text-base opacity-75">/ 1:00</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Para preguntas de texto (no video question)
              // Estado: Answer Saved - Botón Next o Submit según si es la última pregunta
              if (answerSaved && !isReviewMode && !isTranscribing) {
                // Si es la última pregunta de texto, mostrar botón Submit
                if (isLastTextQuestion) {
                  return (
                    <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl -mt-4 sm:-mt-8 relative z-20">
                      <div className="flex items-center justify-center">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-full px-6 sm:px-8 py-3 sm:py-4 font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? 'Submitting...' : 'Submit Interview'}
                        </button>
                      </div>
                    </div>
                  );
                }
                // Si no es la última pregunta, mostrar botón Next
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

              // Estado: Review Mode - Los botones Retake y Keep se muestran después del cuadro de Review and edit
              // No mostrar nada aquí para preguntas de texto en Review Mode
              if (isReviewMode && !isTranscribing && !isVideoQuestion) {
                return null;
              }

              // Estado: Recording/Idle - Botones de grabación
              if (!isReviewMode && !isTranscribing && !answerSaved) {
                return (
                  <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl -mt-4 sm:-mt-8 relative z-20">
                    <div className="flex items-center justify-center gap-3 sm:gap-4">
                      {/* Main Record/Stop Button (Center) */}
                      {/* Hide play button if auto-starting or if already recording */}
                      {!isRecording && !recordedVideo && !shouldAutoStartRecording ? (
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
                      ) : shouldAutoStartRecording ? (
                        // Show loading state while auto-starting
                        <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:h-10 border-2 border-blue-600 border-t-transparent"></div>
                        </div>
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

                    {/* Recording Time Display - Timer principal durante la grabación */}
                    {isRecording && (
                      <div className="mt-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <p className="text-xs text-gray-500 font-medium">Remaining time</p>
                          <div className={`flex items-center gap-2 rounded-full px-4 sm:px-6 py-2 sm:py-3 font-bold text-lg sm:text-2xl md:text-3xl ${
                            (60 - recordingTime) <= 10
                              ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50' 
                              : (60 - recordingTime) <= 20
                              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/50'
                              : 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                          }`}>
                            <span>⏱️</span>
                            <span>{formatRecordingTimeRemaining(recordingTime)}</span>
                            <span className="text-sm sm:text-base opacity-75">/ 1:00</span>
                          </div>
                        </div>
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

            {/* Video Presentation - Mostrar video grabado cuando está en review mode */}
            {isReviewMode && !isTranscribing && isVideoQuestion && recordedVideo && (
              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-2 sm:border-4 border-white/20 mb-6" style={{ aspectRatio: '16/9' }}>
                {recordedVideo && (
                  <video
                    src={recordedVideo}
                    controls
                    className="w-full h-full object-contain bg-black"
                  />
                )}
              </div>
            )}

            {/* Video Presentation Transcription - Mostrar cuando está en review mode para video question */}
            {isReviewMode && !isTranscribing && isVideoQuestion && videoPresentationTranscription && (
              <>
                <div className="glass-card bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-4 sm:p-6 mb-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-2 sm:mb-3">
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                      Review and edit your video presentation transcription:
                    </label>
                    {/* Correction Timer Badge - visible during review (after transcription) */}
                    <div className={`flex-shrink-0 flex items-center gap-2 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-bold text-sm sm:text-base md:text-lg ${
                      timeRemaining < 60 
                        ? 'bg-red-100/80 text-red-700 border border-red-300' 
                        : 'bg-blue-100/80 text-blue-700 border border-blue-300'
                    }`}>
                      <span>⏱️</span>
                      <span>{formatTime(timeRemaining)}</span>
                    </div>
                  </div>
                  <textarea
                    value={videoPresentationTranscription}
                    onChange={(e) => setVideoPresentationTranscription(e.target.value)}
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
                {/* Botones Retake y Next Question - Aparecen después del cuadro de transcripción para video presentation */}
                <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl mb-6">
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
                      onClick={handleNextQuestion}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-6 sm:px-8 py-2 sm:py-3 font-semibold transition shadow-lg hover:shadow-xl text-sm sm:text-base flex items-center gap-2"
                    >
                      <span>Next Question</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Editable Transcription - Panel lateral/colapsable solo en Review Mode */}
            {/* Ocultar para la pregunta de video final (describe yourself) */}
            {isReviewMode && !isTranscribing && !isVideoQuestion && (
              <>
                <div ref={reviewEditRef} className="glass-card bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-2 sm:mb-3">
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                      Review and edit your transcribed answer:
                    </label>
                    {/* Correction Timer Badge - visible during review (after transcription) */}
                    <div className={`flex-shrink-0 flex items-center gap-2 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-bold text-sm sm:text-base md:text-lg ${
                      timeRemaining < 60 
                        ? 'bg-red-100/80 text-red-700 border border-red-300' 
                        : 'bg-blue-100/80 text-blue-700 border border-blue-300'
                    }`}>
                      <span>⏱️</span>
                      <span>{formatTime(timeRemaining)}</span>
                    </div>
                  </div>
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
                {/* Botones Retake y Keep - Aparecen después del cuadro de Review and edit */}
                <div className="glass-card bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl">
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
              </>
            )}

          </form>
        </div>
      </div>
    </div>
  );
};

export default Interview;
