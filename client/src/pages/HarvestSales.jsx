import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../utils/api.js';
import { useToast } from '../components/Toast.jsx';
import SectionCard from '../components/SectionCard.jsx';
import SchemaFormRenderer from '../components/SchemaFormRenderer.jsx';
import WarningBanner from '../components/WarningBanner.jsx';
import { harvestSchema } from '../../../shared/formSchemas/harvest.js';
import { saleSchema } from '../../../shared/formSchemas/sale.js';
import { validateEntity } from '../../../shared/validation/index.js';
import { formatCurrency } from '../utils/formatters.js';
import { AlertCircle, Plus, Edit2, Trash2, RotateCcw, Lock, CheckCircle2 } from 'lucide-react';

export default function HarvestSales() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast() || {};

  // Form states
  const [harvestForm, setHarvestForm] = useState({ round: 1, harvestDate: '', yield: '' });
  const [editingHarvestId, setEditingHarvestId] = useState(null);
  const [harvestErrors, setHarvestErrors] = useState({});
  const [harvestWarnings, setHarvestWarnings] = useState([]);

  const [saleForm, setSaleForm] = useState({ round: 1, saleDate: '', quantitySold: '', income: '', soldTo: '' });
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [saleErrors, setSaleErrors] = useState({});
  const [saleWarnings, setSaleWarnings] = useState([]);

  // 1. Fetch cycles to identify active cycle
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

  // 2. Fetch Harvests
  const { data: harvestsData, isLoading: isHarvestsLoading } = useQuery({
    queryKey: ['harvests', cycleId],
    queryFn: () => apiFetch(`/harvests?cycleId=${cycleId}`),
    enabled: Boolean(cycleId),
  });

  const harvests = useMemo(() => {
    if (!harvestsData) return [];
    return harvestsData.items || (Array.isArray(harvestsData) ? harvestsData : []);
  }, [harvestsData]);

  // 3. Fetch Sales
  const { data: salesData, isLoading: isSalesLoading } = useQuery({
    queryKey: ['sales', cycleId],
    queryFn: () => apiFetch(`/sales?cycleId=${cycleId}`),
    enabled: Boolean(cycleId),
  });

  const sales = useMemo(() => {
    if (!salesData) return [];
    return salesData.items || (Array.isArray(salesData) ? salesData : []);
  }, [salesData]);

  // 4. Computed Totals
  const totalHarvest = useMemo(() => {
    return harvests.reduce((acc, h) => acc + (Number(h.yield) || 0), 0);
  }, [harvests]);

  const totalSold = useMemo(() => {
    return sales.reduce((acc, s) => acc + (Number(s.quantitySold) || 0), 0);
  }, [sales]);

  const totalIncome = useMemo(() => {
    return sales.reduce((acc, s) => acc + (Number(s.income) || 0), 0);
  }, [sales]);

  const soldExceedsHarvest = totalSold > totalHarvest;

  // Auto-set default next round
  const nextHarvestRound = useMemo(() => {
    if (harvests.length === 0) return 1;
    const max = Math.max(...harvests.map(h => Number(h.round) || 0));
    return max + 1;
  }, [harvests]);

  const nextSaleRound = useMemo(() => {
    if (sales.length === 0) return 1;
    const max = Math.max(...sales.map(s => Number(s.round) || 0));
    return max + 1;
  }, [sales]);

  // Harvest Mutations
  const saveHarvestMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingHarvestId) {
        return apiFetch(`/harvests/${editingHarvestId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      return apiFetch('/harvests', {
        method: 'POST',
        body: JSON.stringify({ ...payload, clientRequestId: `harvest-${Date.now()}` }),
      });
    },
    onSuccess: (savedDoc) => {
      if (savedDoc) {
        queryClient.setQueryData(['harvests', cycleId], (old) => {
          if (!old) return { items: [savedDoc], total: 1 };
          const items = old.items || (Array.isArray(old) ? old : []);
          const exists = items.some(x => x._id === savedDoc._id);
          const newItems = exists ? items.map(x => x._id === savedDoc._id ? savedDoc : x) : [...items, savedDoc];
          return Array.isArray(old) ? newItems : { ...old, items: newItems, total: (old.total || items.length) + (exists ? 0 : 1) };
        });
      }
      queryClient.invalidateQueries({ queryKey: ['harvests', cycleId] });
      queryClient.invalidateQueries({ queryKey: ['cycleSummary', cycleId] });
      setHarvestForm({ round: nextHarvestRound, harvestDate: '', yield: '' });
      setEditingHarvestId(null);
      setHarvestErrors({});
      if (savedDoc?.warnings?.length) {
        setHarvestWarnings(savedDoc.warnings);
      } else {
        setHarvestWarnings([]);
      }
      if (showToast) showToast('Harvest saved successfully', 'success');
    },
    onError: (err) => {
      if (err.fields) {
        setHarvestErrors(err.fields);
      } else {
        setHarvestErrors({ form: err.message });
      }
    },
  });

  const deleteHarvestMutation = useMutation({
    mutationFn: (id) => apiFetch(`/harvests/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['harvests', cycleId] });
      queryClient.invalidateQueries({ queryKey: ['cycleSummary', cycleId] });
      if (showToast) {
        showToast(t('harvestSales.deletedSuccess', 'Item deleted'), 'info', {
          actionText: t('harvestSales.undo', 'Undo'),
          onAction: () => restoreHarvestMutation.mutate(id),
          duration: 10000,
        });
      }
    },
  });

  const restoreHarvestMutation = useMutation({
    mutationFn: (id) => apiFetch(`/harvests/${id}/restore`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvests', cycleId] });
      queryClient.invalidateQueries({ queryKey: ['cycleSummary', cycleId] });
      if (showToast) showToast(t('harvestSales.restoredSuccess', 'Restored successfully'), 'success');
    },
  });

  // Sale Mutations
  const saveSaleMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingSaleId) {
        return apiFetch(`/sales/${editingSaleId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      return apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify({ ...payload, clientRequestId: `sale-${Date.now()}` }),
      });
    },
    onSuccess: (savedDoc) => {
      if (savedDoc) {
        queryClient.setQueryData(['sales', cycleId], (old) => {
          if (!old) return { items: [savedDoc], total: 1 };
          const items = old.items || (Array.isArray(old) ? old : []);
          const exists = items.some(x => x._id === savedDoc._id);
          const newItems = exists ? items.map(x => x._id === savedDoc._id ? savedDoc : x) : [...items, savedDoc];
          return Array.isArray(old) ? newItems : { ...old, items: newItems, total: (old.total || items.length) + (exists ? 0 : 1) };
        });
      }
      queryClient.invalidateQueries({ queryKey: ['sales', cycleId] });
      queryClient.invalidateQueries({ queryKey: ['cycleSummary', cycleId] });
      setSaleForm({ round: nextSaleRound, saleDate: '', quantitySold: '', income: '', soldTo: '' });
      setEditingSaleId(null);
      setSaleErrors({});
      if (savedDoc?.warnings?.length) {
        setSaleWarnings(savedDoc.warnings);
      } else {
        setSaleWarnings([]);
      }
      if (showToast) showToast('Sale saved successfully', 'success');
    },
    onError: (err) => {
      if (err.fields) {
        setSaleErrors(err.fields);
      } else {
        setSaleErrors({ form: err.message });
      }
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: (id) => apiFetch(`/sales/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['sales', cycleId] });
      queryClient.invalidateQueries({ queryKey: ['cycleSummary', cycleId] });
      if (showToast) {
        showToast(t('harvestSales.deletedSuccess', 'Item deleted'), 'info', {
          actionText: t('harvestSales.undo', 'Undo'),
          onAction: () => restoreSaleMutation.mutate(id),
          duration: 10000,
        });
      }
    },
  });

  const restoreSaleMutation = useMutation({
    mutationFn: (id) => apiFetch(`/sales/${id}/restore`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', cycleId] });
      queryClient.invalidateQueries({ queryKey: ['cycleSummary', cycleId] });
      if (showToast) showToast(t('harvestSales.restoredSuccess', 'Restored successfully'), 'success');
    },
  });

  // Handlers
  const handleHarvestSubmit = (e) => {
    e.preventDefault();
    setHarvestWarnings([]);
    const res = validateEntity(harvestSchema, harvestForm, { strict: false });
    const errors = {};
    for (const [k, errList] of Object.entries(res.errors)) {
      if (errList.length > 0) errors[k] = errList[0].message;
    }
    if (activeCycle?.startDate && harvestForm.harvestDate) {
      if (new Date(harvestForm.harvestDate) < new Date(activeCycle.startDate)) {
        errors.harvestDate = 'Harvest date cannot be before cycle start date';
      }
    }
    if (Object.keys(errors).length > 0) {
      setHarvestErrors(errors);
      const firstKey = Object.keys(errors)[0];
      document.getElementById(`harvest-${firstKey.replace(/\./g, '-')}`)?.focus();
      return;
    }
    if (!cycleId) return;
    setHarvestErrors({});
    saveHarvestMutation.mutate({
      cycleId,
      round: Number(harvestForm.round) || nextHarvestRound,
      harvestDate: harvestForm.harvestDate || undefined,
      yield: Number(harvestForm.yield),
    });
  };

  const handleSaleSubmit = (e) => {
    e.preventDefault();
    setSaleWarnings([]);
    const res = validateEntity(saleSchema, saleForm, { strict: false });
    const errors = {};
    for (const [k, errList] of Object.entries(res.errors)) {
      if (errList.length > 0) errors[k] = errList[0].message;
    }
    if (Object.keys(errors).length > 0) {
      setSaleErrors(errors);
      const firstKey = Object.keys(errors)[0];
      document.getElementById(`sale-${firstKey.replace(/\./g, '-')}`)?.focus();
      return;
    }
    if (!cycleId) return;
    setSaleErrors({});
    saveSaleMutation.mutate({
      cycleId,
      round: Number(saleForm.round) || nextSaleRound,
      saleDate: saleForm.saleDate || undefined,
      quantitySold: Number(saleForm.quantitySold),
      income: Math.round(Number(saleForm.income)),
      soldTo: saleForm.soldTo || undefined,
    });
  };

  return (
    <div className="space-y-6 pb-12" id="harvest-sales-page">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t('harvestSales.title', 'Harvest & Sales')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('harvestSales.subtitle', 'Record crop harvest rounds and sales income for the active cycle')}
        </p>
      </div>

      {/* Closed Cycle Banner */}
      {isClosed && (
        <div id="cycle-closed-banner" className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-800 text-sm font-medium">
          <Lock size={18} className="shrink-0 text-amber-600" />
          <span>{t('harvestSales.cycleClosedWarning', 'This cultivation cycle is closed and read-only. Further edits cannot be saved.')}</span>
        </div>
      )}

      {/* Total Sold Exceeds Harvest Warning Banner */}
      {soldExceedsHarvest && (
        <div id="sold-exceeds-harvest-warning" className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-800 text-sm font-medium">
          <AlertCircle size={18} className="shrink-0 text-amber-600" />
          <span>
            {t('harvestSales.warningSoldExceedsHarvest', 'Warning: Total quantity sold exceeds total quantity harvested')}
            {' '}({totalSold} kg sold vs {totalHarvest} kg harvested)
          </span>
        </div>
      )}

      {/* ─── SECTION 1: HARVEST (කන්නය තුල අස්වැන්න) ─────────────────────────── */}
      <SectionCard number="1" title={t('harvestSales.section1Title', 'Harvest Rounds (කන්නය තුල අස්වැන්න)')}>
        <div className="space-y-6">
          {/* Header Metric */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl">
            <div>
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                {t('harvestSales.totalYield', 'Total Yield')}
              </span>
              <span className="text-2xl font-bold text-emerald-950" id="total-harvest-display">
                {totalHarvest.toLocaleString()} kg
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {harvests.length} {t('harvestSales.round', 'Rounds Recorded')}
            </div>
          </div>

          {/* Harvest Form */}
          {!isClosed && (
            <div className="space-y-4">
              {harvestWarnings.length > 0 && (
                <WarningBanner warnings={harvestWarnings} onDismiss={() => setHarvestWarnings([])} />
              )}
              <form onSubmit={handleHarvestSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-800">
                {editingHarvestId ? t('harvestSales.editHarvest', 'Edit Harvest Round') : t('harvestSales.addHarvest', 'Add Harvest Round')}
              </h3>

              {harvestErrors.form && (
                <p className="text-xs text-red-600 font-medium" role="alert">{harvestErrors.form}</p>
              )}

              <SchemaFormRenderer
                schema={harvestSchema}
                values={harvestForm}
                onChange={(key, val) => setHarvestForm(prev => ({ ...prev, [key]: val }))}
                errors={harvestErrors}
                idPrefix="harvest"
                columns={3}
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  id="save-harvest-btn"
                  disabled={saveHarvestMutation.isPending || !cycleId}
                  className="px-4 py-2 bg-primary hover:bg-navActive text-white text-xs font-bold rounded-control transition-colors disabled:opacity-50"
                >
                  {saveHarvestMutation.isPending ? '...' : (editingHarvestId ? t('harvestSales.saveHarvest', 'Save Harvest') : t('harvestSales.addHarvest', 'Add Round'))}
                </button>
                {editingHarvestId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHarvestId(null);
                      setHarvestForm({ round: nextHarvestRound, harvestDate: '', yield: '' });
                      setHarvestErrors({});
                    }}
                    className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-control transition-colors"
                  >
                    {t('harvestSales.cancel', 'Cancel')}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

          {/* Harvests List / Table */}
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs" id="harvests-table">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-border">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{t('harvestSales.round', 'Round')}</th>
                  <th className="p-3">{t('harvestSales.harvestDate', 'Harvest Date')}</th>
                  <th className="p-3 text-right">{t('harvestSales.yield', 'Yield (kg)')}</th>
                  {!isClosed && <th className="p-3 text-right">{t('harvestSales.actions', 'Actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {harvests.length === 0 ? (
                  <tr>
                    <td colSpan={isClosed ? 4 : 5} className="p-6 text-center text-slate-400">
                      {t('harvestSales.noHarvests', 'No harvest rounds recorded yet.')}
                    </td>
                  </tr>
                ) : (
                  harvests.map((h, idx) => (
                    <tr key={h._id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{h.round}</td>
                      <td className="p-3 text-slate-700">{h.harvestDate ? new Date(h.harvestDate).toLocaleDateString() : '—'}</td>
                      <td className="p-3 text-right font-semibold text-emerald-700">{h.yield} kg</td>
                      {!isClosed && (
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingHarvestId(h._id);
                                setHarvestForm({
                                  round: h.round,
                                  harvestDate: h.harvestDate ? h.harvestDate.slice(0, 10) : '',
                                  yield: h.yield,
                                });
                              }}
                              className="p-1.5 text-slate-500 hover:text-primary transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteHarvestMutation.mutate(h._id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* ─── SECTION 2: SALES (කන්නය තුල ආදායම) ───────────────────────────── */}
      <SectionCard number="2" title={t('harvestSales.section2Title', 'Sales & Income (කන්නය තුල ආදායම)')}>
        <div className="space-y-6">
          {/* Header Metric */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-sky-50/60 border border-sky-200 rounded-xl">
            <div>
              <span className="text-xs font-semibold text-sky-800 uppercase tracking-wider block">
                {t('harvestSales.totalIncome', 'Total Income')}
              </span>
              <span className="text-2xl font-bold text-sky-950" id="total-income-display">
                {formatCurrency(totalIncome)}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              <span className="font-semibold text-slate-700">{totalSold.toLocaleString()} kg</span> {t('harvestSales.totalSold', 'Total Sold')} ({sales.length} rounds)
            </div>
          </div>

          {/* Sales Form */}
          {!isClosed && (
            <div className="space-y-4">
              {saleWarnings.length > 0 && (
                <WarningBanner warnings={saleWarnings} onDismiss={() => setSaleWarnings([])} />
              )}
              <form onSubmit={handleSaleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-800">
                  {editingSaleId ? t('harvestSales.editSale', 'Edit Sale Round') : t('harvestSales.addSale', 'Add Sale Round')}
                </h3>

                {saleErrors.form && (
                  <p className="text-xs text-red-600 font-medium" role="alert">{saleErrors.form}</p>
                )}

                <SchemaFormRenderer
                  schema={saleSchema}
                  values={saleForm}
                  onChange={(key, val) => setSaleForm(prev => ({ ...prev, [key]: val }))}
                  errors={saleErrors}
                  idPrefix="sale"
                  columns={3}
                />

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    id="save-sale-btn"
                    disabled={saveSaleMutation.isPending || !cycleId}
                    className="px-4 py-2 bg-primary hover:bg-navActive text-white text-xs font-bold rounded-control transition-colors disabled:opacity-50"
                  >
                    {saveSaleMutation.isPending ? '...' : (editingSaleId ? t('harvestSales.saveSale', 'Save Sale') : t('harvestSales.addSale', 'Add Sale'))}
                  </button>
                  {editingSaleId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSaleId(null);
                        setSaleForm({ round: nextSaleRound, saleDate: '', quantitySold: '', income: '', soldTo: '' });
                        setSaleErrors({});
                      }}
                      className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-control transition-colors"
                    >
                      {t('harvestSales.cancel', 'Cancel')}
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Sales List / Table */}
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs" id="sales-table">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-border">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{t('harvestSales.round', 'Round')}</th>
                  <th className="p-3">{t('harvestSales.saleDate', 'Sale Date')}</th>
                  <th className="p-3 text-right">{t('harvestSales.quantitySold', 'Quantity Sold (kg)')}</th>
                  <th className="p-3 text-right">{t('harvestSales.income', 'Income (Rs.)')}</th>
                  <th className="p-3">{t('harvestSales.soldTo', 'Buyer')}</th>
                  {!isClosed && <th className="p-3 text-right">{t('harvestSales.actions', 'Actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={isClosed ? 6 : 7} className="p-6 text-center text-slate-400">
                      {t('harvestSales.noSales', 'No sales rounds recorded yet.')}
                    </td>
                  </tr>
                ) : (
                  sales.map((s, idx) => (
                    <tr key={s._id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{s.round}</td>
                      <td className="p-3 text-slate-700">{s.saleDate ? new Date(s.saleDate).toLocaleDateString() : '—'}</td>
                      <td className="p-3 text-right font-semibold text-slate-800">{s.quantitySold} kg</td>
                      <td className="p-3 text-right font-bold text-sky-800">{formatCurrency(s.income)}</td>
                      <td className="p-3 text-slate-600">{s.soldTo || '—'}</td>
                      {!isClosed && (
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSaleId(s._id);
                                setSaleForm({
                                  round: s.round,
                                  saleDate: s.saleDate ? s.saleDate.slice(0, 10) : '',
                                  quantitySold: s.quantitySold,
                                  income: s.income,
                                  soldTo: s.soldTo || '',
                                });
                              }}
                              className="p-1.5 text-slate-500 hover:text-primary transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSaleMutation.mutate(s._id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
