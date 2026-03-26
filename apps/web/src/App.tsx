import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import {
  Settings,
  User,
  FileText,
  BarChart2,
  Users,
  ClipboardList,
  Activity,
  Shield,
  MonitorPlay,
  ListTodo,
} from 'lucide-react';
import { TaxSituationForm } from './components/TaxSituationForm';
import { W2CaptureZone } from './components/W2CaptureZone';
import { TaxProgressIndicator } from './components/TaxProgressIndicator';
import { SettingsView } from './components/SettingsView';
import { AdminPanel } from './components/AdminPanel';
import { TierResultsView } from './components/TierResultsView';
import type { W2ExtractedData, ParsedTaxFields } from 'core';
import { InstallPrompt } from './components/pwa/install-prompt';
import { IntakeSelector } from './components/IntakeSelector';
import type { AdminSection } from './components/AdminPanel';
import { useTaxObject } from './hooks/use-tax-object';

// Admin section nav items (superadmin-only global nav)
const ADMIN_NAV_ITEMS: {
  id: AdminSection;
  label: string;
  icon: React.ReactNode;
  iconMobile: React.ReactNode;
}[] = [
  {
    id: 'users',
    label: 'Users',
    icon: <Users size={20} strokeWidth={2.5} />,
    iconMobile: <Users size={22} strokeWidth={2} />,
  },
  {
    id: 'registrations',
    label: 'Registrations',
    icon: <ClipboardList size={20} strokeWidth={2.5} />,
    iconMobile: <ClipboardList size={22} strokeWidth={2} />,
  },
  {
    id: 'tax-activity',
    label: 'Tax Activity',
    icon: <Activity size={20} strokeWidth={2.5} />,
    iconMobile: <Activity size={22} strokeWidth={2} />,
  },
  {
    id: 'audit',
    label: 'Audit Log',
    icon: <Shield size={20} strokeWidth={2.5} />,
    iconMobile: <Shield size={22} strokeWidth={2} />,
  },
  {
    id: 'demo-status',
    label: 'Demo Status',
    icon: <MonitorPlay size={20} strokeWidth={2.5} />,
    iconMobile: <MonitorPlay size={22} strokeWidth={2} />,
  },
  {
    id: 'task-queue',
    label: 'Task Queue',
    icon: <ListTodo size={20} strokeWidth={2.5} />,
    iconMobile: <ListTodo size={22} strokeWidth={2} />,
  },
];

type FilerView = 'tax-situation' | 'tier-results' | 'settings';
type ActiveView = FilerView | AdminSection;

