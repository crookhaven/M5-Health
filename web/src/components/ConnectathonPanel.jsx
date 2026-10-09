const WALLET_URL = `${import.meta.env.BASE_URL}test-wallet/index.html`

const SCENARIOS = [
  ['Demographics, problems, medications', 'Supported'],
  ['any-us-core, decline-all, no-selector, unknown-selector', 'Supported'],
  ['large-response, narrowed-family (~3.2 MB synthetic history)', 'Supported'],
  ['form-by-reference, versioned-canonical', 'Supported'],
  ['physician-form (enableWhen, repeats, open-choice)', 'Supported'],
  ['shared-artifact (opt-in toggle)', 'Supported'],
  ['prefilled-form', 'Supported, best effort'],
  ['health-card, insurance-card', 'Not supported (needs SMART Health Card signing)'],
  ['cross-device, in-person handoff', 'Not tested with a web wallet'],
  ['write-back', 'Not a wallet role (EHR side)'],
]

export default function ConnectathonPanel() {
  return (
    <div className="import-panel">
      <section className="import-section">
        <h2>SMART Health Check-in test wallet</h2>
        <p>
          A test tool for the Nov 3 "Kill the Clipboard" SMART Health Check-in
          connectathon. It opens in its own window because it has to receive
          requests from a check-in page. Synthetic data only.
        </p>
        <p>
          <a className="button-link" href={WALLET_URL} target="_blank" rel="noopener">
            Open the test wallet
          </a>
        </p>
        <p>
          Inside it, the <strong>Wallet</strong> tab answers requests and the{' '}
          <strong>Verifier</strong> tab sends one to a wallet (including itself).
        </p>
      </section>
      <section className="import-section">
        <h2>Scenario coverage</h2>
        <p>
          "Supported" means the wallet is built to handle it, not that it has
          been checked against every team's Verifier.
        </p>
        <ul className="scenario-list">
          {SCENARIOS.map(([scenario, status]) => (
            <li key={scenario}>
              <strong>{scenario}</strong>: {status}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
