import { mo } from './guidance.js'
import type { SourceId } from './sources.js'

export type Checkup = { at: number; label: string; vaccines: string[] }
export type CheckupSchedule = { name: string; note: string; visits: Checkup[]; sources: SourceId[] }

/**
 * Visit ages follow the AAP schedule as published by MedlinePlus. Vaccines follow the CDC schedule in effect
 * after the March 2026 court stay (the May 2025 version), which matches the AAP schedule for infants.
 */
const US: CheckupSchedule = {
  name: 'United States',
  note: 'US vaccine recommendations changed several times in 2025 and 2026. Confirm what is due with your pediatrician.',
  sources: ['medlineWellChild', 'cdcVaccines', 'aapPeriodicity'],
  visits: [
    {
      at: 0,
      label: 'Birth',
      vaccines: [
        'Hepatitis B dose 1 (if the mother tested negative, timing is decided with the doctor)',
        'RSV antibody if the mother was not vaccinated in pregnancy, during RSV season',
      ],
    },
    { at: 0.5, label: 'Newborn check, 3 to 5 days old', vaccines: [] },
    { at: mo(1), label: '1 month', vaccines: ['Hepatitis B dose 2 (1 to 2 months)'] },
    { at: mo(2), label: '2 months', vaccines: ['DTaP', 'Hib', 'Pneumococcal (PCV)', 'Polio (IPV)', 'Rotavirus'] },
    { at: mo(4), label: '4 months', vaccines: ['DTaP', 'Hib', 'Pneumococcal (PCV)', 'Polio (IPV)', 'Rotavirus'] },
    {
      at: mo(6),
      label: '6 months',
      vaccines: [
        'DTaP',
        'Pneumococcal (PCV)',
        'Hib and Rotavirus, depending on the brand',
        'Hepatitis B dose 3 and Polio dose 3 (6 to 18 months)',
        'Flu, every season from 6 months',
        'COVID-19, discussed with the doctor',
      ],
    },
    { at: mo(9), label: '9 months', vaccines: [] },
    {
      at: mo(12),
      label: '12 months',
      vaccines: ['MMR', 'Chickenpox (varicella)', 'Hepatitis A dose 1', 'Hib and PCV boosters (12 to 15 months)'],
    },
    { at: mo(15), label: '15 months', vaccines: ['DTaP dose 4 (15 to 18 months)'] },
    { at: mo(18), label: '18 months', vaccines: ['Hepatitis A dose 2 (6 months after dose 1)'] },
    { at: mo(24), label: '2 years', vaccines: [] },
    { at: mo(30), label: '2 and a half years', vaccines: [] },
    { at: mo(36), label: '3 years', vaccines: [] },
  ],
}

export const CHECKUPS = { us: US } satisfies Record<string, CheckupSchedule>
export type Region = keyof typeof CHECKUPS

/** The next visits at or after this age; a visit stays listed for 2 weeks after its date. */
export function nextCheckups(ageWeeks: number, region: Region = 'us', count = 2): Checkup[] {
  return CHECKUPS[region].visits.filter((v) => v.at >= ageWeeks - 2).slice(0, count)
}
