import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Sparkles, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

const STEPS = ['Tier', 'Event Details', 'Stand Config', 'Brief', 'Financials'];

const TIERS = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'Perfect for small exhibitions and pop-up stands. Basic shell scheme setup with essential furnishings.',
    color: 'border-gray-300 bg-gray-50',
    selectedColor: 'border-brand-600 bg-brand-50 ring-2 ring-brand-600',
  },
  {
    key: 'professional',
    name: 'Professional',
    description: 'Full custom stand build with graphics, lighting and AV. Ideal for mid-size trade shows.',
    color: 'border-gray-300 bg-gray-50',
    selectedColor: 'border-brand-600 bg-brand-50 ring-2 ring-brand-600',
  },
  {
    key: 'premium',
    name: 'Premium',
    description: 'Bespoke design with premium materials, interactive displays, and full project management.',
    color: 'border-gray-300 bg-gray-50',
    selectedColor: 'border-brand-600 bg-brand-50 ring-2 ring-brand-600',
  },
];

const STAND_SIZES = [
  { key: 'small', label: 'Small', sqm: 9, desc: '3m x 3m' },
  { key: 'medium', label: 'Medium', sqm: 18, desc: '6m x 3m' },
  { key: 'large', label: 'Large', sqm: 36, desc: '6m x 6m' },
  { key: 'xl', label: 'XL', sqm: 72, desc: '12m x 6m' },
  { key: 'custom', label: 'Custom', sqm: 0, desc: 'Enter size' },
];

