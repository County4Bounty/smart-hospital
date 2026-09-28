import React from 'react';

function formatAlertType(alertType) {
  const labels = { heartRate_high: 'Heart rate high', spo2_low: 'SpO2 low', temperature_high: 'Temperature high' };
  return labels[alertType] || alertType.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function alertClass(alertType) {
  if (alertType === 'spo2_low') return 'v-alert-spo2';
  if (alertType === 'temperature_high') return 'v-alert-temperature';
  return 'v-alert-heart-rate';
}

export default function Alerts({ alerts, onAcknowledge }) {
  const [acknowledgingId, setAcknowledgingId] = React.useState('');
  const [error, setError] = React.useState('');
  const sortedAlerts = [...alerts].sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp));

  async function acknowledge(alertId) {
    setAcknowledgingId(alertId);
    setError('');
    try {
      await onAcknowledge(alertId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to acknowledge this alert.');
    } finally {
      setAcknowledgingId('');
    }
  }

  return (
    <div className="v-view">
      <div className="section-heading v-page-header">
        <div>
          <p className="eyebrow">ALERTS</p>
          <h1>Patient alerts</h1>
          <p className="subtle">Threshold alerts generated from stored vital readings.</p>
        </div>
      </div>
      <div className="panel alert-panel v-alert-list">
        <div className="panel-head">
          <div><p className="eyebrow">CURRENT ALERTS</p><h2>Requires attention</h2></div>
        </div>
        {error && <p className="subtle">{error}</p>}
        {sortedAlerts.map((alert) => <div className={`alert-item v-alert-card ${alertClass(alert.alertType)}`} key={alert.id || alert._id}>
          <span className={`alert-icon ${alert.status !== 'open' ? 'neutral' : ''}`}>!</span>
          <div><strong>{formatAlertType(alert.alertType)}</strong><p>{alert.value} ({alert.direction} threshold {alert.threshold}) · {alert.patientId}</p></div>
          <div className="v-alert-meta"><time>{new Date(alert.timestamp).toLocaleString()}</time><span className={`v-status-badge v-status-${alert.status}`}>{alert.status}</span>{alert.status === 'open' && <button className="text-button" onClick={() => acknowledge(alert.id || alert._id)} disabled={acknowledgingId === (alert.id || alert._id)}>{acknowledgingId === (alert.id || alert._id) ? 'Acknowledging...' : 'Acknowledge'}</button>}</div>
        </div>)}
        {alerts.length === 0 && <p className="subtle empty-state">No alerts recorded.</p>}
      </div>
    </div>
  );
}
