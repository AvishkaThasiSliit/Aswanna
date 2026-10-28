import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Sparkles, Plus, Trash2, Save, RotateCcw,
  AlertTriangle, Loader2, WifiOff
} from 'lucide-react';

import { apiFetch, ApiError } from '../utils/api.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { costSheetGroups, costSheetSchema } from '../../../shared/formSchemas/costSheet.js';
import { calculateExpenseTotals } from '../../../shared/calc.js';
import { CATEGORY_TAGS } from '../../../shared/categoryMap.js';
import SectionCard from '../components/SectionCard.jsx';
import WarningBanner from '../components/WarningBanner.jsx';
import VoiceExpenseEntry from '../components/VoiceExpenseEntry.jsx';
import { useToast } from '../components/Toast.jsx';
import { normalizeNumericInput, stripControlChars, sinhalaDigitsToAscii } from '../../../shared/validation/index.js';

function initialFormState() {
  const today = new Date().toISOString().split('T')[0];
  return {
    entryDate: today,
    dayStatus: 'worked',
    activityCode: '',
    inputs: [
      { categoryTag: 'seed', inputType: '', quantity: '', unit: '', cost: '' }
    ],
    machinery: { method: '', unitPrice: '', quantity: '', cost: '' },
    labour: { familyLabour: '', hiredLabour: '', dailyWage: '', cost: '' },
    other: { description: '', amount: '' }
  };
}

