import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import axios from 'axios';
import Footer from './Footer';
import Patients from './views/Patients';
import Monitoring from './views/Monitoring';
import Alerts from './views/Alerts';
import AiInsights from './views/AiInsights';
import About from './views/About';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
});

function formatTime(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
}

function formatAlertType(alertType) {
  return alertType.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatVital(value, suffix) {
  return value === undefined || value === null ? '--' : `${value}${suffix}`;
}

async function getSession() {
  const storedToken = window.localStorage.getItem('smartHospitalToken');
  if (storedToken) return { token: storedToken, user: JSON.parse(window.localStorage.getItem('smartHospitalUser') || '{}') };

  const email = import.meta.env.VITE_API_EMAIL;
  const password = import.meta.env.VITE_API_PASSWORD;
  if (!email || !password) throw new Error('Configure VITE_API_EMAIL and VITE_API_PASSWORD to connect to the backend.');

  const { data } = await api.post('/auth/login', { email, password });
  window.localStorage.setItem('smartHospitalToken', data.token);
  window.localStorage.setItem('smartHospitalUser', JSON.stringify(data.user));
  return data;
}

async function loadDashboard() {
  const session = await getSession();
  api.defaults.headers.common.Authorization = `Bearer ${session.token}`;
  const [{ data: patients }, { data: alerts }] = await Promise.all([
    api.get('/patients'),
    api.get('/alerts')
  ]);
  const readings = await Promise.all(patients.map(async (patient) => {
    const { data } = await api.get(`/readings/${patient.patientId}?limit=100`);
    return [patient.patientId, data];
  }));
  return { patients, alerts, readings: Object.fromEntries(readings), user: session.user };
}

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [hash, setHash] = useState(window.location.hash || '#/');

  const refresh = () => {
    setError('');
    loadDashboard().then(setDashboard).catch((requestError) => {
      if (requestError.response?.status === 401) {
        window.localStorage.removeItem('smartHospitalToken');
        window.localStorage.removeItem('smartHospitalUser');
      }
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load dashboard data.');
    });
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash || '#/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (error) return <main className="app"><section className="content state-screen"><p className="eyebrow">CONNECTION ERROR</p><h1>Dashboard unavailable</h1><p className="subtle">{error}</p><button className="primary" onClick={refresh}>Retry connection</button></section></main>;
  if (!dashboard) return <main className="app"><section className="content state-screen"><p className="eyebrow">CONNECTING TO CAREPULSE</p><h1>Loading dashboard</h1><p className="subtle">Fetching current patient and alert data.</p></section></main>;

  const { patients, alerts, readings, user } = dashboard;
  const stableCount = patients.filter((patient) => patient.status === 'Stable').length;
  const trendPatient = patients[0];
  const trendReadings = trendPatient ? readings[trendPatient.patientId] || [] : [];
  const openAlerts = alerts.filter((alert) => alert.status === 'open');
  const currentRoute = ['#/', '#/patients', '#/monitoring', '#/alerts', '#/ai', '#/about'].includes(hash) ? hash : '#/';
  const acknowledgeAlert = async (alertId) => {
    const { data: acknowledgedAlert } = await api.patch(`/alerts/${alertId}/acknowledge`);
    setDashboard((currentDashboard) => currentDashboard ? {
      ...currentDashboard,
      alerts: currentDashboard.alerts.map((alert) => alert.id === acknowledgedAlert.id ? acknowledgedAlert : alert)
    } : currentDashboard);
  };

  return <main className="app"><aside><div className="brand"><span className="brand-mark">+</span><span>CarePulse</span></div><div className="role">CLINICAL OPERATIONS</div><nav><a href="#/" className={currentRoute === '#/' ? 'active' : ''}>Overview <b>⌂</b></a><a href="#/patients" className={currentRoute === '#/patients' ? 'active' : ''}>Patients <b>{String(patients.length).padStart(2, '0')}</b></a><a href="#/monitoring" className={currentRoute === '#/monitoring' ? 'active' : ''}>Live monitoring <b>●</b></a><a href="#/alerts" className={currentRoute === '#/alerts' ? 'active' : ''}>Alerts <b className="alert-count">{String(openAlerts.length).padStart(2, '0')}</b></a><a href="#/ai" className={currentRoute === '#/ai' ? 'active' : ''}>AI insights <b>✦</b></a><a href="#/about" className={currentRoute === '#/about' ? 'active' : ''}>About</a></nav><div className="user"><div className="avatar">{(user?.name || 'PS').split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><strong>{user?.name || 'Clinical user'}</strong><small>{user?.role || 'Authenticated user'}</small></div><span>•••</span></div></aside><section className="content">{currentRoute === '#/' && <><header><div><p className="eyebrow">SUNDAY, SEPTEMBER 27, 2026</p><h1>Good morning, {user?.name?.split(' ')[1] || 'Doctor'}</h1><p className="subtle">Here is your team's live clinical overview.</p></div><div className="header-actions"><button className="icon-btn">⌕</button><button className="icon-btn">♧</button><button className="primary">+ Add patient</button></div></header><div className="stats"><Stat label="Patients monitored" value={String(patients.length).padStart(2, '0')} note="All assigned patients"/><Stat label="Open alerts" value={String(openAlerts.length).padStart(2, '0')} note={`${alerts.filter((alert) => alert.status === 'open').length} need attention`} tone="warn"/><Stat label="Stable patients" value={String(stableCount).padStart(2, '0')} note={patients.length ? `${Math.round(stableCount / patients.length * 100)}% of caseload` : 'No patients loaded'}/><Stat label="Avg. response time" value="--:--" note="Backend response time unavailable" tone="good"/></div><div className="section-heading"><div><p className="eyebrow">LIVE CENSUS</p><h2>Patient overview</h2></div><button className="filter">All patients⌄</button></div><div className="patient-grid">{patients.map((patient) => { const latest = (readings[patient.patientId] || []).at(-1); return <article className="patient" key={patient.patientId}><div className="patient-top"><div><span className={`status ${patient.status ? patient.status.toLowerCase() : ''}`}>{patient.status || 'Unknown'}</span><h3>{patient.name}</h3><p>{patient.patientId} · {patient.roomNumber}</p></div><button className="more">•••</button></div><div className="vitals"><Vital label="Heart rate" value={formatVital(latest?.heartRate, ' bpm')} danger={patient.status === 'Critical' && latest?.spo2 < 92}/><Vital label="SpO2" value={formatVital(latest?.spo2, '%')} danger={patient.status === 'Critical' && latest?.spo2 < 92}/><Vital label="Temperature" value={formatVital(latest?.temperature, ' C')}/></div><div className="patient-foot"><span>Last update {latest ? formatTime(latest.timestamp) : 'unavailable'}</span><button>View details →</button></div></article>; })}</div><div className="lower"><div className="panel chart-panel"><div className="panel-head"><div><p className="eyebrow">{trendPatient ? `${trendPatient.patientId} · ${trendPatient.name.toUpperCase()}` : 'VITAL DATA'}</p><h2>Vital trends</h2></div><span className="live"><i></i> Live</span></div><div className="chart"><span>100</span><span>90</span><span>80</span><span>70</span><div className="line one"></div><div className="line two"></div><div className="line three"></div></div><div className="legend"><span><i className="pink"></i> Heart rate</span><span><i className="green"></i> SpO2</span><span><i className="blue"></i> Temperature</span></div><p className="chart-note">{trendReadings.length} readings loaded from the backend</p></div><div className="panel alert-panel"><div className="panel-head"><div><p className="eyebrow">REQUIRES ATTENTION</p><h2>Recent alerts</h2></div><button className="text-button">View all</button></div>{alerts.slice(0, 4).map((alert) => <div className="alert-item" key={alert.id}><span className={`alert-icon ${alert.status !== 'open' ? 'neutral' : ''}`}>!</span><div><strong>{formatAlertType(alert.alertType)}</strong><p>{alert.patientId} · {alert.value} (threshold {alert.threshold})</p></div><time>{formatTime(alert.timestamp)}</time></div>)}{alerts.length === 0 && <p className="subtle empty-state">No alerts recorded.</p>}</div></div><footer><span>● System operational</span><span>Data loaded from backend · Last sync {formatTime(new Date())}</span></footer></>}{currentRoute === '#/patients' && <Patients patients={patients} readings={readings} alerts={alerts} />}{currentRoute === '#/monitoring' && <Monitoring patients={patients} readings={readings} />}{currentRoute === '#/alerts' && <Alerts alerts={alerts} onAcknowledge={acknowledgeAlert} />}{currentRoute === '#/ai' && <AiInsights />}{currentRoute === '#/about' && <About />}</section></main>;
}

function Vital({ label, value, danger = false }) { return <div><span>{label}</span><strong className={danger ? 'danger' : ''}>{value}</strong></div>; }
function Stat({ label, value, note, tone = '' }) { return <div className={`stat ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }

createRoot(document.getElementById('root')).render(<><App /><Footer /></>);
