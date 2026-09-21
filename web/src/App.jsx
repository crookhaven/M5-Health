import { useState } from 'react'
import logo from './assets/logo.svg'
import { WorkspaceProvider, useWorkspace } from './state/WorkspaceContext'
import ImportPanel from './components/ImportPanel'
import Dashboard from './components/Dashboard'
import ClaimsPanel from './components/ClaimsPanel'
import IpsView from './components/IpsView'
import PiqiResults from './components/PiqiResults'
import WhatToDo from './components/WhatToDo'
import PatientBar from './components/PatientBar'
import FamilyOverview from './components/FamilyOverview'
import ComparePlans from './components/ComparePlans'
import SharePanel from './components/SharePanel'
import { DATASETS, DATASET_ORDER } from './lib/datasets'
import './App.css'

const TABS = [
  { key: 'import', label: 'Import' },
  { key: 'family', label: 'Family' },
  { key: 'data', label: 'My data' },
  { key: 'compare', label: 'Compare plans' },
  { key: 'share', label: 'Share & Export' },
]

const DATA_VIEWS = [
  { key: 'view', label: 'View' },
  { key: 'score', label: 'PIQI score' },
  { key: 'todo', label: 'What to do' },
]

// One data set (Clinical, IPS or Claims) with the same three screens each:
// see the data, see its PIQI score, and see what can be done about failures.
function DataArea({ sourceRecords, assertions }) {
  const [dataset, setDataset] = useState('clinical')
  const [view, setView] = useState('view')

  return (
    <div className="data-area">
      <div className="dataset-switcher" role="group" aria-label="Data set">
        {DATASET_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={dataset === key}
            className={dataset === key ? 'active' : ''}
            onClick={() => setDataset(key)}
          >
            {DATASETS[key].label}
          </button>
        ))}
      </div>
      <div className="data-tabs" role="tablist" aria-label={`${DATASETS[dataset].label} screens`}>
        {DATA_VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={view === v.key ? 'active' : ''}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === 'view' && dataset === 'clinical' && (
        <Dashboard sourceRecords={sourceRecords} assertions={assertions} />
      )}
      {view === 'view' && dataset === 'ips' && (
        <IpsView sourceRecords={sourceRecords} assertions={assertions} />
      )}
      {view === 'view' && dataset === 'claims' && <ClaimsPanel />}
      {view === 'score' && <PiqiResults key={dataset} dataset={dataset} />}
      {view === 'todo' && <WhatToDo key={dataset} dataset={dataset} />}
    </div>
  )
}

function AppContent() {
  const { sourceRecords, assertions, activePatient } = useWorkspace()
  const [tab, setTab] = useState('import')

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <img src={logo} alt="" width="32" height="32" />
          <h1>M5 Health</h1>
        </div>
        <p>Your patient-controlled health data workspace</p>
      </header>
      <PatientBar />
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
        {tab === 'family' && <FamilyOverview onOpen={() => setTab('data')} />}
        {tab === 'data' && (
          <>
            <h2 className="patient-heading">{activePatient?.name}</h2>
            <DataArea key={activePatient?.id} sourceRecords={sourceRecords} assertions={assertions} />
          </>
        )}
        {tab === 'compare' && <ComparePlans />}
        {tab === 'share' && (
          <SharePanel sourceRecords={sourceRecords} />
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
