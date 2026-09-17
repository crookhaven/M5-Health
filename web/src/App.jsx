import { useMemo, useState } from 'react'
import logo from './assets/logo.svg'
import { WorkspaceProvider, useWorkspace } from './state/WorkspaceContext'
import ImportPanel from './components/ImportPanel'
import Dashboard from './components/Dashboard'
import FindingsPanel from './components/FindingsPanel'
import Scorecard from './components/Scorecard'
import SharePanel from './components/SharePanel'
import { runPiqiAnalysis } from './lib/piqi/engine'
import { computeScorecard } from './lib/piqi/scorecard'
import './App.css'

const TABS = [
  { key: 'import', label: 'Import' },
  { key: 'dashboard', label: 'Health Record' },
  { key: 'findings', label: 'Findings' },
  { key: 'scorecard', label: 'Scorecard' },
  { key: 'share', label: 'Share & Export' },
]

function AppContent() {
  const { sourceRecords, assertions, findingDecisions } = useWorkspace()
  const [tab, setTab] = useState('import')

  const findings = useMemo(
    () => runPiqiAnalysis(sourceRecords, assertions, findingDecisions),
    [sourceRecords, assertions, findingDecisions],
  )
  const scorecard = useMemo(
    () => computeScorecard(findings, sourceRecords.length),
    [findings, sourceRecords.length],
  )
  const openFindingsCount = findings.filter((f) => !f.decision).length

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <img src={logo} alt="" width="32" height="32" />
          <h1>M5 Health</h1>
        </div>
        <p>Your patient-controlled health data workspace</p>
      </header>
      <nav className="app-tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'findings' && openFindingsCount > 0 && (
              <span className="tab-badge" aria-label={`${openFindingsCount} open findings`}>
                {openFindingsCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <main
        className="app-main"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={-1}
      >
        {tab === 'import' && <ImportPanel />}
        {tab === 'dashboard' && (
          <Dashboard sourceRecords={sourceRecords} assertions={assertions} />
        )}
        {tab === 'findings' && <FindingsPanel findings={findings} />}
        {tab === 'scorecard' && <Scorecard scorecard={scorecard} />}
        {tab === 'share' && (
          <SharePanel sourceRecords={sourceRecords} scorecard={scorecard} />
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  )
}
