import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportService, taskService } from '../services/api';
import { resolveUserTerritoryProfile, isTaskInManagerTerritory, buildTerritoryQueryParams } from '../utils/territoryScoping';
import {
  Calendar,
  Clock,
  Store,
  CheckCircle2,
  XCircle,
  Mic,
  Image as ImageIcon,
  CheckSquare,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  ChevronLeft,
  X,
  User,
  MapPin,
  Tag,
  ShieldCheck,
  Send,
  Sparkles,
  Info,
  Award
} from 'lucide-react';

const PERIOD_PRESETS = [
  { id: 'today', label: 'Today', description: 'Visits and tasks recorded today' },
  { id: 'last_7_days', label: 'Last 7 Days', description: 'Weekly activity summary (recommended)' },
  { id: 'last_30_days', label: 'Last 30 Days', description: 'Full monthly performance report' },
  { id: 'custom', label: 'Custom Date Range', description: 'Specify custom start and end dates' }
];

export default function GenerateReportModal({ onClose, onReportSubmitted, allVisits = [] }) {
  const { user } = useAuth();
  const territoryProfile = useMemo(() => resolveUserTerritoryProfile(user), [user]);
  const [allTasks, setAllTasks] = useState([]);

  // Fetch real tasks from database strictly within manager territory
  useEffect(() => {
    let isMounted = true;
    const queryParams = buildTerritoryQueryParams(territoryProfile);
    taskService.getTasks(queryParams).then(res => {
      if (res && res.success && Array.isArray(res.data) && isMounted) {
        const scopedTasks = res.data.filter(t => isTaskInManagerTerritory(t, territoryProfile));
        setAllTasks(scopedTasks);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [territoryProfile]);

  // Wizard Steps: 'select_period' | 'preview'
  const [step, setStep] = useState('select_period');
  const [selectedPreset, setSelectedPreset] = useState('last_7_days');

  // Custom Date Range
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Confirm Submit Dialog State
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // 1. Calculate Date Range Bounds
  const { startDate, endDate, dateRangeLabel, periodTitle } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let title = 'Last 7 Days';

    if (selectedPreset === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      title = 'Today';
    } else if (selectedPreset === 'last_7_days') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      title = 'Last 7 Days';
    } else if (selectedPreset === 'last_30_days') {
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      title = 'Last 30 Days';
    } else if (selectedPreset === 'custom') {
      start = new Date(customFrom + 'T00:00:00');
      end = new Date(customTo + 'T23:59:59');
      title = 'Custom Range';
    }

    const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const rangeStr = startStr === endStr ? startStr : `${startStr} – ${endStr}`;

    return {
      startDate: start,
      endDate: end,
      dateRangeLabel: rangeStr,
      periodTitle: title
    };
  }, [selectedPreset, customFrom, customTo]);

  // 2. Filter Live Shop Visits for the Period
  const periodVisits = useMemo(() => {
    return allVisits.filter(v => {
      if (!v.createdAt) return true;
      const vDate = new Date(v.createdAt);
      return vDate >= startDate && vDate <= endDate;
    });
  }, [allVisits, startDate, endDate]);

  // 3. Filter Live Database Tasks for the Period
  const periodTasks = useMemo(() => {
    return allTasks.filter(t => {
      if (!t.dueDate && !t.createdAt) return true;
      const tDate = new Date(t.dueDate || t.createdAt);
      return tDate >= startDate && tDate <= endDate;
    });
  }, [allTasks, startDate, endDate]);

  // 4. Compute Dynamic Summary Statistics
  const summary = useMemo(() => {
    const totalVisits = periodVisits.length;
    const interested = periodVisits.filter(v => v.interestedStatus === 'YES').length;
    const notInterested = periodVisits.filter(v => v.interestedStatus === 'NO').length;
    const newTieups = periodVisits.filter(v => v.vendorId).length;

    const tasksAssigned = periodTasks.length;
    const tasksCompleted = periodTasks.filter(t => t.status === 'Completed').length;
    const tasksPending = periodTasks.filter(t => t.status !== 'Completed').length;

    return {
      totalVisits,
      interested,
      notInterested,
      newTieups,
      tasksAssigned,
      tasksCompleted,
      tasksPending
    };
  }, [periodVisits, periodTasks]);

  // 5. Submit Handler
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        periodLabel: `${periodTitle} (${dateRangeLabel})`,
        dateRange: dateRangeLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary,
        shopVisits: periodVisits,
        tasks: periodTasks
      };

      const res = await reportService.submitReport(payload);
      if (res && res.success) {
        if (onReportSubmitted) onReportSubmitted(res.data);
        onClose();
      } else {
        setSubmitError(res?.message || 'Failed to submit report. Please try again.');
        setShowConfirmDialog(false);
      }
    } catch (err) {
      console.error('Failed to submit report:', err);
      setSubmitError(err.message || 'Submission error');
      setShowConfirmDialog(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)'
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} />

      {/* Modal Window */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: step === 'preview' ? '880px' : '560px',
        maxHeight: 'min(92vh, 860px)',
        background: 'var(--bg-card)',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-normal)',
        zIndex: 1,
        transition: 'max-width 0.25s ease'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-normal)',
          background: 'var(--bg-subtle)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(2, 132, 199, 0.15)',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                {step === 'select_period' ? 'Generate Field Performance Report' : 'Report Preview & Verification'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {step === 'select_period'
                  ? 'Select report period to automatically ingest shop visits and task records'
                  : `Reviewing aggregated data for ${dateRangeLabel}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border-normal)',
              background: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {submitError && (
            <div style={{
              padding: '10px 14px',
              background: '#fee2e2',
              color: '#b91c1c',
              borderRadius: 10,
              fontSize: '0.84rem',
              fontWeight: 600,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          {step === 'select_period' ? (
            /* STEP 1: SELECT PERIOD */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#475569' }}>
                Choose Report Timeframe:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PERIOD_PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        borderRadius: 12,
                        border: isSelected ? '2px solid #0284c7' : '1px solid var(--border-normal)',
                        background: isSelected ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: isSelected ? '5px solid #0284c7' : '2px solid var(--border-normal)',
                          background: 'var(--bg-card)',
                          flexShrink: 0
                        }} />
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                            {preset.label}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {preset.description}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircle2 size={18} style={{ color: '#0284c7' }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Custom Date Range Inputs */}
              {selectedPreset === 'custom' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                  padding: '14px 16px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 12,
                  border: '1px solid var(--border-normal)'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      From Date:
                    </label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      To Date:
                    </label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Auto Ingestion Notice */}
              <div style={{
                padding: '12px 14px',
                background: '#ecfdf5',
                borderRadius: 10,
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: '0.8rem',
                color: '#065f46'
              }}>
                <Sparkles size={16} style={{ color: '#059669', flexShrink: 0 }} />
                <span>
                  All <strong>Shop Visits</strong>, merchant audio notes, and <strong>Task completion records</strong> will be automatically gathered without manual re-entry.
                </span>
              </div>
            </div>
          ) : (
            /* STEP 2: REPORT PREVIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Report Header Card */}
              <div style={{
                padding: '16px 20px',
                background: 'var(--bg-subtle)',
                borderRadius: 14,
                border: '1px solid var(--border-normal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      background: 'rgba(2, 132, 199, 0.15)',
                      color: '#0284c7',
                      padding: '2px 8px',
                      borderRadius: 6
                    }}>
                      {user?.role?.replace(/_/g, ' ').toUpperCase() || 'PINCODE MANAGER'}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {user?.name || 'Field Manager'}
                    </h4>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={13} />
                    <span>PIN: {user?.pincode || '635112'} • {user?.division || 'Division'} • {user?.district || 'District'}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Report Period
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {dateRangeLabel}
                  </div>
                </div>
              </div>

              {/* 4. KPI Summary Cards */}
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 10 }}>
                  Report Performance Summary
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10
                }}>
                  <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 10, border: '1px solid var(--border-normal)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Total Visits</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{summary.totalVisits}</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>Interested</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{summary.interested}</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>Not Interested</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>{summary.notInterested}</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(2, 132, 199, 0.12)', borderRadius: 10, border: '1px solid rgba(2, 132, 199, 0.25)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0284c7' }}>New Tie-ups</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>{summary.newTieups}</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: 10, border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Tasks Done</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{summary.tasksCompleted}</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.12)', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>Tasks Pending</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706' }}>{summary.tasksPending}</div>
                  </div>
                </div>
              </div>

              {/* 2. Shop Visit Details Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Store size={16} style={{ color: '#f59e0b' }} />
                    <span>Shop Visit Details ({periodVisits.length})</span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Includes photos, status, and audio notes</span>
                </div>

                {periodVisits.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: 10, border: '1px solid var(--border-normal)', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    No shop visits recorded in this period.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {periodVisits.map((v, idx) => (
                      <div
                        key={v._id || v.id || idx}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 12,
                          border: '1px solid var(--border-normal)',
                          background: 'var(--bg-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap'
                        }}
                      >
                        {/* Photo + Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 240 }}>
                          {v.shopPhoto ? (
                            <img
                              src={v.shopPhoto}
                              alt={v.shopName}
                              style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-normal)', flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                              <ImageIcon size={22} />
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
                                {v.category || 'Products'}
                              </span>
                              <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{v.shopName}</strong>
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 3 }}>
                              PIN: {v.pincodeCode || v.pincode || '635112'} • {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}
                            </div>
                            {v.vendorId && (
                              <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={11} /> Tie-up Created (ID: {v.vendorId})
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status & Voice Note */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                          {/* Interest Badge */}
                          {v.interestedStatus === 'YES' ? (
                            <span style={{ fontSize: '0.76rem', fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: '#d1fae5', color: '#047857', border: '1px solid #a7f3d0' }}>
                              Interested
                            </span>
                          ) : (
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.76rem', fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                                Not Interested
                              </span>
                              {v.notInterestedReason && (
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2, maxWidth: 160 }}>
                                  {v.notInterestedReason}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Voice Note Audio */}
                          {v.voiceNote && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <audio controls src={v.voiceNote} style={{ height: 28, maxWidth: 160 }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Task Details Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckSquare size={16} style={{ color: '#0284c7' }} />
                    <span>Tasks Assigned &amp; Completed ({periodTasks.length})</span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Physical KYC, starter kit delivery &amp; audits</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {periodTasks.map((t, idx) => {
                    const isCompleted = t.status === 'Completed';
                    return (
                      <div
                        key={t.id || idx}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          background: isCompleted ? '#f8fafc' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: isCompleted ? '#d1fae5' : '#fef3c7',
                              color: isCompleted ? '#047857' : '#b45309'
                            }}>
                              {t.status}
                            </span>
                            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                              {t.title}
                            </span>
                          </div>
                          {t.description && (
                            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 3 }}>
                              {t.description}
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: '0.76rem', color: '#64748b', textAlign: 'right' }}>
                          <div>Due: {t.dueDate || '22 Sep 2026'}</div>
                          {t.completionDetails && (
                            <div style={{ color: '#059669', fontWeight: 600, marginTop: 2 }}>
                              {typeof t.completionDetails === 'string'
                                ? t.completionDetails
                                : (t.completionDetails?.workCompleted || t.completionDetails?.resolutionDetails || t.completionDetails?.remarks || 'Completed')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderTop: '1px solid var(--border-normal)',
          background: 'var(--bg-subtle)',
          flexShrink: 0
        }}>
          {step === 'select_period' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 18px',
                  borderRadius: 9,
                  border: '1px solid var(--border-normal)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => setStep('preview')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 20px',
                  borderRadius: 9,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                }}
              >
                <span>Generate Report Preview</span>
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('select_period')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 18px',
                  borderRadius: 9,
                  border: '1px solid var(--border-normal)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer'
                }}
              >
                <ChevronLeft size={15} />
                <span>Back / Edit Period</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmDialog(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 22px',
                  borderRadius: 9,
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.28)'
                }}
              >
                <Send size={15} />
                <span>Confirm &amp; Submit</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* CONFIRMATION PROMPT DIALOG */}
      {showConfirmDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(15, 23, 42, 0.75)'
        }}>
          <div style={{
            width: '100%',
            maxWidth: 480,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-normal)',
            borderRadius: 16,
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            textAlign: 'center'
          }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <ShieldCheck size={26} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>
              Confirm Report Submission
            </h3>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 20px' }}>
              “Please verify that all shop visits, interest status, reasons, photos, voice notes, and task details are correct before submitting this report.”
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmDialog(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: '1px solid var(--border-normal)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: submitting ? 'not-allowed' : 'pointer'
                }}
              >
                Go Back &amp; Review
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalSubmit}
                style={{
                  padding: '9px 22px',
                  borderRadius: 8,
                  border: 'none',
                  background: submitting ? '#94a3b8' : '#10b981',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: submitting ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Submitting Report...' : 'Yes, Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
