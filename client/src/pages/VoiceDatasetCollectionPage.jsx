import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic, Square, Upload, Play, CheckCircle2, AlertCircle,
  RotateCcw, ShieldCheck, ShieldAlert, FileAudio, ChevronRight, X, Clock, Trash2,
  Info, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../utils/auth.jsx';

export default function VoiceDatasetCollectionPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  // Consent state
  const [consentState, setConsentState] = useState({
    loading: true,
    hasConsented: false,
    pseudonymousSpeakerId: null,
    consentVersion: '1.0'
  });
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);
  const [showFullTerms, setShowFullTerms] = useState(false);

  // Collection mode & prompt selection
  const [speechMode, setSpeechMode] = useState('prompted'); // 'prompted' | 'natural'
  const [categories, setCategories] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language === 'si' ? 'si' : 'en');
  const [activePromptIndex, setActivePromptIndex] = useState(0);

  // Audio Recording & Upload states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Contributor's recent submissions
  const [recentRecordings, setRecentRecordings] = useState([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // 1. Fetch participant consent on load
  useEffect(() => {
    fetchConsent();
    fetchPrompts();
    fetchRecordings();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('aswanna_token') || sessionStorage.getItem('aswanna_token');
    return {
      Authorization: `Bearer ${token}`
    };
  };

  const fetchConsent = async () => {
    try {
      setConsentState(prev => ({ ...prev, loading: true }));
      const res = await fetch('/api/dataset-collection/consent', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setConsentState({
          loading: false,
          hasConsented: data.hasConsented,
          pseudonymousSpeakerId: data.pseudonymousSpeakerId,
          consentVersion: data.consentVersion || '1.0'
        });
      } else {
        setConsentState(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setConsentState(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchPrompts = async () => {
    try {
      const res = await fetch('/api/dataset-collection/prompts');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setPrompts(data.prompts || []);
      }
    } catch {}
  };

  const fetchRecordings = async () => {
    try {
      setLoadingRecordings(true);
      const res = await fetch('/api/dataset-collection/recordings', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setRecentRecordings(data.recordings || []);
      }
    } finally {
      setLoadingRecordings(false);
    }
  };

  // 2. Submit Consent
  const handleGrantConsent = async () => {
    if (!agreeChecked) return;
    setConsentSubmitting(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/dataset-collection/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          consentGiven: true,
          agreedTerms: [
            'Donate voice recordings for agricultural speech recognition research',
            'Storage under pseudonymous speaker identifier with no public PII',
            'Human transcription review prior to inclusion in training manifests',
            'Data retained securely for 365 days under controlled staff access',
            'Right to withdraw consent at any time excluding future exports'
          ]
        })
      });
      if (res.ok) {
        const data = await res.json();
        setConsentState({
          loading: false,
          hasConsented: true,
          pseudonymousSpeakerId: data.pseudonymousSpeakerId,
          consentVersion: '1.0'
        });
        setSuccessMessage('Consent recorded. You can now contribute voice recordings.');
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error?.message || 'Failed to record consent');
      }
    } catch {
      setErrorMessage('Network error while recording consent');
    } finally {
      setConsentSubmitting(false);
    }
  };

  // 2b. Revoke Consent
  const handleRevokeConsent = async () => {
    setRevokeSubmitting(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/dataset-collection/consent/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          reason: 'Participant requested revocation from collection interface'
        })
      });
      if (res.ok) {
        setConsentState({
          loading: false,
          hasConsented: false,
          pseudonymousSpeakerId: null,
          consentVersion: '1.0'
        });
        setAgreeChecked(false);
        setShowRevokeModal(false);
        resetRecording();
        setSuccessMessage('Consent has been revoked. Your recordings are now excluded from future dataset exports.');
        fetchRecordings();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error?.message || 'Failed to revoke consent');
      }
    } catch {
      setErrorMessage('Network error while revoking consent');
    } finally {
      setRevokeSubmitting(false);
    }
  };

  // 3. Filtered Prompts
  const filteredPrompts = prompts.filter(p => {
    const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchLang = selectedLanguage === 'all' || p.language === selectedLanguage;
    return matchCategory && matchLang;
  });

  const activePrompt = filteredPrompts[activePromptIndex] || filteredPrompts[0] || null;

  // 4. Microphone Recording Handlers
  const startRecording = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Microphone access is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
          mimeType = 'audio/mp4;codecs=mp4a.40.2';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blobMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: blobMime });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setUploadFile(null);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access denied. Please grant microphone permission in your browser.');
      } else {
        setErrorMessage(`Microphone error: ${err.message}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsRecording(false);
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setUploadFile(null);
    setRecordingSeconds(0);
    setErrorMessage('');
    setSuccessMessage('');
  };

  // 5. File Upload Handler (for existing phone recordings)
  const handleFileChange = (e) => {
    setErrorMessage('');
    setSuccessMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Audio file exceeds 15 MB limit');
      return;
    }

    setUploadFile(file);
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
  };

  // 6. Submit Recording to API
  const handleSubmitRecording = async () => {
    if (!audioBlob) {
      setErrorMessage('Please record or choose an audio file first');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(20);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      let ext = 'webm';
      if (uploadFile) {
        ext = uploadFile.name.split('.').pop()?.toLowerCase() || 'audio';
      } else if (audioBlob.type.includes('wav')) {
        ext = 'wav';
      } else if (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a') || audioBlob.type.includes('aac')) {
        ext = 'm4a';
      } else if (audioBlob.type.includes('ogg')) {
        ext = 'ogg';
      } else if (audioBlob.type.includes('webm')) {
        ext = 'webm';
      }
      formData.append('file', audioBlob, `voice_capture.${ext}`);
      formData.append('speechMode', speechMode);
      formData.append('language', selectedLanguage === 'en' ? 'en' : 'si');
      formData.append('durationSeconds', recordingSeconds || 5);
      formData.append('deviceType', /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop');
      formData.append('recordingSource', uploadFile ? 'file_upload' : 'browser_mic');

      if (speechMode === 'prompted' && activePrompt) {
        formData.append('promptId', activePrompt.id);
        formData.append('promptText', activePrompt.promptText);
        formData.append('promptCategory', activePrompt.category);
      }

      setUploadProgress(60);

      const res = await fetch('/api/dataset-collection/recordings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      setUploadProgress(90);

      if (res.ok) {
        const data = await res.json();
        setUploadProgress(100);
        setSuccessMessage(`Recording ${data.recording.recordingId} submitted successfully for review!`);
        resetRecording();
        fetchRecordings();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error?.message || err.error || 'Failed to submit recording');
      }
    } catch (err) {
      setErrorMessage(`Upload failed: ${err.message}. Please retry.`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
            <Mic size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {i18n.language === 'si' ? 'හඬ දත්ත එකතු කිරීමේ වැඩසටහන' : 'Voice Dataset Collection'}
            </h1>
            <p className="text-sm text-slate-600">
              {i18n.language === 'si'
                ? 'ගොවීන් සඳහා නිවැරදි සිංහල කථන හඳුනාගැනීමේ තාක්ෂණය දියුණු කිරීමට ඔබගේ හඬ දායකත්වය ලබාදෙන්න.'
                : 'Contribute speech recordings to train and evaluate server-side Sinhala agricultural speech recognition.'}
            </p>
          </div>
        </div>
      </div>

      {/* Global Error & Success Alerts */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
          <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-red-500 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Section 1: Participant Consent ── */}
      {!consentState.loading && !consentState.hasConsented ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="text-amber-600 mt-1 shrink-0" size={24} />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900">
                {i18n.language === 'si' ? 'සහභාගිවන්නන්ගේ දැනුවත් කැමැත්ත සහ පෞද්ගලිකත්වය' : 'Informed Participant Consent & Privacy Protection'}
              </h2>
              <p className="text-sm text-amber-800 leading-relaxed">
                {i18n.language === 'si'
                  ? 'ගොවීන් සඳහා වන කථන හඳුනාගැනීමේ පද්ධතිය සාධාරණ හා නිවැරදි ලෙස ගොඩනැගීමට ඔබගේ හඬ දායකත්වය ලබාදෙන්න. කරුණාකර පහත පෞද්ගලිකත්ව සහ පර්යේෂණ කොන්දේසි කියවන්න.'
                  : 'Contribute speech recordings to train and benchmark speech recognition models tailored for Sri Lankan agricultural dialects. Please review the consent and data protection terms below.'}
              </p>
            </div>
          </div>

          {/* Detailed Policy Breakdown */}
          <div className="bg-white/80 border border-amber-200 rounded-xl p-4 text-xs space-y-3 text-slate-700">
            <div>
              <strong className="text-slate-900 block font-semibold">
                {i18n.language === 'si' ? '1. පටිගත කරන්නේ කුමක්ද සහ අරමුණ (What & Why):' : '1. What is recorded and why:'}
              </strong>
              <span>
                {i18n.language === 'si'
                  ? 'කෘෂිකාර්මික වියදම් සම්බන්ධ කෙටි වාක්‍ය (පොහොර, කම්කරු කුලී, ඉන්ධන ආදිය) ස්වභාවික හෝ කියවීම් ආකාරයෙන්. අරමුණ ගොවීන්ගේ හඬින් වියදම් සටහන් කිරීමේ නිරවද්‍යතාව වැඩිදියුණු කිරීමයි.'
                  : 'Spoken agricultural expense phrases (fertilizer, labor, fuel, inputs) in natural or prompted modes to evaluate and improve voice-to-expense speech recognition for farmers.'}
              </span>
            </div>

            <div>
              <strong className="text-slate-900 block font-semibold">
                {i18n.language === 'si' ? '2. දත්ත භාවිතය සහ ඇගයීම (Usage & Evaluation):' : '2. How recordings and transcripts will be used:'}
              </strong>
              <span>
                {i18n.language === 'si'
                  ? 'මනුෂ්‍ය විමර්ශකයින් විසින් සත්‍යාපිත යොමු පිටපත් (reference transcripts) සකස් කරනු ලබන අතර, කථන ආකෘති පුහුණු කිරීමට හා ඇගයීමට යොදා ගැනේ. ස්වයංක්‍රීය අනුමාන කිසිවිටෙක සත්‍ය පිටපත ලෙස ස්වයංක්‍රීයව නොපිළිගැනේ.'
                  : 'Utterances will be used to train and evaluate acoustic models. Reference transcripts are verified by human reviewers; automated predictions are never treated as gold-standard ground truth.'}
              </span>
            </div>

            <div>
              <strong className="text-slate-900 block font-semibold">
                {i18n.language === 'si' ? '3. ප්‍රවේශය සහ රහස්‍යභාවය (Access & Confidentiality):' : '3. Who can access the data:'}
              </strong>
              <span>
                {i18n.language === 'si'
                  ? 'බලයලත් කෘෂිකර්ම නිලධාරීන් සහ පද්ධති පරිපාලකයින්ට පමණක් ප්‍රවේශ විය හැක. ඔබගේ සැබෑ නම හෝ දුරකථන අංක ප්‍රසිද්ධ නොවන අතර දත්ත නිර්නාමික හඳුනාගැනීමේ අංකයක් (spk_*) යටතේ සුරැකේ.'
                  : 'Access is restricted to authorized agricultural extension officers and system administrators. No direct personal identifiers (PII) are stored with audio; all records use pseudonymous speaker IDs (spk_*).'}
              </span>
            </div>

            <div>
              <strong className="text-slate-900 block font-semibold">
                {i18n.language === 'si' ? '4. රඳවා ගැනීමේ කාලය (Data Retention):' : '4. How long data will be retained:'}
              </strong>
              <span>
                {i18n.language === 'si'
                  ? 'පර්යේෂණ දත්ත උපරිම දින 365 ක (වසර 1) කාලයක් සුරක්ෂිතව රඳවා තබා ගන්නා අතර ඉන්පසු කල් ඉකුත් වීමේ ප්‍රතිපත්තිය අනුව කළමනාකරණය කෙරේ.'
                  : 'Recordings are retained securely under a documented 365-day (1-year) retention lifecycle before scheduled retirement.'}
              </span>
            </div>

            <div>
              <strong className="text-slate-900 block font-semibold">
                {i18n.language === 'si' ? '5. කැමැත්ත ඉල්ලා අස්කර ගැනීම සහ එහි බලපෑම (Withdrawal & Policy):' : '5. How to withdraw consent & withdrawal implications:'}
              </strong>
              <span>
                {i18n.language === 'si'
                  ? 'ඔබට ඕනෑම මොහොතක මෙම අතුරුමුහුණත හරහා හෝ ක්ෂේත්‍ර නිලධාරී හරහා කැමැත්ත ඉල්ලා අස්කරගත හැක. ඉල්ලා අස්කරගත් පසු අනාගත දත්ත කට්ටලවලින් ඔබගේ හඬ ගොනු වහාම ඉවත් කෙරේ. (ආපදා උපස්ථ ගොනු දින 30ක චක්‍රයකින් ඉවත් වන අතර, දැනටමත් ප්‍රකාශිත සමස්ත සංඛ්‍යාලේඛන ආපසු හැරවිය නොහැක).'
                  : 'You can withdraw consent at any time directly through this portal or via your extension officer. Withdrawal immediately excludes your recordings from all future dataset exports and partitions. Immutable disaster backups follow a standard 30-day purge cycle; previously computed aggregate benchmark statistics cannot be retroactively uncomputed.'}
              </span>
            </div>
          </div>

          <div className="border-t border-amber-200/80 pt-4 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeChecked}
                onChange={e => setAgreeChecked(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-amber-950">
                {i18n.language === 'si'
                  ? 'මම ඉහත පෞද්ගලිකත්ව, රඳවා ගැනීමේ සහ ඉල්ලා අස්කර ගැනීමේ කොන්දේසි කියවා තේරුම් ගත් අතර, කෘෂිකාර්මික පර්යේෂණ සඳහා මගේ හඬ ලබා දීමට පැහැදිලිවම එකඟ වෙමි.'
                  : 'I have read the terms and explicitly consent to donating my voice recordings for agricultural speech recognition research.'}
              </span>
            </label>

            <button
              onClick={handleGrantConsent}
              disabled={!agreeChecked || consentSubmitting}
              className={`px-5 py-2.5 rounded-xl font-medium text-white shadow transition-all ${
                agreeChecked && !consentSubmitting
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-300 cursor-not-allowed text-slate-500'
              }`}
            >
              {consentSubmitting ? 'Recording Consent...' : (i18n.language === 'si' ? 'කැමැත්ත තහවුරු කරන්න' : 'Confirm Consent & Continue')}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-emerald-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-600 shrink-0" size={18} />
            <span>
              {i18n.language === 'si' ? 'කැමැත්ත සක්‍රියයි | නිර්නාමික කථක අංකය:' : 'Consent Active | Pseudonymous Speaker ID:'}{' '}
              <strong className="font-mono">{consentState.pseudonymousSpeakerId}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-700 font-semibold bg-emerald-100 px-2.5 py-0.5 rounded-full">v{consentState.consentVersion}</span>
            <button
              type="button"
              onClick={() => setShowRevokeModal(true)}
              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
            >
              {i18n.language === 'si' ? 'කැමැත්ත ඉල්ලා අස්කරගන්න' : 'Withdraw Consent'}
            </button>
          </div>
        </div>
      )}

      {/* Revocation Confirmation Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3 text-red-600">
              <ShieldAlert size={28} className="shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {i18n.language === 'si' ? 'කැමැත්ත ඉල්ලා අස්කර ගැනීම' : 'Withdraw Voice Consent'}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {i18n.language === 'si'
                    ? 'කැමැත්ත ඉල්ලා අස්කරගත් පසු, ඔබගේ සියලු හඬ පටිගත කිරීම් අනාගත පර්යේෂණ දත්ත කට්ටලවලින් සහ අපනයනවලින් වහාම බැහැර කරනු ලැබේ.'
                    : 'Withdrawing consent will immediately exclude all your recordings from future dataset exports and model training manifests.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-semibold">
                {i18n.language === 'si' ? 'ප්‍රතිවිපාක සටහන:' : 'Consequences note:'}
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                <li>{i18n.language === 'si' ? 'අනාගත අපනයනවලට ඔබගේ හඬ ඇතුළත් නොවේ.' : 'Future training manifests will strictly exclude your audio.'}</li>
                <li>{i18n.language === 'si' ? 'නව හඬ පටිගත කිරීම් ඉදිරිපත් කිරීම අවහිර කෙරේ.' : 'Uploading new recordings will be blocked until consent is re-granted.'}</li>
                <li>{i18n.language === 'si' ? 'දැනටමත් ප්‍රකාශිත සමස්ත සංඛ්‍යාලේඛන වෙනස් කළ නොහැක.' : 'Already calculated aggregate research benchmarks cannot be uncomputed.'}</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={revokeSubmitting}
                onClick={() => setShowRevokeModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-50"
              >
                {i18n.language === 'si' ? 'අවලංගු කරන්න' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={revokeSubmitting}
                onClick={handleRevokeConsent}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-xl shadow-sm transition-all"
              >
                {revokeSubmitting ? 'Revoking...' : (i18n.language === 'si' ? 'ඔව්, ඉල්ලා අස්කරගන්න' : 'Yes, Withdraw Consent')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 2: Mode & Prompt Selector ── */}
      {consentState.hasConsented && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
          {/* Mode Switcher */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              {i18n.language === 'si' ? '1. පටිගත කිරීමේ ආකාරය තෝරන්න' : '1. Select Recording Mode'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setSpeechMode('prompted'); resetRecording(); }}
                className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                  speechMode === 'prompted'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {i18n.language === 'si' ? 'පෙළ කියවීම (Prompted Speech)' : 'Prompted Speech (Read cards)'}
              </button>
              <button
                type="button"
                onClick={() => { setSpeechMode('natural'); resetRecording(); }}
                className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                  speechMode === 'natural'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {i18n.language === 'si' ? 'ස්වභාවික කථනය (Natural Speech)' : 'Natural Speech (Freeform)'}
              </button>
            </div>
          </div>

          {/* Prompt Selector (if Prompted Mode) */}
          {speechMode === 'prompted' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {i18n.language === 'si' ? '2. කාණ්ඩය සහ භාෂාව' : '2. Category & Language'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLanguage('si')}
                    className={`px-3 py-1 text-xs rounded-full border ${selectedLanguage === 'si' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'}`}
                  >
                    සිංහල
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLanguage('en')}
                    className={`px-3 py-1 text-xs rounded-full border ${selectedLanguage === 'en' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'}`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  type="button"
                  onClick={() => { setSelectedCategory('all'); setActivePromptIndex(0); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {i18n.language === 'si' ? 'සියල්ල' : 'All Categories'}
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { setSelectedCategory(cat.id); setActivePromptIndex(0); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {i18n.language === 'si' ? cat.labelSi : cat.labelEn}
                  </button>
                ))}
              </div>

              {/* Active Prompt Card */}
              {activePrompt ? (
                <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-emerald-100 rounded-2xl p-5 relative space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {activePrompt.id}
                    </span>
                    <span>
                      Prompt {activePromptIndex + 1} of {filteredPrompts.length}
                    </span>
                  </div>

                  <p className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed font-sinhala">
                    "{activePrompt.promptText}"
                  </p>

                  {activePrompt.phoneticGuide && (
                    <p className="text-xs text-slate-600 italic">
                      Pronunciation: {activePrompt.phoneticGuide}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-slate-500">
                      Meaning: {activePrompt.englishMeaning}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePromptIndex(prev => (prev > 0 ? prev - 1 : filteredPrompts.length - 1))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePromptIndex(prev => (prev < filteredPrompts.length - 1 ? prev + 1 : 0))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 text-center text-sm text-slate-500 rounded-xl">
                  No prompts available for this category and language combination.
                </div>
              )}
            </div>
          )}

          {/* Natural Speech Guide (if Natural Mode) */}
          {speechMode === 'natural' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 space-y-2">
              <p className="font-medium text-slate-900">
                {i18n.language === 'si' ? 'ස්වභාවික කථනය සඳහා උපදෙස්:' : 'Natural Speech Recording Instructions:'}
              </p>
              <ul className="list-disc list-inside text-xs space-y-1 text-slate-600">
                <li>{i18n.language === 'si' ? 'ඔබ අද කළ කෘෂිකාර්මික වියදමක් හෝ මිලදී ගැනීමක් සාමාන්‍ය පරිදි විස්තර කරන්න.' : 'Speak an everyday farming expense naturally in your own accent or dialect.'}</li>
                <li>{i18n.language === 'si' ? 'උදාහරණ: "අද කුඹුරට යුරියා මිටි දෙකක් ගත්තා රුපියල් දාහතරදාහයි."' : 'Example: "Bought two bags of urea fertilizer for 14000 rupees yesterday."'}</li>
                <li>{i18n.language === 'si' ? 'පැහැදිලිව හා සාමාන්‍ය වේගයෙන් කථා කරන්න.' : 'Speak clearly at a normal speaking pace.'}</li>
              </ul>
            </div>
          )}

          {/* ── Section 3: Recording & Upload Controls ── */}
          <div className="border-t border-slate-200 pt-6 space-y-5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {i18n.language === 'si' ? '3. හඬ පටිගත කිරීම හෝ ගොනුවක් තෝරන්න' : '3. Record Audio or Upload Phone Audio File'}
            </label>

            {/* Recorder Controls */}
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-4">
              {!audioUrl ? (
                <>
                  <div className="relative">
                    {isRecording && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg transition-all ${
                        isRecording
                          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isRecording ? <Square size={28} /> : <Mic size={32} />}
                    </button>
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-slate-900">
                      {isRecording
                        ? `Recording in progress... (${recordingSeconds}s / 30s)`
                        : (i18n.language === 'si' ? 'පටිගත කිරීම ආරම්භ කිරීමට ඔබන්න' : 'Tap to start recording')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isRecording ? 'Tap the square button when finished' : 'Speak into your mobile or laptop microphone'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 my-1">
                    <span className="w-12 h-px bg-slate-200"></span>
                    <span>OR</span>
                    <span className="w-12 h-px bg-slate-200"></span>
                  </div>

                  {/* Upload file button */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a,.flac"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-xl bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
                    >
                      <Upload size={16} />
                      {i18n.language === 'si' ? 'දුරකථනයෙන් හඬ ගොනුවක් තෝරන්න (WAV/MP3/M4A)' : 'Upload existing phone recording'}
                    </button>
                  </div>
                </>
              ) : (
                /* Audio Preview & Playback */
                <div className="w-full max-w-md space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <FileAudio size={16} className="text-emerald-600" />
                      {uploadFile ? uploadFile.name : `Recorded audio (${recordingSeconds || '<1'}s)`}
                    </span>
                    <button
                      type="button"
                      onClick={resetRecording}
                      className="text-red-600 hover:text-red-700 flex items-center gap-1 text-xs"
                    >
                      <RotateCcw size={14} /> Re-record
                    </button>
                  </div>

                  <audio src={audioUrl} controls className="w-full h-10 rounded-lg" />

                  {/* Progress bar */}
                  {uploadProgress > 0 && (
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    type="button"
                    onClick={handleSubmitRecording}
                    disabled={isSubmitting}
                    className={`w-full py-3 rounded-xl font-medium text-white shadow transition-all ${
                      isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isSubmitting ? 'Uploading to Secure Storage...' : (i18n.language === 'si' ? 'හඬ පටිගත කිරීම ඉදිරිපත් කරන්න' : 'Submit Voice Contribution')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Section 4: Contributor Submissions History ── */}
      {consentState.hasConsented && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {i18n.language === 'si' ? 'ඔබගේ මෑත හඬ දායකත්වයන්' : 'Your Contributed Recordings'}
            </h3>
            <span className="text-xs text-slate-500">
              Total: {recentRecordings.length}
            </span>
          </div>

          {recentRecordings.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">
              {i18n.language === 'si'
                ? 'තවමත් කිසිදු හඬ පටිගත කිරීමක් ඉදිරිපත් කර නැත. ඉහත පියවර අනුගමනය කර පළමු හඬ දායකත්වය ලබාදෙන්න.'
                : 'No recordings submitted yet. Follow the steps above to contribute your first recording.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentRecordings.slice(0, 5).map(rec => (
                <div key={rec.recordingId} className="py-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <span className="font-mono">{rec.recordingId}</span>
                      <span className="text-slate-400">•</span>
                      <span className="capitalize">{rec.speechMode}</span>
                      <span className="text-slate-400">•</span>
                      <span>{rec.language.toUpperCase()}</span>
                      <span className="text-slate-400">•</span>
                      <span>{rec.durationSeconds}s</span>
                    </div>
                    {rec.promptText && (
                      <p className="text-slate-500 text-[11px] truncate max-w-sm">"{rec.promptText}"</p>
                    )}
                  </div>
                  <div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                      rec.reviewStatus === 'reviewed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : (rec.reviewStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')
                    }`}>
                      {rec.reviewStatus === 'reviewed' ? 'Reviewed (Gold)' : (rec.reviewStatus === 'rejected' ? 'Rejected' : 'Pending Review')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
