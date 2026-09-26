import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role_id: number;
  active: number;
  role_name: string;
  role_name_ar: string;
}

const emptyForm = { username: '', displayName: '', password: '', roleId: 0, active: true };

export default function UsersPage() {
  const { language, user, setUser } = useAuthStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Array<{ id: number; name: string; display_name_ar: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [u, r] = await Promise.all([
      window.electronAPI.getUsers() as Promise<UserRow[]>,
      window.electronAPI.getRoles() as Promise<Array<{ id: number; name: string; display_name_ar: string }>>,
    ]);
    setUsers(u); setRoles(r);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (u: UserRow) => {
    setEditingId(u.id);
    setForm({
      username: u.username,
      displayName: u.display_name,
      password: '',
      roleId: u.role_id,
      active: u.active === 1,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.displayName.trim() || !form.roleId) return;
    if (editingId === null && !form.password) return;

    setSaving(true);
    try {
      if (editingId === null) {
        await window.electronAPI.createUser(form);
      } else {
        await window.electronAPI.updateUser(editingId, form);

        if (user && editingId === user.id) {
          setUser({
            id: user.id,
            username: form.username.trim(),
            displayName: form.displayName.trim(),
            roleId: form.roleId,
          });
        }
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = editingId !== null;
  const editingSelf = isEditing && user !== null && editingId === user.id;
  const canSave = form.username.trim() && form.displayName.trim() && form.roleId && (isEditing || form.password);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('employees', language)}</h1>
        <button onClick={openCreate} className="btn-primary text-sm">{t('add', language)}</button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50">
            <th className="p-3 text-right font-medium">{t('username', language)}</th>
            <th className="p-3 text-right font-medium">{t('displayName', language)}</th>
            <th className="p-3 text-right font-medium">{t('role', language)}</th>
            <th className="p-3 text-right font-medium">{t('status', language)}</th>
            <th className="p-3 text-right font-medium"></th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border hover:bg-muted/30">
                <td className="p-3" dir="ltr">{u.username}</td>
                <td className="p-3 font-medium">{u.display_name}</td>
                <td className="p-3">{u.role_name_ar}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.active ? t('active', language) : t('inactive', language)}</span></td>
                <td className="p-3 text-left">
                  <button onClick={() => openEdit(u)} className="btn-outline text-xs px-3 py-1">{t('edit', language)}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-96 shadow-2xl animate-pop-in">
            <h3 className="text-lg font-bold mb-4">
              {isEditing ? t('edit', language) : t('add', language)} {t('employees', language)}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('displayName', language)}</label>
                <input autoFocus value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="rtl" />
                {isEditing && editingSelf && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'ar' ? 'هذا الاسم يظهر في الإيصالات التي تطبعها.' : 'This name appears on the receipts you print.'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('username', language)}</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('password', language)}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="ltr" placeholder={isEditing ? (language === 'ar' ? 'اتركه فارغاً للإبقاء على كلمة المرور' : 'Leave blank to keep the current password') : ''} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('role', language)}</label>
                <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value={0}>-</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.display_name_ar}</option>)}
                </select>
              </div>
              {isEditing && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  {t('active', language)}
                </label>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleSave} disabled={!canSave || saving} className="flex-1 btn-primary text-sm disabled:opacity-50">{t('save', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
