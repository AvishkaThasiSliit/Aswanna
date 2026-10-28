import React from 'react';
import { useTranslation } from 'react-i18next';
import { convertToAcres } from '../../../shared/units.js';
import {
  sinhalaDigitsToAscii,
  stripThousandsSeparators,
  normalizePhone,
  stripControlChars,
  normalizeNumericInput,
} from '../../../shared/validation/index.js';

export function getFieldValue(obj, key) {
  if (!obj) return '';
  if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  if (key.includes('.')) {
    const parts = key.split('.');
    let curr = obj;
    for (const p of parts) {
      if (curr == null) return '';
      curr = curr[p];
    }
    return curr ?? '';
  }
  return obj[key] ?? '';
}

export default function SchemaFormRenderer({
  schema,
  values = {},
  onChange,
  onBlur = null,
  errors = {},
  idPrefix = 'field',
  columns = 2,
}) {
  const { t } = useTranslation();

  const getOptionLabel = (fieldKey, opt) => {
    const key = `setup.options.${opt.toLowerCase()}`;
    const si = t(`${key}.si`, opt);
    const en = t(`${key}.en`, opt);
    if (si !== opt && en !== opt) {
      return `${si} (${en})`;
    }
    return opt;
  };

  const formatErrorMessage = (err) => {
    if (!err) return null;
    if (typeof err === 'string') return err;
    if (Array.isArray(err)) {
      const first = err[0];
      if (!first) return null;
      if (typeof first === 'string') return first;
      return first.key ? t(first.key, first.message) : first.message;
    }
    if (typeof err === 'object') {
      return err.key ? t(err.key, err.message) : (err.message || String(err));
    }
    return String(err);
  };

  const handlePaste = (e, field) => {
    const pasted = e.clipboardData?.getData('text');
    if (!pasted) return;

    if (field.type === 'number' || field.rules?.type === 'number') {
      e.preventDefault();
      const cleaned = normalizeNumericInput(pasted);
      onChange(field.key, cleaned);
    } else if (field.key === 'phone') {
      e.preventDefault();
      const cleaned = normalizePhone(pasted);
      onChange(field.key, cleaned);
    } else if (field.type === 'text') {
      e.preventDefault();
      const cleaned = stripControlChars(sinhalaDigitsToAscii(pasted));
      onChange(field.key, cleaned);
    }
  };

  return (
    <div className={`grid grid-cols-1 ${columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
      {schema.map((field) => {
        // Special case: irrigationSource only appears when waterSourceType is irrigated
        if (field.key === 'irrigationSource') {
          const waterSource = getFieldValue(values, 'waterSourceType');
          if (waterSource !== 'irrigated') {
            return null;
          }
        }

        const fieldId = `${idPrefix}-${field.key.replace(/\./g, '-')}`;
        const rawValue = getFieldValue(values, field.key);
        const rawError = errors[field.key];
        const errorText = formatErrorMessage(rawError);
        const isComputed = field.computed;

        // Computed live acres
        let displayValue = rawValue;
        if (field.key === 'extentAcres' && isComputed) {
          const extentVal = Number(getFieldValue(values, 'extentValue')) || 0;
          const extentUnit = getFieldValue(values, 'extentUnit') || 'acre';
          const computed = convertToAcres(extentVal, extentUnit);
          displayValue = computed ? computed.toFixed(2) : '0.00';
        }

        const cleanKey = field.key.replace(/\./g, '');
        const siLabel = field.paperLabelSi || field.labelSi || t(`setup.fields.${cleanKey}.si`, field.labelEn);
        const enLabel = field.labelEn || t(`setup.fields.${cleanKey}.en`, field.key);

        const rules = field.rules || {};
        const maxLength = rules.maxLength || (field.type === 'text' ? 5000 : undefined);
        const step = rules.step ?? (rules.integer || rules.rupees ? 1 : field.type === 'number' ? 'any' : undefined);
        const inputMode = field.key === 'phone'
          ? 'tel'
          : field.type === 'number'
          ? (rules.integer || rules.rupees ? 'numeric' : 'decimal')
          : undefined;

        return (
          <div
            key={field.key}
            className={`${field.key === 'address' ? 'sm:col-span-2' : ''} flex flex-col justify-start`}
          >
            <label
              htmlFor={fieldId}
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              <span className="font-semibold text-slate-800">{siLabel}</span>
              <span className="text-slate-500 font-normal ml-1">({enLabel})</span>
              {(field.required || rules.required) && <span className="text-red-500 ml-1">*</span>}
            </label>

            {/* Select Dropdown */}
            {field.type === 'select' ? (
              <select
                id={fieldId}
                aria-label={`${siLabel} (${enLabel})`}
                aria-required={(field.required || rules.required) ? 'true' : 'false'}
                aria-invalid={Boolean(errorText)}
                aria-describedby={errorText ? `${fieldId}-error` : undefined}
                value={rawValue}
                onChange={(e) => onChange(field.key, e.target.value)}
                onBlur={(e) => onBlur && onBlur(field.key, e.target.value)}
                className={`w-full px-3 py-2 rounded-control border text-sm outline-none transition-colors bg-white focus:border-primary ${
                  errorText ? 'border-red-500 bg-red-50/20' : 'border-border'
                }`}
              >
                <option value="">{`-- Select (${enLabel}) --`}</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {getOptionLabel(field.key, opt)}
                  </option>
                ))}
              </select>
            ) : field.key === 'address' ? (
              /* Address 2 lines */
              <textarea
                id={fieldId}
                rows={2}
                maxLength={maxLength}
                aria-label={`${siLabel} (${enLabel})`}
                aria-required={(field.required || rules.required) ? 'true' : 'false'}
                aria-invalid={Boolean(errorText)}
                aria-describedby={errorText ? `${fieldId}-error` : undefined}
                value={rawValue}
                onChange={(e) => onChange(field.key, e.target.value)}
                onBlur={(e) => onBlur && onBlur(field.key, e.target.value)}
                onPaste={(e) => handlePaste(e, field)}
                placeholder="Line 1&#10;Line 2"
                className={`w-full px-3 py-2 rounded-control border text-sm outline-none transition-colors focus:border-primary resize-none ${
                  errorText ? 'border-red-500 bg-red-50/20' : 'border-border'
                }`}
              />
            ) : isComputed ? (
              /* Computed Readonly */
              <div
                id={fieldId}
                aria-label={`${siLabel} (${enLabel})`}
                className="w-full px-3 py-2 rounded-control border border-slate-200 bg-slate-50 text-slate-700 font-semibold text-sm select-none"
              >
                {displayValue} {t('setup.options.acre.si', 'අක්කර')} ({displayValue} acres)
              </div>
            ) : (
              /* Standard Input */
              <input
                id={fieldId}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                step={step}
                inputMode={inputMode}
                maxLength={maxLength}
                aria-label={`${siLabel} (${enLabel})`}
                aria-required={(field.required || rules.required) ? 'true' : 'false'}
                aria-invalid={Boolean(errorText)}
                aria-describedby={errorText ? `${fieldId}-error` : field.key === 'landCode' ? `${fieldId}-helper` : undefined}
                value={rawValue}
                onChange={(e) => onChange(field.key, e.target.value)}
                onBlur={(e) => onBlur && onBlur(field.key, e.target.value)}
                onPaste={(e) => handlePaste(e, field)}
                className={`w-full px-3 py-2 rounded-control border text-sm outline-none transition-colors focus:border-primary ${
                  errorText ? 'border-red-500 bg-red-50/20' : 'border-border'
                }`}
              />
            )}

            {/* Helper Text for Land Code */}
            {field.key === 'landCode' && (
              <p id={`${fieldId}-helper`} className="text-[11px] text-slate-500 mt-1">
                {t('setup.helpers.landCode', 'any easy number you choose, used on every page')}
              </p>
            )}

            {/* Inline Error Message */}
            {errorText && (
              <p
                id={`${fieldId}-error`}
                role="alert"
                className="text-xs text-red-600 font-medium mt-1"
              >
                {errorText}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
