import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';
import { Category } from '../../shared/types';

export default function CategoriesPage() {
  const { language } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [form, setForm] = useState({ nameAr: '', nameEn: '', description: '', sortOrder: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await window.electronAPI.getCategories() as Category[];
    setCategories(result);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.nameAr.trim()) { alert(language === 'ar' ? 'أدخل اسم القسم' : 'Enter category name'); return; }
    try {
      if (editCategory) {
        await window.electronAPI.updateCategory(editCategory.id, form);
      } else {
        await window.electronAPI.createCategory(form);
      }
      setShowForm(false);
      setEditCategory(null);
      setForm({ nameAr: '', nameEn: '', description: '', sortOrder: 0 });
      loadData();
    } catch (e) { alert((e as Error).message); }
  };

  const handleEdit = (cat: Category) => {
    setForm({ nameAr: cat.nameAr, nameEn: cat.nameEn || '', description: cat.description || '', sortOrder: cat.sortOrder });
    setEditCategory(cat);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا القسم؟' : 'Are you sure you want to delete this category?')) return;
    await window.electronAPI.deleteCategory(id);
    loadData();
  };

  const handleAdd = () => {
    setForm({ nameAr: '', nameEn: '', description: '', sortOrder: 0 });
    setEditCategory(null);
    setShowForm(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('categories', language)}</h1>
        <button onClick={handleAdd} className="btn-primary text-sm">{t('add', language)}</button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="p-3 text-right font-medium">#</th>
              <th className="p-3 text-right font-medium">{t('categories', language)}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'الاسم بالإنجليزي' : 'English Name'}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'الترتيب' : 'Order'}</th>
              <th className="p-3 text-right font-medium">{language === 'ar' ? 'الحالة' : 'Status'}</th>
              <th className="p-3 text-right font-medium">{t('actions', language)}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, i) => (
              <tr key={cat.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="p-3 text-muted-foreground">{i + 1}</td>
                <td className="p-3 font-medium">{cat.nameAr}</td>
                <td className="p-3 text-muted-foreground">{cat.nameEn || '-'}</td>
                <td className="p-3 text-muted-foreground">{cat.sortOrder}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${cat.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {cat.active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => handleEdit(cat)} className="text-primary hover:underline text-sm ml-2">{t('edit', language)}</button>
                  <button onClick={() => handleDelete(cat.id)} className="text-red-600 hover:underline text-sm ml-2">{t('delete', language)}</button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t('noData', language)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl animate-pop-in">
            <h3 className="text-lg font-bold mb-4">
              {editCategory ? t('edit', language) : t('add', language)} {t('categories', language)}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('categories', language)}</label>
                <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="rtl" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الاسم بالإنجليزي' : 'English Name'}</label>
                <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('description', language)}</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" dir="rtl" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الترتيب' : 'Sort Order'}</label>
                <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowForm(false); setEditCategory(null); }} className="btn-outline text-sm">{t('cancel', language)}</button>
              <button onClick={handleSave} className="flex-1 btn-primary text-sm">{t('save', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
