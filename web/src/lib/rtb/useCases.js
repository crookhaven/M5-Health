// The two CMS Health Tech Ecosystem Real-Time Benefits MVPs, kept apart because
// they are demonstrated at different events. Each status says what M5 Whole
// Health does today, not what the event requires.

export const STATUS = {
  supported: 'Supported',
  partial: 'Partly supported',
  missing: 'Not yet',
  outOfScope: 'Not a patient-app role',
}

export const MEDICAL_RTB = {
  key: 'medical',
  title: 'Real-Time Benefits: Medical MVP',
  intro:
    'What a plan covers, what it costs, what limits apply and whether an extra benefit is included, ' +
    'for Medicare Advantage and ACA Marketplace plans, using data CMS already publishes. ' +
    'Requirements follow the 10/13 update. The member’s own numbers (visits used, deductible met) wait for GA.',
  source: 'RTB Medical MVP Use Cases – MA & ACA (10/13/26)',
  notes: [
    'How M5 Whole Health would take part: as a third-party app it uses the CMS public-data path. It first needs the member’s exact plan ID (ideally from the CARIN Digital Insurance Card), then reads the CMS files for that plan.',
    'For the November 1 demonstration, known plan IDs are used and shown on screen as such.',
    'Programs: ACA plans are read from the HealthCare.gov Marketplace API (Compare plans). Medicare Advantage, ACA and employer plans can also be read as FHIR InsurancePlan resources on the CARIN Digital Insurance Card SBC profile (Try it, below), using the Benefit Plan Standard examples: 7 Medicare Advantage plans, 5 of them from the CY2027 PBP files.',
    'Known issue: the plan screen says "Not covered" when the data has no entry. The update requires "not in the public plan data" instead.',
  ],
  useCases: [
    {
      title: '1. What does my plan cover and what do I pay?',
      items: [
        ['SHALL', 'Plan-level fields that apply to the plan', 'partial',
          'Name, type, metal level, HSA and document links. Missing: cost-sharing reduction version, coverage dates, referral needed, plan-wide exclusions, family amounts.'],
        ['SHALL', 'Plan year and date of the CMS data, on every answer', 'partial',
          'The InsurancePlan view shows the plan year with every answer. The date the CMS data was published is not in the FHIR data.'],
        ['SHALL', 'Cost of the twelve core services', 'partial',
          'Compare plans: 5 of 12 (primary care, specialist, urgent care, emergency room, mental health). The InsurancePlan view shows every service the plan data has.'],
        ['SHALL', 'Preventive services, $0 in network', 'missing'],
        ['SHALL', 'Whether each of the ten extra benefits is covered', 'partial',
          'The InsurancePlan view answers for each one. Where the SBC profile has no code for a benefit, it can only say the plan lists it.'],
        ['SHOULD', 'Cost and other details of the ten extra benefits', 'missing'],
      ],
    },
    {
      title: '2. Does the cost change depending on where I go?',
      items: [
        ['SHALL', 'Cost by setting, including nurse or PA visit, skilled nursing and home health', 'partial',
          'The InsurancePlan view shows skilled nursing and hospital costs, including hospital tiers and day ranges. Home health has no SBC code yet, so it shows only as listed.'],
        ['SHALL', 'In network versus out of network, out-of-network deductible and maximum', 'partial',
          'Shown on the plan screen. Compare plans shows in-network only.'],
        ['SHALL', 'Provider directory link', 'supported'],
        ['SHOULD', 'ACA: cost by network tier where the plan has two tiers', 'missing'],
        ['SHOULD', 'MA: telehealth', 'missing'],
      ],
    },
    {
      title: '3. Is there a limit on this service?',
      items: [
        ['SHOULD', 'Limits and dollar maximums for the ten extra benefits', 'partial',
          'The InsurancePlan view shows limits with their own period (per visit, per 6 months, per benefit period). The Medicare Advantage examples carry no limits in FHIR yet; the profile has no place for most of them.'],
      ],
    },
    {
      title: '4. Does my plan cover hearing aids? (and other extra benefits)',
      items: [
        ['SHALL', 'Fact 1: covered, covered with a limit, not covered, or not in the CMS data', 'partial',
          'Answered from a FHIR InsurancePlan. For Medicare Advantage hearing aids the answer is "listed by the plan": the PBP data has the cost and limits, but the SBC profile has no hearing aid code to carry them.'],
        ['SHOULD', 'Facts 2–6: add-on or included, limits, cost in and out of network, exclusions, counts toward the maximum', 'missing'],
      ],
    },
  ],
}

export const PHARMACY_RTB = {
  key: 'pharmacy',
  title: 'Real-Time Benefits: Pharmacy MVP',
  intro:
    'Patient-specific drug cost and coverage, based on the CARIN Consumer Real-Time Pharmacy Benefit Check (RTPBC) ' +
    'FHIR IG (STU2 ballot) and NCPDP RTPB v13. Accumulators and Part B medications are planned for GA.',
  source: 'Pharmacy Use Cases for MVP (final)',
  notes: [
    'Today the app only checks whether a drug is on a Marketplace plan’s drug list (Compare plans). It shows no drug costs yet.',
    'Scenario 1 gets the member’s coverage (member ID, group, BIN/PCN) from a CARIN Digital Insurance Card or details on file.',
  ],
  useCases: [
    {
      title: 'Scenario 1. Checking insurance cost for a medication',
      items: [
        ['MVP', 'Send an RTPBC request (patient, coverage, medication) and show the copay, formulary status, prior auth / step therapy / quantity limits and covered alternatives', 'missing'],
        ['Optional', 'Whether the medication is available, and when if not', 'missing'],
      ],
    },
    {
      title: 'Scenario 2. Comparing cash price vs. insurance before deciding',
      items: [
        ['MVP', 'Non-PHI request for cash and coupon prices (no patient identifiers), shown beside the insurance cost and patient assistance programs', 'missing'],
        ['Optional', 'Whether the medication is available, and when if not', 'missing'],
      ],
    },
    {
      title: 'Scenario 3. Choosing between pharmacies',
      items: [
        ['MVP', 'Cost broken out by pharmacy: retail in network, out of network and mail order (including 90-day supply)', 'missing'],
        ['Optional', 'Whether the medication is available, and when if not', 'missing'],
      ],
    },
    {
      title: 'Provider-facing flow',
      items: [
        ['MVP', 'Cost, coverage and restrictions shown in the EHR before the prescription is finalized', 'outOfScope',
          'Runs in the prescriber’s EHR, not in a patient app.'],
      ],
    },
    {
      title: 'Later (after the MVP). Prior authorization criteria',
      items: [
        ['Idea', 'When a drug needs prior authorization, show what the plan will ask the doctor, from the payer’s published coverage policy', 'missing',
          'Payer policies (for example Aetna and Cigna) can be turned into yes/no criteria trees, which also make good test cases: one patient who meets the criteria and one who misses by one fact. Link to the payer’s policy rather than copying its text, which is copyrighted.'],
      ],
    },
  ],
}
