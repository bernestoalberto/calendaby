import { expect, it } from 'vitest'
import { parseLog } from '../src/agents/capture'
import data from './capture.json'
import { passes, type EvalFile } from './score'

const file = data as EvalFile
// Raise this when the rules improve; never lower it to get a green run.
const RULES_BASELINE = 9

it(`rules parser scores at least ${RULES_BASELINE}/${file.cases.length} on the capture eval`, () => {
  const now = new Date(file.now)
  const failed = file.cases.filter((c) => !passes(parseLog(c.text, now).drafts, c.expect, now)).map((c) => c.text)
  console.log(`rules: ${file.cases.length - failed.length}/${file.cases.length}; left for the agent:`, failed)
  expect(file.cases.length - failed.length).toBeGreaterThanOrEqual(RULES_BASELINE)
})
