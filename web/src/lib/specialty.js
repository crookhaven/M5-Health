// Sorts records into Medical, Dental, Vision, Hearing or Dermatology for the
// specialty filter. Sources rarely say which specialty a record belongs to, so
// this looks at what the record is: its name, its codes, and the organization,
// specialist or body site it involves. Incidental details are ignored on
// purpose, so a penicillin allergy whose reaction is "rash" stays Medical.

import { IDENTITY_FIELDS, recordLabel } from './piqi/rules'

export const SPECIALTIES = [
  { key: 'all', label: 'All' },
  { key: 'medical', label: 'Medical' },
  { key: 'dental', label: 'Dental' },
  { key: 'vision', label: 'Vision' },
  { key: 'hearing', label: 'Hearing' },
  { key: 'dermatology', label: 'Dermatology' },
]

const KEYWORDS = [
  ['dental', /\b(dental|dentist\w*|tooth|teeth|periodont\w*|gingiv\w*|caries|oral (exam|evaluation)|prophylaxis|crown|molar|premolar|endodont\w*|root canal|orthodont\w*|denture|panoramic|bitewing|occlusal|mouthwash|mouth rinse)\b/i],
  ['vision', /\b(eyes?|ocular|optic|retina\w*|retinopathy|glaucoma|cataract|visual|vision|ophthalm\w*|optometr\w*|refraction|intraocular|macula\w*|myopia|hyperopia|presbyopia|astigmatism|fundus|spectacles?|eyeglass\w*|contact lens\w*|OCT)\b/i],
  ['hearing', /\b(hearing|audiolog\w*|audiogram|audiometr\w*|tinnitus|cochlear|otolog\w*|tympan\w*|otoacoustic|ear canal|cerumen|presbycusis)\b/i],
  ['dermatology', /\b(skin|dermat\w*|psoriasis|eczema|melanoma|basal cell|squamous cell carcinoma of skin|nevus|nevi|acne|keratosis|dermoscop\w*|rosacea|urticaria|vitiligo|warts?|cutaneous|mohs|topical (cream|ointment|lotion|solution|foam|gel))\b/i],
]

// Fields that say what or who a record is about, beyond its title.
const CONTEXT_FIELDS = ['noteType', 'organization', 'performer', 'facility', 'modality', 'bodySite', 'procedure', 'group_name', 'type']

function codingsOf(value) {
  return value && typeof value === 'object' && Array.isArray(value.codings) ? value.codings : []
}

function inRange(code, from, to) {
  return code >= from && code <= to
}

function specialtyFromCode({ system = '', code = '' }) {
  const c = String(code).toUpperCase()
  if (/ada\.org|cdt/i.test(system) || /^D\d{4}$/.test(c)) return 'dental'
  if (/icd-10/i.test(system)) {
    if (inRange(c, 'H00', 'H59.ZZZ')) return 'vision'
    if (inRange(c, 'H60', 'H95.ZZZ')) return 'hearing'
    if (inRange(c, 'L00', 'L99.ZZZ') || inRange(c, 'C43', 'C44.ZZZ')) return 'dermatology'
    if (inRange(c, 'K00', 'K14.ZZZ')) return 'dental'
  }
  if (/cpt/i.test(system) && /^\d{5}$/.test(c)) {
    if (inRange(c, '92002', '92499')) return 'vision'
    if (inRange(c, '92550', '92597') || inRange(c, '92620', '92700')) return 'hearing'
    if (inRange(c, '11000', '11646') || inRange(c, '17000', '17999')) return 'dermatology'
  }
  return null
}

export function specialtyOf(record) {
  const data = record.data ?? {}
  const identity = data[IDENTITY_FIELDS[record.domain]]
  for (const coding of codingsOf(identity)) {
    const fromCode = specialtyFromCode(coding)
    if (fromCode) return fromCode
  }
  const text = [
    recordLabel(record.domain, data),
    ...CONTEXT_FIELDS.map((f) => (typeof data[f] === 'string' ? data[f] : data[f]?.text)),
  ]
    .filter(Boolean)
    .join(' | ')
  for (const [key, pattern] of KEYWORDS) {
    if (pattern.test(text)) return key
  }
  return 'medical'
}

export function filterBySpecialty(records, specialty) {
  if (!specialty || specialty === 'all') return records
  return records.filter((r) => specialtyOf(r) === specialty)
}
