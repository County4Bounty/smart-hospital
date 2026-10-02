import React, { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
});

export default function Users() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem('smartHospitalToken');
    if (!token) {
      setError('Session expired.');
      setLoading(false);
      return;
    }

    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    api.get('/users')
      .then(({ data }) => setUsers(data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load team members.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="v-view">
      <div className="section-heading v-page-header">
        <div>
          <p className="eyebrow">TEAM</p>
          <h1>Hospital staff directory</h1>
          <p className="subtle">Admin-only team records from the secured users API.</p>
        </div>
      </div>

      {error && <p className="subtle" style={{ color: '#9f3a2d', marginBottom: '18px' }}>{error}</p>}

      <div className="panel" style={{ padding: '18px 20px' }}>
        {loading ? (
          <p className="subtle">Loading team members...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#5a706d' }}>
                <th style={{ padding: '10px 8px' }}>Name</th>
                <th style={{ padding: '10px 8px' }}>Email</th>
                <th style={{ padding: '10px 8px' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderTop: '1px solid #e4ece8' }}>
                  <td style={{ padding: '12px 8px' }}>{user.name}</td>
                  <td style={{ padding: '12px 8px' }}>{user.email}</td>
                  <td style={{ padding: '12px 8px' }}>{user.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
