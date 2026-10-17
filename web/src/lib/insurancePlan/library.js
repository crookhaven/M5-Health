// Example plans published by the Benefit Plan Standard project (MIT licensed)
// as FHIR InsurancePlan Bundles on the CARIN Digital Insurance Card SBC profile:
// https://github.com/Benefit-Plan-Standard/benefit-plan-schema
// Pinned to one commit so a later rename upstream can't break the list.
const COMMIT = '34b7def13edf9a5c96857081c7f033b55e620ac7'
const RAW = `https://raw.githubusercontent.com/Benefit-Plan-Standard/benefit-plan-schema/${COMMIT}/`
export const PLAN_LIBRARY_SOURCE = 'https://github.com/Benefit-Plan-Standard/benefit-plan-schema'

const MA = 'Medicare Advantage'
const ACA = 'ACA individual market'
const EMP = 'Employer plans'

export const PLAN_LIBRARY = [
  [MA, 'AARP Medicare Advantage from UHC FL-0021 (PPO), 2027', 'examples/fhir/aarp-medicare-advantage-from-uhc-fl-0021-ppo-h2406-013-000.json'],
  [MA, 'Aetna Medicare Select Extra (HMO-POS), 2027', 'examples/fhir/aetna-medicare-select-extra-hmo-pos-h1609-028-000.json'],
  [MA, 'Humana Gold Plus H1036-068 (HMO), 2027', 'examples/fhir/humana-gold-plus-h1036-068-hmo-h1036-068-000.json'],
  [MA, 'Humana Gold Plus H1036-025 (HMO), 2026', 'examples/fhir/humana-gold-plus-h1036-025-hmo.json'],
  [MA, 'SCAN Costco Medicare Advantage (HMO), 2027', 'examples/fhir/scan-costco-medicare-advantage-hmo-h5425-140-000.json'],
  [MA, 'SCAN Classic (HMO), 2026', 'examples/fhir/scan-classic-hmo-los-angeles.json'],
  [MA, 'UPMC for Life PPO Rx Choice (PPO), 2027', 'examples/fhir/upmc-for-life-ppo-rx-choice-ppo-h5533-019-000.json'],
  [ACA, 'AvMed Entrust Gold 125, 2026', 'examples/fhir-puf/avmed-avmed-entrust-gold-125.json'],
  [ACA, 'Blue Cross and Blue Shield of Louisiana Blue Max Copay 50/50, 2026', 'examples/fhir-puf/blue-cross-and-blue-shield-of-louisiana-blue-max-copay-50-50.json'],
  [ACA, 'Health Net of CA Silver 94 Ambetter HMO, 2026', 'examples/fhir/ambetter-ca-silver-94-hmo.json'],
  [ACA, 'Kaiser Permanente Gold 80 HMO, 2026', 'examples/fhir/kaiser-ca-gold-80-hmo.json'],
  [ACA, 'UHC Bronze Essential, 2026', 'examples/fhir-puf/unitedhealthcare-uhc-bronze-essential.json'],
  [ACA, 'UHC Gold Standard, 2026', 'examples/fhir-puf/unitedhealthcare-uhc-gold-standard.json'],
  [ACA, 'Florida Blue BlueOptions Gold 1505, 2023', 'examples/fhir-puf/florida-blue-blueoptions-gold-1505.json'],
  [ACA, 'Florida Blue BlueOptions 505, 2023', 'examples/fhir/flblue-blueoptions-505.json'],
  [EMP, 'Aetna FL PPO 1500 80/50, 2026', 'examples/fhir/aetna-ppo-1500-80-50.json'],
  [EMP, 'Aetna FL PPO 5000 80/50, 2026', 'examples/fhir/aetna-ppo-5000-80-50.json'],
  [EMP, 'Cigna Open Access Plus (Bowdoin College), 2026', 'examples/fhir/cigna-oap-bowdoin.json'],
  [EMP, 'GatorCare Prime EPO, 2026', 'examples/fhir/gatorcare-prime-epo.json'],
  [EMP, 'UHC Choice Plus HSA Gold 1700, 2026', 'examples/fhir/uhc-choice-plus-hsa-gold-1700.json'],
].map(([group, label, path]) => ({ group, label, url: RAW + path }))

export const PLAN_GROUPS = [MA, ACA, EMP]
