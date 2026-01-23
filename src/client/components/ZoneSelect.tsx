import { useState, useMemo } from 'react';
import type { ZoneInfo } from '../hooks/useSocket';

interface ZoneSelectProps {
  zones: ZoneInfo[];
  zonesLoading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onDeploy: () => void;
  onBack: () => void;
}

export default function ZoneSelect({
  zones,
  zonesLoading,
  selectedIds,
  onSelectionChange,
  onDeploy,
  onBack,
}: ZoneSelectProps) {
  const [filter, setFilter] = useState('');

  const filteredZones = useMemo(() => {
    if (!filter.trim()) {return zones;}
    const lowerFilter = filter.toLowerCase();
    return zones.filter(
      (zone) => zone.domain.toLowerCase().includes(lowerFilter)
    );
  }, [zones, filter]);

  const handleToggleZone = (zoneId: string) => {
    if (selectedIds.includes(zoneId)) {
      onSelectionChange(selectedIds.filter((id) => id !== zoneId));
    } else {
      onSelectionChange([...selectedIds, zoneId]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(filteredZones.map((z) => z.id));
  };

  const handleDeselectAll = () => {
    const filteredIds = new Set(filteredZones.map((z) => z.id));
    onSelectionChange(selectedIds.filter((id) => !filteredIds.has(id)));
  };

  const allFilteredSelected = filteredZones.every((z) =>
    selectedIds.includes(z.id)
  );

  // Show loading spinner while zones are being fetched
  if (zonesLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Loading Zones
          </h2>
          <p className="text-gray-600">
            Fetching your Cloudflare zones...
          </p>
        </div>
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <div className="text-yellow-500 text-5xl mb-4">⚠</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            No Zones Found
          </h2>
          <p className="text-gray-600 mb-6">
            No Cloudflare zones were found with your token. Make sure your token
            has access to at least one zone with DNS records.
          </p>
          <button onClick={onBack} className="btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Select Zones to Protect
        </h2>
        <p className="text-gray-600">
          Choose which Cloudflare zones should be protected by the bouncer
        </p>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter zones by name..."
              className="input-field"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={allFilteredSelected ? handleDeselectAll : handleSelectAll}
              className="btn-secondary whitespace-nowrap"
            >
              {allFilteredSelected
                ? filter.trim() ? 'Deselect All Filtered Zones' : 'Deselect All'
                : filter.trim() ? 'Select All Filtered Zones' : 'Select All'}
            </button>
          </div>
        </div>

        <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
          {filteredZones.map((zone) => (
            <label
              key={zone.id}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(zone.id)}
                onChange={() => handleToggleZone(zone.id)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">
                  {zone.domain}
                </div>
                <div className="text-sm text-gray-500">
                  Account: {zone.accountName}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {zone.actions.join(', ')}
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          {selectedIds.length} of {zones.length} zones selected
        </div>

        <div className="flex gap-4 mt-6">
          <button onClick={onBack} className="btn-secondary flex-1">
            Back
          </button>
          <button
            onClick={onDeploy}
            disabled={selectedIds.length === 0}
            className="btn-primary flex-1"
          >
            Deploy to {selectedIds.length} Zone{selectedIds.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
