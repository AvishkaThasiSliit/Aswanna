import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../utils/api.js';
import { useToast } from '../components/Toast.jsx';
import SectionCard from '../components/SectionCard.jsx';
import SchemaFormRenderer from '../components/SchemaFormRenderer.jsx';
import WarningBanner from '../components/WarningBanner.jsx';
import { notesSchema } from '../../../shared/formSchemas/notes.js';
import { validateEntity } from '../../../shared/validation/index.js';
import { Lock, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CycleNotesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast() || {};

  const [formValues, setFormValues] = useState({
    pestsAndDiseases: '',
    otherCropLosses: '',
    areaNotHarvested: '',
    other: '',
  });
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);

  // 1. Fetch active cycle
  const { data: cyclesData, isLoading: isCyclesLoading } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch('/cycles'),
  });

  const activeCycle = useMemo(() => {
    if (!cyclesData) return null;
    const items = cyclesData.items || cyclesData;
    if (Array.isArray(items)) {
      return items.find(c => c.status === 'active' || c.status === 'harvesting') || items.find(c => c.status === 'closed') || null;
    }
    return null;
  }, [cyclesData]);

  const cycleId = activeCycle?._id;
  const isClosed = activeCycle?.status === 'closed';

  // 2. Fetch Notes for active cycle
  const { data: notesData, isLoading: isNotesLoading } = useQuery({
    queryKey: ['cycle-notes', cycleId],
    queryFn: () => apiFetch(`/cycle-notes?cycleId=${cycleId}`),
    enabled: Boolean(cycleId),
  });

  // Populate form with existing note data
  useEffect(() => {
    if (notesData) {
      const note = notesData.note || (notesData.items && notesData.items[0]);
      if (note) {
        setFormValues({
          pestsAndDiseases: note.pestsAndDiseases || '',
          otherCropLosses: note.otherCropLosses || '',
          areaNotHarvested: note.areaNotHarvested || '',
          other: note.other || '',
        });
      }
    }
  }, [notesData]);

  // 3. Save Mutation (idempotent with clientRequestId)
  const saveMutation = useMutation({
    mutationFn: (payload) => {
      return apiFetch('/cycle-notes', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          cycleId,
          clientRequestId: `notes-${cycleId}-${Date.now()}`,
        }),
      });
    },
    onSuccess: (savedDoc) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-notes', cycleId] });
      setErrors({});
      if (savedDoc?.warnings?.length) {
        setWarnings(savedDoc.warnings);
      } else {
        setWarnings([]);
      }
      if (showToast) {
        showToast(t('cycleNotes.savedSuccess', 'Notes saved successfully'), 'success');
      }
    },
    onError: (err) => {
      if (err.fields) {
        setErrors(err.fields);
      } else {
        setErrors({ form: err.message });
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cycleId) return;
    setWarnings([]);
    const res = validateEntity(notesSchema, formValues, { strict: false });
    const fieldErrs = {};
    for (const [k, errList] of Object.entries(res.errors)) {
      if (errList.length > 0) fieldErrs[k] = errList[0].message;
    }
    if (Object.keys(fieldErrs).length > 0) {
      setErrors(fieldErrs);
      const firstKey = Object.keys(fieldErrs)[0];
      document.getElementById(`notes-${firstKey.replace(/\./g, '-')}`)?.focus();
      return;
    }
    saveMutation.mutate(formValues);
  };

  return (
    <div className="space-y-6 pb-12" id="cycle-notes-page">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t('cycleNotes.title', 'Special Observations & Notes')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('cycleNotes.subtitle', 'Record crop damages, unharvested extent, pests and diseases')}
        </p>
      </div>

      {/* Closed Cycle Banner */}
      {isClosed && (
        <div id="cycle-closed-banner" className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-800 text-sm font-medium">
          <Lock size={18} className="shrink-0 text-amber-600" />
          <span>{t('cycleNotes.cycleClosedWarning', 'This cultivation cycle is closed and read-only. Further edits cannot be saved.')}</span>
        </div>
      )}

      {/* Section Card: විශේෂ කාරණා */}
      <SectionCard
        number="1"
        title={t('cycleNotes.sectionTitle', 'Special Notes (විශේෂ කාරණා)')}
        badge={notesData?.note ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 size={12} />
            <span>Recorded</span>
          </span>
        ) : null}
      >
        <div className="space-y-4">
          {warnings.length > 0 && (
            <WarningBanner warnings={warnings} onDismiss={() => setWarnings([])} />
          )}
          <form onSubmit={handleSubmit} id="cycle-notes-form" className="space-y-6">
            {errors.form && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700" role="alert">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errors.form}</span>
              </div>
            )}

            {/* Form fields generated from schema */}
            <SchemaFormRenderer
              schema={notesSchema}
            values={formValues}
            onChange={(key, val) => {
              if (isClosed) return;
              setFormValues(prev => ({ ...prev, [key]: val }));
            }}
            errors={errors}
            idPrefix="notes"
            columns={2}
          />

          {!isClosed && (
            <div className="flex items-center justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                id="notes-save-btn"
                disabled={saveMutation.isPending || !cycleId}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-navActive text-white text-xs font-bold rounded-control transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                <span>{saveMutation.isPending ? '...' : t('cycleNotes.saveNotes', 'Save Notes')}</span>
              </button>
            </div>
          )}
        </form>
        </div>
      </SectionCard>
    </div>
  );
}
