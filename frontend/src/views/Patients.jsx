import React, { useMemo, useState } from 'react';

function latestReading(readings, patientId) {
  return (readings[patientId] || []).at(-1);
}

function hasOpenAlert(alerts, patientId, alertType) {
  return alerts.some((alert) => alert.patientId === patientId && alert.alertType === alertType && alert.status === 'open');
}

const emptyForm = {
  patientId: '',
  name: '',
  age: '',
  gender: 'Male',
  roomNumber: '',
  assignedDoctor: '',
  status: 'Stable'
};

export default function Patients({ patients, readings, alerts, currentUserRole, onAddPatient, onUpdatePatient }) {
  const isAdmin = currentUserRole === 'admin';
  const [formMode, setFormMode] = useState(null);
  const [formValues, setFormValues] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sortedPatients = useMemo(() => [...patients].sort((a, b) => a.name.localeCompare(b.name)), [patients]);

  function openAddForm() {
    setFormMode('add');
    setFormValues(emptyForm);
    setFormError('');
  }

  function openEditForm(patient) {
    setFormMode('edit');
    setFormValues({
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      roomNumber: patient.roomNumber,
      assignedDoctor: patient.assignedDoctor,
      status: patient.status
    });
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        ...formValues,
        age: Number(formValues.age),
        patientId: String(formValues.patientId).trim(),
        name: String(formValues.name).trim(),
        gender: String(formValues.gender).trim(),
        roomNumber: String(formValues.roomNumber).trim(),
        assignedDoctor: String(formValues.assignedDoctor).trim(),
        status: String(formValues.status).trim()
      };

      if (!payload.patientId || !payload.name || !payload.age || !payload.gender || !payload.roomNumber || !payload.assignedDoctor || !payload.status) {
        throw new Error('All fields are required.');
      }

      if (formMode === 'add') {
        await onAddPatient(payload);
      } else {
        await onUpdatePatient(formValues.patientId, payload);
      }
      setFormMode(null);
      setFormValues(emptyForm);
    } catch (error) {
      setFormError(error.response?.data?.message || error.message || 'Unable to save patient.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="v-view">
      <div className="section-heading v-page-header">
        <div>
          <p className="eyebrow">PATIENTS</p>
          <h1>All patients</h1>
          <p className="subtle">Current patients monitored by the system.</p>
        </div>
        {isAdmin && <button className="primary" onClick={openAddForm}>+ Add patient</button>}
      </div>

      {formMode && (
        <div className="panel" style={{ padding: '22px', marginBottom: '20px' }}>
          <div className="panel-head" style={{ marginBottom: '16px' }}>
            <div>
              <p className="eyebrow">{formMode === 'add' ? 'NEW PATIENT' : 'EDIT PATIENT'}</p>
              <h2>{formMode === 'add' ? 'Add patient' : 'Update patient'}</h2>
            </div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Patient ID</span>
                <input value={formValues.patientId} onChange={(event) => setFormValues((current) => ({ ...current, patientId: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required />
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Name</span>
                <input value={formValues.name} onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required />
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Age</span>
                <input type="number" min="0" value={formValues.age} onChange={(event) => setFormValues((current) => ({ ...current, age: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required />
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Gender</span>
                <select value={formValues.gender} onChange={(event) => setFormValues((current) => ({ ...current, gender: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Room number</span>
                <input value={formValues.roomNumber} onChange={(event) => setFormValues((current) => ({ ...current, roomNumber: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required />
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Assigned doctor</span>
                <input value={formValues.assignedDoctor} onChange={(event) => setFormValues((current) => ({ ...current, assignedDoctor: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required />
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Status</span>
                <select value={formValues.status} onChange={(event) => setFormValues((current) => ({ ...current, status: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }}>
                  <option value="Stable">Stable</option>
                  <option value="Watch">Watch</option>
                  <option value="Critical">Critical</option>
                </select>
              </label>
            </div>
            {formError && <div style={{ color: '#8b2d2d', background: '#fbe8e3', borderRadius: '8px', padding: '10px 12px' }}>{formError}</div>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="icon-btn" onClick={() => setFormMode(null)} style={{ width: 'auto', padding: '0 14px' }}>Cancel</button>
              <button type="submit" className="primary" disabled={submitting}>{submitting ? 'Saving...' : formMode === 'add' ? 'Create patient' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="patient-grid v-card-grid">
        {sortedPatients.map((patient) => {
          const latest = latestReading(readings, patient.patientId);
          const statusClass = patient.status ? patient.status.toLowerCase() : '';
          return <article className="patient v-view-card" key={patient.patientId}>
            <div className="patient-top">
              <div>
                <span className={`status ${statusClass} v-status-pill`}>{patient.status || 'Unknown'}</span>
                <h3>{patient.name}</h3>
                <p>{patient.patientId} · {patient.roomNumber}</p>
              </div>
              {isAdmin && <button className="text-button" onClick={() => openEditForm(patient)}>Edit</button>}
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
