import React from 'react';

function formatAge(timestamp) {
  if (!timestamp) return 'No stored reading';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  return minutes === 0 ? 'just now' : `${minutes} min ago`;
}

function sparklinePoints(readings, field) {
  const values = readings.slice(-20).map((reading) => Number(reading[field])).filter(Number.isFinite);
  if (!values.length) return '';
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  return values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${28 - ((value - min) / range) * 22}`).join(' ');
}

function Sparkline({ readings, field, label }) {
  return <svg className="v-sparkline" viewBox="0 0 100 30" role="img" aria-label={`${label} trend`}>
    <polyline points={sparklinePoints(readings, field) || '0,28 100,28'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export default function Monitoring({ patients, readings }) {
  return (
    <div className="v-view">
      <div className="section-heading v-page-header">
        <div>
          <p className="eyebrow">LIVE MONITORING</p>
          <h1>Latest stored readings</h1>
          <p className="subtle">Live updates while connected; otherwise latest stored readings.</p>
        </div>
      </div>
      <div className="v-monitor-list">
        {patients.map((patient) => {
          const patientReadings = readings[patient.patientId] || [];
          const latest = patientReadings.at(-1);
          const statusClass = patient.status ? patient.status.toLowerCase() : '';
          return <article className="patient v-view-card v-monitor-card" key={patient.patientId}>
            <div className="patient-top">
              <div>
                <span className={`status ${statusClass} v-status-pill`}>{patient.status || 'Unknown'}</span>
                <h3>{patient.name}</h3>
                <p>{patient.patientId} · {patient.roomNumber}</p>
              </div>
            </div>
            <div className="vitals">
              <div className="v-monitor-vital"><span>Heart rate</span><strong>{latest?.heartRate ?? '--'} bpm</strong><Sparkline readings={patientReadings} field="heartRate" label="Heart rate" /></div>
              <div className="v-monitor-vital"><span>SpO2</span><strong>{latest?.spo2 ?? '--'}%</strong><Sparkline readings={patientReadings} field="spo2" label="SpO2" /></div>
              <div className="v-monitor-vital"><span>Temperature</span><strong>{latest?.temperature ?? '--'} C</strong><Sparkline readings={patientReadings} field="temperature" label="Temperature" /></div>
            </div>
            <div className="patient-foot">
              <span>{formatAge(latest?.timestamp)}</span>
            </div>
          </article>;
        })}
      </div>
    </div>
  );
}
