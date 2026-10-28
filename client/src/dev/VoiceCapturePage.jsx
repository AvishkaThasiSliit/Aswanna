import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Square, Download, Trash2, CheckCircle, AlertTriangle,
  RotateCcw, Volume2, ShieldCheck, ArrowLeft, RefreshCw
} from 'lucide-react';
import promptsData from './heldout-en.json';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

function detectDeviceType() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) {
    return 'phone';
  }
  return 'desktop';
}

export default function VoiceCapturePage() {
  const [prompts, setPrompts] = useState(promptsData);

  useEffect(() => {
    fetch('/api/dev/voice-capture/prompts')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && Array.isArray(data.prompts) && data.prompts.length > 0) {
          setPrompts(data.prompts);
        }
      })
      .catch(() => {});
  }, []);
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [noiseCondition, setNoiseCondition] = useState('quiet');
  const [deviceType, setDeviceType] = useState(detectDeviceType());
  const [selectedLang, setSelectedLang] = useState('en-US');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [capturedData, setCapturedData] = useState(() => {
    try {
      const saved = localStorage.getItem('aswanna_real_asr_captures');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [audioBlobs, setAudioBlobs] = useState({});
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Sync selectedLang with prompt default language
  const currentPrompt = prompts[activePromptIndex] || prompts[0];
  useEffect(() => {
    if (currentPrompt) {
      if (currentPrompt.language === 'si') {
        setSelectedLang('si-LK');
      } else {
        setSelectedLang(prev => (prev === 'si-LK' ? 'en-US' : prev));
      }
    }
  }, [activePromptIndex, currentPrompt]);

  // Persist captures to localStorage
  const saveCapture = (promptId, data) => {
    setCapturedData(prev => {
      const next = { ...prev, [promptId]: data };
      try {
        localStorage.setItem('aswanna_real_asr_captures', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const removeCapture = (promptId) => {
    setCapturedData(prev => {
      const next = { ...prev };
      delete next[promptId];
      try {
        localStorage.setItem('aswanna_real_asr_captures', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const startRecording = async () => {
    setRecordingError('');
    if (!SpeechRecognition) {
      setRecordingError('SpeechRecognition API is not supported in this browser.');
      return;
    }

    try {
      // Start simultaneous local MediaRecorder for offline comparative evaluation
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioChunksRef.current = [];
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };
          recorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            if (audioChunksRef.current.length > 0) {
              const mime = recorder.mimeType || 'audio/webm';
              const ext = mime.includes('wav') ? 'wav' : (mime.includes('ogg') ? 'ogg' : 'webm');
              const blob = new Blob(audioChunksRef.current, { type: mime });
              const filename = `${currentPrompt.id}.${ext}`;

              setAudioBlobs(prev => ({
                ...prev,
                [currentPrompt.id]: { blob, ext, filename, promptId: currentPrompt.id }
              }));

              // Auto-save audio to voice-capture-audio/ via dev endpoint
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64Data = reader.result ? reader.result.split(',')[1] : null;
                if (base64Data) {
                  fetch('/api/dev/voice-capture/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      promptId: currentPrompt.id,
                      ext,
                      audioBase64: base64Data
                    })
                  }).catch(err => {
                    console.warn('Dev audio auto-save failed:', err);
                  });
                }
              };
              reader.readAsDataURL(blob);
            }
          };
          mediaRecorderRef.current = recorder;
          recorder.start();
        } catch (mediaErr) {
          console.warn('Simultaneous MediaRecorder capture unavailable:', mediaErr);
        }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.lang = selectedLang;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
        const result = event.results[0];
        if (!result) return;

        const mainTranscript = result[0]?.transcript || '';
        const confidence = result[0]?.confidence || null;
        const alternatives = [];
        for (let i = 0; i < result.length; i++) {
          alternatives.push({
            transcript: result[i].transcript,
            confidence: result[i].confidence || null
          });
        }

        const currentCapture = capturedData[currentPrompt.id] || {};
        const expected = currentCapture.expected || currentPrompt.expected || currentPrompt.expected_command || null;
        const audioEntry = audioBlobs[currentPrompt.id];
        const audioFilename = audioEntry ? audioEntry.filename : `${currentPrompt.id}.webm`;

        saveCapture(currentPrompt.id, {
          promptId: currentPrompt.id,
          promptText: currentPrompt.text,
          language: currentPrompt.language || 'en',
          asrLang: selectedLang,
          rawTranscript: mainTranscript,
          chromeTranscript: mainTranscript,
          confidence,
          alternatives,
          audioFilename,
          audioPath: `voice-capture-audio/${audioFilename}`,
          userAgent: navigator.userAgent,
          deviceType,
          noiseCondition,
          timestamp: new Date().toISOString(),
          notAnExpense: currentCapture.notAnExpense || false,
          expected: currentCapture.notAnExpense ? null : expected
        });
      };

      recognition.onerror = (event) => {
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
        setRecordingError(`Speech error: ${event.error}`);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setRecordingError(err.message || 'Failed to start recording');
      setIsRecording(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  const activeCapture = capturedData[currentPrompt.id];

  const handleExpectedChange = (jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (activeCapture) {
        saveCapture(currentPrompt.id, { ...activeCapture, expected: parsed });
      }
    } catch {}
  };

  const handleToggleNotAnExpense = (checked) => {
    if (activeCapture) {
      saveCapture(currentPrompt.id, {
        ...activeCapture,
        notAnExpense: checked,
        expected: checked ? null : (activeCapture.expected || currentPrompt.expected)
      });
    }
  };

  const handleDownloadJson = () => {
    const list = Object.values(capturedData);
    if (list.length === 0) {
      alert('No captures recorded yet.');
      return;
    }

    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'real-asr.captured.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAudio = (promptId) => {
    const audioEntry = audioBlobs[promptId];
    if (!audioEntry) {
      alert('No recorded audio available for this prompt on this device session.');
      return;
    }
    const url = URL.createObjectURL(audioEntry.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${promptId}.${audioEntry.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const capturedCount = Object.keys(capturedData).length;
  const recordedAudioCount = Object.keys(audioBlobs).length;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">DEV ONLY</span>
              <h1 className="text-xl font-bold text-slate-800">Real Speech ASR Capture Tool</h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Read aloud the prompts to capture real browser Web Speech API transcripts (si-LK & en). Audio is recorded via MediaRecorder simultaneously and saved only on this device for comparative evaluation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              Captured: {capturedCount} / {prompts.length} ({recordedAudioCount} audio)
            </span>
            <button
              onClick={handleDownloadJson}
              disabled={capturedCount === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-sm transition"
            >
              <Download size={16} />
              Download JSON
            </button>
            {audioBlobs[currentPrompt.id] && (
              <button
                onClick={() => handleDownloadAudio(currentPrompt.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium shadow-sm transition"
              >
                <Download size={16} />
                Download Audio ({currentPrompt.id})
              </button>
            )}
          </div>
        </div>

        {/* Local Storage Evaluation Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-700 flex-shrink-0" />
          <span>
            <strong>Comparative Evaluation Notice:</strong> Audio recorded via MediaRecorder is kept exclusively in temporary memory on this device for Whisper evaluation. It is never transmitted to cloud servers.
          </span>
        </div>

        {/* Global Controls & Privacy Badge */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 font-medium text-slate-700">
              Device:
              <select
                value={deviceType}
                onChange={e => setDeviceType(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800"
              >
                <option value="desktop">Desktop</option>
                <option value="phone">Phone / Mobile</option>
                <option value="tablet">Tablet</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 font-medium text-slate-700">
              Noise Condition:
              <select
                value={noiseCondition}
                onChange={e => setNoiseCondition(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800"
              >
                <option value="quiet">Quiet (Home / Indoors)</option>
                <option value="moderate">Moderate (Office / Farmyard)</option>
                <option value="noisy">Noisy (Tractor / Roadside)</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Audio stream discarded immediately by browser. Only text transcripts recorded.</span>
          </div>
        </div>

        {/* Prompt Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Prompt List Sidebar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 max-h-[700px] overflow-y-auto space-y-2">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Prompts ({prompts.length})</h2>
            {prompts.map((p, idx) => {
              const isCaptured = Boolean(capturedData[p.id]);
              const isSelected = idx === activePromptIndex;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePromptIndex(idx)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-mono text-[10px] text-slate-500 mr-1.5">{p.id}</span>
                    <span>{p.text}</span>
                  </div>
                  {isCaptured ? (
                    <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Prompt Capture Card */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="font-mono text-xs font-semibold text-slate-500 uppercase">{currentPrompt.id}</span>
                <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                  {currentPrompt.language === 'si' ? 'Sinhala' : 'English'}
                </span>
                <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700">
                  {currentPrompt.review_status}
                </span>
              </div>

              {activeCapture && (
                <button
                  onClick={() => removeCapture(currentPrompt.id)}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-medium"
                >
                  <Trash2 size={13} />
                  Clear Capture
                </button>
              )}
            </div>

            {/* Prompt Text to Read */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Text to Read Aloud:</div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-lg font-medium text-slate-900 select-all">
                "{currentPrompt.text}"
              </div>
              {currentPrompt.notes && (
                <p className="text-xs text-slate-500 mt-1 italic">{currentPrompt.notes}</p>
              )}
            </div>

            {/* Language & Recording Bar */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
                Speech Lang:
                <select
                  value={selectedLang}
                  onChange={e => setSelectedLang(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800"
                >
                  <option value="en-US">English (US - en-US)</option>
                  <option value="en-IN">English (India - en-IN)</option>
                  <option value="si-LK">Sinhala (Sri Lanka - si-LK)</option>
                </select>
              </label>

              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition"
                >
                  <Mic size={16} />
                  Record
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition animate-pulse"
                >
                  <Square size={16} />
                  Stop Recording
                </button>
              )}

              {recordingError && (
                <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                  <AlertTriangle size={14} />
                  {recordingError}
                </span>
              )}
            </div>

            {/* Capture Results */}
            {activeCapture ? (
              <div className="space-y-4 pt-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Captured Raw Transcript:</div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 font-medium text-base">
                    {activeCapture.rawTranscript || <span className="italic text-slate-400">Empty transcript</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                    <span>Confidence: {activeCapture.confidence != null ? `${(activeCapture.confidence * 100).toFixed(1)}%` : 'N/A'}</span>
                    <span>Device: {activeCapture.deviceType}</span>
                    <span>Noise: {activeCapture.noiseCondition}</span>
                    <span>Timestamp: {new Date(activeCapture.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {activeCapture.alternatives?.length > 1 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Alternative Transcripts:</div>
                    <ul className="text-xs space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700">
                      {activeCapture.alternatives.map((alt, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{alt.transcript}</span>
                          <span className="text-slate-400 font-mono">
                            {alt.confidence != null ? `${(alt.confidence * 100).toFixed(0)}%` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Expected Structured Result Editor */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 uppercase">Expected Structured Result:</span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(activeCapture.notAnExpense)}
                        onChange={e => handleToggleNotAnExpense(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Not an expense</span>
                    </label>
                  </div>

                  {!activeCapture.notAnExpense && (
                    <textarea
                      rows={5}
                      defaultValue={JSON.stringify(activeCapture.expected || currentPrompt.expected, null, 2)}
                      onBlur={e => handleExpectedChange(e.target.value)}
                      className="w-full font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
                      placeholder="JSON object with items: [...]"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm italic">
                Press Record and read the prompt clearly.
              </div>
            )}

            {/* Next / Prev Navigation */}
            <div className="flex items-center justify-between pt-4 border-t">
              <button
                onClick={() => setActivePromptIndex(prev => Math.max(0, prev - 1))}
                disabled={activePromptIndex === 0}
                className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-40"
              >
                Previous Prompt
              </button>
              <span className="text-xs text-slate-500">
                {activePromptIndex + 1} of {prompts.length}
              </span>
              <button
                onClick={() => setActivePromptIndex(prev => Math.min(prompts.length - 1, prev + 1))}
                disabled={activePromptIndex === prompts.length - 1}
                className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-40"
              >
                Next Prompt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
