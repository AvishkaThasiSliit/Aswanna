import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic, MicOff, Square, X, Plus, Trash2, CheckCircle, Check,
  AlertCircle, AlertTriangle, Sparkles, ShieldCheck,
  RotateCcw, ListFilter, HelpCircle, Camera
} from 'lucide-react';

import { apiFetch, ApiError, getAuthToken } from '../utils/api.js';
import { formatCurrency } from '../utils/formatters.js';
import {
  extractExpenses,
  sumTotals,
  CANONICAL_CATEGORIES
} from '../../../shared/voice/extractExpenses.js';
import { parseCommand } from '../../../shared/voice/parseCommand.js';
import { applyAsrConfidence } from '../lib/asrConfidence.js';
import { useToast } from './Toast.jsx';

/**
 * Voice & Smart Text Expense Entry Component (TASK V2 + TASK V3)
 * 
 * Features:
 * - Feature flag controlled: VITE_VOICE_ENTRY=on (defaults to off)
 * - Browser Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * - Permission requested on-tap only
 * - Privacy notice with local dismissal
 * - Fallback to typed text with no microphone
 * - Follow-up command interpreter via parseCommand (add, correct, remove, query)
 * - Safe target resolution with ambiguity chooser (never modifies a guessed row)
 * - One-step Undo for last command
 * - Duplicate warning with reason 'possible_duplicate'
 * - Queries answered only from pending rows via sumTotals / counts
 * - Pending items table with full editing, deleting, and manual row addition
 * - Blocks saving if any row has status === 'needs_review'
 * - Per-row POST /api/expenses with double-tap guard and partial-failure retention
 * 
 * NOTE: There is no server-side bulk or idempotency key endpoint for expenses.
 * Rows are dispatched individually via POST /expenses. On partial failure,
 * succeeded rows are removed and failed rows remain in client state for user retry.
 */
export default function VoiceExpenseEntry({
  activeCycle,
  activityCodes = [],
  defaultActivityCode,
  defaultDate,
  categoryBaselines,
  totalBaseline,
  onExpensesSaved,
  enabled
}) {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const voiceParam = searchParams?.get('voice');
  const isEnabled = enabled !== undefined
    ? enabled
    : voiceParam === 'off'
    ? false
    : voiceParam === 'on'
    ? true
    : (typeof window !== 'undefined' && window.__VOICE_ENTRY__ !== undefined)
    ? (window.__VOICE_ENTRY__ === 'on' || window.__VOICE_ENTRY__ === true)
    : (import.meta.env.VITE_VOICE_ENTRY === 'on' || import.meta.env.VITE_VOICE_ENTRY === 'true');

  if (!isEnabled) {
    return null;
  }

  return (
    <VoiceExpenseEntryInner
      activeCycle={activeCycle}
      activityCodes={activityCodes}
      defaultActivityCode={defaultActivityCode}
      defaultDate={defaultDate}
      categoryBaselines={categoryBaselines}
      totalBaseline={totalBaseline}
      onExpensesSaved={onExpensesSaved}
    />
  );
}

