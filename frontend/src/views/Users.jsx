import React, { useEffect, useState } from 'react';

const emptyForm = { name: '', email: '', password: '', role: 'nurse' };

export default function Users({ api }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [formMode, setFormMode] = useState(null);
  const [editingUserId, setEditingUserId] = useState('');
  const [form, setForm] = useState(emptyForm);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load team members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  function openCreateForm() {
    setFormMode('create');
    setEditingUserId('');
    setForm(emptyForm);
    setError('');
    setSuccess('');
  }

  function openEditForm(user) {
    setFormMode('edit');
    setEditingUserId(user.id);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setError('');
    setSuccess('');
  }

  function closeForm() {
    setFormMode(null);
    setEditingUserId('');
    setForm(emptyForm);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = { name: form.name.trim(), email: form.email.trim(), role: form.role };
      if (formMode === 'create') {
        payload.password = form.password;
        if (!payload.name || !payload.email || !payload.password) throw new Error('Name, email, password, and role are required.');
        const { data } = await api.post('/users', payload);
        setUsers((currentUsers) => [...currentUsers, data].sort((first, second) => first.name.localeCompare(second.name)));
        setSuccess(`${data.name} was created.`);
      } else {
        if (!payload.name || !payload.email) throw new Error('Name, email, and role are required.');
        const user = users.find((item) => item.id === editingUserId);
        if (!user) throw new Error('User no longer exists. Refresh and try again.');
        const { data } = await api.patch(`/users/${user.id}`, payload);
        setUsers((currentUsers) => currentUsers.map((item) => item.id === data.id ? data : item).sort((first, second) => first.name.localeCompare(second.name)));
        setSuccess(`${data.name} was updated.`);
      }
      closeForm();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    setUpdatingId(user.id);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.patch(`/users/${user.id}`, { isActive: user.isActive === false });
      setUsers((currentUsers) => currentUsers.map((item) => item.id === data.id ? data : item));
      setSuccess(`${data.name} is now ${data.isActive ? 'active' : 'inactive'}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update account status.');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <div className="v-view">
      <div className="section-heading v-page-header">
        <div>
          <p className="eyebrow">TEAM</p>
          <h1>Hospital staff directory</h1>
          <p className="subtle">Create and manage hospital staff accounts.</p>
        </div>
        <button type="button" className="primary" onClick={openCreateForm}>+ Add user</button>
      </div>

      {error && <p className="subtle" style={{ color: '#9f3a2d', marginBottom: '18px' }}>{error}</p>}
      {success && <p className="subtle" style={{ color: '#1d5d42', marginBottom: '18px' }}>{success}</p>}

      {formMode && (
        <div className="panel" style={{ padding: '22px', marginBottom: '20px' }}>
          <div className="panel-head" style={{ marginBottom: '16px' }}>
            <div>
              <p className="eyebrow">{formMode === 'create' ? 'NEW USER' : 'EDIT USER'}</p>
              <h2>{formMode === 'create' ? 'Create user' : 'Edit user'}</h2>
            </div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Name</span>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required />
              </label>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Email</span>
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required />
              </label>
              {formMode === 'create' && <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Initial password</span>
                <input type="password" minLength="8" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }} required />
              </label>}
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="subtle">Role</span>
                <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} style={{ border: '1px solid #d8e1dc', borderRadius: '8px', padding: '10px 12px', background: '#f4f7f4', color: '#192528' }}>
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="icon-btn" onClick={closeForm} style={{ width: 'auto', padding: '0 14px' }}>Cancel</button>
              <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : formMode === 'create' ? 'Create user' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}

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
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderTop: '1px solid #e4ece8' }}>
                  <td style={{ padding: '12px 8px' }}>{user.name}</td>
                  <td style={{ padding: '12px 8px' }}>{user.email}</td>
                  <td style={{ padding: '12px 8px' }}>{user.role}</td>
                  <td style={{ padding: '12px 8px' }}><span className={`v-status-badge ${user.isActive === false ? 'v-status-acknowledged' : 'v-status-open'}`}>{user.isActive === false ? 'Inactive' : 'Active'}</span></td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button type="button" className="text-button" onClick={() => openEditForm(user)} style={{ marginRight: '12px' }}>Edit</button>
                    <button type="button" className="text-button" onClick={() => toggleActive(user)} disabled={updatingId === user.id}>{updatingId === user.id ? 'Saving...' : user.isActive === false ? 'Activate' : 'Deactivate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
