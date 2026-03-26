import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Settings, User, Receipt, FileText, ShieldAlert, BarChart2 } from 'lucide-react';
import { DemoFlow } from './components/demo/demo-flow';
import { TaxSituationForm } from './components/TaxSituationForm';
import { W2CaptureZone } from './components/W2CaptureZone';
import { TaxProgressIndicator } from './components/TaxProgressIndicator';
import { SettingsView } from './components/SettingsView';
import { AdminPanel } from './components/AdminPanel';
import { TierResultsView } from './components/TierResultsView';
import type { W2ExtractedData } from 'core';
import { InstallPrompt } from './components/pwa/install-prompt';

function App() {
  const { user, logout, loading } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  // Core Layout State
  // Role-aware default: superadmin can be directed to 'admin' in the future (#81).
  const defaultView = isSuperadmin ? 'tax-situation' : 'tax-situation';
  const [activeView, setActiveView] = useState<
    'demo' | 'tax-situation' | 'tier-results' | 'settings' | 'admin'
  >(defaultView as 'demo' | 'tax-situation' | 'tier-results' | 'settings' | 'admin');

  // W-2 extraction state: null = not yet extracted, data = confirmed extraction
  const [w2Data, setW2Data] = useState<W2ExtractedData | null>(null);
  // Whether the W2CaptureZone step has been completed (skipped or confirmed)
  const [w2StepDone, setW2StepDone] = useState(false);
  // Current step (1-based) within the Tax Situation Protocol flow (1 = W-2 Import … 7 = Review)
  const [taxCurrentStep, setTaxCurrentStep] = useState(1);

  // Redirect non-superadmin users away from the admin view if they somehow land there
  useEffect(() => {
    if (activeView === 'admin' && !isSuperadmin) {
      setActiveView('tax-situation');
    }
  }, [activeView, isSuperadmin]);

  // Reset W-2 capture state when navigating away from tax-situation
  useEffect(() => {
    if (activeView !== 'tax-situation') {
      setW2Data(null);
      setW2StepDone(false);
      setTaxCurrentStep(1);
    }
  }, [activeView]);

  // When W-2 step completes, advance to step 2 (Filing Basics)
  useEffect(() => {
    if (w2StepDone && taxCurrentStep === 1) {
      setTaxCurrentStep(2);
    }
  }, [w2StepDone, taxCurrentStep]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-surface-800"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen w-full bg-surface-50 font-sans overflow-hidden text-surface-800">
      {/* Left Sidebar - hidden on mobile, visible on sm+ */}
      <nav className="hidden sm:flex w-16 shrink-0 border-r border-surface-200 bg-white flex-col items-center py-6 justify-between z-10">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-lg">T</span>
          </div>

          <div className="flex flex-col gap-4 mt-4 w-full px-2">
            <button
              onClick={() => setActiveView('demo')}
              className={`p-3 rounded-lg flex items-center justify-center transition-all ${activeView === 'demo' ? 'bg-accent-500/10 text-accent-500' : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'}`}
              title="Tax Demo"
            >
              <Receipt size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setActiveView('tax-situation')}
              className={`p-3 rounded-lg flex items-center justify-center transition-all ${activeView === 'tax-situation' ? 'bg-accent-500/10 text-accent-500' : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'}`}
              title="Tax Situation"
            >
              <FileText size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setActiveView('tier-results')}
              className={`p-3 rounded-xl flex items-center justify-center transition-all ${activeView === 'tier-results' ? 'bg-accent-500/10 text-accent-500' : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'}`}
              title="Tier Results"
              data-testid="tier-results-nav-item"
            >
              <BarChart2 size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className={`p-3 rounded-lg flex items-center justify-center transition-all ${activeView === 'settings' ? 'bg-accent-500/10 text-accent-500' : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'}`}
              title="Settings"
            >
              <Settings size={20} strokeWidth={2.5} />
            </button>
            {isSuperadmin && (
              <button
                onClick={() => setActiveView('admin')}
                className={`p-3 rounded-lg flex items-center justify-center transition-all ${activeView === 'admin' ? 'bg-accent-500/10 text-accent-500' : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'}`}
                title="Admin"
                data-testid="admin-nav-item"
              >
                <ShieldAlert size={20} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={logout}
            className="w-10 h-10 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-red-500 outline-none"
          >
            <User size={18} />
          </button>
        </div>
      </nav>

      {/* Main Application Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Full-width Content Panel */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Header */}
          <header className="h-12 px-5 border-b border-surface-200 flex items-center justify-between shrink-0 bg-white shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-accent-500 ring-2 ring-accent-400/20" />
              <h1 className="text-sm font-semibold tracking-tight text-surface-800">Tea Tax</h1>
            </div>
            {/* Mobile logout button in header */}
            <button
              onClick={logout}
              className="sm:hidden w-8 h-8 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              aria-label="Log out"
            >
              <User size={16} />
            </button>
          </header>

          {/* Tax Situation progress indicator — only shown in tax-situation view */}
          {activeView === 'tax-situation' && (
            <TaxProgressIndicator
              currentStep={taxCurrentStep}
              completedSteps={
                w2StepDone ? Array.from({ length: taxCurrentStep - 1 }, (_, i) => i + 1) : []
              }
            />
          )}

          {/* Content — add bottom padding on mobile to account for bottom nav */}
          <div className="flex-1 overflow-hidden overflow-y-auto pb-16 sm:pb-0">
            {activeView === 'demo' && <DemoFlow onExit={() => setActiveView('tax-situation')} />}
            {activeView === 'tax-situation' && !w2StepDone && (
              <W2CaptureZone
                onExtracted={(data) => {
                  setW2Data(data);
                  setW2StepDone(true);
                }}
                onSkip={() => {
                  setW2Data(null);
                  setW2StepDone(true);
                }}
              />
            )}
            {activeView === 'tax-situation' && w2StepDone && (
              <TaxSituationForm
                taxObjectId="demo-tax-object-id"
                returnId="demo-return-id"
                w2Data={w2Data}
                onViewTierResults={() => setActiveView('tier-results')}
                onStepChange={setTaxCurrentStep}
              />
            )}
            {activeView === 'tier-results' && (
              <TierResultsView taxObjectId="demo-tax-object-id" returnId="demo-return-id" />
            )}
            {activeView === 'settings' && <SettingsView />}
            {activeView === 'admin' && isSuperadmin && <AdminPanel />}
            {activeView === 'admin' && !isSuperadmin && (
              <div className="p-8 text-red-500 text-sm">Access denied.</div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom tab bar — visible only on mobile (hidden on sm+) */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-surface-200 flex items-center justify-around h-16"
        aria-label="Bottom navigation"
      >
        <button
          onClick={() => setActiveView('demo')}
          className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors ${activeView === 'demo' ? 'text-accent-500' : 'text-surface-400'}`}
          aria-current={activeView === 'demo' ? 'page' : undefined}
        >
          <Receipt size={22} strokeWidth={2} />
          <span>Demo</span>
        </button>
        <button
          onClick={() => setActiveView('tax-situation')}
          className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors ${activeView === 'tax-situation' ? 'text-accent-500' : 'text-surface-400'}`}
          aria-current={activeView === 'tax-situation' ? 'page' : undefined}
        >
          <FileText size={22} strokeWidth={2} />
          <span>Tax</span>
        </button>
        <button
          onClick={() => setActiveView('tier-results')}
          className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors ${activeView === 'tier-results' ? 'text-accent-500' : 'text-surface-400'}`}
          aria-current={activeView === 'tier-results' ? 'page' : undefined}
          data-testid="tier-results-nav-item-mobile"
        >
          <BarChart2 size={22} strokeWidth={2} />
          <span>Tiers</span>
        </button>
        <button
          onClick={() => setActiveView('settings')}
          className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors ${activeView === 'settings' ? 'text-accent-500' : 'text-surface-400'}`}
          aria-current={activeView === 'settings' ? 'page' : undefined}
        >
          <Settings size={22} strokeWidth={2} />
          <span>Settings</span>
        </button>
        {isSuperadmin && (
          <button
            onClick={() => setActiveView('admin')}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors ${activeView === 'admin' ? 'text-accent-500' : 'text-surface-400'}`}
            aria-current={activeView === 'admin' ? 'page' : undefined}
            data-testid="admin-nav-item-mobile"
          >
            <ShieldAlert size={22} strokeWidth={2} />
            <span>Admin</span>
          </button>
        )}
      </nav>

      {/* PWA install prompt — rendered near root so it is reachable from any view */}
      <InstallPrompt />
    </div>
  );
}

export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
