import { useMemo, useState } from 'react'
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
        <h1>M5 Health</h1>
        <p>Your patient-controlled health data workspace</p>
      </header>
      <nav className="app-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'findings' && openFindingsCount > 0 && (
              <span className="tab-badge">{openFindingsCount}</span>
            )}
          </button>
        ))}
      </nav>
      <main className="app-main">
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
