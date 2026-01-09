import { useState, useRef, useCallback } from 'react';
import { useSocket, type ZoneInfo } from './hooks/useSocket';
import type { Action, WizardStep, WizardState } from './types';
import ActionSelect from './components/ActionSelect';
import CredentialsForm from './components/CredentialsForm';
import ClearConfirm from './components/ClearConfirm';
import ZoneSelect from './components/ZoneSelect';
import CommandOutput from './components/CommandOutput';
import SuccessScreen from './components/SuccessScreen';
import Header from './components/Header';

const initialState: WizardState = {
  step: 'action-select',
  action: null,
  cloudflareToken: '',
  crowdsecLapiUrl: '',
  crowdsecLapiKey: '',
  selectedZoneIds: [],
};

type PendingOperation = 'generate-config' | 'deploy' | 'clear' | null;

export default function App() {
  const [state, setState] = useState<WizardState>(initialState);
  const pendingOperationRef = useRef<PendingOperation>(null);
  const loadZonesRef = useRef<() => void>(() => {});

  // Handle command completion via callback (instead of useEffect)
  const handleCommandComplete = useCallback((exitCode: number) => {
    if (exitCode === 0) {
      const operation = pendingOperationRef.current;
      if (operation === 'generate-config') {
        // After generating config, load zones and move to zone selection
        loadZonesRef.current();
        setState((s) => ({ ...s, step: 'zone-select' }));
      } else {
        // Deploy or clear completed successfully
        setState((s) => ({ ...s, step: 'success' }));
      }
    } else {
      setState((s) => ({ ...s, step: 'error' }));
    }
    pendingOperationRef.current = null;
  }, []);

  // Handle zones loaded via callback (instead of useEffect)
  // Auto-select all zones when first loaded
  const handleZonesLoaded = useCallback((zones: ZoneInfo[]) => {
    setState((s) => ({
      ...s,
      selectedZoneIds: zones.map((z) => z.id),
    }));
  }, []);

  const socket = useSocket({
    onCommandComplete: handleCommandComplete,
    onZonesLoaded: handleZonesLoaded,
  });

  // Keep ref updated for use in callbacks
  loadZonesRef.current = socket.loadZones;

  const handleActionSelect = (action: Action) => {
    setState((s) => ({ ...s, action, step: 'credentials' }));
  };

  const handleCredentialsSubmit = (credentials: {
    cloudflareToken: string;
    crowdsecLapiUrl: string;
    crowdsecLapiKey: string;
  }) => {
    setState((s) => ({
      ...s,
      ...credentials,
    }));

    if (state.action === 'clear') {
      setState((s) => ({ ...s, step: 'clear-confirm' }));
    } else {
      // Deploy flow: generate config first (with Lapi credentials)
      pendingOperationRef.current = 'generate-config';
      setState((s) => ({ ...s, step: 'executing' }));
      socket.generateConfig(
        credentials.cloudflareToken,
        credentials.crowdsecLapiUrl,
        credentials.crowdsecLapiKey
      );
    }
  };

  const handleClearConfirm = () => {
    pendingOperationRef.current = 'clear';
    setState((s) => ({ ...s, step: 'executing' }));
    socket.clear();
  };

  const handleClearCancel = () => {
    setState(initialState);
  };

  const handleZoneSelectionChange = (zoneIds: string[]) => {
    setState((s) => ({ ...s, selectedZoneIds: zoneIds }));
  };

  const handleDeploy = async () => {
    socket.clearOutput();
    pendingOperationRef.current = 'deploy';
    setState((s) => ({ ...s, step: 'executing' }));
    try {
      await socket.updateZones(state.selectedZoneIds);
      socket.deploy(state.crowdsecLapiUrl, state.crowdsecLapiKey);
    } catch (_error) {
      pendingOperationRef.current = null;
      setState((s) => ({ ...s, step: 'error' }));
    }
  };

  const handleBack = () => {
    const stepOrder: WizardStep[] = [
      'action-select',
      'credentials',
      'clear-confirm',
      'zone-select',
    ];
    const currentIndex = stepOrder.indexOf(state.step);
    if (currentIndex > 0) {
      setState((s) => ({ ...s, step: stepOrder[currentIndex - 1] }));
    }
  };

  const handleReset = () => {
    socket.clearOutput();
    socket.setZones([]);
    pendingOperationRef.current = null;
    setState(initialState);
  };

  const renderStep = () => {
    switch (state.step) {
      case 'action-select':
        return <ActionSelect onSelect={handleActionSelect} />;

      case 'credentials':
        return state.action && (
          <CredentialsForm
            action={state.action}
            onSubmit={handleCredentialsSubmit}
            onBack={handleBack}
          />
        );

      case 'clear-confirm':
        return (
          <ClearConfirm
            onConfirm={handleClearConfirm}
            onCancel={handleClearCancel}
          />
        );

      case 'zone-select':
        return (
          <ZoneSelect
            zones={socket.zones}
            zonesLoading={socket.zonesLoading}
            selectedIds={state.selectedZoneIds}
            onSelectionChange={handleZoneSelectionChange}
            onDeploy={handleDeploy}
            onBack={handleBack}
          />
        );

      case 'executing':
        return (
          <CommandOutput
            output={socket.output}
            isRunning={socket.isRunning}
          />
        );

      case 'success':
        return state.action && (
          <SuccessScreen
            action={state.action}
            onReset={handleReset}
          />
        );

      case 'error':
        return (
          <div className="card max-w-2xl mx-auto text-center">
            <div className="text-red-500 text-5xl mb-4">✗</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Operation Failed
            </h2>
            <p className="text-gray-600 mb-6">
              An error occurred. Check the output below for details.
            </p>
            <CommandOutput output={socket.output} isRunning={false} />
            <button onClick={handleReset} className="btn-primary mt-6">
              Start Over
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {renderStep()}
      </main>
    </div>
  );
}
