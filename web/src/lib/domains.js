// Data classes from the HL7 PIQI Clinical Data Model (PAT_CLINICAL_V1), plus
// Coverage, which is an M5 Health addition outside the PIQI clinical model.
// https://github.com/piqiframework/reference_application/blob/main/PIQI_Engine.Server/ReferenceData/Models/PAT_CLINICAL_V1.json
//
// Encounters, imaging, clinical notes, referrals, care team and contacts are
// also outside the PIQI model. They are display-only: shown and shareable, but
// never scored, never given findings, and never sent in a PIQI message.

export const DOMAINS = {
  demographics: { key: 'demographics', label: 'Demographics', plural: false },
  allergies: { key: 'allergies', label: 'Allergies', plural: true },
  conditions: { key: 'conditions', label: 'Conditions', plural: true },
  immunizations: { key: 'immunizations', label: 'Immunizations', plural: true },
  labResults: { key: 'labResults', label: 'Lab Results', plural: true },
  medications: { key: 'medications', label: 'Medications', plural: true },
  procedures: { key: 'procedures', label: 'Procedures', plural: true },
  vitalSigns: { key: 'vitalSigns', label: 'Vital Signs', plural: true },
  medicalDevices: { key: 'medicalDevices', label: 'Medical Devices', plural: true },
  healthAssessments: { key: 'healthAssessments', label: 'Health Assessments', plural: true },
  encounters: { key: 'encounters', label: 'Encounters', plural: true, displayOnly: true },
  imaging: { key: 'imaging', label: 'Imaging', plural: true, displayOnly: true },
  clinicalNotes: { key: 'clinicalNotes', label: 'Clinical Notes & Reports', plural: true, displayOnly: true },
  referrals: { key: 'referrals', label: 'Referrals & Orders', plural: true, displayOnly: true },
  careTeam: { key: 'careTeam', label: 'Care Team', plural: true, displayOnly: true },
  contacts: { key: 'contacts', label: 'Related People & Contacts', plural: true, displayOnly: true },
  coverage: { key: 'coverage', label: 'Coverage', plural: true },
}

// Plain-language explanations shown under each section in the patient view.
export const DOMAIN_HELP = {
  demographics: 'Who this record is about.',
  allergies: 'Medicines, foods or other things that caused a reaction.',
  conditions: 'Health problems you have now or had in the past.',
  immunizations: 'Vaccines you have received.',
  labResults: 'Results of tests on blood, urine or other samples.',
  medications: 'Medicines you take or have taken.',
  procedures: 'Surgeries, tests and treatments that were done.',
  vitalSigns: 'Measurements like blood pressure, pulse, weight and temperature.',
  medicalDevices: 'Devices you use or have implanted, like a pump, stent or hearing aid.',
  healthAssessments: 'Questionnaires and screenings about how you are doing.',
  encounters: 'Visits: office appointments, hospital stays, video visits.',
  imaging: 'X-rays, scans and other pictures, with what the specialist found.',
  clinicalNotes: 'Notes and reports written by your care team. Open one to read it in full.',
  referrals: 'Referrals to specialists and orders for tests.',
  careTeam: 'The people and organizations who take care of you.',
  contacts: 'Family members and others connected to your care.',
  coverage: 'Your health, dental and vision insurance.',
}

export function isDisplayOnly(domain) {
  return Boolean(DOMAINS[domain]?.displayOnly)
}

export const DOMAIN_ORDER = [
  'demographics',
  'allergies',
  'conditions',
  'immunizations',
  'labResults',
  'medications',
  'procedures',
  'vitalSigns',
  'medicalDevices',
  'healthAssessments',
  'encounters',
  'imaging',
  'clinicalNotes',
  'referrals',
  'careTeam',
  'contacts',
  'coverage',
]
