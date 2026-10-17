import { formatCost, formatLimit } from './parse'

// The extra benefits RTB medical use case 4 asks about ("Does my plan cover
// hearing aids?"), with the Benefit Plan Standard keys and SBC categories that
// identify each one.
export const EXTRA_BENEFITS = [
  { key: 'hearing_aids', label: 'Hearing aids', match: /hearing aid/i },
  { key: 'hearing_exam', label: 'Routine hearing exam', match: /hearing exam|hearing test/i },
  { key: 'routine_eye_exam', label: 'Routine eye exam', match: /eye exam/i },
  { key: 'eyeglasses', label: 'Eyeglasses', match: /eyeglass|glasses|eyewear/i },
  { key: 'dental_cleaning', label: 'Dental cleaning', match: /dental (cleaning|check)|preventive dental|prophylaxis/i },
  { key: 'fitness_benefit', label: 'Fitness benefit', match: /fitness/i },
  { key: 'otc_allowance', label: 'Over-the-counter allowance', match: /over-the-counter|\botc\b/i },
  { key: 'transportation', label: 'Transportation', match: /transportation/i },
  { key: 'meals', label: 'Meals', match: /\bmeal/i },
  { key: 'home_health_care', label: 'Home health care', match: /home health/i },
]

// What the plan data says about one extra benefit:
//   covered        the plan prices it (costs shown)
//   not-covered    the plan says it is not covered or excludes it
//   listed         the plan lists it, but the FHIR profile has no place for its cost or limits yet
//   not-in-data    the plan data doesn't mention it
export function answerExtraBenefit(plan, extra) {
  // Children's dental and vision codes are the only ones the SBC category list
  // has for those services; they don't answer an adult's question.
  const forAdults = (b) => !/^children-/.test(b.category.code ?? '') && !/child/i.test(b.name)
  const benefit = plan.benefits.find(
    (b) => forAdults(b) && (extra.match.test(b.name) || extra.match.test(b.category.display ?? '')),
  )
  if (benefit) {
    const priced = benefit.costs.filter((c) => !c.absent)
    if (priced.length && priced.every((c) => c.kind === 'not-covered')) {
      return { status: 'not-covered', benefit, costs: priced, limits: benefit.limits }
    }
    return {
      status: priced.length ? 'covered' : 'listed',
      benefit,
      costs: priced.map((c) => ({ network: c.network, text: formatCost(c) })),
      limits: benefit.limits.map(formatLimit),
      requirement: benefit.requirement,
    }
  }
  if (plan.excluded.some((x) => extra.match.test(x))) return { status: 'not-covered', costs: [], limits: [] }
  const listed = plan.extras.find((x) => x.key === extra.key || extra.match.test(x.name))
  if (listed) return { status: 'listed', name: listed.name, costs: [], limits: [] }
  return { status: 'not-in-data', costs: [], limits: [] }
}

export const ANSWER_TEXT = {
  covered: 'Covered',
  'not-covered': 'Not covered',
  listed: 'Listed by the plan; cost and limits not in the FHIR data',
  'not-in-data': 'Not in the plan data',
}
