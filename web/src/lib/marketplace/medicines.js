// Turns a record's medicine list into the list a plan check needs: vaccines
// left out (they're usually a medical, not a pharmacy, benefit), and the same
// medicine under different names (brand and generic, two inhaler listings)
// counted once. Each medicine keeps every RxCUI it was recorded under, so a
// plan that lists any of them covers it.

const VACCINE = /\b(vaccine|antigen|toxoid|immune globulin)\b/i

export function isVaccine(name) {
  return VACCINE.test(name ?? '')
}

const FORMS = [
  ['inhaler', /inhal|actuat|hfa|flexhaler|diskus|respimat/i],
  ['nasal spray', /nasal/i],
  ['injection', /inject|syringe|pen\b|auto-injector|vial/i],
  ['oral', /tablet|capsule|oral|chewable|solution|suspension/i],
  ['topical', /cream|ointment|gel|patch|lotion/i],
  ['eye drops', /ophthalmic|eye/i],
]

export function formOf(name) {
  return FORMS.find(([, re]) => re.test(name ?? ''))?.[0] ?? 'other'
}

// Without RxNorm ingredients, a rough name key: the first word that isn't a
// number, unit or pack size, e.g. "loratadine 10 MG Oral Tablet [Claritin]" -> "loratadine".
function nameStem(name) {
  const cleaned = String(name)
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\bnda\d+\b/g, ' ')
  const word = cleaned.split(/[^a-z]+/).find((w) => w.length > 3 && !/^(actuat|mcg|act|base|sulfate|hydrochloride|hcl)$/.test(w))
  return word ?? cleaned.trim()
}

// medicines: [{ id, name, rxcui }]; ingredients: { [rxcui]: ['budesonide'] }.
export function groupMedicines(medicines, ingredients = {}) {
  const groups = new Map()
  for (const m of medicines) {
    if (isVaccine(m.name)) continue
    const ing = m.rxcui && ingredients[m.rxcui]?.length ? [...ingredients[m.rxcui]].sort().join('+') : nameStem(m.name)
    const key = `${ing}|${formOf(m.name)}`
    if (!groups.has(key)) groups.set(key, { ...m, key, ingredient: ing, rxcuis: [], names: [] })
    const g = groups.get(key)
    if (m.rxcui && !g.rxcuis.includes(m.rxcui)) g.rxcuis.push(m.rxcui)
    g.names.push(m.name)
  }
  return [...groups.values()]
}

const RXNAV = 'https://rxnav.nlm.nih.gov/REST'

// Each RxCUI's active ingredients, from the NLM's free RxNav API (no key).
// Lookups that fail are left out, and the name is used instead.
export async function fetchIngredients(rxcuis, fetchImpl = globalThis.fetch) {
  const out = {}
  await Promise.all(
    [...new Set(rxcuis)].map(async (rxcui) => {
      try {
        const res = await fetchImpl(`${RXNAV}/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=IN+MIN`)
        if (!res.ok) return
        const body = await res.json()
        const groups = body.relatedGroup?.conceptGroup ?? []
        const min = groups.find((g) => g.tty === 'MIN')?.conceptProperties ?? []
        const ins = groups.find((g) => g.tty === 'IN')?.conceptProperties ?? []
        const names = (min.length ? min : ins).map((c) => c.name.toLowerCase())
        if (names.length) out[rxcui] = names
      } catch {
        // offline or blocked: fall back to names
      }
    }),
  )
  return out
}

// What the saved or live drug check says about each grouped medicine on one plan.
export function medicineStatuses(planId, groups, drugCoverage) {
  const perPlan = drugCoverage?.[planId] ?? {}
  return groups.map((g) => {
    const statuses = g.rxcuis.map((r) => perPlan[r]).filter(Boolean)
    const status = !g.rxcuis.length
      ? 'no-code'
      : statuses.includes('covered')
        ? 'covered'
        : statuses.length && statuses.every((s) => s === 'not-covered')
          ? 'not-covered'
          : 'not-checked'
    return { ...g, status }
  })
}

// RxCUIs the loaded drug check has no answer for, on any plan.
export function uncheckedRxcuis(groups, drugCoverage) {
  const answered = new Set(Object.values(drugCoverage ?? {}).flatMap((p) => Object.keys(p)))
  return [...new Set(groups.flatMap((g) => g.rxcuis))].filter((r) => !answered.has(r))
}

const MARKETPLACE = 'https://marketplace.api.healthcare.gov/api/v1'

// Asks the CMS Marketplace API which plans cover which RxCUIs, 20 plans at a
// time, as the fetch script does. The API key is used for this call only.
export async function checkCoverageLive({ rxcuis, planIds, year, apiKey }, fetchImpl = globalThis.fetch) {
  const rows = []
  for (let i = 0; i < planIds.length; i += 20) {
    const url = new URL(`${MARKETPLACE}/drugs/covered`)
    url.search = new URLSearchParams({ drugs: rxcuis.join(','), planids: planIds.slice(i, i + 20).join(','), year: String(year), apikey: apiKey }).toString()
    let res
    try {
      res = await fetchImpl(url.toString())
    } catch {
      throw new Error('Your browser could not reach the Marketplace API from this page. Use the PowerShell line below instead.')
    }
    if (res.status === 401 || res.status === 403) throw new Error('The Marketplace API did not accept that API key.')
    if (!res.ok) throw new Error(`The Marketplace API responded ${res.status}.`)
    const body = await res.json()
    rows.push(...(body.coverage ?? []))
  }
  return rows
}
