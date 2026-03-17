import React, { useState, useEffect } from 'react';
import { Save, Loader2, Users, CreditCard, Grid3x3 } from 'lucide-react';
import { api } from '../lib/api';

export default function Settings() {
  const [org, setOrg] = useState(null);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    name: '',
    address: '',
    vat_pct: '20',
    default_margin_pct: '20',
    default_contingency_pct: '5',
  });

  useEffect(() => {
    Promise.all([
      api.get('/org').catch(() => null),
      api.get('/org/users').catch(() => []),
      api.get('/categories').catch(() => []),
    ]).then(([orgData, usersData, catsData]) => {
      if (orgData) {
        setOrg(orgData);
        setForm({
          name: orgData.name || orgData.org_name || '',
          address: orgData.address || '',
          vat_pct: String(orgData.vat_pct ?? orgData.default_vat_pct ?? 20),
          default_margin_pct: String(orgData.default_margin_pct ?? orgData.margin_pct ?? 20),
          default_contingency_pct: String(orgData.default_contingency_pct ?? orgData.contingency_pct ?? 5),
        });
      }
      setUsers(Array.isArray(usersData) ? usersData : usersData.data || []);
      setCategories(Array.isArray(catsData) ? catsData : []);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/org', {
        name: form.name,
        address: form.address,
        vat_pct: parseFloat(form.vat_pct),
        default_margin_pct: parseFloat(form.default_margin_pct),
        default_contingency_pct: parseFloat(form.default_contingency_pct),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your organisation settings and team</p>

      {/* Subscription Tier */}
      {org && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <CreditCard className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center rounded-full bg-brand-100 text-brand-700 px-3 py-1 text-sm font-semibold capitalize">
              {org.tier || org.subscription_tier || 'Free'}
            </span>
            {org.balls_balance !== undefined && (
              <span className="text-sm text-gray-500">
                Balance: <span className="font-semibold text-gray-900">{org.balls_balance} balls</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Org Settings */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Organisation Details</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organisation Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-y"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default VAT %</label>
              <input
                type="number"
                value={form.vat_pct}
                onChange={(e) => setForm((prev) => ({ ...prev, vat_pct: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Margin %</label>
              <input
                type="number"
                value={form.default_margin_pct}
                onChange={(e) => setForm((prev) => ({ ...prev, default_margin_pct: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Contingency %</label>
              <input
                type="number"
                value={form.default_contingency_pct}
                onChange={(e) => setForm((prev) => ({ ...prev, default_contingency_pct: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved successfully!</span>}
        </div>
      </div>

      {/* Users */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
        </div>
        {users.length === 0 ? (
          <p className="text-sm text-gray-500">No team members found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-brand-600">
                      {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.name || 'Unnamed'}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-100 px-2.5 py-1 rounded-full">
                  {user.role || 'member'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <Grid3x3 className="w-5 h-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-500">No categories found.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-900">{cat.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
