import React from 'react';
import { TrendingUp, Award, Target, Users, BarChart3, CheckCircle } from 'lucide-react';

const Performance = () => {
  return (
    <div>
      <div style={{ marginBottom: '22px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Territory Performance & Target Scorecard
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Quarterly merchant onboarding goals, active merchant retention rates, and onboarding benchmarks
        </p>
      </div>

      <div className="forge-kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="forge-kpi-card">
          <div className="kpi-main-title">Quarter Target Achieved</div>
          <div className="kpi-main-value" style={{ color: '#16a34a' }}>92.4%</div>
          <div className="kpi-card-footer"><span>Goal: 10,000 Outlets</span></div>
        </div>

        <div className="forge-kpi-card">
          <div className="kpi-main-title">Active Merchant Network</div>
          <div className="kpi-main-value">8,428</div>
          <div className="kpi-card-footer"><span>+18.6% Onboarding Growth</span></div>
        </div>

        <div className="forge-kpi-card">
          <div className="kpi-main-title">Average KYC SLA</div>
          <div className="kpi-main-value" style={{ color: '#0284c7' }}>18 Hrs</div>
          <div className="kpi-card-footer"><span>Target: &lt; 24 Hrs</span></div>
        </div>

        <div className="forge-kpi-card">
          <div className="kpi-main-title">Merchant Retention</div>
          <div className="kpi-main-value" style={{ color: '#d97706' }}>96.2%</div>
          <div className="kpi-card-footer"><span>Low churn rate</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Quarterly Performance Benchmarks</h3>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            All 4 manager tiers are meeting key performance indicators (KPIs) for Q3 2026. Review territory expansion guidelines in the reports module.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-normal)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>State Operations Command</div>
              <div style={{ fontSize: '0.8rem', color: '#15803d' }}>● Top rank in regional onboarding</div>
            </div>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-normal)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>District Clusters</div>
              <div style={{ fontSize: '0.8rem', color: '#0284c7' }}>● 100% division coverage achieved</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Performance;
