import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, User, FolderKanban } from 'lucide-react';
import { api } from '../lib/api';
import { formatGBP } from '../components/CurrencyDisplay';
import StatusBadge from '../components/StatusBadge';

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/clients/${id}`),
      api.get(`/clients/${id}/projects`).catch(() => []),
    ])
      .then(([c, p]) => {
        setClient(c);
        setProjects(Array.isArray(p) ? p : p.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading client...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Client not found.</p>
        <Link to="/clients" className="text-brand-600 hover:text-brand-700 text-sm mt-2 inline-block">Back to Clients</Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Link>

      {/* Client Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-brand-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{client.name || client.org_name}</h1>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              {client.contact_name && (
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-gray-400" />
                  {client.contact_name}
                </span>
              )}
              {(client.email || client.contact_email) && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {client.email || client.contact_email}
                </span>
              )}
              {(client.phone || client.contact_phone) && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {client.phone || client.contact_phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client Projects */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
        </div>
        {projects.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No projects for this client yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{project.event_name || project.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {project.event_date || ''}
                    {project.venue_city && ` · ${project.venue_city}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <span className="text-sm font-medium text-gray-700">
                    {formatGBP(project.total_client_cost || project.project_budget || 0)}
                  </span>
                  <StatusBadge status={project.status_name} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
