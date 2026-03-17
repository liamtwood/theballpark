import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Truck, Package } from 'lucide-react';
import { api } from '../lib/api';
import { formatGBP } from '../components/CurrencyDisplay';

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [catalogues, setCatalogues] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/suppliers')
      .then((data) => setSuppliers(Array.isArray(data) ? data : data.data || []))
      .catch(() => setSuppliers([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (supplierId) => {
    const isExpanded = expanded[supplierId];
    setExpanded((prev) => ({ ...prev, [supplierId]: !isExpanded }));

    if (!isExpanded && !catalogues[supplierId]) {
      try {
        const items = await api.get(`/suppliers/${supplierId}/catalogue`);
        setCatalogues((prev) => ({ ...prev, [supplierId]: Array.isArray(items) ? items : items.data || [] }));
      } catch {
        setCatalogues((prev) => ({ ...prev, [supplierId]: [] }));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading suppliers...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        <p className="text-sm text-gray-500 mt-1">{suppliers.length} registered suppliers</p>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-16 text-center">
          <Truck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No suppliers found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleExpand(supplier.id)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Truck className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{supplier.name || supplier.org_name}</p>
                    <p className="text-xs text-gray-500">
                      {supplier.contact_email || supplier.email || 'No email'}
                      {supplier.city && ` · ${supplier.city}`}
                    </p>
                  </div>
                </div>
                {expanded[supplier.id] ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {expanded[supplier.id] && (
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                  {!catalogues[supplier.id] ? (
                    <p className="text-sm text-gray-400">Loading catalogue...</p>
                  ) : catalogues[supplier.id].length === 0 ? (
                    <p className="text-sm text-gray-400">No catalogue items.</p>
                  ) : (
                    <CatalogueByCategory items={catalogues[supplier.id]} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogueByCategory({ items }) {
  const grouped = items.reduce((acc, item) => {
    const cat = item.category_name || 'Uncategorised';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category}>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
            <Package className="w-3.5 h-3.5" />
            {category}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {catItems.map((item) => (
              <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name || item.item_name}</p>
                  {item.description && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[250px]">{item.description}</p>}
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {formatGBP(item.base_price || 0)}
                  </span>
                  {item.tier && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium capitalize">
                      {item.tier}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