function App() {
  const { user, logout, loading } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  // Bootstrap real tax object and return IDs for filer users.
  // Disabled for superadmins (who have no personal tax objects).
  const {
    taxObjectId,
    returnId,
    loading: taxObjectLoading,
    error: taxObjectError,
  } = useTaxObject(!!user && !isSuperadmin);

  // Role-aware default: superadmin lands on Users section; filers land on Tax Situation.
  const defaultView: ActiveView = isSuperadmin ? 'users' : 'tax-situation';
  const [activeView, setActiveView] = useState<ActiveView>(defaultView);

  /**
   * Tax-situation intake state machine.
   *
   *   'selector'  — entry: user picks AI wizard or manual form
   *   'ai-wizard' — AI-assisted: W-2 upload or describe → feeds extracted data into form
   *   'form'      — TaxSituationForm (pre-populated or empty)
   */
  const [taxIntakePath, setTaxIntakePath] = useState<'selector' | 'ai-wizard' | 'form'>('selector');
  // Extracted W-2 data to pre-populate TaxSituationForm after the AI wizard
  const [w2Data, setW2Data] = useState<W2ExtractedData | null>(null);
  // Parsed fields from the describe-path to pre-populate TaxSituationForm
  const [parsedFields, setParsedFields] = useState<ParsedTaxFields | null>(null);
  // Current step (1-based) within the tax intake form flow (1 = W-2 Import … 7 = Review)
  const [taxCurrentStep, setTaxCurrentStep] = useState(1);

  // Guard: redirect superadmin away from filer views, redirect filer away from admin sections
  useEffect(() => {
    const filerViews: string[] = ['tax-situation', 'tier-results', 'settings'];
    const adminSections: string[] = ADMIN_NAV_ITEMS.map((item) => item.id);
    if (isSuperadmin && filerViews.includes(activeView)) {
      setActiveView('users');
    } else if (!isSuperadmin && adminSections.includes(activeView)) {
      setActiveView('tax-situation');
    }
  }, [activeView, isSuperadmin]);

  // Reset tax intake state when navigating away from tax-situation
  useEffect(() => {
    if (activeView !== 'tax-situation') {
      setW2Data(null);
      setParsedFields(null);
      setTaxIntakePath('selector');
      setTaxCurrentStep(1);
    }
  }, [activeView]);

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

  // Defer filer views until real IDs are resolved; show spinner or error.
  if (!isSuperadmin && taxObjectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-surface-800"></div>
      </div>
    );
  }

  if (!isSuperadmin && taxObjectError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center p-8">
          <p className="text-red-600 font-medium mb-2">Unable to load your tax data</p>
          <p className="text-surface-500 text-sm">{taxObjectError}</p>
        </div>
      </div>
    );
  }

  // Determine active admin section (null when a filer view is active)
  const adminSectionIds = ADMIN_NAV_ITEMS.map((item) => item.id as string);
  const activeAdminSection = adminSectionIds.includes(activeView)
    ? (activeView as AdminSection)
    : null;

  return (
    <div className="flex h-screen w-full bg-surface-50 font-sans overflow-hidden text-surface-800">
      {/* Left Sidebar - hidden on mobile, visible on sm+ */}
      <nav className="hidden sm:flex w-16 shrink-0 border-r border-surface-200 bg-white flex-col items-center py-6 justify-between z-10">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-lg">T</span>
          </div>

          <div className="flex flex-col gap-4 mt-4 w-full px-2">
            {isSuperadmin ? (
              // Superadmin: show only the six admin section icons
              ADMIN_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`p-3 rounded-lg flex items-center justify-center transition-all ${activeView === item.id ? 'bg-accent-500/10 text-accent-500' : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'}`}
                  title={item.label}
                  data-testid={`admin-nav-${item.id}`}
                >
                  {item.icon}
                </button>
              ))
            ) : (
              // Filer: show tax-situation, tier-results, settings
              <>
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
              </>
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
                taxIntakePath === 'form'
                  ? Array.from({ length: taxCurrentStep - 1 }, (_, i) => i + 1)
                  : []
              }
            />
          )}

          {/* Content — add bottom padding on mobile to account for bottom nav */}
          <div className="flex-1 overflow-hidden overflow-y-auto pb-16 sm:pb-0">
            {/* Filer-only views: guarded against superadmin access */}
            {!isSuperadmin && activeView === 'tax-situation' && taxIntakePath === 'selector' && (
              <IntakeSelector
                onSelectAiWizard={() => setTaxIntakePath('ai-wizard')}
                onSelectManual={() => setTaxIntakePath('form')}
              />
            )}
            {!isSuperadmin && activeView === 'tax-situation' && taxIntakePath === 'ai-wizard' && (
              <div className="max-w-3xl mx-auto px-4 py-6">
                <W2CaptureZone
                  onExtracted={(data) => {
                    setW2Data(data);
                    setParsedFields(null);
                    setTaxIntakePath('form');
                  }}
                  onDescriptionParsed={(fields) => {
                    setParsedFields(fields);
                    setW2Data(null);
                    setTaxIntakePath('form');
                  }}
                  onBack={() => setTaxIntakePath('selector')}
                  taxObjectId={taxObjectId ?? ''}
                  returnId={returnId ?? ''}
                />
              </div>
            )}
            {!isSuperadmin && activeView === 'tax-situation' && taxIntakePath === 'form' && (
              <TaxSituationForm
                taxObjectId={taxObjectId ?? ''}
                returnId={returnId ?? ''}
                w2Data={w2Data}
                parsedFields={parsedFields}
                onViewTierResults={() => setActiveView('tier-results')}
                onStepChange={setTaxCurrentStep}
              />
            )}
            {!isSuperadmin && activeView === 'tier-results' && (
              <TierResultsView taxObjectId={taxObjectId ?? ''} returnId={returnId ?? ''} />
            )}
            {!isSuperadmin && activeView === 'settings' && <SettingsView />}

            {/* Superadmin-only: admin sections driven by global nav, no internal tab bar */}
            {isSuperadmin && activeAdminSection !== null && (
              <AdminPanel activeSection={activeAdminSection} />
            )}
          </div>
        </div>
      </main>

      {/* Bottom tab bar — visible only on mobile (hidden on sm+) */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-surface-200 flex items-center justify-around h-16"
        aria-label="Bottom navigation"
      >
        {isSuperadmin ? (
          // Superadmin mobile nav: six admin section icons
          ADMIN_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 text-xs transition-colors ${activeView === item.id ? 'text-accent-500' : 'text-surface-400'}`}
              aria-current={activeView === item.id ? 'page' : undefined}
              data-testid={`admin-nav-${item.id}-mobile`}
            >
              {item.iconMobile}
              <span>{item.label}</span>
            </button>
          ))
        ) : (
          // Filer mobile nav: tax, tiers, settings
          <>
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
          </>
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
