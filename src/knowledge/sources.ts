export type Source = { org: string; title: string; url: string }

/** Public sources only. AAP pages are linked, never quoted. Reviewed 2026-10-24. */
export const SOURCES = {
  cdcSleep: { org: 'CDC', title: 'About Sleep', url: 'https://www.cdc.gov/sleep/about/index.html' },
  safeToSleep: {
    org: 'NIH Safe to Sleep',
    title: "Ways to Reduce Baby's Risk",
    url: 'https://safetosleep.nichd.nih.gov/reduce-risk/reduce',
  },
  cdcBreastfeeding: {
    org: 'CDC',
    title: 'How Much and How Often to Breastfeed',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/breastfeeding/how-much-and-how-often.html',
  },
  cdcFormula: {
    org: 'CDC',
    title: 'How Much and How Often to Feed Infant Formula',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/formula-feeding/how-much-and-how-often.html',
  },
  cdcNewborn: {
    org: 'CDC',
    title: 'Newborn Breastfeeding Basics',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/breastfeeding/newborn-basics.html',
  },
  whoFeeding: {
    org: 'WHO',
    title: 'Infant and young child feeding',
    url: 'https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding',
  },
  cdcSolids: {
    org: 'CDC',
    title: 'When, What, and How to Introduce Solid Foods',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/when-what-and-how-to-introduce-solid-foods.html',
  },
  cdcAvoid: {
    org: 'CDC',
    title: 'Foods and Drinks to Avoid or Limit',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-avoid-or-limit.html',
  },
  cdcMilestones: {
    org: 'CDC',
    title: 'Milestone Checklists by Age',
    url: 'https://www.cdc.gov/act-early/resources/milestones-checklist-by-age.html',
  },
  medlineFever: {
    org: 'MedlinePlus',
    title: 'When your baby or infant has a fever',
    url: 'https://medlineplus.gov/ency/patientinstructions/000319.htm',
  },
  medlineDiarrhea: {
    org: 'MedlinePlus',
    title: 'Diarrhea in infants',
    url: 'https://medlineplus.gov/ency/patientinstructions/000691.htm',
  },
  medlineJaundice: {
    org: 'MedlinePlus',
    title: 'Newborn jaundice',
    url: 'https://medlineplus.gov/ency/article/001559.htm',
  },
  medlineWellChild: {
    org: 'MedlinePlus',
    title: 'Well-child visits',
    url: 'https://medlineplus.gov/ency/article/001928.htm',
  },
  cdcVaccines: {
    org: 'CDC',
    title: 'Child and Adolescent Immunization Schedule by Age',
    url: 'https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html',
  },
  aapPeriodicity: {
    org: 'AAP',
    title: 'Bright Futures periodicity schedule (link only)',
    url: 'https://www.aap.org/periodicityschedule',
  },
} as const satisfies Record<string, Source>

export type SourceId = keyof typeof SOURCES
