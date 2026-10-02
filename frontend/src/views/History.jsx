import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function History({ patients, readings }) {
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.patientId || '');

  const patientOptions = patients || [];
  const selectedPatient = patientOptions.find((patient) => patient.patientId === selectedPatientId) || patientOptions[0] || null;
  const patientReadings = selectedPatient ? readings[selectedPatient.patientId] || [] : [];

  const chartData = useMemo(() => {
    const labels = patientReadings.map((reading) => new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const heartRate = patientReadings.map((reading) => Number(reading.heartRate));
    const spo2 = patientReadings.map((reading) => Number(reading.spo2));
    const temperature = patientReadings.map((reading) => Number(reading.temperature));

    return {
      labels,
      datasets: [
        {
          label: 'Heart rate',
          data: heartRate,
          borderColor: '#d95f5a',
          backgroundColor: 'rgba(217, 95, 90, 0.12)',
          tension: 0.3,
          pointRadius: 2,
          fill: false
        },
        {
          label: 'SpO2',
          data: spo2,
          borderColor: '#2e7a6b',
          backgroundColor: 'rgba(46, 122, 107, 0.12)',
          tension: 0.3,
          pointRadius: 2,
          fill: false
        },
        {
          label: 'Temperature',
          data: temperature,
          borderColor: '#9d7c3d',
          backgroundColor: 'rgba(157, 124, 61, 0.12)',
          tension: 0.3,
          pointRadius: 2,
          fill: false
        }
      ]
    };
  }, [patientReadings]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top' },
      title: { display: false }
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 8 },
        grid: { color: 'rgba(25, 37, 40, 0.06)' }
      },
      y: {
        beginAtZero: false,
        grid: { color: 'rgba(25, 37, 40, 0.06)' }
      }
    }
  };

  return (
    <div className="v-view">
      <div className="section-heading v-page-header">
        <div>
          <p className="eyebrow">HISTORY</p>
          <h1>Patient trend history</h1>
          <p className="subtle">Review recent clinical changes over time.</p>
        </div>
      </div>

      <div className="panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
          <label style={{ display: 'grid', gap: '8px', minWidth: '220px', color: '#192528' }}>
            <span className="subtle">Select patient</span>
            <select
              value={selectedPatient?.patientId || ''}
              onChange={(event) => setSelectedPatientId(event.target.value)}
              style={{ border: '1px solid #d8e1dc', borderRadius: '8px', background: '#f4f7f4', color: '#192528', padding: '10px 12px' }}
            >
              {patientOptions.map((patient) => (
                <option key={patient.patientId} value={patient.patientId}>{patient.name}</option>
              ))}
            </select>
          </label>
        </div>

        {selectedPatient && patientReadings.length > 1 ? (
          <div style={{ height: '380px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <p className="subtle">Not enough data yet</p>
        )}
      </div>
    </div>
  );
}
