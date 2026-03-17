import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban, TrendingUp, Banknote, Circle } from 'lucide-react';
import { api } from '../lib/api';
import { formatGBP } from '../components/CurrencyDisplay';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [ballsBalance, setBallsBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/projects').catch(() => []),
      api.get('/org/balls-balance').catch(() => ({ balance: 0 })),
    ]).then(([proj, balls]) => {
      setProjects(Array.isArray(proj) ? proj : proj.data || []);
      setBallsBalance(balls.balance ?? balls.balls_balance ?? 0);
      setLoading(false);
    });
  }, []);

  const activeProjects = projects.filter((p) => p.status_name === 'active');
  const totalBudget = projects.reduce((sum, p) => sum + (parseFloat(p.total_client_cost) || parseFloat(p.project_budget) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your projects and activity</p>
        </div>
        <Link
          to="/projects/new"
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard
          icon={<FolderKanban className="w-5 h-5 text-brand-600" />}
          label="Total Projects"
          value={projects.length}
          bg="bg-brand-50"
        />
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          label="Active Projects"
          value={activeProjects.length}
          bg="bg-green-50"
        />
        <SummaryCard
          icon={<Banknote className="w-5 h-5 text-purple-600" />}
          label="Total Budget"
          value={formatGBP(totalBudget)}
          bg="bg-purple-50"
        />
        <SummaryCard
          icon={<Circle className="w-5 h-5 text-blue-600" />}
          label="Balls Balance"
          value={ballsBalance}
          bg="bg-blue-50"
        />
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Projects</h2>
        </div>
        {projects.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No projects yet. Create your first project to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {projects.slice(0, 10).map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{project.event_name || project.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {project.venue_city && `${project.venue_city} · `}
                    {project.event_date || ''}
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

function SummaryCard({ icon, label, value, bg }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}
