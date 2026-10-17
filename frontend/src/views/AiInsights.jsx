import React, { useEffect, useState } from 'react';

const DISCLAIMER = 'AI-generated decision support. Not a diagnosis. Model trained on simulated data. Threshold alerts operate independently of this analysis.';

function formatDate(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString() : 'Unavailable';
}

function formatProbability(probability) {
  return `${(Number(probability || 0) * 100).toFixed(1)}%`;
}

function analysisError(requestError) {
  return requestError.response?.status === 503 || !requestError.response
    ? 'AI analysis unavailable. Threshold alerts are unaffected.'
    : requestError.response?.data?.message || 'AI analysis unavailable. Threshold alerts are unaffected.';
}

export default function AiInsights({ api, patients }) {
  const [analyses, setAnalyses] = useState({});
  const [loading, setLoading] = useState(true);

  const refreshAnalyses = async () => {
    setLoading(true);
    const results = await Promise.all(patients.map(async (patient) => {
      try {
        const { data } = await api.get(`/ai/risk/${patient.patientId}`);
        return [patient.patientId, { data, error: '' }];
      } catch (requestError) {
        return [patient.patientId, { data: null, error: analysisError(requestError) }];
      }
    }));
    setAnalyses(Object.fromEntries(results));
    setLoading(false);
  };

  useEffect(() => {
    refreshAnalyses();
    const interval = window.setInterval(refreshAnalyses, 20000);
    return () => window.clearInterval(interval);
  }, [api, patients]);

  return <div className="v-view">
    <div className="section-heading v-page-header">
      <div><p className="eyebrow">AI INSIGHTS</p><h1>Patient risk analysis</h1><p className="subtle">Model-assisted context from each patient's latest vital readings.</p></div>
      <button type="button" className="primary" onClick={refreshAnalyses} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
    </div>

    {loading && Object.keys(analyses).length === 0 && <div className="panel" style={{ padding: '22px' }}><p className="subtle">Loading AI analyses...</p></div>}

    <div className="v-info-grid">
      {patients.map((patient) => {
        const result = analyses[patient.patientId];
        const analysis = result?.data;
        const probability = analysis?.riskLevel ? analysis.probabilities[analysis.riskLevel] : null;
        const neededReadings = analysis?.window ? Math.max(0, 12 - analysis.window.readingCount) : 12;

        return <article className="panel v-info-card" key={patient.patientId}>
          <div className="panel-head">
            <div><p className="eyebrow">{patient.patientId}</p><h2>{patient.name}</h2></div>
            {analysis?.status === 'ok' && <span className={`v-status-badge v-status-${analysis.riskLevel}`}>{analysis.riskLevel} · {formatProbability(probability)}</span>}
            {analysis?.status === 'insufficient_data' && <span className="v-status-badge v-status-acknowledged">Insufficient data</span>}
            {result?.error && <span className="v-status-badge v-status-open">Unavailable</span>}
          </div>

          {result?.error && <p className="subtle" style={{ color: '#9f3a2d' }}>{result.error}</p>}
          {analysis?.status === 'insufficient_data' && <p className="subtle">Need {neededReadings} more reading{neededReadings === 1 ? '' : 's'} for an analysis.</p>}
          {analysis?.status === 'ok' && <>
            <div style={{ marginTop: '16px' }}>
              <p className="eyebrow">CONTRIBUTING FACTORS</p>
              <ul style={{ margin: '10px 0 0', paddingLeft: '20px', color: '#405753' }}>
                {analysis.contributingFactors.map((factor) => <li key={factor.feature} style={{ marginBottom: '6px' }}>{factor.message}</li>)}
              </ul>
            </div>
            <p className="subtle" style={{ marginTop: '16px' }}>Window: {formatDate(analysis.window.firstTimestamp)} to {formatDate(analysis.window.lastTimestamp)} ({analysis.window.readingCount} readings)</p>
          </>}
          {analysis && <p className="subtle" style={{ marginTop: '12px' }}>Model {analysis.modelVersion} · Generated {formatDate(analysis.generatedAt)}</p>}
          <p className="subtle" style={{ marginTop: '16px', fontSize: '12px' }}>{DISCLAIMER}</p>
        </article>;
      })}
    </div>
    {!loading && patients.length === 0 && <div className="panel" style={{ padding: '22px' }}><p className="subtle">No patients available for AI analysis.</p></div>}
  </div>;
}