export default function ProjectCreate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedBrief, setParsedBrief] = useState(null);

  const [form, setForm] = useState({
    tier: '',
    event_name: '',
    event_date: '',
    venue_name: '',
    venue_city: '',
    venue_address: '',
    guest_count: '',
    stand_size: '',
    stand_sqm: '',
    stand_type: 'shell_scheme',
    raw_brief_text: '',
    project_budget: '',
    margin_pct: '20',
    contingency_pct: '5',
    vat_pct: '20',
  });

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const canNext = () => {
    switch (step) {
      case 0: return !!form.tier;
      case 1: return !!form.event_name && !!form.event_date;
      case 2: return (form.stand_size && form.stand_size !== 'custom') || (form.stand_size === 'custom' && form.stand_sqm > 0);
      case 3: return true;
      case 4: return true;
      default: return true;
    }
  };

  const handleParseBrief = async () => {
    if (!form.raw_brief_text.trim()) return;
    setParsing(true);
    try {
      const result = await api.post('/ai/parse-brief', { raw_brief_text: form.raw_brief_text });
      setParsedBrief(result);
    } catch (err) {
      alert('Failed to parse brief: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const selectedSize = STAND_SIZES.find((s) => s.key === form.stand_size);
      let standWidthM, standDepthM;
      if (form.stand_size === 'custom') {
        const customSqm = parseFloat(form.stand_sqm) || 0;
        standWidthM = Math.sqrt(customSqm);
        standDepthM = Math.sqrt(customSqm);
      } else if (selectedSize) {
        const dims = selectedSize.desc.split('x').map((d) => parseFloat(d.trim()));
        standWidthM = dims[0] || 0;
        standDepthM = dims[1] || 0;
      } else {
        standWidthM = 0;
        standDepthM = 0;
      }

      const payload = {
        name: form.event_name,
        tier: form.tier,
        event_name: form.event_name,
        event_date: form.event_date,
        venue_name: form.venue_name,
        venue_city: form.venue_city,
        venue_address: form.venue_address,
        guest_count: parseInt(form.guest_count) || 0,
        stand_size: form.stand_size,
        stand_width_m: standWidthM,
        stand_depth_m: standDepthM,
        stand_type: form.stand_type,
        raw_brief_text: form.raw_brief_text,
        project_budget: parseFloat(form.project_budget) || 0,
        default_margin_pct: parseFloat(form.margin_pct) || 20,
        default_contingency_pct: parseFloat(form.contingency_pct) || 5,
        default_vat_pct: parseFloat(form.vat_pct) || 20,
        parsed_brief_json: parsedBrief || null,
      };

      const project = await api.post('/projects', payload);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      alert('Failed to create project: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Create New Project</h1>
      <p className="text-sm text-gray-500 mb-8">Set up your exhibition project step by step</p>

      {/* Step Indicator */}
      <div className="flex items-center mb-10">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`ml-2 text-xs font-medium hidden sm:inline ${i <= step ? 'text-brand-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${i < step ? 'bg-brand-600' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 mb-8">
        {step === 0 && <StepTier form={form} set={set} />}
        {step === 1 && <StepEventDetails form={form} set={set} />}
        {step === 2 && <StepStandConfig form={form} set={set} />}
        {step === 3 && (
          <StepBrief form={form} set={set} onParse={handleParseBrief} parsing={parsing} parsedBrief={parsedBrief} setParsedBrief={setParsedBrief} />
        )}
        {step === 4 && <StepFinancials form={form} set={set} />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => canNext() && setStep(step + 1)}
            disabled={!canNext()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
        )}
      </div>
    </div>
  );
}

function StepTier({ form, set }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose Your Tier</h2>
      <p className="text-sm text-gray-500 mb-6">Select the service level that fits your event</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((tier) => (
          <button
            key={tier.key}
            onClick={() => set('tier', tier.key)}
            className={`text-left p-5 rounded-lg border-2 transition-all ${
              form.tier === tier.key ? tier.selectedColor : tier.color + ' hover:border-gray-400'
            }`}
          >
            <h3 className="font-semibold text-gray-900 mb-2">{tier.name}</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{tier.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepEventDetails({ form, set }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Event Details</h2>
      <p className="text-sm text-gray-500 mb-6">Tell us about the event</p>
      <div className="space-y-5">
        <Field label="Event Name *" value={form.event_name} onChange={(v) => set('event_name', v)} placeholder="e.g. London Tech Expo 2026" />
        <Field label="Event Date *" type="date" value={form.event_date} onChange={(v) => set('event_date', v)} />
        <Field label="Venue Name" value={form.venue_name} onChange={(v) => set('venue_name', v)} placeholder="e.g. ExCeL London" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Venue City" value={form.venue_city} onChange={(v) => set('venue_city', v)} placeholder="e.g. London" />
          <Field label="Guest Count" type="number" value={form.guest_count} onChange={(v) => set('guest_count', v)} placeholder="Expected visitors" />
        </div>
        <Field label="Venue Address" value={form.venue_address} onChange={(v) => set('venue_address', v)} placeholder="Full address" />
      </div>
    </div>
  );
}

function StepStandConfig({ form, set }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Stand Configuration</h2>
      <p className="text-sm text-gray-500 mb-6">Choose your stand size and type</p>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">Stand Size</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {STAND_SIZES.map((size) => (
            <button
              key={size.key}
              onClick={() => set('stand_size', size.key)}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                form.stand_size === size.key
                  ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900">{size.label}</div>
              {size.key !== 'custom' ? (
                <>
                  <div className="text-lg font-bold text-brand-600 mt-1">{size.sqm} sqm</div>
                  <div className="text-xs text-gray-500">{size.desc}</div>
                </>
              ) : (
                <div className="text-xs text-gray-500 mt-1">{size.desc}</div>
              )}
            </button>
          ))}
        </div>
        {form.stand_size === 'custom' && (
          <div className="mt-4 max-w-xs">
            <Field label="Custom Size (sqm)" type="number" value={form.stand_sqm} onChange={(v) => set('stand_sqm', v)} placeholder="Enter square metres" />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Stand Type</label>
        <div className="flex gap-4">
          {[
            { key: 'shell_scheme', label: 'Shell Scheme', desc: 'Pre-built modular walls and fascia' },
            { key: 'space_only', label: 'Space Only', desc: 'Raw floor space for custom builds' },
          ].map((type) => (
            <button
              key={type.key}
              onClick={() => set('stand_type', type.key)}
              className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${
                form.stand_type === type.key
                  ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900">{type.label}</div>
              <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepBrief({ form, set, onParse, parsing, parsedBrief, setParsedBrief }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Project Brief</h2>
      <p className="text-sm text-gray-500 mb-6">Paste or type your brief and let AI extract the key details</p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Raw Brief Text</label>
          <textarea
            value={form.raw_brief_text}
            onChange={(e) => set('raw_brief_text', e.target.value)}
            rows={8}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-y"
            placeholder="Paste the client's brief here... Include details about design preferences, branding requirements, furniture needs, AV equipment, etc."
          />
        </div>
        <button
          onClick={onParse}
          disabled={parsing || !form.raw_brief_text.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {parsing ? 'Parsing...' : 'Parse with AI'}
        </button>

        {parsedBrief && (
          <div className="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Parsed Brief Results
            </h3>
            <div className="space-y-3">
              {parsedBrief.categories && parsedBrief.categories.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Categories</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {parsedBrief.categories.map((cat, i) => (
                      <span key={i} className="bg-brand-100 text-brand-700 text-xs px-2.5 py-1 rounded-full font-medium">
                        {cat.name || cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {parsedBrief.requirements && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Requirements</label>
                  <ul className="mt-1 space-y-1">
                    {(Array.isArray(parsedBrief.requirements) ? parsedBrief.requirements : [parsedBrief.requirements]).map((req, i) => (
                      <li key={i} className="text-sm text-gray-700">- {typeof req === 'string' ? req : req.description || JSON.stringify(req)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {parsedBrief.summary && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Summary</label>
                  <p className="text-sm text-gray-700 mt-1">{parsedBrief.summary}</p>
                </div>
              )}
              {parsedBrief.estimated_budget && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Estimated Budget</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{parsedBrief.estimated_budget}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepFinancials({ form, set }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Financials</h2>
      <p className="text-sm text-gray-500 mb-6">Set the budget and financial parameters</p>
      <div className="space-y-5">
        <Field label="Project Budget (£)" type="number" value={form.project_budget} onChange={(v) => set('project_budget', v)} placeholder="e.g. 25000" />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Margin %" type="number" value={form.margin_pct} onChange={(v) => set('margin_pct', v)} />
          <Field label="Contingency %" type="number" value={form.contingency_pct} onChange={(v) => set('contingency_pct', v)} />
          <Field label="VAT %" type="number" value={form.vat_pct} onChange={(v) => set('vat_pct', v)} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, placeholder = '' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      />
    </div>
  );
}
