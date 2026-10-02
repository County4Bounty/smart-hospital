import React, { useEffect, useState } from 'react';

export default function Thresholds({ api }) {
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingKey, setSavingKey] = useState(null);

  const fetchThresholds = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/thresholds');
      setThresholds(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load thresholds.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThresholds();
  }, []);

  const updateThreshold = async (threshold) => {
    setSavingKey(threshold.key);
    setError('');
    setSuccess('');
    try {
      const numericValue = Number(threshold.value);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        throw new Error('Threshold value must be a non-negative number.');
      }
      const { data } = await api.patch(`/thresholds/${threshold.key}`, { value: numericValue });
      setThresholds((currentThresholds) => currentThresholds.map((item) => item.key === threshold.key ? data : item));
      setSuccess(`${data.label} updated successfully.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to save threshold.');
    } finally {
      setSavingKey(null);
    }
  };

  const resetToDefaults = () => {
    const defaults = { heartRate_high: 120, spo2_low: 92, temperature_high: 38 };
    setThresholds((currentThresholds) => currentThresholds.map((threshold) => (
      Object.hasOwn(defaults, threshold.key)
        ? { ...threshold, value: defaults[threshold.key] }
        : threshold
    )));
    setError('');
    setSuccess('Defaults populated. Save each changed threshold to commit them.');
  };

  return (
    <div className="v-view">
      <div className="section-heading v-page-header">
        <div>
          <p className="eyebrow">THRESHOLDS</p>
          <h1>Alert thresholds</h1>
          <p className="subtle">Adjust the monitoring thresholds used when generating scheduled clinical alerts.</p>
        </div>
        <button type="button" className="icon-btn" onClick={resetToDefaults} style={{ width: 'auto', padding: '0 14px' }}>
          Reset to defaults
        </button>
      </div>

      {error && <div style={{ marginBottom: '16px', background: '#fbe8e3', color: '#7f2b1f', borderRadius: '8px', padding: '10px 12px' }}>{error}</div>}
      {success && <div style={{ marginBottom: '16px', background: '#dff5ea', color: '#1d5d42', borderRadius: '8px', padding: '10px 12px' }}>{success}</div>}

      {loading ? (
        <div className="panel" style={{ padding: '24px' }}>
          <p className="subtle">Loading alert thresholds...</p>
        </div>
      ) : (
        <div className="patient-grid v-card-grid">
          {thresholds.map((threshold) => (
            <article className="patient v-view-card" key={threshold.key}>
              <div className="patient-top">
                <div>
                  <span className="status stable v-status-pill">{threshold.direction === 'above' ? 'Above' : 'Below'}</span>
                  <h3>{threshold.label}</h3>
                  <p>{threshold.key}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
                <label style={{ display: 'grid', gap: '8px' }}>
                  <span className="subtle">Current value</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={threshold.value}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setThresholds((currentThresholds) => currentThresholds.map((item) => item.key === threshold.key ? { ...item, value: Number.isFinite(nextValue) ? nextValue : 0 } : item));
                      }}
                      style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528', width: '100%' }}
                    />
                    <span className="subtle">{threshold.unit}</span>
                  </div>
                </label>
                <button type="button" className="primary" onClick={() => updateThreshold(threshold)} disabled={savingKey === threshold.key}>
                  {savingKey === threshold.key ? 'Saving...' : 'Save'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
