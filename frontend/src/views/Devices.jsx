import React, { useEffect, useState } from 'react';

function relativeTime(timestamp) {
  if (!timestamp) return 'Never';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  return `${Math.floor(elapsedHours / 24)} days ago`;
}

const emptyForm = { deviceId: '', label: '', assignedPatientId: '' };

export default function Devices({ api, patients }) {
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadDevices = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/devices');
      setDevices(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load devices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        label: form.label.trim(),
        assignedPatientId: form.assignedPatientId || null
      };
      if (!payload.label) throw new Error('Device label is required.');

      if (editingDeviceId) {
        const { data } = await api.patch(`/devices/${editingDeviceId}`, payload);
        setDevices((currentDevices) => currentDevices.map((device) => device.deviceId === editingDeviceId ? data : device));
        setSuccess(`${data.deviceId} updated successfully.`);
      } else {
        if (!form.deviceId.trim()) throw new Error('Device ID is required.');
        const { data } = await api.post('/devices', { deviceId: form.deviceId.trim(), ...payload });
        setDevices((currentDevices) => [...currentDevices, data].sort((first, second) => first.deviceId.localeCompare(second.deviceId)));
        setSuccess(`${data.deviceId} registered successfully.`);
      }
      setForm(emptyForm);
      setEditingDeviceId(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to save device.');
    } finally {
      setSaving(false);
    }
  };

  const editDevice = (device) => {
    setEditingDeviceId(device.deviceId);
    setForm({ deviceId: device.deviceId, label: device.label, assignedPatientId: device.assignedPatientId || '' });
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingDeviceId(null);
    setForm(emptyForm);
    setError('');
  };

  return (
    <div className="v-view">
      <div className="section-heading v-page-header">
        <div>
          <p className="eyebrow">DEVICES</p>
          <h1>Device management</h1>
          <p className="subtle">Register monitoring devices and track their latest heartbeat.</p>
        </div>
      </div>

      <div className="panel" style={{ padding: '22px', marginBottom: '20px' }}>
        <div className="panel-head" style={{ marginBottom: '16px' }}>
          <div>
            <p className="eyebrow">{editingDeviceId ? 'EDIT DEVICE' : 'REGISTER DEVICE'}</p>
            <h2>{editingDeviceId ? `Update ${editingDeviceId}` : 'Add a device'}</h2>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
            <label style={{ display: 'grid', gap: '8px' }}>
              <span className="subtle">Device ID</span>
              <input value={form.deviceId} disabled={Boolean(editingDeviceId)} onChange={(event) => setForm((current) => ({ ...current, deviceId: event.target.value }))} placeholder="ESP32-ICU-04" style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required={!editingDeviceId} />
            </label>
            <label style={{ display: 'grid', gap: '8px' }}>
              <span className="subtle">Label</span>
              <input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="ESP32 - ICU-04" style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required />
            </label>
            <label style={{ display: 'grid', gap: '8px' }}>
              <span className="subtle">Assigned patient</span>
              <select value={form.assignedPatientId} onChange={(event) => setForm((current) => ({ ...current, assignedPatientId: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }}>
                <option value="">Unassigned</option>
                {patients.map((patient) => <option key={patient.patientId} value={patient.patientId}>{patient.patientId} - {patient.name}</option>)}
              </select>
            </label>
          </div>
          {error && <div style={{ color: '#8b2d2d', background: '#fbe8e3', borderRadius: '8px', padding: '10px 12px' }}>{error}</div>}
          {success && <div style={{ color: '#1d5d42', background: '#dff5ea', borderRadius: '8px', padding: '10px 12px' }}>{success}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            {editingDeviceId && <button type="button" className="icon-btn" onClick={cancelEdit} style={{ width: 'auto', padding: '0 14px' }}>Cancel</button>}
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : editingDeviceId ? 'Save changes' : 'Register device'}</button>
          </div>
        </form>
      </div>

      <div className="panel" style={{ padding: '18px 20px' }}>
        {loading ? <p className="subtle">Loading devices...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#5a706d' }}>
                <th style={{ padding: '10px 8px' }}>Device ID</th>
                <th style={{ padding: '10px 8px' }}>Label</th>
                <th style={{ padding: '10px 8px' }}>Assigned patient</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Last seen</th>
                <th style={{ padding: '10px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.deviceId} style={{ borderTop: '1px solid #e4ece8' }}>
                  <td style={{ padding: '12px 8px' }}>{device.deviceId}</td>
                  <td style={{ padding: '12px 8px' }}>{device.label}</td>
                  <td style={{ padding: '12px 8px' }}>{device.assignedPatientName || 'Unassigned'}</td>
                  <td style={{ padding: '12px 8px' }}><span className={`status ${device.status === 'online' ? 'stable' : ''} v-status-pill`}>{device.status}</span></td>
                  <td style={{ padding: '12px 8px' }}>{relativeTime(device.lastSeenAt)}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}><button type="button" className="text-button" onClick={() => editDevice(device)}>Edit</button></td>
                </tr>
              ))}
              {devices.length === 0 && <tr><td colSpan="6" style={{ padding: '18px 8px' }} className="subtle">No devices registered.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
