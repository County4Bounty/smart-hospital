import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import Footer from './Footer';
import Patients from './views/Patients';
import Monitoring from './views/Monitoring';
import Alerts from './views/Alerts';
import AiInsights from './views/AiInsights';
import About from './views/About';
import Users from './views/Users';
import History from './views/History';
import Thresholds from './views/Thresholds';
import Devices from './views/Devices';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
});
const apiOrigin = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');

function formatTime(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
}

function formatAlertType(alertType) {
  return alertType.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatVital(value, suffix) {
  return value === undefined || value === null ? '--' : `${value}${suffix}`;
}

function readingsMatch(first, second) {
  return (first.id && second.id && first.id === second.id)
    || (first._id && second._id && first._id === second._id)
    || (first.timestamp && second.timestamp && first.timestamp === second.timestamp);
}

function getStoredSession() {
  const storedToken = window.localStorage.getItem('smartHospitalToken');
  if (!storedToken) return null;
  try {
    return { token: storedToken, user: JSON.parse(window.localStorage.getItem('smartHospitalUser') || '{}') };
  } catch {
    window.localStorage.removeItem('smartHospitalToken');
    window.localStorage.removeItem('smartHospitalUser');
    return null;
  }
}

function clearStoredSession() {
  window.localStorage.removeItem('smartHospitalToken');
  window.localStorage.removeItem('smartHospitalUser');
}

async function loadDashboard(token) {
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  const [{ data: patients }, { data: alerts }] = await Promise.all([
    api.get('/patients'),
    api.get('/alerts')
  ]);
  const readings = await Promise.all(patients.map(async (patient) => {
    const { data } = await api.get(`/readings/${patient.patientId}?limit=100`);
    return [patient.patientId, data];
  }));
  return { patients, alerts, readings: Object.fromEntries(readings), user: JSON.parse(window.localStorage.getItem('smartHospitalUser') || '{}') };
}

function LoginForm({ onSuccess }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      window.localStorage.setItem('smartHospitalToken', data.token);
      window.localStorage.setItem('smartHospitalUser', JSON.stringify(data.user));
      api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      onSuccess(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Invalid email or password.');
    }
  };

  return (
    <main className="app" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <section className="panel" style={{ width: '100%', maxWidth: '420px', padding: '32px', background: '#fff', borderRadius: '12px', boxShadow: '0 18px 40px rgba(25, 37, 40, 0.08)' }}>
        <p className="eyebrow">SIGN IN</p>
        <h1 style={{ marginTop: '8px', marginBottom: '8px' }}>CarePulse access</h1>
        <p className="subtle" style={{ marginBottom: '20px' }}>Sign in with your hospital account to continue.</p>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span className="subtle">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="name@smart-hospital.local"
              style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', background: '#f4f7f4', color: '#192528' }}
              required
            />
          </label>
          <label style={{ display: 'grid', gap: '8px' }}>
            <span className="subtle">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Enter password"
              style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', background: '#f4f7f4', color: '#192528' }}
              required
            />
          </label>
          {error && <div style={{ background: '#fbe8e3', color: '#7f2b1f', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' }}>{error}</div>}
          <button type="submit" className="primary" style={{ width: '100%' }}>Sign in</button>
        </form>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(() => getStoredSession());
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [hash, setHash] = useState(window.location.hash || '#/');
  const [liveStatus, setLiveStatus] = useState('offline');
  const socketRef = useRef(null);

  const currentUser = session?.user || null;

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash || '#/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!session && hash !== '#/login') {
      setHash('#/login');
      return;
    }
    if (session && hash === '#/login') {
      setHash('#/');
      return;
    }
    if (session && hash === '#/users' && currentUser?.role !== 'admin') {
      setHash('#/');
    }
    if (session && hash === '#/thresholds' && currentUser?.role !== 'admin') {
      setHash('#/');
    }
    if (session && hash === '#/devices' && currentUser?.role !== 'admin') {
      setHash('#/');
    }
  }, [session, hash, currentUser?.role]);

  useEffect(() => {
    if (!session) return undefined;
    let isMounted = true;

    const refresh = async () => {
      setError('');
      try {
        const nextDashboard = await loadDashboard(session.token);
        if (isMounted) setDashboard(nextDashboard);
      } catch (requestError) {
        if (requestError.response?.status === 401) {
          clearStoredSession();
          setSession(null);
          setDashboard(null);
          window.location.hash = '#/login';
        }
        if (isMounted) {
          setError(requestError.response?.data?.message || requestError.message || 'Unable to load dashboard data.');
        }
      }
    };

    refresh();
    return () => { isMounted = false; };
  }, [session?.token]);

  useEffect(() => {
    if (!session) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return undefined;
    }

    const socket = io(apiOrigin, { auth: { token: session.token } });
    socketRef.current = socket;
    let hasConnected = false;

    const refetchLiveData = async () => {
      const [{ data: nextAlerts }, nextReadings] = await Promise.all([
        api.get('/alerts'),
        Promise.all((dashboard?.patients || []).map(async (patient) => {
          const { data } = await api.get(`/readings/${patient.patientId}?limit=100`);
          return [patient.patientId, data];
        }))
      ]);
      setDashboard((currentDashboard) => currentDashboard ? {
        ...currentDashboard,
        alerts: nextAlerts,
        readings: Object.fromEntries(nextReadings)
      } : currentDashboard);
    };

    socket.on('connect', () => {
      setLiveStatus('connected');
      if (hasConnected) {
        refetchLiveData().catch(() => setLiveStatus('offline'));
      }
      hasConnected = true;
    });
    socket.on('disconnect', () => setLiveStatus('offline'));
    socket.on('connect_error', () => setLiveStatus('offline'));
    socket.on('reading.created', (reading) => {
      setDashboard((currentDashboard) => {
        if (!currentDashboard) return currentDashboard;
        const patientReadings = currentDashboard.readings[reading.patientId] || [];
        if (patientReadings.some((existingReading) => readingsMatch(existingReading, reading))) return currentDashboard;
        return {
          ...currentDashboard,
          readings: {
            ...currentDashboard.readings,
            [reading.patientId]: [...patientReadings, reading].slice(-50)
          }
        };
      });
    });
    socket.on('alert.created', (alert) => {
      setDashboard((currentDashboard) => {
        if (!currentDashboard || currentDashboard.alerts.some((existingAlert) => (existingAlert.id || existingAlert._id) === (alert.id || alert._id))) return currentDashboard;
        return { ...currentDashboard, alerts: [alert, ...currentDashboard.alerts] };
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.token, dashboard?.patients]);

  const logout = () => {
    clearStoredSession();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    api.defaults.headers.common.Authorization = undefined;
    setDashboard(null);
    setError('');
    setLiveStatus('offline');
    setSession(null);
    window.location.hash = '#/login';
    setHash('#/login');
  };

  const handleLoginSuccess = (nextSession) => {
    setSession(nextSession);
    setDashboard(null);
    setError('');
    window.location.hash = '#/';
    setHash('#/');
  };

  if (!session) return <LoginForm onSuccess={handleLoginSuccess} />;
  if (error) return <main className="app"><section className="content state-screen"><p className="eyebrow">CONNECTION ERROR</p><h1>Dashboard unavailable</h1><p className="subtle">{error}</p><button className="primary" onClick={() => window.location.reload()}>Retry</button></section></main>;
  if (!dashboard) return <main className="app"><section className="content state-screen"><p className="eyebrow">CONNECTING TO CAREPULSE</p><h1>Loading dashboard</h1><p className="subtle">Fetching current patient and alert data.</p></section></main>;

  const { patients, alerts, readings, user } = dashboard;
  const stableCount = patients.filter((patient) => patient.status === 'Stable').length;
  const currentRoute = ['#/', '#/patients', '#/monitoring', '#/history', '#/alerts', '#/ai', '#/about', '#/users', '#/thresholds', '#/devices'].includes(hash) ? hash : '#/';
  const openAlerts = alerts.filter((alert) => alert.status === 'open');
  const trendPatient = patients[0];
  const trendReadings = trendPatient ? readings[trendPatient.patientId] || [] : [];

  const acknowledgeAlert = async (alertId) => {
    const { data: acknowledgedAlert } = await api.patch(`/alerts/${alertId}/acknowledge`);
    setDashboard((currentDashboard) => currentDashboard ? {
      ...currentDashboard,
      alerts: currentDashboard.alerts.map((alert) => alert.id === acknowledgedAlert.id ? acknowledgedAlert : alert)
    } : currentDashboard);
  };

  const handleAddPatient = async (payload) => {
    const { data: patient } = await api.post('/patients', payload);
    setDashboard((currentDashboard) => currentDashboard ? {
      ...currentDashboard,
      patients: [...currentDashboard.patients, patient]
    } : currentDashboard);
    return patient;
  };

  const handleUpdatePatient = async (patientId, payload) => {
    const { data: patient } = await api.patch(`/patients/${patientId}`, payload);
    setDashboard((currentDashboard) => currentDashboard ? {
      ...currentDashboard,
      patients: currentDashboard.patients.map((existingPatient) => existingPatient.patientId === patientId ? patient : existingPatient)
    } : currentDashboard);
    return patient;
  };

  return (
    <main className="app">
      <aside>
        <div className="brand"><span className="brand-mark">+</span><span>CarePulse</span></div>
        <div className="role">CLINICAL OPERATIONS</div>
        <div className="v-live-indicator"><i className={liveStatus === 'connected' ? 'v-live-dot' : 'v-live-dot v-live-dot-off'}></i>{liveStatus === 'connected' ? 'Live' : 'Offline - reconnecting'}</div>
        <nav>
          <a href="#/" className={currentRoute === '#/' ? 'active' : ''}>Overview <b>⌂</b></a>
          <a href="#/patients" className={currentRoute === '#/patients' ? 'active' : ''}>Patients <b>{String(patients.length).padStart(2, '0')}</b></a>
          <a href="#/monitoring" className={currentRoute === '#/monitoring' ? 'active' : ''}>Live monitoring <b>●</b></a>
          <a href="#/history" className={currentRoute === '#/history' ? 'active' : ''}>History</a>
          <a href="#/alerts" className={currentRoute === '#/alerts' ? 'active' : ''}>Alerts <b className="alert-count">{String(openAlerts.length).padStart(2, '0')}</b></a>
          <a href="#/ai" className={currentRoute === '#/ai' ? 'active' : ''}>AI insights <b>✦</b></a>
          <a href="#/about" className={currentRoute === '#/about' ? 'active' : ''}>About</a>
          {currentUser?.role === 'admin' && <a href="#/users" className={currentRoute === '#/users' ? 'active' : ''}>Team</a>}
          {currentUser?.role === 'admin' && <a href="#/thresholds" className={currentRoute === '#/thresholds' ? 'active' : ''}>Thresholds</a>}
          {currentUser?.role === 'admin' && <a href="#/devices" className={currentRoute === '#/devices' ? 'active' : ''}>Devices</a>}
        </nav>
        <div className="user">
          <div className="avatar">{(user?.name || 'PS').split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
          <div>
            <strong>{user?.name || 'Clinical user'}</strong>
            <small>{user?.role || 'Authenticated user'}</small>
          </div>
          <button type="button" onClick={logout} style={{ marginLeft: 'auto', fontSize: '12px', color: '#d7e7df', background: 'transparent', padding: 0 }}>Logout</button>
        </div>
      </aside>
      <section className="content">
        {currentRoute === '#/' && <>
          <header>
            <div>
              <p className="eyebrow">SUNDAY, SEPTEMBER 27, 2026</p>
              <h1>Good morning, {user?.name?.split(' ')[1] || 'Doctor'}</h1>
              <p className="subtle">Here is your team's live clinical overview.</p>
            </div>
            <div className="header-actions">
              <button className="icon-btn">⌕</button>
              <button className="icon-btn">♧</button>
              <button className="primary">+ Add patient</button>
            </div>
          </header>
          <div className="stats">
            <Stat label="Patients monitored" value={String(patients.length).padStart(2, '0')} note="All assigned patients" />
            <Stat label="Open alerts" value={String(openAlerts.length).padStart(2, '0')} note={`${alerts.filter((alert) => alert.status === 'acknowledged').length} acknowledged`} />
            <Stat label="Stable" value={String(stableCount).padStart(2, '0')} note="Clinically stable" />
          </div>
          <div className="section-heading">
            <div><p className="eyebrow">LIVE CENSUS</p><h2>Patient overview</h2></div>
            <button className="filter">All patients▾</button>
          </div>
          <div className="patient-grid">
            {patients.map((patient) => {
              const latest = (readings[patient.patientId] || []).at(-1);
              return <article className="patient" key={patient.patientId}>
                <div className="patient-top">
                  <div>
                    <span className={`status ${patient.status ? patient.status.toLowerCase() : ''}`}>{patient.status || 'Unknown'}</span>
                    <h3>{patient.name}</h3>
                    <p>{patient.patientId} · {patient.roomNumber}</p>
                  </div>
                  <button className="more">•••</button>
                </div>
                <div className="vitals">
                  <Vital label="Heart rate" value={formatVital(latest?.heartRate, ' bpm')} danger={patient.status === 'Critical' && latest?.spo2 < 92} />
                  <Vital label="SpO2" value={formatVital(latest?.spo2, '%')} danger={patient.status === 'Critical' && latest?.spo2 < 92} />
                  <Vital label="Temperature" value={formatVital(latest?.temperature, ' C')} />
                </div>
                <div className="patient-foot">
                  <span>Last update {latest ? formatTime(latest.timestamp) : 'unavailable'}</span>
                  <button>View details →</button>
                </div>
              </article>;
            })}
          </div>
          <div className="lower">
            <div className="panel chart-panel">
              <div className="panel-head">
                <div><p className="eyebrow">{trendPatient ? `${trendPatient.patientId} · ${trendPatient.name.toUpperCase()}` : 'VITAL DATA'}</p><h2>Vital trends</h2></div>
                <span className="live"><i></i> Live</span>
              </div>
              <div className="chart"><span>100</span><span>90</span><span>80</span><span>70</span><div className="line one"></div><div className="line two"></div><div className="line three"></div></div>
              <div className="legend"><span><i className="pink"></i> Heart rate</span><span><i className="green"></i> SpO2</span><span><i className="blue"></i> Temperature</span></div>
              <p className="chart-note">{trendReadings.length} readings loaded from the backend</p>
            </div>
            <div className="panel alert-panel">
              <div className="panel-head">
                <div><p className="eyebrow">REQUIRES ATTENTION</p><h2>Recent alerts</h2></div>
                <button className="text-button">View all</button>
              </div>
              {alerts.slice(0, 4).map((alert) => <div className="alert-item" key={alert.id}><span className={`alert-icon ${alert.status !== 'open' ? 'neutral' : ''}`}>!</span><div><strong>{formatAlertType(alert.alertType)}</strong><p>{alert.patientId} · {alert.value} (threshold {alert.threshold})</p></div><time>{formatTime(alert.timestamp)}</time></div>)}
              {alerts.length === 0 && <p className="subtle empty-state">No alerts recorded.</p>}
            </div>
          </div>
          <footer><span>● System operational</span><span>Data loaded from backend · Last sync {formatTime(new Date())}</span></footer>
        </>}
        {currentRoute === '#/patients' && <Patients patients={patients} readings={readings} alerts={alerts} currentUserRole={currentUser?.role} onAddPatient={handleAddPatient} onUpdatePatient={handleUpdatePatient} />}
        {currentRoute === '#/monitoring' && <Monitoring patients={patients} readings={readings} />}
        {currentRoute === '#/history' && <History api={api} patients={patients} />}
        {currentRoute === '#/alerts' && <Alerts alerts={alerts} onAcknowledge={acknowledgeAlert} />}
        {currentRoute === '#/ai' && <AiInsights />}
        {currentRoute === '#/about' && <About />}
        {currentRoute === '#/users' && <Users />}
        {currentRoute === '#/thresholds' && <Thresholds api={api} />}
        {currentRoute === '#/devices' && <Devices api={api} patients={patients} />}
      </section>
    </main>
  );
}

function Vital({ label, value, danger = false }) {
  return <div><span>{label}</span><strong className={danger ? 'danger' : ''}>{value}</strong></div>;
}

function Stat({ label, value, note, tone = '' }) {
  return <div className={`stat ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

createRoot(document.getElementById('root')).render(<><App /><Footer /></>);
