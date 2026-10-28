import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2, XCircle, Play, ShieldAlert,
  Volume2, RefreshCw, FileText, Check, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../utils/auth.jsx';

export default function VoiceDatasetReviewerPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState('pending');
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTranscripts, setEditingTranscripts] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('aswanna_token') || sessionStorage.getItem('aswanna_token');
    return {
      Authorization: `Bearer ${token}`
    };
  };

  useEffect(() => {
    fetchQueue();
  }, [statusFilter]);

  const fetchQueue = async () => {
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await fetch(`/api/dataset-collection/review/recordings?status=${statusFilter}&limit=30`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setRecordings(data.recordings || []);
        // Pre-fill edit buffers with existing referenceTranscript or promptText
        const initialEdits = {};
        (data.recordings || []).forEach(r => {
          initialEdits[r.recordingId] = r.referenceTranscript || r.promptText || '';
        });
        setEditingTranscripts(initialEdits);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: err.error?.message || 'Failed to load review queue' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error loading review queue' });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (recordingId, action) => {
    const transcriptText = (editingTranscripts[recordingId] || '').trim();

    if (action === 'reviewed' && !transcriptText) {
      setFeedback({
        type: 'error',
        message: 'A non-empty reference transcript is mandatory to mark recording as reviewed.'
      });
      return;
    }

    setSubmittingId(recordingId);
    setFeedback({ type: '', message: '' });

    try {
      const payload = {
        reviewStatus: action,
        referenceTranscript: transcriptText
      };
      if (action === 'rejected') {
        payload.rejectionReason = 'Audio inaudible, distorted, or invalid speech content';
      }

      const res = await fetch(`/api/dataset-collection/review/recordings/${recordingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `Recording ${recordingId} marked as ${action} successfully.`
        });
        // Remove reviewed item from current list if looking at pending
        setRecordings(prev => prev.filter(r => r.recordingId !== recordingId));
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: err.error?.message || 'Failed to update review status' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: `Review submission failed: ${err.message}` });
    } finally {
      setSubmittingId(null);
    }
  };

  // Role check guard
  const isAuthorized = user && ['officer', 'admin'].includes(user.role);
  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
        <ShieldAlert size={36} className="mx-auto text-red-600" />
        <h2 className="text-lg font-bold text-red-900">Access Restricted</h2>
        <p className="text-sm text-red-700">
          The voice dataset reviewer interface is restricted to agricultural extension officers and system administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Voice Dataset Reviewer Queue
          </h1>
          <p className="text-sm text-slate-600">
            Listen to submitted voice recordings, verify or enter ground-truth reference transcripts, and approve for model training.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-xs font-medium hover:bg-slate-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Queue
        </button>
      </div>

      {/* Human Review Invariant Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900">
        <AlertTriangle size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="block font-semibold">Human Review Ground Truth Invariant</strong>
          Reference transcripts must be strictly verified or transcribed by a human reviewer.
          Automated model predictions are never automatically treated as gold-standard training data.
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {['pending', 'reviewed', 'rejected'].map(st => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`pb-2.5 px-3 text-xs font-semibold capitalize border-b-2 transition-colors ${
              statusFilter === st
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {st} Recordings
          </button>
        ))}
      </div>

      {/* Feedback Banner */}
      {feedback.message && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Recordings List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading queue...</div>
      ) : recordings.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          No {statusFilter} recordings found.
        </div>
      ) : (
        <div className="space-y-4">
          {recordings.map(rec => (
            <div
              key={rec.recordingId}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
            >
              {/* Metadata row */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {rec.recordingId}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">Speaker: <strong className="font-mono">{rec.pseudonymousSpeakerId}</strong></span>
                  <span className="text-slate-400">•</span>
                  <span className="capitalize">{rec.speechMode}</span>
                  <span className="text-slate-400">•</span>
                  <span className="uppercase font-semibold text-emerald-700">{rec.language}</span>
                  <span className="text-slate-400">•</span>
                  <span>{rec.durationSeconds}s</span>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full font-medium ${
                  rec.reviewStatus === 'reviewed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : (rec.reviewStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')
                }`}>
                  {rec.reviewStatus}
                </span>
              </div>

              {/* Audio player */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                <Volume2 size={20} className="text-slate-600 shrink-0" />
                <audio src={rec.audioUrl} controls className="w-full h-8" />
              </div>

              {/* Prompt reference if available */}
              {rec.promptText && (
                <div className="text-xs bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block mb-0.5">Prompt Card Text ({rec.promptCategory}):</span>
                  <span className="font-medium text-slate-800 font-sinhala">{rec.promptText}</span>
                </div>
              )}

              {/* Ground truth reference transcript input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText size={14} />
                  Ground Truth Reference Transcript (Gold Standard):
                </label>
                <textarea
                  rows={2}
                  value={editingTranscripts[rec.recordingId] || ''}
                  onChange={e => setEditingTranscripts({
                    ...editingTranscripts,
                    [rec.recordingId]: e.target.value
                  })}
                  placeholder="Enter exact verbatim transcription in Sinhala or English..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 font-sinhala"
                />
              </div>

              {/* Review Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submittingId === rec.recordingId}
                  onClick={() => handleReviewAction(rec.recordingId, 'rejected')}
                  className="px-3 py-1.5 border border-red-200 bg-red-50 text-red-700 text-xs font-medium rounded-xl hover:bg-red-100 transition-colors"
                >
                  <XCircle size={14} className="inline mr-1" />
                  Reject Audio
                </button>

                <button
                  type="button"
                  disabled={submittingId === rec.recordingId}
                  onClick={() => handleReviewAction(rec.recordingId, 'reviewed')}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Check size={14} />
                  Mark Reviewed
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
