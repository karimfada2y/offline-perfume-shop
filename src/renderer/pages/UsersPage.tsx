import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';

export default function UsersPage() {
  const { language } = useAuthStore();
  const [users, setUsers] = useState<Array<{ id: number; username: string; display_name: string; role_name: string; role_name_ar: string; active: number }>>([]);
  const [roles, setRoles] = useState<Array<{ id: number; name: string; display_name_ar: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', roleId: 0, active: true });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [u, r] = await Promise.all([
      window.electronAPI.getUsers() as Promise<Array<{ id: number; username: string; display_name: string; role_name: string; role_name_ar: string; active: number }>>,
      window.electronAPI.getRoles() as Promise<Array<{ id: number; name: string; display_name_ar: string }>>,
    ]);
    setUsers(u); setRoles(r);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.username || !form.displayName || !form.password || !form.roleId) return;
    try {
      await window.electronAPI.createUser(form);
      setShowForm(false); loadData();
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('employees', language)}</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">{t('add', language)}</button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50">
            <th className="p-3 text-right font-medium">{t('username', language)}</th>
            <th className="p-3 text-right font-medium">{t('displayName', language)}</th>
            <th className="p-3 text-right font-medium">{t('role', language)}</th>
            <th className="p-3 text-right font-medium">{t('status', language)}</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border hover:bg-muted/30">
                <td className="p-3">{u.username}</td>
                <td className="p-3 font-medium">{u.display_name}</td>
                <td className="p-3">{u.role_name_ar}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.active ? t('active', language) : t('inactive', language)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-96 shadow-2xl animate-pop-in">
            <h3 className="text-lg font-bold mb-4">{t('add', language)} {t('employees', language)}</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">{t('displayName', language)}</label><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('username', language)}</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="ltr" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('password', language)}</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="ltr" /></div>
              <div><label className="block text-sm font-medium mb-1">{t('role', language)}</label>
                <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>{roles.map(r => <option key={r.id} value={r.id}>{r.display_name_ar}</option>)}
                </select></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleSave} className="flex-1 btn-primary text-sm">{t('save', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