function VoiceExpenseEntryInner({
  activeCycle,
  activityCodes = [],
  defaultActivityCode,
  defaultDate,
  categoryBaselines,
  totalBaseline,
  onExpensesSaved
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast() || {};

  // Speech Recognition support check
  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  // Language selection: English ('en') or Sinhala ('si')
  const [selectedLang, setSelectedLang] = useState(i18n.language === 'si' ? 'si' : 'en');
  const [transcript, setTranscript] = useState('');
  const [alternatives, setAlternatives] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechError, setSpeechError] = useState('');

  // First-use privacy notice dismissal
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(() => {
    try {
      return localStorage.getItem('aswanna_voice_privacy_dismissed') !== 'true';
    } catch {
      return true;
    }
  });

  // Pending rows state
  const [pendingItems, setPendingItems] = useState([]);
  const [previousPendingItems, setPreviousPendingItems] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Query response and command feedback state
  const [queryResult, setQueryResult] = useState(null);
  const [commandFeedback, setCommandFeedback] = useState(null);
  const [activeChooser, setActiveChooser] = useState(null);

  const isWhisperMode = import.meta.env?.VITE_VOICE_ASR === 'whisper';

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const timerRef = useRef(null);

  // Bill scan feature flag check (URL param ?bill=on/off, window.__BILL_SCAN__, or VITE_BILL_SCAN=on)
  const currentSearchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isBillScanEnabled = (
    currentSearchParams?.get('bill') === 'on' ||
    (typeof window !== 'undefined' && (window.__BILL_SCAN__ === 'on' || window.__BILL_SCAN__ === true)) ||
    (import.meta.env?.VITE_BILL_SCAN === 'on' || import.meta.env?.VITE_BILL_SCAN === 'true')
  );

  const fileInputRef = useRef(null);
  const [isScanningBill, setIsScanningBill] = useState(false);
  const [billScanError, setBillScanError] = useState('');

  // Downscale image helper to max 1600px long edge before upload
  const downscaleImageIfNeeded = (file) => {
    return new Promise((resolve) => {
      if (!window.Image || !window.HTMLCanvasElement || typeof window.URL?.createObjectURL !== 'function') {
        return resolve(file);
      }
      try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        let resolved = false;
        const cleanup = () => {
          try { URL.revokeObjectURL(objectUrl); } catch {}
        };
        img.onload = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          const maxDim = 1600;
          let { width, height } = img;
          if (width <= maxDim && height <= maxDim) {
            return resolve(file);
          }
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(file);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          }, file.type || 'image/jpeg', 0.90);
        };
        img.onerror = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve(file);
        };
        img.src = objectUrl;
        // Fallback for test / headless environments where image loading doesn't fire events
        if (typeof setTimeout === 'function') {
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve(file);
            }
          }, 50);
        }
      } catch {
        resolve(file);
      }
    });
  };

  const handleBillFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so same file can be re-selected if desired
    e.target.value = '';

    setBillScanError('');

    // Client-side validations
    if (file.size === 0) {
      setBillScanError(t('billScan.emptyFile'));
      return;
    }
    const ct = file.type?.toLowerCase();
    if (ct !== 'image/png' && ct !== 'image/jpeg' && ct !== 'image/jpg') {
      setBillScanError(t('billScan.invalidType'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBillScanError(t('billScan.fileTooLarge'));
      return;
    }

    setIsScanningBill(true);

    try {
      // Optional downscale before upload
      const uploadBlob = await downscaleImageIfNeeded(file);

      const headers = {
        'Content-Type': ct || 'image/jpeg'
      };
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/bill-scan', {
        method: 'POST',
        headers,
        body: uploadBlob
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error?.message || errJson.message || t('billScan.errorGeneric');
        throw new Error(msg);
      }

      const data = await res.json();
      const extractedItems = Array.isArray(data.items) ? data.items : [];

      if (extractedItems.length === 0) {
        setBillScanError(t('billScan.emptyFile'));
        return;
      }

      // Add to pending rows without saving until farmer confirms
      // Requirement 2: Scanned amount ALWAYS needs an explicit Accept tap before Save is enabled
      const billRows = extractedItems.map(item => ({
        ...item,
        billAccepted: false,
        source: 'bill'
      }));

      setPreviousPendingItems([...pendingItems]);
      setPendingItems(prev => [...prev, ...billRows]);
      showToast?.(t('billScan.photoProcessed'));
    } catch (err) {
      setBillScanError(err.message || t('billScan.errorGeneric'));
    } finally {
      setIsScanningBill(false);
    }
  };

  // Sync language if i18n language changes
  useEffect(() => {
    if (i18n.language === 'si') {
      setSelectedLang('si');
    }
  }, [i18n.language]);

  // Clean up recognition, media stream and timer on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
        } catch {}
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          const next = prev + 1;
          if (isWhisperMode && next >= 30) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isWhisperMode]);

  const handleDismissPrivacy = () => {
    setShowPrivacyNotice(false);
    try {
      localStorage.setItem('aswanna_voice_privacy_dismissed', 'true');
    } catch {}
  };

  const handleWhisperTranscription = async (audioBlob) => {
    if (!audioBlob || audioBlob.size === 0) return;
    setIsTranscribing(true);
    setSpeechError('');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const headers = {};
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/voice/transcribe?use_vocab_prompt=true', {
        method: 'POST',
        headers,
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error || errJson.message || `Voice service error (${res.status})`;
        throw new Error(msg);
      }

      const data = await res.json();
      const text = (data.text || '').trim();
      setTranscript(text);

      if (!text) {
        setSpeechError(t('voice.errorNoSpeech'));
        return;
      }

      const todayISO = defaultDate || new Date().toISOString().split('T')[0];
      const command = parseCommand(text, pendingItems, {
        lang: 'en',
        today: todayISO,
        categoryBaselines,
        totalBaseline
      });

      if (command.intent === 'query') {
        if (command.kind === 'total') {
          const tot = sumTotals(pendingItems);
          setQueryResult(t('voice.queryResultTotal', { total: formatCurrency(tot, i18n.language) }));
        } else if (command.kind === 'category_total') {
          const catItems = pendingItems.filter(r => r.category === command.category);
          const catTot = sumTotals(catItems);
          setQueryResult(t('voice.queryResultCategory', {
            category: command.category,
            total: formatCurrency(catTot, i18n.language)
          }));
        } else if (command.kind === 'count') {
          const count = command.category
            ? pendingItems.filter(r => r.category === command.category).length
            : pendingItems.length;
          setQueryResult(t('voice.queryResultCount', { count }));
        }
      } else if (command.intent === 'add') {
        setPreviousPendingItems([...pendingItems]);
        const assessedItems = applyAsrConfidence(command.items || [], data.segments || []);
        const mapped = assessedItems.map((item, idx) => ({
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `item-${Date.now()}-${idx}`,
          description: item.description || '',
          category: item.category || '',
          quantity: item.quantity != null ? item.quantity : '',
          unit: item.unit || '',
          unitPrice: item.unitPrice != null ? item.unitPrice : '',
          totalAmount: item.totalAmount != null ? item.totalAmount : '',
          currency: item.currency || 'LKR',
          dateISO: item.dateISO || todayISO,
          status: item.status || 'needs_review',
          reasons: item.reasons || []
        }));

        setPendingItems(prev => [...prev, ...mapped]);

        const hasDuplicate = mapped.some(m => m.reasons?.includes('possible_duplicate'));
        if (hasDuplicate) {
          setCommandFeedback(t('voice.duplicateWarning'));
        }
      } else if (command.intent === 'remove') {
        if (command.status === 'needs_choice') {
          setActiveChooser({
            intent: 'remove',
            candidates: command.targetCandidates,
            targetWord: command.targetWord
          });
        } else if (command.status === 'ready' && command.targetCandidates.length === 1) {
          const targetId = command.targetCandidates[0];
          setPreviousPendingItems([...pendingItems]);
          setPendingItems(prev => prev.filter(r => r.id !== targetId));
        }
      } else if (command.intent === 'correct') {
        if (command.status === 'needs_choice') {
          setActiveChooser({
            intent: 'correct',
            candidates: command.targetCandidates,
            field: command.field,
            newValue: command.newValue,
            targetWord: command.targetWord
          });
        } else if (command.status === 'ready' && command.targetCandidates.length === 1) {
          const targetId = command.targetCandidates[0];
          setPreviousPendingItems([...pendingItems]);
          setPendingItems(prev => updateRowById(targetId, command.field, command.newValue, prev));
        }
      } else if (command.intent === 'unknown') {
        if (command.reason === 'saved_record_reference') {
          setCommandFeedback(t('voice.savedRecordNotice'));
        } else {
          setCommandFeedback(t('voice.commandUnknown'));
        }
      }
    } catch (err) {
      console.warn('Whisper transcription error, falling back to typed entry:', err);
      // Fall back to typed entry with pending rows preserved
      setSpeechError(err.message || 'Voice service unavailable. Please type your expenses.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Start Voice Recording
  const startRecording = async () => {
    setSpeechError('');
    if (isWhisperMode) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setSpeechError(t('voice.unsupportedBrowser'));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];

        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
          if (!MediaRecorder.isTypeSupported('audio/webm')) {
            if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
            else if (MediaRecorder.isTypeSupported('audio/wav')) mimeType = 'audio/wav';
          }
        }

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        recorder.onerror = () => {
          setSpeechError(t('voice.errorGeneric'));
          setIsRecording(false);
        };
        mediaRecorderRef.current = recorder;
        recorder.start(250);
        setIsRecording(true);
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setSpeechError(t('voice.errorPermissionDenied'));
        } else {
          setSpeechError(t('voice.errorGeneric'));
        }
        setIsRecording(false);
      }
      return;
    }

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.lang = selectedLang === 'si' ? 'si-LK' : 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        const currentAlts = [];
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (event.results.length > 0) {
          const lastRes = event.results[event.results.length - 1];
          for (let j = 0; j < lastRes.length; j++) {
            currentAlts.push({
              transcript: lastRes[j].transcript,
              confidence: lastRes[j].confidence
            });
          }
        }
        setTranscript(currentTranscript);
        setAlternatives(currentAlts);
      };

      recognition.onerror = (event) => {
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          setSpeechError(t('voice.errorPermissionDenied'));
        } else if (event.error === 'no-speech') {
          setSpeechError(t('voice.errorNoSpeech'));
        } else if (event.error === 'network') {
          setSpeechError(t('voice.errorNetwork'));
        } else if (event.error === 'language-not-supported') {
          setSpeechError(t('voice.errorUnsupportedLanguage'));
        } else {
          setSpeechError(t('voice.errorGeneric'));
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setSpeechError(t('voice.errorGeneric'));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (isWhisperMode) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const recorder = mediaRecorderRef.current;
        recorder.onstop = async () => {
          const mimeType = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          if (mediaStreamRef.current) {
            try {
              mediaStreamRef.current.getTracks().forEach(t => t.stop());
            } catch {}
            mediaStreamRef.current = null;
          }
          await handleWhisperTranscription(audioBlob);
        };
        try {
          recorder.stop();
        } catch {}
      }
      setIsRecording(false);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (isWhisperMode) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
        } catch {}
        mediaStreamRef.current = null;
      }
      audioChunksRef.current = [];
      setIsRecording(false);
      setRecordingSeconds(0);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Row update helper
  const updateRowById = (id, field, value, rowsList = pendingItems) => {
    const targetField = field === 'amount' ? 'totalAmount' : field;
    return rowsList.map(row => {
      if (row.id !== id) return row;

      let val = value;
      if (targetField === 'totalAmount' || targetField === 'quantity' || targetField === 'unitPrice') {
        val = value === '' ? '' : Number(value);
      }

      const updated = { ...row, [targetField]: val };

      if (targetField === 'totalAmount' || targetField === 'quantity') {
        const total = targetField === 'totalAmount' ? Number(val) : Number(row.totalAmount);
        const qty = targetField === 'quantity' ? Number(val) : Number(row.quantity);
        if (total > 0 && qty > 0) {
          updated.unitPrice = Number((total / qty).toFixed(2));
        }
      }

      const totalNum = Number(updated.totalAmount);
      const hasAmount = !isNaN(totalNum) && totalNum > 0;
      const hasCategory = Boolean(updated.category && CANONICAL_CATEGORIES.includes(updated.category));

      const remainingReasons = (updated.reasons || []).filter(r => {
        if (hasAmount && (r === 'amount_unresolved' || r === 'amount_ambiguous' || r === 'amount_from_words_verify' || r === 'unit_price_fractional')) return false;
        if (hasCategory && r === 'category_uncertain') return false;
        return true;
      });

      updated.reasons = remainingReasons;
      updated.status = (hasAmount && hasCategory && remainingReasons.length === 0) ? 'ok' : 'needs_review';

      return updated;
    });
  };

  // Row update handler for table inputs
  const handleUpdateRow = (id, field, value) => {
    setPendingItems(prev => updateRowById(id, field, value, prev));
  };

  // Row delete handler
  const handleDeleteRow = (id) => {
    setPreviousPendingItems([...pendingItems]);
    setPendingItems(prev => prev.filter(row => row.id !== id));
  };

  // Farmer override handler for implausible amounts, ASR alternatives disagreement, low confidence, or interim Sinhala number words
  const handleOverrideRow = (id) => {
    setPreviousPendingItems([...pendingItems]);
    setPendingItems(prev => prev.map(row => {
      if (row.id !== id) return row;
      const filteredReasons = (row.reasons || []).filter(r =>
        r !== 'amount_implausible' &&
        r !== 'asr_alternatives_disagree' &&
        r !== 'amount_from_words_verify' &&
        r !== 'asr_low_confidence' &&
        r !== 'unit_price_fractional' &&
        r !== 'amount_rounded' &&
        r !== 'category_unsure' &&
        r !== 'single_row_from_total'
      );
      const hasAmount = !isNaN(Number(row.totalAmount)) && Number(row.totalAmount) > 0;
      const hasCategory = Boolean(row.category && CANONICAL_CATEGORIES.includes(row.category));
      return {
        ...row,
        billAccepted: true,
        reasons: filteredReasons,
        status: (hasAmount && hasCategory && filteredReasons.length === 0) ? 'ok' : 'needs_review'
      };
    }));
  };

  // Farmer accept handler for scanned bill items (Requirement 2)
  const handleAcceptBillItem = (id) => {
    setPreviousPendingItems([...pendingItems]);
    setPendingItems(prev => prev.map(row => {
      if (row.id !== id) return row;
      const filteredReasons = (row.reasons || []).filter(r =>
        r !== 'amount_rounded' &&
        r !== 'category_unsure' &&
        r !== 'single_row_from_total'
      );
      const hasAmount = !isNaN(Number(row.totalAmount)) && Number(row.totalAmount) > 0;
      const hasCategory = Boolean(row.category && CANONICAL_CATEGORIES.includes(row.category));
      return {
        ...row,
        billAccepted: true,
        reasons: filteredReasons,
        status: (hasAmount && hasCategory && filteredReasons.length === 0) ? 'ok' : 'needs_review'
      };
    }));
  };

  // Add empty manual row
  const handleAddRow = () => {
    const todayISO = defaultDate || new Date().toISOString().split('T')[0];
    const newRow = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `item-${Date.now()}`,
      description: '',
      category: '',
      quantity: '',
      unit: '',
      unitPrice: '',
      totalAmount: '',
      currency: 'LKR',
      dateISO: todayISO,
      status: 'needs_review',
      reasons: ['amount_unresolved']
    };
    setPreviousPendingItems([...pendingItems]);
    setPendingItems(prev => [...prev, newRow]);
  };

  // Undo last command handler
  const handleUndo = () => {
    if (!previousPendingItems) return;
    setPendingItems(previousPendingItems);
    setPreviousPendingItems(null);
    showToast?.(t('voice.undoSuccess'));
  };

  // Run command or extraction handler
  const handleRunCommandOrExtract = () => {
    if (!transcript || !transcript.trim()) return;
    setIsExtracting(true);
    setSaveError('');
    setQueryResult(null);
    setCommandFeedback(null);
    setActiveChooser(null);

    try {
      const todayISO = defaultDate || new Date().toISOString().split('T')[0];
      const command = parseCommand(transcript, pendingItems, {
        lang: selectedLang,
        today: todayISO,
        categoryBaselines,
        totalBaseline,
        alternatives
      });

      // 1. Query Intent: answer from pending list only, do NOT mutate rows
      if (command.intent === 'query') {
        if (command.kind === 'total') {
          const tot = sumTotals(pendingItems);
          setQueryResult(t('voice.queryResultTotal', { total: formatCurrency(tot, i18n.language) }));
        } else if (command.kind === 'category_total') {
          const catItems = pendingItems.filter(r => r.category === command.category);
          const catTot = sumTotals(catItems);
          setQueryResult(t('voice.queryResultCategory', {
            category: command.category,
            total: formatCurrency(catTot, i18n.language)
          }));
        } else if (command.kind === 'count') {
          const count = command.category
            ? pendingItems.filter(r => r.category === command.category).length
            : pendingItems.length;
          setQueryResult(t('voice.queryResultCount', { count }));
        }
        return;
      }

      // 2. Add Intent: append new items without clearing existing rows
      if (command.intent === 'add') {
        setPreviousPendingItems([...pendingItems]);
        const mapped = command.items.map((item, idx) => ({
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `item-${Date.now()}-${idx}`,
          description: item.description || '',
          category: item.category || '',
          quantity: item.quantity != null ? item.quantity : '',
          unit: item.unit || '',
          unitPrice: item.unitPrice != null ? item.unitPrice : '',
          totalAmount: item.totalAmount != null ? item.totalAmount : '',
          currency: item.currency || 'LKR',
          dateISO: item.dateISO || todayISO,
          status: item.status || 'needs_review',
          reasons: item.reasons || []
        }));

        setPendingItems(prev => [...prev, ...mapped]);

        const hasDuplicate = mapped.some(m => m.reasons?.includes('possible_duplicate'));
        if (hasDuplicate) {
          setCommandFeedback(t('voice.duplicateWarning'));
        }
        return;
      }

      // 3. Remove Intent
      if (command.intent === 'remove') {
        if (command.status === 'needs_choice') {
          setActiveChooser({
            intent: 'remove',
            candidates: command.targetCandidates,
            targetWord: command.targetWord
          });
          return;
        }

        if (command.status === 'ready' && command.targetCandidates.length === 1) {
          const targetId = command.targetCandidates[0];
          setPreviousPendingItems([...pendingItems]);
          setPendingItems(prev => prev.filter(r => r.id !== targetId));
          return;
        }
      }

      // 4. Correct Intent
      if (command.intent === 'correct') {
        if (command.status === 'needs_choice') {
          setActiveChooser({
            intent: 'correct',
            candidates: command.targetCandidates,
            field: command.field,
            newValue: command.newValue,
            targetWord: command.targetWord
          });
          return;
        }

        if (command.status === 'ready' && command.targetCandidates.length === 1) {
          const targetId = command.targetCandidates[0];
          setPreviousPendingItems([...pendingItems]);
          setPendingItems(prev => updateRowById(targetId, command.field, command.newValue, prev));
          return;
        }
      }

      // 5. Unknown Intent / Saved record notice
      if (command.intent === 'unknown') {
        if (command.reason === 'saved_record_reference') {
          setCommandFeedback(t('voice.savedRecordNotice'));
        } else {
          setCommandFeedback(t('voice.commandUnknown'));
        }
        return;
      }
    } catch (err) {
      setSaveError(err.message || 'Processing failed');
    } finally {
      setIsExtracting(false);
    }
  };

  // Candidate chooser resolution handler
  const handleApplyChoice = (chosenId) => {
    if (!activeChooser) return;
    setPreviousPendingItems([...pendingItems]);

    if (activeChooser.intent === 'remove') {
      setPendingItems(prev => prev.filter(r => r.id !== chosenId));
    } else if (activeChooser.intent === 'correct') {
      setPendingItems(prev => updateRowById(chosenId, activeChooser.field, activeChooser.newValue, prev));
    }
    setActiveChooser(null);
  };

  // Overall Total - derived strictly from sumTotals(pendingItems)
  const totalAmount = useMemo(() => sumTotals(pendingItems), [pendingItems]);

  // Category Subtotals - derived strictly from sumTotals over each category
  const categorySubtotals = useMemo(() => {
    const map = {};
    for (const cat of CANONICAL_CATEGORIES) {
      const itemsInCat = pendingItems.filter(item => item.category === cat);
      const catSum = sumTotals(itemsInCat);
      if (catSum > 0) {
        map[cat] = catSum;
      }
    }
    return map;
  }, [pendingItems]);

  // Check if any row needs review or is missing valid category or total
  const hasNeedsReview = useMemo(() => {
    if (pendingItems.length === 0) return true;
    return pendingItems.some(item => {
      const totalNum = Number(item.totalAmount);
      const isTotalValid = !isNaN(totalNum) && totalNum > 0;
      const isCatValid = Boolean(item.category && CANONICAL_CATEGORIES.includes(item.category));
      // Requirement 2: Scanned amount ALWAYS needs an explicit Accept tap before Save is enabled, even when status is ok
      if (item.source === 'bill' && !item.billAccepted) {
        return true;
      }
      return item.status === 'needs_review' || !isTotalValid || !isCatValid;
    });
  }, [pendingItems]);

  // Build POST payload for single row
  const buildPayload = (row) => {
    const total = Number(row.totalAmount);
    const qty = row.quantity !== '' && row.quantity != null ? Number(row.quantity) : undefined;
    const unitPrice = row.unitPrice !== '' && row.unitPrice != null ? Number(row.unitPrice) : undefined;
    const resolvedActivityCode = defaultActivityCode || activityCodes?.[0]?._id;

    const base = {
      cycleId: activeCycle?._id,
      entryDate: row.dateISO || defaultDate || new Date().toISOString().split('T')[0],
      dayStatus: 'worked',
      activityCode: resolvedActivityCode || undefined,
      clientRequestId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      source: 'voice',
      reviewConfirmed: true,
    };

    if (['seed', 'fertilizer', 'agrochemical', 'fuel', 'irrigation'].includes(row.category)) {
      return {
        ...base,
        inputs: [{
          categoryTag: row.category,
          inputType: row.description || row.category,
          quantity: qty,
          unit: row.unit || undefined,
          cost: Math.round(total)
        }]
      };
    }

    if (row.category === 'labour') {
      return {
        ...base,
        labour: {
          hiredLabour: qty,
          dailyWage: unitPrice ? Math.round(unitPrice) : (qty ? Math.round(total / qty) : undefined),
          cost: Math.round(total)
        }
      };
    }

    if (row.category === 'machinery') {
      return {
        ...base,
        machinery: {
          method: row.description || 'Machinery',
          quantity: qty,
          unitPrice: unitPrice ? Math.round(unitPrice) : undefined,
          cost: Math.round(total)
        }
      };
    }

    return {
      ...base,
      other: {
        description: row.description || 'Voice expense',
        amount: Math.round(total)
      }
    };
  };

  // Confirm & Save all pending rows (one POST /expenses per row)
  const handleConfirmSave = async () => {
    if (isSaving || hasNeedsReview) return;
    setIsSaving(true);
    setSaveError('');

    const initialTotalCount = pendingItems.length;
    const failedRows = [];

    for (const row of pendingItems) {
      try {
        const payload = buildPayload(row);
        await apiFetch('/expenses', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (err) {
        failedRows.push({ ...row, saveError: err.message || 'Save failed' });
      }
    }

    setIsSaving(false);

    if (failedRows.length === 0) {
      setPendingItems([]);
      setPreviousPendingItems(null);
      setTranscript('');
      showToast?.(t('voice.saveSuccess', { count: initialTotalCount }));
      onExpensesSaved?.();
    } else {
      setPendingItems(failedRows);
      const failedCount = failedRows.length;
      const errorMsg = t('voice.partialFailure', { failedCount, totalCount: initialTotalCount });
      setSaveError(errorMsg);
      showToast?.(errorMsg, 'error');
      if (initialTotalCount > failedCount) {
        onExpensesSaved?.();
      }
    }
  };

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  // Candidate rows to display in ambiguity chooser
  const chooserCandidateRows = useMemo(() => {
    if (!activeChooser) return [];
    if (activeChooser.candidates.length === 0) {
      return pendingItems;
    }
    return pendingItems.filter(r => activeChooser.candidates.includes(r.id));
  }, [activeChooser, pendingItems]);

  return (
    <div id="voice-expense-entry-card" data-testid="voice-expense-entry-card" className="bg-white border border-border rounded-card p-4 sm:p-6 shadow-sm space-y-4">
      {/* Title & Subtitle */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 rounded-control text-emerald-800">
            <Mic size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span>{t('voice.title')}</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                Beta
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {t('voice.subtitle')}
            </p>
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="voice-lang-select" className="text-xs text-slate-500 hidden sm:inline">
            {t('voice.selectLang')}:
          </label>
          <select
            id="voice-lang-select"
            aria-label={t('voice.selectLang')}
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-border rounded-control focus:outline-none focus:ring-1 focus:ring-emerald-700"
          >
            <option value="en">{t('voice.langEn')}</option>
            <option value="si">{t('voice.langSi')}</option>
          </select>
        </div>
      </div>

      {/* Privacy Notice (First Use) */}
      {showPrivacyNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-control flex items-start justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-start gap-2">
            <ShieldCheck size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t('voice.privacyNotice')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismissPrivacy}
            className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 rounded-control transition-colors shrink-0"
          >
            {t('voice.privacyDismiss')}
          </button>
        </div>
      )}

      {/* Unsupported Browser Notice */}
      {!SpeechRecognition && !isWhisperMode && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-control text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-amber-600" />
          <span>{t('voice.unsupportedBrowser')}</span>
        </div>
      )}

      {/* Speech Error Banner */}
      {speechError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-control text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0 text-red-600" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Query Result Banner */}
      {queryResult && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-control text-xs text-blue-900 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600 shrink-0" />
            <span className="font-semibold">{queryResult}</span>
          </div>
          <button
            type="button"
            onClick={() => setQueryResult(null)}
            className="text-blue-500 hover:text-blue-800"
            aria-label="Dismiss query result"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Command Feedback Banner */}
      {commandFeedback && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-control text-xs text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>{commandFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setCommandFeedback(null)}
            className="text-amber-500 hover:text-amber-800"
            aria-label="Dismiss feedback"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Ambiguity Candidate Chooser */}
      {activeChooser && (
        <div id="voice-ambiguity-chooser" data-testid="voice-ambiguity-chooser" className="p-4 bg-slate-50 border-2 border-emerald-500 rounded-card space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListFilter size={18} className="text-emerald-700" />
              <h4 className="text-xs font-bold text-slate-900">{t('voice.chooserTitle')}</h4>
            </div>
            <button
              type="button"
              onClick={() => setActiveChooser(null)}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded border border-border bg-white"
            >
              {t('voice.chooserCancel')}
            </button>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            {t('voice.chooserPrompt')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {chooserCandidateRows.map(row => (
              <button
                key={row.id}
                type="button"
                onClick={() => handleApplyChoice(row.id)}
                className="p-2.5 text-left bg-white hover:bg-emerald-50 border border-border hover:border-emerald-300 rounded-control transition-all shadow-2xs group"
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-800 group-hover:text-emerald-900 text-xs">
                    {row.description || '--'}
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                    {row.category || 'other'}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                  <span>{row.quantity ? `${row.quantity} ${row.unit || ''}` : ''}</span>
                  <span className="font-semibold text-emerald-800">
                    {formatCurrency(Number(row.totalAmount) || 0, i18n.language)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls & Recording / Scanning Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {(SpeechRecognition || isWhisperMode) && (
          <>
            {!isRecording ? (
              <button
                type="button"
                id="voice-mic-btn"
                data-testid="voice-mic-btn"
                onClick={startRecording}
                disabled={isTranscribing || isScanningBill}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-control transition-colors shadow-sm"
              >
                <Mic size={15} />
                <span>{isTranscribing ? t('voice.extracting') : t('voice.startRecording')}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-control text-red-700 text-xs font-semibold animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                  <span>{t('voice.recording')}</span>
                  <span className="font-mono ml-1">{formatTimer(recordingSeconds)}</span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-control transition-colors"
                >
                  <Square size={13} />
                  <span>{t('voice.stopRecording')}</span>
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-control transition-colors"
                >
                  <X size={13} />
                  <span>{t('voice.cancelRecording')}</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Scan Bill Button (gated by VITE_BILL_SCAN=on) */}
        {isBillScanEnabled && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              data-testid="bill-file-input"
              accept="image/png,image/jpeg"
              capture="environment"
              onChange={handleBillFileChange}
              className="hidden"
            />
            <button
              type="button"
              id="bill-scan-btn"
              data-testid="bill-scan-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanningBill || isRecording || isTranscribing}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-control transition-colors shadow-sm"
            >
              <Camera size={15} />
              <span>{isScanningBill ? t('billScan.scanning') : t('billScan.scanButton')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Bill Scan Error banner */}
      {billScanError && (
        <div data-testid="bill-scan-error" className="p-2.5 bg-red-50 border border-red-200 rounded-control flex items-center justify-between text-red-800 text-xs">
          <span>{billScanError}</span>
          <button type="button" onClick={() => setBillScanError('')} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Transcript Textarea & Action Button */}
      <div className="space-y-2">
        <textarea
          id="voice-transcript-input"
          data-testid="voice-transcript-input"
          aria-label={t('voice.transcriptPlaceholder')}
          placeholder={t('voice.transcriptPlaceholder')}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={3}
          className="w-full text-xs p-3 bg-slate-50 border border-border rounded-control focus:outline-none focus:ring-1 focus:ring-emerald-700 font-sans"
        />
        <div className="flex flex-wrap justify-between items-center gap-2">
          <p className="text-[11px] text-slate-500 italic">
            {t('voice.commandsHelp')}
          </p>
          <button
            type="button"
            id="voice-extract-btn"
            data-testid="voice-extract-btn"
            onClick={handleRunCommandOrExtract}
            disabled={!transcript.trim() || isExtracting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-control transition-colors shadow-sm"
          >
            <Sparkles size={14} />
            <span>{isExtracting ? t('voice.extracting') : t('voice.extractButton')}</span>
          </button>
        </div>
      </div>

      {/* Pending Items Table (Requirement 6) */}
      {pendingItems.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-border">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('voice.pendingTitle')}</h3>
              <p className="text-xs text-slate-500">{t('voice.pendingSubtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              {previousPendingItems && (
                <button
                  type="button"
                  id="voice-undo-btn"
                  data-testid="voice-undo-btn"
                  onClick={handleUndo}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-control transition-colors"
                >
                  <RotateCcw size={13} />
                  <span>{t('voice.undo')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-control transition-colors"
              >
                <Plus size={13} />
                <span>{t('voice.addRow')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviousPendingItems([...pendingItems]);
                  setPendingItems([]);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-border rounded-control transition-colors"
              >
                <Trash2 size={13} />
                <span>{t('voice.clearAll')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            {/* Original Transcript Panel (Requirement 6) */}
            <div
              id="voice-original-transcript-card"
              data-testid="voice-original-transcript-card"
              className="lg:col-span-1 bg-slate-50 border border-border rounded-control p-3.5 space-y-2 h-fit"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Mic size={14} className="text-emerald-700" />
                <span>{t('voice.originalTranscript')}</span>
              </div>
              <p
                id="voice-original-transcript"
                data-testid="voice-original-transcript"
                className="text-xs text-slate-700 italic bg-white p-2.5 rounded border border-border whitespace-pre-wrap leading-relaxed shadow-2xs font-sans"
              >
                "{transcript || '--'}"
              </p>
            </div>

            {/* Table (lg:col-span-3) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="overflow-x-auto border border-border rounded-control">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-border text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2 min-w-[130px]">{t('voice.colDescription')}</th>
                      <th className="p-2 min-w-[110px]">{t('voice.colCategory')}</th>
                      <th className="p-2 min-w-[55px]">{t('voice.colQuantity')}</th>
                      <th className="p-2 min-w-[55px]">{t('voice.colUnit')}</th>
                      <th className="p-2 min-w-[75px]">{t('voice.colUnitPrice')}</th>
                      <th className="p-2 min-w-[115px]">{t('voice.colTotal')}</th>
                      <th className="p-2 min-w-[100px]">{t('voice.colDate')}</th>
                      <th className="p-2 min-w-[110px]">{t('voice.colStatus')}</th>
                      <th className="p-2 text-center w-10">{t('voice.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-border">
                    {pendingItems.map((item) => {
                      const isNeedsReview = item.status === 'needs_review' || !item.category || !item.totalAmount || (item.source === 'bill' && !item.billAccepted);
                      return (
                        <tr
                          key={item.id}
                          className={isNeedsReview ? 'bg-amber-50/70 border-l-4 border-l-amber-500 hover:bg-amber-50' : 'hover:bg-slate-50'}
                        >
                          {/* Description */}
                          <td className="p-2">
                            <input
                              type="text"
                              aria-label={t('voice.colDescription')}
                              value={item.description}
                              onChange={(e) => handleUpdateRow(item.id, 'description', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-border rounded text-xs focus:ring-1 focus:ring-emerald-700"
                            />
                          </td>

                          {/* Category */}
                          <td className="p-2">
                            <select
                              aria-label={t('voice.colCategory')}
                              value={item.category || ''}
                              onChange={(e) => handleUpdateRow(item.id, 'category', e.target.value)}
                              className={`w-full px-2 py-1 bg-white border rounded text-xs focus:ring-1 focus:ring-emerald-700 ${
                                !item.category ? 'border-amber-400 font-semibold text-amber-800' : 'border-border'
                              }`}
                            >
                              <option value="">-- select --</option>
                              {CANONICAL_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>

                          {/* Qty */}
                          <td className="p-2">
                            <input
                              type="number"
                              aria-label={t('voice.colQuantity')}
                              value={item.quantity}
                              onChange={(e) => handleUpdateRow(item.id, 'quantity', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-border rounded text-xs focus:ring-1 focus:ring-emerald-700"
                              min="0"
                              step="any"
                            />
                          </td>

                          {/* Unit */}
                          <td className="p-2">
                            <input
                              type="text"
                              aria-label={t('voice.colUnit')}
                              value={item.unit}
                              onChange={(e) => handleUpdateRow(item.id, 'unit', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-border rounded text-xs focus:ring-1 focus:ring-emerald-700"
                            />
                          </td>

                          {/* Unit Price */}
                          <td className="p-2">
                            <input
                              type="number"
                              aria-label={t('voice.colUnitPrice')}
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateRow(item.id, 'unitPrice', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-border rounded text-xs focus:ring-1 focus:ring-emerald-700"
                              min="0"
                              step="any"
                            />
                          </td>

                          {/* Total with large font & 'Rs.' (Requirement 6) */}
                          <td className="p-2">
                            <div className="flex items-center">
                              <span className="text-xs font-bold text-slate-500 mr-1">Rs.</span>
                              <input
                                type="number"
                                data-field="totalAmount"
                                aria-label={t('voice.colTotal')}
                                value={item.totalAmount}
                                onChange={(e) => handleUpdateRow(item.id, 'totalAmount', e.target.value)}
                                className={`w-full px-2 py-1 bg-white border rounded text-base font-bold focus:ring-1 focus:ring-emerald-700 ${
                                  !item.totalAmount ? 'border-amber-400 text-amber-800' : 'border-border text-slate-900'
                                }`}
                                min="0"
                                step="any"
                              />
                            </div>
                          </td>

                          {/* Date */}
                          <td className="p-2">
                            <input
                              type="date"
                              aria-label={t('voice.colDate')}
                              value={item.dateISO}
                              onChange={(e) => handleUpdateRow(item.id, 'dateISO', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-border rounded text-xs focus:ring-1 focus:ring-emerald-700"
                            />
                          </td>

                          {/* Status & Reasons in plain words */}
                          <td className="p-2">
                            {isNeedsReview ? (
                              <div className="space-y-1">
                                <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">
                                  {t('voice.statusNeedsReview')}
                                </span>
                                {item.reasons && item.reasons.length > 0 && (
                                  <div className="text-[10px] font-semibold text-amber-900 leading-tight">
                                    {item.reasons.map(r => t(`voice.reasons.${r}`, r)).join('; ')}
                                  </div>
                                )}
                                {(
                                  (item.source === 'bill' && !item.billAccepted) ||
                                  (item.reasons && (item.reasons.includes('amount_implausible') || item.reasons.includes('asr_alternatives_disagree') || item.reasons.includes('amount_from_words_verify') || item.reasons.includes('asr_low_confidence') || item.reasons.includes('unit_price_fractional') || item.reasons.includes('amount_rounded') || item.reasons.includes('category_unsure')))
                                ) && (
                                  <button
                                    type="button"
                                    data-testid={item.source === 'bill' ? `bill-accept-btn-${item.id}` : `voice-override-btn-${item.id}`}
                                    onClick={() => item.source === 'bill' ? handleAcceptBillItem(item.id) : handleOverrideRow(item.id)}
                                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded transition-colors"
                                  >
                                    <Check size={11} />
                                    <span>{t('voice.acceptAmount')}</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                                  {t('voice.statusOk')}
                                </span>
                                {item.reasons && item.reasons.includes('currency_assumed') && (
                                  <div className="text-[10px] text-slate-500 italic">
                                    {t('voice.reasons.currency_assumed')}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              aria-label={t('voice.colActions')}
                              onClick={() => handleDeleteRow(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Category Subtotals Chips */}
              {Object.keys(categorySubtotals).length > 0 && (
                <div className="p-3 bg-slate-50 border border-border rounded-control space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    {t('voice.categorySubtotals')}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(categorySubtotals).map(([cat, subtotal]) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-border rounded text-xs font-medium text-slate-700 shadow-2xs"
                      >
                        <span className="capitalize">{cat}:</span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(subtotal, i18n.language)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Total & Confirm Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-border">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <span>{t('voice.totalLabel')}: </span>
              <span id="voice-overall-total" data-testid="voice-overall-total" className="text-xl sm:text-2xl font-black text-emerald-800">
                Rs. {Number(totalAmount || 0).toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
              {hasNeedsReview && (
                <span className="text-xs text-amber-700 font-medium">
                  {t('voice.needsReviewWarning')}
                </span>
              )}
              {saveError && (
                <span className="text-xs text-red-600 font-medium">
                  {saveError}
                </span>
              )}
              <button
                type="button"
                id="voice-confirm-btn"
                data-testid="voice-confirm-btn"
                onClick={handleConfirmSave}
                disabled={hasNeedsReview || isSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-control transition-colors shadow-sm"
              >
                <CheckCircle size={15} />
                <span>
                  {isSaving
                    ? t('voice.saving')
                    : t('voice.confirmButton', {
                        count: pendingItems.length,
                        total: formatCurrency(totalAmount, i18n.language)
                      })}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
