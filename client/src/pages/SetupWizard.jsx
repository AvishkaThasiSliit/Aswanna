import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Tractor, MapPin, Sprout, ArrowRight, ArrowLeft,
  Plus, Trash2, Check, AlertCircle, Loader2, Sparkles, RefreshCw
} from 'lucide-react';

import { apiFetch, ApiError } from '../utils/api.js';
import { farmerSchema } from '../../../shared/formSchemas/farmer.js';
import { machinerySchema } from '../../../shared/formSchemas/machinery.js';
import { landSchema } from '../../../shared/formSchemas/land.js';
import { cycleSchema } from '../../../shared/formSchemas/cycle.js';
import { validateField, validateEntity } from '../../../shared/validation/index.js';
import SchemaFormRenderer from '../components/SchemaFormRenderer.jsx';
import SectionCard from '../components/SectionCard.jsx';
import WarningBanner from '../components/WarningBanner.jsx';
import { useToast } from '../components/Toast.jsx';

const CROPS = [
  'Tomato',
  'Paddy',
  'Maize',
  'Chili',
  'Big Onion',
  'Red Onion',
  'Potato',
  'Carrot',
  'Beans',
  'Cabbage',
  'Brinjal'
];

export default function SetupWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast() || {};

  // ── Determine Current Step from Route ───────────────────────────────────────
  const currentStep = useMemo(() => {
    const path = location.pathname;
    if (path.endsWith('/farmer')) return 1;
    if (path.endsWith('/machinery')) return 2;
    if (path.endsWith('/lands')) return 3;
    if (path.endsWith('/cycle')) return 4;
    return 1;
  }, [location.pathname]);

  const goToStep = (step) => {
    switch (step) {
      case 1: navigate('/setup/farmer'); break;
      case 2: navigate('/setup/machinery'); break;
      case 3: navigate('/setup/lands'); break;
      case 4: navigate('/setup/cycle'); break;
      default: navigate('/setup/farmer');
    }
  };

  // ── Form State ─────────────────────────────────────────────────────────────
  const [farmerData, setFarmerData] = useState({
    name: '',
    dateOfBirth: '',
    nic: '',
    phone: '',
    address: '',
    district: 'Kurunegala',
    divisionalSecretariat: '',
    gnDivision: '',
  });

  const [machineryList, setMachineryList] = useState([]);
  const [landList, setLandList] = useState([
    {
      landCode: 'L-1',
      landType: 'lowland',
      district: 'Kurunegala',
      agrarianServiceCentre: '',
      gnDivision: '',
      tenure: 'freehold',
      extentUnit: 'acre',
      extentValue: '1',
      waterSourceType: 'irrigated',
      irrigationSource: 'Mahaweli Water Canal',
    }
  ]);

  const [cycleData, setCycleData] = useState({
    landId: '',
    crop: 'Tomato',
    season: 'Yala',
    startDate: new Date().toISOString().split('T')[0],
  });

  const [activeCycleResult, setActiveCycleResult] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Load Existing Data on Mount (Progress kept on refresh) ─────────────────
  const { data: profileData, isLoading: loadingProfile } = useQuery({
    queryKey: ['farmerProfile'],
    queryFn: () => apiFetch('/farmer-profiles'),
  });

  const { data: machineryData, isLoading: loadingMachinery } = useQuery({
    queryKey: ['machineryOwned'],
    queryFn: () => apiFetch('/machinery-owned'),
  });

  const { data: landsData, isLoading: loadingLands } = useQuery({
    queryKey: ['lands'],
    queryFn: () => apiFetch('/lands'),
  });

  const { data: cyclesData, isLoading: loadingCycles } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch('/cycles'),
  });

  // Populate data when fetched
  useEffect(() => {
    if (profileData) {
      const items = profileData.items || profileData;
      const profile = Array.isArray(items) ? items[0] : items;
      if (profile && profile.name) {
        setFarmerData({
          _id: profile._id,
          name: profile.name || '',
          dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
          nic: profile.nic || '',
          phone: profile.phone || '',
          address: profile.address || '',
          district: profile.district || 'Kurunegala',
          divisionalSecretariat: profile.divisionalSecretariat || '',
          gnDivision: profile.gnDivision || '',
        });
      }
    }
  }, [profileData]);

  useEffect(() => {
    if (machineryData) {
      const items = machineryData.items || machineryData;
      if (Array.isArray(items) && items.length > 0) {
        setMachineryList(items.map(m => ({
          _id: m._id,
          equipment: m.equipment || '',
          quantity: m.quantity != null ? String(m.quantity) : '',
          'purchasedOn.year': m.purchasedOn?.year != null ? String(m.purchasedOn.year) : '',
          'purchasedOn.month': m.purchasedOn?.month != null ? String(m.purchasedOn.month) : '',
          'purchasedOn.day': m.purchasedOn?.day != null ? String(m.purchasedOn.day) : '',
          purchaseValue: m.purchaseValue != null ? String(m.purchaseValue) : '',
          annotationNote: m.annotationNote || '',
        })));
      }
    }
  }, [machineryData]);

  useEffect(() => {
    if (landsData) {
      const items = landsData.items || landsData;
      if (Array.isArray(items) && items.length > 0) {
        setLandList(items.map(l => ({
          _id: l._id,
          landCode: l.landCode || '',
          landType: l.landType || 'upland',
          district: l.district || 'Kurunegala',
          agrarianServiceCentre: l.agrarianServiceCentre || '',
          gnDivision: l.gnDivision || '',
          tenure: l.tenure || 'freehold',
          extentUnit: l.extentUnit || 'acre',
          extentValue: l.extentValue != null ? String(l.extentValue) : '1',
          waterSourceType: l.waterSourceType || 'irrigated',
          irrigationSource: l.irrigationSource || '',
        })));
        if (!cycleData.landId) {
          setCycleData(prev => ({ ...prev, landId: items[0]._id }));
        }
      }
    }
  }, [landsData]);

  useEffect(() => {
    if (cyclesData) {
      const items = cyclesData.items || cyclesData;
      if (Array.isArray(items)) {
        const active = items.find(c => c.status === 'active');
        if (active) {
          setActiveCycleResult(active);
        }
      }
    }
  }, [cyclesData]);

  // ── Unsaved-Change Warning ──────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = t('setup.helpers.unsavedChanges');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, t]);

  const [serverWarnings, setServerWarnings] = useState([]);

  const focusFirstError = (errorsObj, prefix = '') => {
    const firstKey = Object.keys(errorsObj)[0];
    if (firstKey) {
      const fieldId = prefix ? `${prefix}-${firstKey.replace(/\./g, '-')}` : `farmer-${firstKey.replace(/\./g, '-')}`;
      document.getElementById(fieldId)?.focus();
    }
  };

  // ── Client-side Field Validations ──────────────────────────────────────────
  const validateFarmer = () => {
    const res = validateEntity(farmerSchema, farmerData, { strict: false });
    const errors = {};
    for (const [k, errList] of Object.entries(res.errors)) {
      if (errList.length > 0) {
        errors[k] = errList[0].message;
      }
    }
    return errors;
  };

  const handleFarmerChange = (k, val) => {
    const updated = { ...farmerData, [k]: val };
    setFarmerData(updated);
    setIsDirty(true);

    const fieldDef = farmerSchema.find(f => f.key === k);
    if (fieldDef) {
      const res = validateField(fieldDef, val, updated);
      setFieldErrors(prev => {
        const next = { ...prev };
        if (res.errors.length > 0) {
          next[k] = res.errors[0].message;
        } else {
          delete next[k];
        }
        return next;
      });
    }
  };

  const handleFarmerBlur = (k, val) => {
    handleFarmerChange(k, val);
  };

  const validateMachinery = () => {
    const errors = {};
    machineryList.forEach((item, idx) => {
      const hasAnyField = item.equipment || item.quantity || item['purchasedOn.year'] || item.purchaseValue || item.annotationNote;
      if (hasAnyField) {
        if (!item['purchasedOn.year']) {
          errors[`machinery.${idx}.purchasedOn.year`] = t('setup.errors.yearRequired', 'Purchase year is required');
        }
        if (item.quantity && (Number(item.quantity) < 1 || !Number.isInteger(Number(item.quantity)))) {
          errors[`machinery.${idx}.quantity`] = 'Quantity must be an integer >= 1';
        }
        if (item.purchaseValue && (Number(item.purchaseValue) < 0 || !Number.isInteger(Number(item.purchaseValue)))) {
          errors[`machinery.${idx}.purchaseValue`] = 'Purchase value must be whole rupees >= 0';
        }
      }
    });
    return errors;
  };

  const validateLands = () => {
    const errors = {};
    if (landList.length === 0) {
      errors.general = t('setup.errors.atLeastOneLand', 'At least one land is required');
      return errors;
    }
    const codeMap = new Set();
    landList.forEach((land, idx) => {
      if (!land.landCode || !land.landCode.trim()) {
        errors[`land.${idx}.landCode`] = t('setup.errors.landCodeRequired', 'Land code is required');
      } else {
        const code = land.landCode.trim().toLowerCase();
        if (codeMap.has(code)) {
          errors[`land.${idx}.landCode`] = t('setup.errors.duplicateLandCode', 'This Land Code is already in use by another of your lands');
        }
        codeMap.add(code);
      }
      if (!land.extentValue || Number(land.extentValue) <= 0) {
        errors[`land.${idx}.extentValue`] = t('setup.errors.extentRequired', 'Extent is required');
      }
      if (land.waterSourceType === 'irrigated' && (!land.irrigationSource || !land.irrigationSource.trim())) {
        errors[`land.${idx}.irrigationSource`] = t('setup.errors.irrigationSourceRequired', 'Irrigation source is required');
      }
    });
    return errors;
  };

  const validateCycle = () => {
    const res = validateEntity(cycleSchema, cycleData, { strict: false });
    const errors = {};
    for (const [k, errList] of Object.entries(res.errors)) {
      if (errList.length > 0) {
        errors[k] = errList[0].message;
      }
    }
    return errors;
  };

  // ── Step 1: Save Farmer Profile ────────────────────────────────────────────
  const handleSaveFarmer = async () => {
    setFieldErrors({});
    setGeneralError('');
    setWarnings([]);
    const errs = validateFarmer();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const firstKey = Object.keys(errs)[0];
      const el = document.getElementById(`farmer-${firstKey.replace(/\./g, '-')}`);
      el?.focus?.();
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: farmerData.name.trim(),
        dateOfBirth: farmerData.dateOfBirth || undefined,
        nic: farmerData.nic ? farmerData.nic.trim() : undefined,
        phone: farmerData.phone ? farmerData.phone.trim() : undefined,
        address: farmerData.address ? farmerData.address.trim() : undefined,
        district: farmerData.district || undefined,
        divisionalSecretariat: farmerData.divisionalSecretariat ? farmerData.divisionalSecretariat.trim() : undefined,
        gnDivision: farmerData.gnDivision ? farmerData.gnDivision.trim() : undefined,
      };

      let res;
      if (farmerData._id) {
        res = await apiFetch(`/farmer-profiles/${farmerData._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch('/farmer-profiles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setFarmerData(prev => ({ ...prev, _id: res._id }));
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['farmerProfile'] });
      queryClient.invalidateQueries({ queryKey: ['authMe'] });
      if (res.warnings?.length) {
        setWarnings(res.warnings);
      }
      showToast?.('Farmer profile saved successfully');
      goToStep(2);
    } catch (err) {
      if (err.data?.error?.fields) {
        setFieldErrors(err.data.error.fields);
      } else {
        setGeneralError(err.message || 'Failed to save farmer profile');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step 2: Save Machinery ─────────────────────────────────────────────────
  const handleSaveMachinery = async () => {
    setFieldErrors({});
    setGeneralError('');
    const errs = validateMachinery();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setIsSaving(true);
    try {
      const itemsPayload = machineryList
        .filter(m => m.equipment || m.quantity || m['purchasedOn.year'] || m.purchaseValue || m.annotationNote)
        .map(m => ({
          _id: m._id,
          equipment: m.equipment || undefined,
          quantity: m.quantity !== '' ? Number(m.quantity) : undefined,
          purchasedOn: {
            year: m['purchasedOn.year'] !== '' ? Number(m['purchasedOn.year']) : undefined,
            month: m['purchasedOn.month'] !== '' ? Number(m['purchasedOn.month']) : undefined,
            day: m['purchasedOn.day'] !== '' ? Number(m['purchasedOn.day']) : undefined,
          },
          purchaseValue: m.purchaseValue !== '' ? Number(m.purchaseValue) : undefined,
          annotationNote: m.annotationNote || undefined,
        }));

      const res = await apiFetch('/machinery-owned/batch', {
        method: 'POST',
        body: JSON.stringify({ items: itemsPayload }),
      });

      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['machineryOwned'] });
      showToast?.('Machinery details saved successfully');
      goToStep(3);
    } catch (err) {
      if (err.data?.error?.fields) {
        setFieldErrors(err.data.error.fields);
      } else {
        setGeneralError(err.message || 'Failed to save machinery details');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step 3: Save Lands ─────────────────────────────────────────────────────
  const handleSaveLands = async () => {
    setFieldErrors({});
    setGeneralError('');
    const errs = validateLands();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setIsSaving(true);
    try {
      const itemsPayload = landList.map(l => ({
        _id: l._id,
        landCode: l.landCode.trim(),
        landType: l.landType,
        district: l.district,
        agrarianServiceCentre: l.agrarianServiceCentre ? l.agrarianServiceCentre.trim() : undefined,
        gnDivision: l.gnDivision ? l.gnDivision.trim() : undefined,
        tenure: l.tenure,
        extentUnit: l.extentUnit,
        extentValue: Number(l.extentValue),
        waterSourceType: l.waterSourceType,
        irrigationSource: l.waterSourceType === 'irrigated' ? l.irrigationSource : undefined,
      }));

      const res = await apiFetch('/lands/batch', {
        method: 'POST',
        body: JSON.stringify({ items: itemsPayload }),
      });

      const savedLands = res.items || [];
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['lands'] });
      showToast?.('Land details saved successfully');

      if (savedLands.length > 0) {
        setLandList(savedLands.map(l => ({
          _id: l._id,
          landCode: l.landCode || '',
          landType: l.landType || 'upland',
          district: l.district || 'Kurunegala',
          agrarianServiceCentre: l.agrarianServiceCentre || '',
          gnDivision: l.gnDivision || '',
          tenure: l.tenure || 'freehold',
          extentUnit: l.extentUnit || 'acre',
          extentValue: l.extentValue != null ? String(l.extentValue) : '1',
          waterSourceType: l.waterSourceType || 'irrigated',
          irrigationSource: l.irrigationSource || '',
        })));
        setCycleData(prev => ({ ...prev, landId: savedLands[0]._id }));
      }
      goToStep(4);
    } catch (err) {
      if (err.data?.error?.fields) {
        setFieldErrors(err.data.error.fields);
      } else {
        setGeneralError(err.message || 'Failed to save land details');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step 4: Start Cultivation Cycle ────────────────────────────────────────
  const handleStartCycle = async () => {
    setFieldErrors({});
    setGeneralError('');
    setWarnings([]);
    const errs = validateCycle();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const firstKey = Object.keys(errs)[0];
      const el = document.getElementById(`cycle${firstKey.charAt(0).toUpperCase() + firstKey.slice(1)}`) || document.getElementById(`cycle-${firstKey}`);
      el?.focus?.();
      return;
    }

    setIsSaving(true);
    try {
      const selectedLand = landList.find(l => l._id === cycleData.landId) || landList[0];
      const payload = {
        landId: cycleData.landId,
        landCode: selectedLand?.landCode,
        crop: cycleData.crop,
        season: cycleData.season,
        district: selectedLand?.district || farmerData.district,
        startDate: cycleData.startDate,
        extentValue: selectedLand ? Number(selectedLand.extentValue) : 1,
        extentUnit: selectedLand?.extentUnit || 'acre',
        status: 'active',
      };

      const res = await apiFetch('/cycles', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.warnings?.length) {
        setWarnings(res.warnings);
      }
      setActiveCycleResult(res);
      queryClient.setQueryData(['cycles'], (old) => {
        if (!old) return [res];
        const items = old.items || old;
        if (Array.isArray(items)) {
          return Array.isArray(old) ? [...old, res] : { ...old, items: [...items, res] };
        }
        return [res];
      });
      await queryClient.invalidateQueries({ queryKey: ['cycles'] });
      showToast?.('Cultivation cycle started successfully!');
    } catch (err) {
      if (err.data?.error?.fields) {
        setFieldErrors(err.data.error.fields);
      } else {
        setGeneralError(err.message || 'Failed to start cycle');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step 4: Retry Baseline Fetch ───────────────────────────────────────────
  const handleRetryBaseline = async () => {
    if (!activeCycleResult?._id) return;
    setIsSaving(true);
    try {
      const res = await apiFetch(`/cycles/${activeCycleResult._id}/retry-baseline`, {
        method: 'POST'
      });
      setActiveCycleResult(res.cycle || res);
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      showToast?.('Baseline retry completed');
    } catch (err) {
      showToast?.(err.message || 'Baseline retry failed');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Handlers for Repeatable Rows ───────────────────────────────────────────
  const addMachineryRow = () => {
    setMachineryList(prev => [
      ...prev,
      {
        equipment: '',
        quantity: '1',
        'purchasedOn.year': new Date().getFullYear().toString(),
        'purchasedOn.month': '',
        'purchasedOn.day': '',
        purchaseValue: '',
        annotationNote: ''
      }
    ]);
    setIsDirty(true);
  };

  const removeMachineryRow = (idx) => {
    setMachineryList(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const updateMachineryRow = (idx, fieldKey, val) => {
    setMachineryList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [fieldKey]: val };
      return next;
    });
    setIsDirty(true);
  };

  const addLandRow = () => {
    const nextNum = landList.length + 1;
    setLandList(prev => [
      ...prev,
      {
        landCode: `L-${nextNum}`,
        landType: 'upland',
        district: farmerData.district || 'Kurunegala',
        agrarianServiceCentre: '',
        gnDivision: '',
        tenure: 'freehold',
        extentUnit: 'acre',
        extentValue: '1',
        waterSourceType: 'rainfed',
        irrigationSource: '',
      }
    ]);
    setIsDirty(true);
  };

  const removeLandRow = (idx) => {
    if (landList.length <= 1) return;
    setLandList(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const updateLandRow = (idx, fieldKey, val) => {
    setLandList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [fieldKey]: val };
      return next;
    });
    setIsDirty(true);
  };

  // Steps definition for header badges
  const steps = [
    { num: 1, id: 'farmer', titleSi: 'ගොවියාගේ තොරතුරු', titleEn: 'Farmer Profile', icon: User },
    { num: 2, id: 'machinery', titleSi: 'කෘෂි යන්ත්‍රෝපකරණ', titleEn: 'Machinery Owned', icon: Tractor },
    { num: 3, id: 'lands', titleSi: 'වගා ඉඩම් විස්තර', titleEn: 'Land Details', icon: MapPin },
    { num: 4, id: 'cycle', titleSi: 'වගා කන්නය ආරම්භ කිරීම', titleEn: 'Start Cycle', icon: Sprout },
  ];

  const isLoadingData = loadingProfile || loadingMachinery || loadingLands || loadingCycles;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Wizard Header */}
      <div className="bg-white rounded-card border border-border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Sparkles className="text-primary w-6 h-6" />
              <span>{t('setup.title', 'Initial Setup Wizard')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {t('setup.subtitle', 'Complete your profile, machinery, lands, and start your cultivation cycle')}
            </p>
          </div>
          {isDirty && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Unsaved Changes
            </span>
          )}
        </div>

        {/* Numbered Step Badges (Visual Style matching Aswanna Section Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {steps.map((s) => {
            const isActive = currentStep === s.num;
            const isCompleted = currentStep > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => goToStep(s.num)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${s.num}: ${s.titleEn}`}
                className={`flex items-center gap-3 p-3 rounded-control text-left transition-all border outline-none ${
                  isActive
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                    : 'border-border bg-slate-50/50 opacity-70 hover:opacity-100'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0 transition-colors ${
                    isActive
                      ? 'bg-primary text-white ring-2 ring-primary/30'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {isCompleted ? <Check size={16} /> : s.num}
                </span>
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold text-slate-800 truncate">
                    {s.titleSi}
                  </span>
                  <span className="block text-[10px] text-slate-400 truncate">
                    {s.titleEn}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* General Error Banner */}
      {generalError && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-card flex items-center gap-3 text-red-900 text-sm font-medium">
          <AlertCircle size={20} className="text-red-600 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoadingData ? (
        <div className="bg-white rounded-card border border-border p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 size={32} className="animate-spin text-primary" />
          <span className="text-sm font-semibold">Loading your agricultural details...</span>
        </div>
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* STEP 1: FARMER PROFILE                                             */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {currentStep === 1 && (
            <SectionCard
              number={1}
              title={`${t('setup.stepHeadings.farmer', 'ගොවියාගේ තොරතුරු')} (${t('setup.steps.farmer', 'Farmer Profile')})`}
            >
              {warnings.length > 0 && (
                <div className="mb-4">
                  <WarningBanner warnings={warnings} onDismiss={() => setWarnings([])} />
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveFarmer();
                }}
                className="space-y-6"
              >
                {/* Dynamically Generated Form from farmerSchema */}
                <SchemaFormRenderer
                  schema={farmerSchema}
                  values={farmerData}
                  onChange={handleFarmerChange}
                  onBlur={handleFarmerBlur}
                  errors={fieldErrors}
                  idPrefix="farmer"
                  columns={2}
                />

                <div className="flex justify-end pt-4 border-t border-border">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-control font-bold text-sm shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
                  >
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    <span>{t('setup.buttons.next', 'Save & Next')}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </SectionCard>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* STEP 2: MACHINERY OWNED                                             */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {currentStep === 2 && (
            <SectionCard
              number={2}
              title={`${t('setup.stepHeadings.machinery', 'කෘෂි යන්ත්‍රෝපකරණ')} (${t('setup.steps.machinery', 'Machinery Owned')})`}
            >
              <div className="space-y-6">
                <p className="text-xs text-slate-500">
                  {t('setup.helpers.noMachinery', 'No machinery recorded yet. You may add equipment or skip to the next step.')}
                </p>

                {machineryList.map((item, idx) => {
                  // Map fieldErrors with prefix
                  const rowErrors = {};
                  Object.keys(fieldErrors).forEach(k => {
                    const prefix = `machinery.${idx}.`;
                    if (k.startsWith(prefix)) {
                      rowErrors[k.replace(prefix, '')] = fieldErrors[k];
                    }
                  });

                  return (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50/70 border border-slate-200 rounded-control relative space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-bold text-slate-700">
                          {t('setup.fields.equipment.si', 'උපකරණය')} #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMachineryRow(idx)}
                          aria-label={`${t('setup.buttons.removeRow')} ${idx + 1}`}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Generated from machinerySchema */}
                      <SchemaFormRenderer
                        schema={machinerySchema}
                        values={item}
                        onChange={(k, val) => updateMachineryRow(idx, k, val)}
                        errors={rowErrors}
                        idPrefix={`machinery-${idx}`}
                        columns={3}
                      />
                    </div>
                  );
                })}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={addMachineryRow}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-control text-xs font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <Plus size={16} />
                    <span>{t('setup.buttons.addMachinery', '+ Add Equipment')}</span>
                  </button>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="px-4 py-2 border border-border rounded-control text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {t('setup.buttons.prev', 'Back')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMachinery}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-control font-bold text-sm shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
                    >
                      {isSaving && <Loader2 size={16} className="animate-spin" />}
                      <span>{t('setup.buttons.next', 'Save & Next')}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* STEP 3: LAND DETAILS                                                */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {currentStep === 3 && (
            <SectionCard
              number={3}
              title={`${t('setup.stepHeadings.lands', 'වගා ඉඩම් විස්තර')} (${t('setup.steps.lands', 'Land Details')})`}
            >
              <div className="space-y-6">
                {landList.map((land, idx) => {
                  const rowErrors = {};
                  Object.keys(fieldErrors).forEach(k => {
                    const prefix = `land.${idx}.`;
                    if (k.startsWith(prefix)) {
                      rowErrors[k.replace(prefix, '')] = fieldErrors[k];
                    }
                  });
                  if (fieldErrors.landCode) {
                    rowErrors.landCode = fieldErrors.landCode;
                  }

                  return (
                    <div
                      key={idx}
                      className="p-5 bg-slate-50/80 border border-slate-200 rounded-control space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <MapPin size={16} className="text-primary" />
                          <span>{t('setup.fields.cycleLand.si', 'වගා ඉඩම')} #{idx + 1} ({land.landCode || 'Unnamed'})</span>
                        </span>
                        {landList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLandRow(idx)}
                            aria-label={`${t('setup.buttons.removeRow')} ${idx + 1}`}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {/* Generated from landSchema */}
                      <SchemaFormRenderer
                        schema={landSchema}
                        values={land}
                        onChange={(k, val) => updateLandRow(idx, k, val)}
                        errors={rowErrors}
                        idPrefix={`land-${idx}`}
                        columns={2}
                      />
                    </div>
                  );
                })}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={addLandRow}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-control text-xs font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <Plus size={16} />
                    <span>{t('setup.buttons.addLand', '+ Add Another Land')}</span>
                  </button>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="px-4 py-2 border border-border rounded-control text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {t('setup.buttons.prev', 'Back')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLands}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-control font-bold text-sm shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
                    >
                      {isSaving && <Loader2 size={16} className="animate-spin" />}
                      <span>{t('setup.buttons.next', 'Save & Next')}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* STEP 4: START CULTIVATION CYCLE                                    */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <SectionCard
              number={4}
              title={`${t('setup.stepHeadings.cycle', 'වගා කන්නය ආරම්භ කිරීම')} (${t('setup.steps.cycle', 'Start Cultivation Cycle')})`}
            >
              <div className="space-y-6">
                {activeCycleResult ? (
                  /* Active Cycle Banner with Baseline Status */
                  <div className="p-6 bg-emerald-50/60 border border-emerald-200 rounded-card space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                        <Check size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-emerald-950">
                          Active Cultivation Cycle Running
                        </h3>
                        <p className="text-xs text-emerald-800">
                          {activeCycleResult.crop} • {activeCycleResult.season} • {activeCycleResult.district || 'Kurunegala'} (Land: {activeCycleResult.landCode || 'L-1'})
                        </p>
                      </div>
                    </div>

                    {/* Baseline Status Card */}
                    <div className="p-4 bg-white border border-emerald-200 rounded-control flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">SO1 Baseline Status</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {activeCycleResult.baselineStatus === 'ready' ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                              <Check size={14} /> Ready ({activeCycleResult.baselineSource || 'SO1'})
                            </span>
                          ) : activeCycleResult.baselineStatus === 'missing' ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                              <AlertCircle size={14} /> Missing (Could not load baseline)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                              <Loader2 size={14} className="animate-spin" /> Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {activeCycleResult.baselineStatus === 'missing' && (
                        <button
                          type="button"
                          onClick={handleRetryBaseline}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-control font-bold hover:bg-amber-100 transition-colors"
                        >
                          <RefreshCw size={12} className={isSaving ? 'animate-spin' : ''} />
                          <span>Retry Baseline</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate('/tracker/add')}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white rounded-control font-bold shadow-sm hover:bg-primary-hover transition-colors"
                      >
                        <span>{t('setup.buttons.viewExpenses', 'Go to Expense Form')}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form to Start Cycle */
                  <>
                    {warnings.length > 0 && (
                      <div className="mb-4">
                        <WarningBanner warnings={warnings} onDismiss={() => setWarnings([])} />
                      </div>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleStartCycle();
                      }}
                      className="space-y-6"
                    >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Select Land */}
                      <div>
                        <label htmlFor="cycleLand" className="block text-xs font-bold text-slate-700 mb-1">
                          <span className="font-semibold text-slate-800">{t('setup.fields.cycleLand.si', 'වගා ඉඩම')}</span>
                          <span className="text-slate-500 font-normal ml-1">({t('setup.fields.cycleLand.en', 'Land')})</span>
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                          id="cycleLand"
                          aria-label="Cultivation Land"
                          value={cycleData.landId}
                          onChange={(e) => setCycleData(prev => ({ ...prev, landId: e.target.value }))}
                          className={`w-full px-3 py-2 rounded-control border text-sm outline-none transition-colors bg-white focus:border-primary ${
                            fieldErrors.landId ? 'border-red-500 bg-red-50/20' : 'border-border'
                          }`}
                        >
                          <option value="">-- Select Land --</option>
                          {landList.map((l) => (
                            <option key={l._id || l.landCode} value={l._id || l.landCode}>
                              {l.landCode} • {l.district} ({l.extentValue} {l.extentUnit})
                            </option>
                          ))}
                        </select>
                        {fieldErrors.landId && (
                          <p role="alert" className="text-xs text-red-600 font-medium mt-1">{fieldErrors.landId}</p>
                        )}
                      </div>

                      {/* Select Crop */}
                      <div>
                        <label htmlFor="cycleCrop" className="block text-xs font-bold text-slate-700 mb-1">
                          <span className="font-semibold text-slate-800">{t('setup.fields.crop.si', 'බෝගය')}</span>
                          <span className="text-slate-500 font-normal ml-1">({t('setup.fields.crop.en', 'Crop')})</span>
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                          id="cycleCrop"
                          aria-label="Crop"
                          value={cycleData.crop}
                          onChange={(e) => setCycleData(prev => ({ ...prev, crop: e.target.value }))}
                          className={`w-full px-3 py-2 rounded-control border text-sm outline-none transition-colors bg-white focus:border-primary ${
                            fieldErrors.crop ? 'border-red-500 bg-red-50/20' : 'border-border'
                          }`}
                        >
                          {CROPS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        {fieldErrors.crop && (
                          <p role="alert" className="text-xs text-red-600 font-medium mt-1">{fieldErrors.crop}</p>
                        )}
                      </div>

                      {/* Select Season */}
                      <div>
                        <label htmlFor="cycleSeason" className="block text-xs font-bold text-slate-700 mb-1">
                          <span className="font-semibold text-slate-800">{t('setup.fields.season.si', 'කන්නය')}</span>
                          <span className="text-slate-500 font-normal ml-1">({t('setup.fields.season.en', 'Season')})</span>
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                          id="cycleSeason"
                          aria-label="Season"
                          value={cycleData.season}
                          onChange={(e) => setCycleData(prev => ({ ...prev, season: e.target.value }))}
                          className={`w-full px-3 py-2 rounded-control border text-sm outline-none transition-colors bg-white focus:border-primary ${
                            fieldErrors.season ? 'border-red-500 bg-red-50/20' : 'border-border'
                          }`}
                        >
                          <option value="Yala">යල (Yala)</option>
                          <option value="Maha">මහ (Maha)</option>
                        </select>
                        {fieldErrors.season && (
                          <p role="alert" className="text-xs text-red-600 font-medium mt-1">{fieldErrors.season}</p>
                        )}
                      </div>

                      {/* Start Date */}
                      <div>
                        <label htmlFor="cycleStartDate" className="block text-xs font-bold text-slate-700 mb-1">
                          <span className="font-semibold text-slate-800">{t('setup.fields.startDate.si', 'ආරම්භක දිනය')}</span>
                          <span className="text-slate-500 font-normal ml-1">({t('setup.fields.startDate.en', 'Start Date')})</span>
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          id="cycleStartDate"
                          type="date"
                          aria-label="Start Date"
                          value={cycleData.startDate}
                          onChange={(e) => setCycleData(prev => ({ ...prev, startDate: e.target.value }))}
                          className={`w-full px-3 py-2 rounded-control border text-sm outline-none transition-colors focus:border-primary ${
                            fieldErrors.startDate ? 'border-red-500 bg-red-50/20' : 'border-border'
                          }`}
                        />
                        {fieldErrors.startDate && (
                          <p role="alert" className="text-xs text-red-600 font-medium mt-1">{fieldErrors.startDate}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <button
                        type="button"
                        onClick={() => goToStep(3)}
                        className="px-4 py-2 border border-border rounded-control text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {t('setup.buttons.prev', 'Back')}
                      </button>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-control font-bold text-sm shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Sprout size={16} />}
                        <span>{t('setup.buttons.startCycle', 'Start Cycle')}</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
