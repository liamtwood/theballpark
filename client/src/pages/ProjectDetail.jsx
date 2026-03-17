import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Send, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { formatGBP } from '../components/CurrencyDisplay';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

const TABS = ['Overview', 'Categories', 'Estimates', 'Messages'];

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [categories, setCategories] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const [proj, ests, msgs] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/estimates?project_id=${id}`).catch(() => []),
        api.get(`/messages?project_id=${id}`).catch(() => []),
      ]);
      setProject(proj);
      setCategories(proj.project_categories || []);
      setEstimates(Array.isArray(ests) ? ests : ests.data || []);
      setMessages(Array.isArray(msgs) ? msgs : msgs.data || []);
    } catch (err) {
      console.error('Failed to load project', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Project not found.</p>
        <Link to="/projects" className="text-brand-600 hover:text-brand-700 text-sm mt-2 inline-block">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.event_name || 'Untitled Project'}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
              {project.venue_name && <span>{project.venue_name}</span>}
              {project.venue_city && <span>· {project.venue_city}</span>}
              {project.event_date && <span>· {project.event_date}</span>}
            </div>
          </div>
          <StatusBadge status={project.status_name} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && <OverviewTab project={project} />}
      {activeTab === 'Categories' && <CategoriesTab projectId={id} categories={categories} onRefresh={loadProject} />}
      {activeTab === 'Estimates' && <EstimatesTab estimates={estimates} />}
      {activeTab === 'Messages' && <MessagesTab projectId={id} messages={messages} onRefresh={loadProject} />}
    </div>
  );
}

function OverviewTab({ project }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Event Details */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Event Details</h3>
        <dl className="space-y-3">
          <DetailRow label="Event Name" value={project.event_name} />
          <DetailRow label="Event Date" value={project.event_date || '-'} />
          <DetailRow label="Venue" value={project.venue_name} />
          <DetailRow label="City" value={project.venue_city} />
          <DetailRow label="Address" value={project.venue_address} />
          <DetailRow label="Guest Count" value={project.guest_count} />
          <DetailRow label="Tier" value={project.tier} />
        </dl>
      </div>

      {/* Stand Info */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Stand Configuration</h3>
        <dl className="space-y-3">
          <DetailRow label="Size" value={project.stand_size} />
          <DetailRow label="Area" value={(() => { const area = parseFloat(project.stand_width_m || 0) * parseFloat(project.stand_depth_m || 0); return area > 0 ? `${area} sqm` : '-'; })()} />
          <DetailRow label="Type" value={project.stand_type?.replace('_', ' ')} />
        </dl>
      </div>

      {/* Brief */}
      {project.raw_brief_text && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Brief</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{project.raw_brief_text}</p>
        </div>
      )}

      {/* Financials */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Financial Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Budget</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatGBP(project.project_budget || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Margin</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{project.default_margin_pct || 0}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Contingency</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{project.default_contingency_pct || 0}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Client Cost</p>
            <p className="text-lg font-bold text-brand-600 mt-1">{formatGBP(project.total_client_cost || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoriesTab({ projectId, categories, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ category_name: '', requirement_brief: '' });
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await api.post('/project-categories', { project_id: projectId, name: addForm.category_name, requirement_brief: addForm.requirement_brief });
      setShowAdd(false);
      setAddForm({ category_name: '', requirement_brief: '' });
      onRefresh();
    } catch (err) {
      alert('Failed to add category: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Cost Breakdown by Category</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Category
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-gray-500">No categories yet. Add a category to start building your estimate.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Brief</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ballpark</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Base Cost</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Contingency</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Subtotal</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Margin</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Net Cost</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">VAT</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Client Cost</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {cat.icon && <span className="text-base">{cat.icon}</span>}
                      {cat.category_name || cat.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{cat.requirement_brief || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatGBP(cat.ballpark_cost || 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatGBP(cat.base_cost || 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatGBP(cat.contingency_amount || 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatGBP(cat.subtotal || 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatGBP(cat.margin_amount || 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatGBP(cat.net_cost || 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatGBP(cat.vat_amount || 0)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatGBP(cat.client_cost || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={cat.status_name || 'pending'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Category">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
            <input
              type="text"
              value={addForm.category_name}
              onChange={(e) => setAddForm((prev) => ({ ...prev, category_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. Graphics, AV, Furniture"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requirement Brief</label>
            <textarea
              value={addForm.requirement_brief}
              onChange={(e) => setAddForm((prev) => ({ ...prev, requirement_brief: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-y"
              placeholder="Describe what's needed for this category..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={adding || !addForm.category_name}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-40"
            >
              {adding ? 'Adding...' : 'Add Category'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EstimatesTab({ estimates }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Estimates</h3>
      {estimates.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-gray-500">No estimates generated yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {estimates.map((est) => (
            <div key={est.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Version {est.version || est.id}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Created {est.created_at ? new Date(est.created_at).toLocaleDateString('en-GB') : '-'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total Value</p>
                    <p className="text-sm font-bold text-gray-900">{formatGBP(est.total_value || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Balls Cost</p>
                    <p className="text-sm font-bold text-purple-600">{est.balls_cost || 0} balls</p>
                  </div>
                  <StatusBadge status={est.status_name || 'draft'} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessagesTab({ projectId, messages, onRefresh }) {
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await api.post('/messages', { project_id: projectId, body: newMsg, direction: 'outbound', subject: 'Message' });
      setNewMsg('');
      onRefresh();
    } catch (err) {
      alert('Failed to send message: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Messages</h3>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="max-h-96 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No messages yet. Start the conversation.</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.direction === 'outbound' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.direction === 'outbound' ? 'bg-brand-100' : 'bg-gray-100'}`}>
                  <span className={`text-xs font-semibold ${msg.direction === 'outbound' ? 'text-brand-600' : 'text-gray-600'}`}>
                    {(msg.sender_name || msg.role || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className={`flex-1 min-w-0 ${msg.direction === 'outbound' ? 'text-right' : ''}`}>
                  <div className={`flex items-center gap-2 ${msg.direction === 'outbound' ? 'justify-end' : ''}`}>
                    <span className="text-sm font-medium text-gray-900">{msg.sender_name || msg.role || 'User'}</span>
                    <span className="text-xs text-gray-400">
                      {msg.created_at ? new Date(msg.created_at).toLocaleString('en-GB') : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{msg.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMsg.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 capitalize">{value || '-'}</dd>
    </div>
  );
}
