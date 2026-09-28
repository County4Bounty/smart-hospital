import React from 'react';

function latestReading(readings, patientId) {
  return (readings[patientId] || []).at(-1);
}

function hasOpenAlert(alerts, patientId, alertType) {
  return alerts.some((alert) => alert.patientId === patientId && alert.alertType === alertType && alert.status === 'open');
}

export default function Patients({ patients, readings, alerts }) {
  return (
    <div className="v-view">
      <div className="section-heading v-page-header">
        <div>
          <p className="eyebrow">PATIENTS</p>
          <h1>All patients</h1>
          <p className="subtle">Current patients monitored by the system.</p>
        </div>
      </div>
      <div className="patient-grid v-card-grid">
        {patients.map((patient) => {
          const latest = latestReading(readings, patient.patientId);
          const statusClass = patient.status ? patient.status.toLowerCase() : '';
          return <article className="patient v-view-card" key={patient.patientId}>
            <div className="patient-top">
              <div>
                <span className={`status ${statusClass} v-status-pill`}>{patient.status || 'Unknown'}</span>
                <h3>{patient.name}</h3>
                <p>{patient.patientId} · {patient.roomNumber}</p>
              </div>
            </div>
            <div className="vitals">
              <div className={`v-vital-tile ${hasOpenAlert(alerts, patient.patientId, 'heartRate_high') ? 'v-alert-red' : ''}`}><span>Heart rate</span><strong>{latest?.heartRate ?? '--'} bpm</strong></div>
              <div className={`v-vital-tile ${hasOpenAlert(alerts, patient.patientId, 'spo2_low') ? 'v-alert-amber' : ''}`}><span>SpO2</span><strong>{latest?.spo2 ?? '--'}%</strong></div>
              <div className={`v-vital-tile ${hasOpenAlert(alerts, patient.patientId, 'temperature_high') ? 'v-alert-red' : ''}`}><span>Temperature</span><strong>{latest?.temperature ?? '--'} C</strong></div>
            </div>
          </article>;
        })}
      </div>
    </div>
  );
}