export default function ExpenseForm() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const { showToast } = useToast() || {};

  const [formData, setFormData] = useState(initialFormState());
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isOfflineWarning, setIsOfflineWarning] = useState(false);

  // ─── 1. Fetch Active Cycle & Farmer Profile ─────────────────────────────────
  const { data: cyclesData, isLoading: isCyclesLoading, isFetching: isCyclesFetching } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch('/cycles'),
  });

  const { data: userData } = useQuery({
    queryKey: ['authMe'],
    queryFn: () => apiFetch('/auth/me'),
  });

  const activeCycle = useMemo(() => {
    if (!cyclesData) return null;
    const items = cyclesData.items || cyclesData;
    if (Array.isArray(items)) {
      return items.find(c => c.status === 'active') || null;
    }
    return null;
  }, [cyclesData]);

  const { data: profileQueryData } = useQuery({
    queryKey: ['farmerProfile'],
    queryFn: () => apiFetch('/farmer-profiles'),
  });

  const farmerProfile = useMemo(() => {
    if (!profileQueryData) return null;
    const items = profileQueryData.items || profileQueryData;
    return Array.isArray(items) ? items[0] : items;
  }, [profileQueryData]);

  // Redirect to /setup if user has no active cycle
  useEffect(() => {
    if (!isCyclesLoading && !isCyclesFetching && cyclesData) {
      const items = cyclesData.items || cyclesData;
      const hasActive = Array.isArray(items) && items.some(c => c.status === 'active');
      if (!hasActive) {
        navigate('/setup');
      }
    }
  }, [isCyclesLoading, isCyclesFetching, cyclesData, navigate]);

  // ─── 2. Fetch Activity Codes ────────────────────────────────────────────────
  const { data: activityCodesData } = useQuery({
    queryKey: ['activityCodes'],
    queryFn: () => apiFetch('/activity-codes'),
  });

  const activityCodes = useMemo(() => {
    if (!activityCodesData) return [];
    return activityCodesData.items || activityCodesData;
  }, [activityCodesData]);

  // ─── 3. Fetch Existing Expense (Edit Mode) ──────────────────────────────────
  const { data: existingExpense } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => apiFetch(`/expenses/${id}`),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (isEditMode && existingExpense) {
      setFormData({
        entryDate: existingExpense.entryDate ? existingExpense.entryDate.split('T')[0] : new Date().toISOString().split('T')[0],
        dayStatus: existingExpense.dayStatus || 'worked',
        activityCode: typeof existingExpense.activityCode === 'object' ? existingExpense.activityCode?._id : (existingExpense.activityCode || ''),
        inputs: existingExpense.inputs?.length > 0
          ? existingExpense.inputs.map(i => ({
              categoryTag: i.categoryTag || 'seed',
              inputType: i.inputType || '',
              quantity: i.quantity ?? '',
              unit: i.unit || '',
              cost: i.cost ?? ''
            }))
          : [{ categoryTag: 'seed', inputType: '', quantity: '', unit: '', cost: '' }],
        machinery: {
          method: existingExpense.machinery?.method || '',
          unitPrice: existingExpense.machinery?.unitPrice ?? '',
          quantity: existingExpense.machinery?.quantity ?? '',
          cost: existingExpense.machinery?.cost ?? ''
        },
        labour: {
          familyLabour: existingExpense.labour?.familyLabour ?? '',
          hiredLabour: existingExpense.labour?.hiredLabour ?? '',
          dailyWage: existingExpense.labour?.dailyWage ?? '',
          cost: existingExpense.labour?.cost ?? ''
        },
        other: {
          description: existingExpense.other?.description || '',
          amount: existingExpense.other?.amount ?? ''
        }
      });
      setIsDirty(false);
    }
  }, [isEditMode, existingExpense]);

  // ─── 4. Live Calculation Preview ────────────────────────────────────────────
  const livePreview = useMemo(() => {
    const raw = {
      inputs: formData.inputs.map(i => ({
        ...i,
        cost: i.cost !== '' ? Number(i.cost) : 0,
        quantity: i.quantity !== '' ? Number(i.quantity) : 0,
      })),
      machinery: {
        method: formData.machinery.method,
        unitPrice: formData.machinery.unitPrice !== '' ? Number(formData.machinery.unitPrice) : 0,
        quantity: formData.machinery.quantity !== '' ? Number(formData.machinery.quantity) : 0,
        cost: formData.machinery.cost !== '' ? Number(formData.machinery.cost) : 0,
      },
      labour: {
        familyLabour: formData.labour.familyLabour !== '' ? Number(formData.labour.familyLabour) : 0,
        hiredLabour: formData.labour.hiredLabour !== '' ? Number(formData.labour.hiredLabour) : 0,
        dailyWage: formData.labour.dailyWage !== '' ? Number(formData.labour.dailyWage) : 0,
        cost: formData.labour.cost !== '' ? Number(formData.labour.cost) : 0,
      },
      other: {
        description: formData.other.description,
        amount: formData.other.amount !== '' ? Number(formData.other.amount) : 0,
      },
      dayStatus: formData.dayStatus,
    };
    if (raw.dayStatus === 'no_work') {
      return {
        subtotals: { inputs: 0, machinery: 0, labour: 0, other: 0 },
        totalAmount: 0
      };
    }
    return calculateExpenseTotals(raw);
  }, [formData]);

  // ─── 5. Cost Impact Data ───────────────────────────────────────────────────
  const { data: summaryData } = useQuery({
    queryKey: ['cycleSummary', activeCycle?._id],
    queryFn: () => apiFetch(`/cycles/${activeCycle._id}/summary`),
    enabled: Boolean(activeCycle?._id),
  });

  const { data: variance } = useQuery({
    queryKey: ['variance', activeCycle?._id],
    queryFn: () => apiFetch(`/api/cycles/${activeCycle._id}/variance`),
    enabled: Boolean(activeCycle?._id),
  });

  const currentCycleTotal = summaryData?.totalCost || 0;
  const previousEditAmount = isEditMode && existingExpense ? (existingExpense.totalAmount || 0) : 0;
  const newCycleTotal = isEditMode
    ? currentCycleTotal - previousEditAmount + livePreview.totalAmount
    : currentCycleTotal + livePreview.totalAmount;

  const categoryBaselines = useMemo(() => {
    if (!variance?.categories) return null;
    const map = {};
    for (const [cat, data] of Object.entries(variance.categories)) {
      if (data?.expected) map[cat] = data.expected;
    }
    return map;
  }, [variance]);
  const totalBaseline = variance?.total?.expected || null;

  const primaryCategory = useMemo(() => {
    const inputWithCost = formData.inputs?.find(i => Number(i.cost) > 0);
    if (inputWithCost?.categoryTag) return inputWithCost.categoryTag;
    if (Number(formData.labour?.cost) > 0) return 'labour';
    if (Number(formData.machinery?.cost) > 0) return 'machinery';
    if (Number(formData.other?.amount) > 0) return 'other';
    return formData.inputs?.[0]?.categoryTag || 'seed';
  }, [formData]);

  const categoryVariance = variance?.categories?.[primaryCategory];
  const budgetUsedPct = useMemo(() => {
    if (variance?.total?.budgetUsedPct != null) return variance.total.budgetUsedPct;
    if (variance?.total?.expected && variance.total.expected > 0) {
      return newCycleTotal / variance.total.expected;
    }
    return null;
  }, [variance, newCycleTotal]);

  const showOverspendWarning = useMemo(() => {
    const totalVar = variance?.total?.variancePct || 0;
    const catVar = categoryVariance?.variancePct || 0;
    return totalVar > 0.15 || catVar > 0.15;
  }, [variance, categoryVariance]);

  // ─── Unsaved Changes Warning ────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ─── Field Handlers ─────────────────────────────────────────────────────────
  const handleTopLevelChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    if (fieldErrors[key]) {
      setFieldErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleInputChange = (index, field, value) => {
    setFormData(prev => {
      const nextInputs = [...prev.inputs];
      nextInputs[index] = { ...nextInputs[index], [field]: value };
      return { ...prev, inputs: nextInputs };
    });
    setIsDirty(true);
    const errKey = `inputs.${index}.${field}`;
    if (fieldErrors[errKey]) {
      setFieldErrors(prev => ({ ...prev, [errKey]: null }));
    }
  };

  const addInputRow = () => {
    setFormData(prev => ({
      ...prev,
      inputs: [...prev.inputs, { categoryTag: 'seed', inputType: '', quantity: '', unit: '', cost: '' }]
    }));
    setIsDirty(true);
  };

  const removeInputRow = (index) => {
    setFormData(prev => {
      if (prev.inputs.length <= 1) return prev;
      const nextInputs = prev.inputs.filter((_, i) => i !== index);
      return { ...prev, inputs: nextInputs };
    });
    setIsDirty(true);
  };

  const handleGroupChange = (group, field, value) => {
    setFormData(prev => {
      const nextGroup = { ...prev[group], [field]: value };
      
      // Auto-compute machinery cost if unitPrice and quantity supplied
      if (group === 'machinery' && (field === 'unitPrice' || field === 'quantity')) {
        const u = field === 'unitPrice' ? value : nextGroup.unitPrice;
        const q = field === 'quantity' ? value : nextGroup.quantity;
        if (u !== '' && q !== '') {
          nextGroup.cost = String(Number(u) * Number(q));
        }
      }

      // Auto-compute labour cost if familyLabour/hiredLabour/dailyWage supplied
      if (group === 'labour') {
        const f = Number(nextGroup.familyLabour || 0);
        const h = Number(nextGroup.hiredLabour || 0);
        const w = Number(nextGroup.dailyWage || 0);
        if (w > 0 || f > 0 || h > 0) {
          nextGroup.cost = String((f + h) * w);
        }
      }

      return { ...prev, [group]: nextGroup };
    });
    setIsDirty(true);
    const errKey = `${group}.${field}`;
    if (fieldErrors[errKey]) {
      setFieldErrors(prev => ({ ...prev, [errKey]: null }));
    }
  };

  // ─── Prefill from Repeat Last Entry ──────────────────────────────────────────
  const handleRepeatLastEntry = async () => {
    try {
      const res = await apiFetch('/expenses?pageSize=1&sort=-entryDate');
      const lastExp = res.items?.[0];
      if (!lastExp) {
        showToast?.(t('form.noPreviousRecord'));
        return;
      }
      setFormData(prev => ({
        ...prev,
        activityCode: typeof lastExp.activityCode === 'object' ? lastExp.activityCode._id : (lastExp.activityCode || prev.activityCode),
        inputs: lastExp.inputs?.length > 0
          ? lastExp.inputs.map(i => ({
              categoryTag: i.categoryTag || 'seed',
              inputType: i.inputType || '',
              quantity: i.quantity ?? '',
              unit: i.unit || '',
              cost: i.cost ?? ''
            }))
          : prev.inputs,
        machinery: {
          method: lastExp.machinery?.method || '',
          unitPrice: lastExp.machinery?.unitPrice ?? '',
          quantity: lastExp.machinery?.quantity ?? '',
          cost: lastExp.machinery?.cost ?? ''
        },
        labour: {
          familyLabour: lastExp.labour?.familyLabour ?? '',
          hiredLabour: lastExp.labour?.hiredLabour ?? '',
          dailyWage: lastExp.labour?.dailyWage ?? '',
          cost: lastExp.labour?.cost ?? ''
        },
        other: {
          description: lastExp.other?.description || '',
          amount: lastExp.other?.amount ?? ''
        }
      }));
      setIsDirty(true);
      showToast?.(t('form.repeatedSuccess'));
    } catch (err) {
      showToast?.(t('toast.error'));
    }
  };

  // ─── Validation ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};
    let generalErr = '';

    if (formData.dayStatus === 'worked') {
      if (!formData.activityCode) {
        errors.activityCode = t('validation.activityRequired');
      }
      if (livePreview.totalAmount <= 0) {
        generalErr = t('validation.atLeastOneCost');
      }
    }

    // Number validation
    formData.inputs.forEach((input, idx) => {
      if (input.quantity !== '' && Number(input.quantity) < 0) {
        errors[`inputs.${idx}.quantity`] = t('validation.noNegatives');
      }
      if (input.cost !== '' && (Number(input.cost) < 0 || !Number.isInteger(Number(input.cost)))) {
        errors[`inputs.${idx}.cost`] = t('validation.integerRupees');
      }
    });

    ['unitPrice', 'cost'].forEach(f => {
      if (formData.machinery[f] !== '' && (Number(formData.machinery[f]) < 0 || !Number.isInteger(Number(formData.machinery[f])))) {
        errors[`machinery.${f}`] = t('validation.integerRupees');
      }
    });

    ['familyLabour', 'hiredLabour'].forEach(f => {
      if (formData.labour[f] !== '' && Number(formData.labour[f]) < 0) {
        errors[`labour.${f}`] = t('validation.noNegatives');
      }
    });
    if (formData.labour.dailyWage !== '' && (Number(formData.labour.dailyWage) < 0 || !Number.isInteger(Number(formData.labour.dailyWage)))) {
      errors[`labour.dailyWage`] = t('validation.integerRupees');
    }

    if (formData.other.amount !== '' && (Number(formData.other.amount) < 0 || !Number.isInteger(Number(formData.other.amount)))) {
      errors[`other.amount`] = t('validation.integerRupees');
    }

    setFieldErrors(errors);
    if (generalErr) setGeneralError(generalErr);
    return Object.keys(errors).length === 0 && !generalErr;
  };

  // ─── Save Mutation ──────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ shouldAddAnother }) => {
      if (!navigator.onLine) {
        setIsOfflineWarning(true);
        throw new Error('OFFLINE');
      }
      setIsOfflineWarning(false);

      if (!activeCycle?._id) {
        throw new Error('NO_ACTIVE_CYCLE');
      }

      const clientRequestId = crypto.randomUUID();
      const payload = {
        cycleId: activeCycle._id,
        entryDate: formData.entryDate,
        dayStatus: formData.dayStatus,
        activityCode: formData.dayStatus === 'no_work' ? undefined : (formData.activityCode || undefined),
        inputs: formData.dayStatus === 'no_work' ? [] : formData.inputs
          .filter(i => i.cost !== '' || i.quantity !== '' || i.inputType !== '')
          .map(i => ({
            categoryTag: i.categoryTag,
            inputType: i.inputType || undefined,
            quantity: i.quantity !== '' ? Number(i.quantity) : undefined,
            unit: i.unit || undefined,
            cost: i.cost !== '' ? Number(i.cost) : undefined,
          })),
        machinery: formData.dayStatus === 'no_work' ? {} : {
          method: formData.machinery.method || undefined,
          unitPrice: formData.machinery.unitPrice !== '' ? Number(formData.machinery.unitPrice) : undefined,
          quantity: formData.machinery.quantity !== '' ? Number(formData.machinery.quantity) : undefined,
          cost: formData.machinery.cost !== '' ? Number(formData.machinery.cost) : undefined,
        },
        labour: formData.dayStatus === 'no_work' ? {} : {
          familyLabour: formData.labour.familyLabour !== '' ? Number(formData.labour.familyLabour) : undefined,
          hiredLabour: formData.labour.hiredLabour !== '' ? Number(formData.labour.hiredLabour) : undefined,
          dailyWage: formData.labour.dailyWage !== '' ? Number(formData.labour.dailyWage) : undefined,
          cost: formData.labour.cost !== '' ? Number(formData.labour.cost) : undefined,
        },
        other: formData.dayStatus === 'no_work' ? {} : {
          description: formData.other.description || undefined,
          amount: formData.other.amount !== '' ? Number(formData.other.amount) : undefined,
        },
        clientRequestId,
      };

      if (isEditMode) {
        return apiFetch(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      return apiFetch('/expenses', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: (data, variables) => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cycleSummary'] });
      showToast?.(isEditMode ? t('form.updateSuccess') : t('form.saveSuccess'));

      if (data?.warnings?.length) {
        setWarnings(data.warnings);
      } else {
        setWarnings([]);
      }

      if (variables.shouldAddAnother) {
        setFormData(initialFormState());
        setFieldErrors({});
        setGeneralError('');
      } else if (!data?.warnings?.length) {
        navigate('/tracker/records');
      }
    },
    onError: (err) => {
      if (err.message === 'OFFLINE') return;
      if (err instanceof ApiError || err.name === 'ApiError' || err.status) {
        if (err.status === 409) {
          setGeneralError(t('toast.cycleClosed'));
          return;
        }
        const fields = err.fields || err.data?.error?.fields;
        if (fields && fields.length > 0) {
          const mapped = {};
          fields.forEach(f => {
            mapped[f.field] = f.message;
          });
          setFieldErrors(mapped);
          setGeneralError(t('validation.fixErrors'));
          return;
        }
        setGeneralError(err.message || 'An error occurred while saving.');
      } else {
        setGeneralError(err.message || 'An unexpected error occurred.');
      }
    }
  });

  const handleSubmit = (shouldAddAnother = false) => {
    setGeneralError('');
    setWarnings([]);
    if (!validateForm()) {
      setTimeout(() => {
        const firstInvalid = document.querySelector('[aria-invalid="true"]') || document.querySelector('.border-red-500');
        firstInvalid?.focus?.();
      }, 50);
      return;
    }
    saveMutation.mutate({ shouldAddAnother });
  };

  // Selected Activity Info
  const selectedActivity = activityCodes.find(a => a._id === formData.activityCode);
  const isFutureDate = new Date(formData.entryDate) > new Date();

  return (
    <div id="expense-form-page" className="max-w-6xl mx-auto space-y-6">
      {/* Top Navigation / Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link 
            to="/tracker/records" 
            aria-label={t('app.back')}
            className="p-2 rounded-control text-slate-500 hover:text-slate-800 hover:bg-white border border-border transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {isEditMode ? t('form.editTitle') : t('form.addTitle')}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditMode ? t('form.editSubtitle') : t('form.addSubtitle')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRepeatLastEntry}
          aria-label={t('form.repeatLast')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-control transition-colors"
        >
          <RotateCcw size={14} />
          <span>{t('form.repeatLast')}</span>
        </button>
      </div>

      {/* Warning Banner */}
      {warnings.length > 0 && (
        <WarningBanner warnings={warnings} onDismiss={() => setWarnings([])} />
      )}

      {/* Offline Warning Banner */}
      {isOfflineWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-card flex items-center gap-3 text-amber-900 text-sm font-medium">
          <WifiOff size={20} className="text-amber-600 shrink-0" />
          <span>{t('form.offlineWarning')}</span>
        </div>
      )}

      {/* General Error Banner */}
      {generalError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-card flex items-center gap-3 text-red-900 text-sm font-medium">
          <AlertTriangle size={20} className="text-red-600 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form Sections (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Voice & Smart Text Expense Entry (behind feature flag) */}
          <VoiceExpenseEntry
            activeCycle={activeCycle}
            activityCodes={activityCodes}
            defaultActivityCode={formData.activityCode}
            defaultDate={formData.entryDate}
            categoryBaselines={categoryBaselines}
            totalBaseline={totalBaseline}
            onExpensesSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['expenses'] });
              queryClient.invalidateQueries({ queryKey: ['cycleSummary'] });
              queryClient.invalidateQueries({ queryKey: ['variance'] });
            }}
          />

          {/* Section 1: Cultivation Info Bar (Read-only) */}
          <SectionCard 
            title={t('form.section1Title')} 
            subtitle={t('form.section1Subtitle')}
            number={1}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-slate-50 border border-border rounded-control text-xs">
              <div>
                <span className="text-slate-400 block font-medium">{t('form.farmer')}</span>
                <span className="font-bold text-slate-800">{farmerProfile?.name || userData?.farmerProfile?.fullName || userData?.name || userData?.user?.name || 'Sunil Perera'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">{t('form.district')}</span>
                <span className="font-bold text-slate-800">{activeCycle?.district || farmerProfile?.district || userData?.farmerProfile?.district || 'Kurunegala'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">{t('form.crop')}</span>
                <span className="font-bold text-slate-800">{activeCycle ? `${activeCycle.crop} (${activeCycle.season})` : 'Tomato (Yala)'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">{t('form.extent')}</span>
                <span className="font-bold text-slate-800">{activeCycle ? `${activeCycle.extentValue || 1} ${activeCycle.extentUnit || 'acre'}` : '1 acre'}</span>
              </div>
            </div>
          </SectionCard>

          {/* Section 2: Date + Activity */}
          <SectionCard
            title={t('form.section2Title')}
            subtitle={t('form.section2Subtitle')}
            number={2}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date Picker */}
                <div>
                  <label htmlFor="entryDate" className="block text-xs font-bold text-slate-700 mb-1">
                    {t('table.date')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="entryDate"
                    aria-label={t('table.date')}
                    type="date"
                    value={formData.entryDate}
                    onChange={(e) => handleTopLevelChange('entryDate', e.target.value)}
                    aria-invalid={Boolean(fieldErrors.entryDate)}
                    aria-describedby={fieldErrors.entryDate ? "entryDate-error" : undefined}
                    className={`w-full px-3 py-2 rounded-control border text-sm outline-none focus:border-primary ${
                      fieldErrors.entryDate ? 'border-red-500 bg-red-50/20' : 'border-border'
                    }`}
                  />
                  {isFutureDate && (
                    <p className="text-[11px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {t('form.futureDateWarning')}
                    </p>
                  )}
                  {fieldErrors.entryDate && <p id="entryDate-error" role="alert" className="text-xs text-red-600 mt-1">{fieldErrors.entryDate}</p>}
                </div>

                {/* Day Status Toggle */}
                <div>
                  <label htmlFor="dayStatusNoWork" className="block text-xs font-bold text-slate-700 mb-1">
                    {t('form.dayStatus')}
                  </label>
                  <label htmlFor="dayStatusNoWork" className="flex items-center gap-2 p-2.5 rounded-control border border-border bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      id="dayStatusNoWork"
                      aria-label={t('form.dayStatus')}
                      type="checkbox"
                      checked={formData.dayStatus === 'no_work'}
                      onChange={(e) => handleTopLevelChange('dayStatus', e.target.checked ? 'no_work' : 'worked')}
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      {t('statuses.no_work')} ({t('form.noWorkToggle')})
                    </span>
                  </label>
                </div>
              </div>

              {/* Activity Code Dropdown */}
              {formData.dayStatus === 'worked' && (
                <div>
                  <label htmlFor="activityCode" className="block text-xs font-bold text-slate-700 mb-1">
                    {t('table.activity')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="activityCode"
                    aria-label={t('table.activity')}
                    value={formData.activityCode}
                    onChange={(e) => handleTopLevelChange('activityCode', e.target.value)}
                    aria-invalid={Boolean(fieldErrors.activityCode)}
                    aria-describedby={fieldErrors.activityCode ? "activityCode-error" : undefined}
                    className={`w-full px-3 py-2 rounded-control border text-sm outline-none focus:border-primary bg-white ${
                      fieldErrors.activityCode ? 'border-red-500 bg-red-50/20' : 'border-border'
                    }`}
                  >
                    <option value="">{t('form.selectActivity')}</option>
                    {activityCodes.map(act => (
                      <option key={act._id} value={act._id}>
                        {act.code} - {lang === 'si' ? act.nameSi : act.nameEn} {act.isPlaceholder || act.code.startsWith('PH-') ? '(Placeholder)' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedActivity && (selectedActivity.isPlaceholder || selectedActivity.code.startsWith('PH-')) && (
                    <div className="mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        Placeholder PH Code
                      </span>
                    </div>
                  )}
                  {fieldErrors.activityCode && <p className="text-xs text-red-600 mt-1" id="activityCode-error">{fieldErrors.activityCode}</p>}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Cost Sections only show if dayStatus === 'worked' */}
          {formData.dayStatus === 'worked' && (
            <>
              {/* Section 3: Inputs */}
              <SectionCard
                title={t('form.section3Title')}
                subtitle={t('form.inputsSubtitle')}
                number={3}
              >
                <div className="space-y-4">
                  {formData.inputs.map((input, idx) => {
                    const derivedUnitPrice = (Number(input.cost) > 0 && Number(input.quantity) > 0)
                      ? Math.round(Number(input.cost) / Number(input.quantity))
                      : null;

                    return (
                      <div key={idx} className="p-3 bg-slate-50 border border-border rounded-control space-y-2 relative">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                          <span className="text-xs font-bold text-slate-600">Input #{idx + 1}</span>
                          {formData.inputs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeInputRow(idx)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Remove input line"
                              aria-label={`Remove input line #${idx + 1}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                          <div>
                            <label htmlFor={`input-categoryTag-${idx}`} className="block text-[11px] font-semibold text-slate-600 mb-1">Tag</label>
                            <select
                              id={`input-categoryTag-${idx}`}
                              aria-label={`Category Tag #${idx + 1}`}
                              value={input.categoryTag}
                              onChange={(e) => handleInputChange(idx, 'categoryTag', e.target.value)}
                              className="w-full px-2 py-1.5 rounded border border-border bg-white outline-none focus:border-primary"
                            >
                              {CATEGORY_TAGS.map(tag => (
                                <option key={tag} value={tag}>{t(`categories.${tag}`) || tag}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label htmlFor={`input-inputType-${idx}`} className="block text-[11px] font-semibold text-slate-600 mb-1">Type / Name</label>
                            <input
                              id={`input-inputType-${idx}`}
                              aria-label={`Input Type #${idx + 1}`}
                              type="text"
                              placeholder="e.g. Urea"
                              value={input.inputType}
                              onChange={(e) => handleInputChange(idx, 'inputType', e.target.value)}
                              className="w-full px-2 py-1.5 rounded border border-border outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label htmlFor={`input-quantity-${idx}`} className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                            <input
                              id={`input-quantity-${idx}`}
                              aria-label={`Input Quantity #${idx + 1}`}
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              aria-invalid={Boolean(fieldErrors[`inputs.${idx}.quantity`])}
                              aria-describedby={fieldErrors[`inputs.${idx}.quantity`] ? `input-quantity-${idx}-error` : undefined}
                              placeholder="0"
                              value={input.quantity}
                              onChange={(e) => handleInputChange(idx, 'quantity', e.target.value)}
                              className={`w-full px-2 py-1.5 rounded border outline-none focus:border-primary ${
                                fieldErrors[`inputs.${idx}.quantity`] ? 'border-red-500 bg-red-50/20' : 'border-border'
                              }`}
                            />
                            {fieldErrors[`inputs.${idx}.quantity`] && (
                              <p id={`input-quantity-${idx}-error`} role="alert" className="text-[10px] text-red-600 mt-0.5">{fieldErrors[`inputs.${idx}.quantity`]}</p>
                            )}
                          </div>

                          <div>
                            <label htmlFor={`input-unit-${idx}`} className="block text-[11px] font-semibold text-slate-600 mb-1">Unit</label>
                            <input
                              id={`input-unit-${idx}`}
                              aria-label={`Input Unit #${idx + 1}`}
                              type="text"
                              placeholder="kg / l / hrs"
                              value={input.unit}
                              onChange={(e) => handleInputChange(idx, 'unit', e.target.value)}
                              className="w-full px-2 py-1.5 rounded border border-border outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label htmlFor={`input-cost-${idx}`} className="block text-[11px] font-semibold text-slate-600 mb-1">Cost (Rs.)</label>
                            <input
                              id={`input-cost-${idx}`}
                              aria-label={`Input Cost #${idx + 1}`}
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              aria-invalid={Boolean(fieldErrors[`inputs.${idx}.cost`])}
                              aria-describedby={fieldErrors[`inputs.${idx}.cost`] ? `input-cost-${idx}-error` : undefined}
                              placeholder="0"
                              value={input.cost}
                              onChange={(e) => handleInputChange(idx, 'cost', e.target.value)}
                              className={`w-full px-2 py-1.5 rounded border outline-none focus:border-primary ${
                                fieldErrors[`inputs.${idx}.cost`] ? 'border-red-500 bg-red-50/20' : 'border-border'
                              }`}
                            />
                            {fieldErrors[`inputs.${idx}.cost`] && (
                              <p id={`input-cost-${idx}-error`} role="alert" className="text-[10px] text-red-600 mt-0.5">{fieldErrors[`inputs.${idx}.cost`]}</p>
                            )}
                          </div>
                        </div>

                        {derivedUnitPrice !== null && (
                          <div className="text-[11px] text-slate-500 font-medium italic pt-1">
                            Hint: Derived unit price ~ {formatCurrency(derivedUnitPrice, lang)} / {input.unit || 'unit'}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addInputRow}
                    aria-label={t('form.addInput')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-tint hover:bg-emerald-100 rounded-control transition-colors"
                  >
                    <Plus size={14} />
                    <span>{t('form.addInput')}</span>
                  </button>
                </div>
              </SectionCard>

              {/* Section 4: Machinery */}
              <SectionCard
                title={t('form.section4Title')}
                subtitle={t('form.machinerySubtitle')}
                number={4}
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label htmlFor="machinery-method" className="block text-xs font-semibold text-slate-700 mb-1">Method / Equipment</label>
                    <input
                      id="machinery-method"
                      aria-label="Machinery Method"
                      type="text"
                      placeholder="e.g. 4-Wheel Tractor"
                      value={formData.machinery.method}
                      onChange={(e) => handleGroupChange('machinery', 'method', e.target.value)}
                      className="w-full px-3 py-2 rounded-control border border-border outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="machinery-unitPrice" className="block text-xs font-semibold text-slate-700 mb-1">Unit Price (Rs.)</label>
                    <input
                      id="machinery-unitPrice"
                      aria-label="Machinery Unit Price"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      aria-invalid={Boolean(fieldErrors['machinery.unitPrice'])}
                      aria-describedby={fieldErrors['machinery.unitPrice'] ? 'machinery-unitPrice-error' : undefined}
                      placeholder="0"
                      value={formData.machinery.unitPrice}
                      onChange={(e) => handleGroupChange('machinery', 'unitPrice', e.target.value)}
                      className={`w-full px-3 py-2 rounded-control border text-sm outline-none focus:border-primary ${
                        fieldErrors['machinery.unitPrice'] ? 'border-red-500 bg-red-50/20' : 'border-border'
                      }`}
                    />
                    {fieldErrors['machinery.unitPrice'] && (
                      <p id="machinery-unitPrice-error" role="alert" className="text-[10px] text-red-600 mt-0.5">{fieldErrors['machinery.unitPrice']}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="machinery-quantity" className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                    <input
                      id="machinery-quantity"
                      aria-label="Machinery Quantity"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      placeholder="0"
                      value={formData.machinery.quantity}
                      onChange={(e) => handleGroupChange('machinery', 'quantity', e.target.value)}
                      className="w-full px-3 py-2 rounded-control border border-border text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="machinery-cost" className="block text-xs font-semibold text-slate-700 mb-1">Machinery Cost (Rs.)</label>
                    <input
                      id="machinery-cost"
                      aria-label="Machinery Cost"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      aria-invalid={Boolean(fieldErrors['machinery.cost'])}
                      aria-describedby={fieldErrors['machinery.cost'] ? 'machinery-cost-error' : undefined}
                      placeholder="0"
                      value={formData.machinery.cost}
                      onChange={(e) => handleGroupChange('machinery', 'cost', e.target.value)}
                      className={`w-full px-3 py-2 rounded-control border text-sm outline-none focus:border-primary font-bold text-slate-900 ${
                        fieldErrors['machinery.cost'] ? 'border-red-500 bg-red-50/20' : 'border-border'
                      }`}
                    />
                    {fieldErrors['machinery.cost'] && (
                      <p id="machinery-cost-error" role="alert" className="text-[10px] text-red-600 mt-0.5">{fieldErrors['machinery.cost']}</p>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Section 5: Labour */}
              <SectionCard
                title={t('form.section5Title')}
                subtitle={t('form.labourSubtitle')}
                number={5}
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label htmlFor="labour-familyLabour" className="block text-xs font-semibold text-slate-700 mb-1">Family Labour (persons)</label>
                    <input
                      id="labour-familyLabour"
                      aria-label="Family Labour"
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      aria-invalid={Boolean(fieldErrors['labour.familyLabour'])}
                      aria-describedby={fieldErrors['labour.familyLabour'] ? 'labour-familyLabour-error' : undefined}
                      placeholder="0"
                      value={formData.labour.familyLabour}
                      onChange={(e) => handleGroupChange('labour', 'familyLabour', e.target.value)}
                      className={`w-full px-3 py-2 rounded-control border text-sm outline-none focus:border-primary ${
                        fieldErrors['labour.familyLabour'] ? 'border-red-500 bg-red-50/20' : 'border-border'
                      }`}
                    />
                    {fieldErrors['labour.familyLabour'] && (
                      <p id="labour-familyLabour-error" role="alert" className="text-[10px] text-red-600 mt-0.5">{fieldErrors['labour.familyLabour']}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="labour-hiredLabour" className="block text-xs font-semibold text-slate-700 mb-1">Hired Labour (persons)</label>
                    <input
                      id="labour-hiredLabour"
                      aria-label="Hired Labour"
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      aria-invalid={Boolean(fieldErrors['labour.hiredLabour'])}
                      aria-describedby={fieldErrors['labour.hiredLabour'] ? 'labour-hiredLabour-error' : undefined}
                      placeholder="0"
                      value={formData.labour.hiredLabour}
                      onChange={(e) => handleGroupChange('labour', 'hiredLabour', e.target.value)}
                      className={`w-full px-3 py-2 rounded-control border text-sm outline-none focus:border-primary ${
                        fieldErrors['labour.hiredLabour'] ? 'border-red-500 bg-red-50/20' : 'border-border'
                      }`}
                    />
                    {fieldErrors['labour.hiredLabour'] && (
                      <p id="labour-hiredLabour-error" role="alert" className="text-[10px] text-red-600 mt-0.5">{fieldErrors['labour.hiredLabour']}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="labour-dailyWage" className="block text-xs font-semibold text-slate-700 mb-1">Daily Wage Rate (Rs.)</label>
                    <input
                      id="labour-dailyWage"
                      aria-label="Daily Wage"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      aria-invalid={Boolean(fieldErrors['labour.dailyWage'])}
                      aria-describedby={fieldErrors['labour.dailyWage'] ? 'labour-dailyWage-error' : undefined}
                      placeholder="0"
                      value={formData.labour.dailyWage}
                      onChange={(e) => handleGroupChange('labour', 'dailyWage', e.target.value)}
                      className={`w-full px-3 py-2 rounded-control border text-sm outline-none focus:border-primary ${
                        fieldErrors['labour.dailyWage'] ? 'border-red-500 bg-red-50/20' : 'border-border'
                      }`}
                    />
                    {fieldErrors['labour.dailyWage'] && (
                      <p id="labour-dailyWage-error" role="alert" className="text-[10px] text-red-600 mt-0.5">{fieldErrors['labour.dailyWage']}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="labour-cost" className="block text-xs font-semibold text-slate-700 mb-1">Computed Cost (Rs.)</label>
                    <input
                      id="labour-cost"
                      aria-label="Labour Cost"
                      type="text"
                      readOnly
                      value={formData.labour.cost ? formatCurrency(Number(formData.labour.cost), lang) : 'Rs. 0'}
                      className="w-full px-3 py-2 rounded-control border border-border bg-slate-100 font-bold text-slate-900 outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Section 6: Other */}
              <SectionCard
                title={t('form.section6Title')}
                subtitle={t('form.otherSubtitle')}
                number={6}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label htmlFor="other-description" className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                    <input
                      id="other-description"
                      aria-label="Other Description"
                      type="text"
                      placeholder="e.g. Snacks or land lease"
                      value={formData.other.description}
                      onChange={(e) => handleGroupChange('other', 'description', e.target.value)}
                      className="w-full px-3 py-2 rounded-control border border-border text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="other-amount" className="block text-xs font-semibold text-slate-700 mb-1">Amount (Rs.)</label>
                    <input
                      id="other-amount"
                      aria-label="Other Amount"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      aria-invalid={Boolean(fieldErrors['other.amount'])}
                      aria-describedby={fieldErrors['other.amount'] ? 'other-amount-error' : undefined}
                      placeholder="0"
                      value={formData.other.amount}
                      onChange={(e) => handleGroupChange('other', 'amount', e.target.value)}
                      className={`w-full px-3 py-2 rounded-control border text-sm outline-none focus:border-primary font-bold text-slate-900 ${
                        fieldErrors['other.amount'] ? 'border-red-500 bg-red-50/20' : 'border-border'
                      }`}
                    />
                    {fieldErrors['other.amount'] && (
                      <p id="other-amount-error" role="alert" className="text-[10px] text-red-600 mt-0.5">{fieldErrors['other.amount']}</p>
                    )}
                  </div>
                </div>
              </SectionCard>
            </>
          )}

        </div>

        {/* Right Column: Live Preview & Cost Impact (1 col) */}
        <div className="space-y-6">

          {/* Expense Live Preview */}
          <div className="bg-white p-5 rounded-card border border-border shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <span>{t('form.previewTitle')}</span>
            </h2>

            <div className="space-y-2 text-xs border-b border-slate-100 pb-3">
              <div className="flex justify-between text-slate-600">
                <span>{t('table.date')}:</span>
                <span className="font-semibold text-slate-900">{formatDate(formData.entryDate)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t('form.dayStatus')}:</span>
                <span className="font-semibold text-slate-900">{formData.dayStatus}</span>
              </div>
              {formData.dayStatus === 'worked' && (
                <div className="flex justify-between text-slate-600">
                  <span>{t('table.activity')}:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[140px]">
                    {selectedActivity ? `${selectedActivity.code} (${lang === 'si' ? selectedActivity.nameSi : selectedActivity.nameEn})` : '-'}
                  </span>
                </div>
              )}
            </div>

            {formData.dayStatus === 'worked' && (
              <div className="space-y-2 text-xs border-b border-slate-100 pb-3">
                <div className="flex justify-between text-slate-600">
                  <span>{costSheetGroups.inputs.labelEn} Subtotal:</span>
                  <span className="font-medium text-slate-900">{formatCurrency(livePreview.subtotals.inputs, lang)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{costSheetGroups.machinery.labelEn} Subtotal:</span>
                  <span className="font-medium text-slate-900">{formatCurrency(livePreview.subtotals.machinery, lang)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{costSheetGroups.labour.labelEn} Subtotal:</span>
                  <span className="font-medium text-slate-900">{formatCurrency(livePreview.subtotals.labour, lang)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{costSheetGroups.other.labelEn} Subtotal:</span>
                  <span className="font-medium text-slate-900">{formatCurrency(livePreview.subtotals.other, lang)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-1">
              <span className="text-sm font-bold text-slate-900">Total Day Cost:</span>
              <span className="text-lg font-black text-primary" data-testid="live-total-preview">
                {formatCurrency(livePreview.totalAmount, lang)}
              </span>
            </div>
          </div>

          {/* Cost Impact */}
          <div className="bg-white p-5 rounded-card border border-border shadow-sm space-y-3 text-xs" id="add-expense-cost-impact-card">
            <h2 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Cost Impact Summary</span>
              <div className="flex items-center gap-2">
                <span id="cost-impact-category-tier-badge" className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border uppercase tracking-wider ${
                  (categoryVariance?.tier || variance?.total?.tier) === 'significant' ? 'bg-red-100 text-red-800 border-red-300' :
                  (categoryVariance?.tier || variance?.total?.tier) === 'attention' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                  'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}>
                  <span className="capitalize">{primaryCategory}: </span>
                  {categoryVariance?.tier || variance?.total?.tier || 'normal'}
                </span>
              </div>
            </h2>

            {/* Dynamic inline warning above +15% */}
            {showOverspendWarning && (
              <div id="cost-impact-warning-banner" className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <span>⚠️ Significant Overspend Warning: Phased variance exceeds +15%. Immediate attention recommended.</span>
              </div>
            )}

            <div className="space-y-2 border-b border-slate-100 pb-3">
              <div className="flex justify-between text-slate-600">
                <span>Current Actual Cost:</span>
                <span className="font-semibold text-slate-800 font-mono">{formatCurrency(currentCycleTotal, lang)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>This Entry Cost:</span>
                <span className="font-semibold text-emerald-700 font-mono">+{formatCurrency(livePreview.totalAmount, lang)}</span>
              </div>

              <div className="flex justify-between text-slate-900 font-bold">
                <span>New Actual Total:</span>
                <span className="text-primary font-mono">{formatCurrency(newCycleTotal, lang)}</span>
              </div>

              <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
                <span>Full Predicted Total:</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {variance?.total?.expected ? formatCurrency(variance.total.expected, lang) : (t('kpi.noBaseline') || 'No baseline yet')}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Expected To Date (Phased):</span>
                <span className="font-semibold text-blue-700 font-mono">
                  {variance?.total?.expectedToDate ? formatCurrency(variance.total.expectedToDate, lang) : (t('kpi.noBaseline') || 'No baseline yet')}
                </span>
              </div>

              {/* Category Expected to Date */}
              <div className="flex justify-between text-slate-600" id="cost-impact-category-expected">
                <span className="capitalize">{primaryCategory} Expected To Date:</span>
                <span className="font-semibold text-blue-700 font-mono">
                  {categoryVariance?.expectedToDate != null ? formatCurrency(categoryVariance.expectedToDate, lang) : '-'}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Variance % vs Phase:</span>
                <span className={`font-bold font-mono ${
                  (variance?.total?.variancePct || 0) > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}>
                  {variance?.total?.variancePct !== undefined
                    ? `${variance.total.variancePct > 0 ? '+' : ''}${(variance.total.variancePct * 100).toFixed(1)}%`
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              disabled={saveMutation.isPending || isCyclesLoading}
              onClick={() => handleSubmit(false)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary text-white font-bold rounded-control hover:bg-emerald-900 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>{t('form.saveExpense')}</span>
                </>
              )}
            </button>

            {!isEditMode && (
              <button
                type="button"
                disabled={saveMutation.isPending || isCyclesLoading}
                onClick={() => handleSubmit(true)}
                className="w-full py-2.5 px-4 bg-white text-primary border border-primary font-bold rounded-control hover:bg-tint transition-colors disabled:opacity-50"
              >
                {t('form.saveAndAddAnother')}
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/tracker/records')}
              className="w-full py-2 px-4 bg-white text-slate-600 border border-border font-medium rounded-control hover:bg-slate-50 transition-colors text-xs"
            >
              {t('form.cancel')}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
