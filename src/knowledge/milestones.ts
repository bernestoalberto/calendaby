import { SOURCES, type Source } from './sources.js'

/**
 * The CDC "Learn the Signs. Act Early." milestone checklists, from 2 months to 3 years (reviewed 2026-10-29,
 * https://www.cdc.gov/act-early/milestones/). Each item is something most children (75% or more) do by that age.
 * Worded without "he" or "she"; the meaning is the CDC's. Planted into the `milestone` table by the milestones seed.
 */
export const MILESTONE_AREAS = [
  { id: 'social', label: 'Social & emotional' },
  { id: 'language', label: 'Language & communication' },
  { id: 'cognitive', label: 'Learning & thinking' },
  { id: 'movement', label: 'Movement & physical' },
] as const
export type MilestoneArea = (typeof MILESTONE_AREAS)[number]['id']

export interface Milestone {
  id: string
  ageMonths: number
  area: MilestoneArea
  text: string
  sort: number
}

export const MILESTONE_SOURCE: Source = SOURCES.cdcMilestones

type Checklist = Record<MilestoneArea, string[]>

const CHECKLISTS: Record<number, Checklist> = {
  2: {
    social: ['Calms down when spoken to or picked up', 'Looks at your face', 'Seems happy to see you when you walk up', 'Smiles when you talk to or smile at them'],
    language: ['Makes sounds other than crying', 'Reacts to loud sounds'],
    cognitive: ['Watches you as you move', 'Looks at a toy for several seconds'],
    movement: ['Holds head up when on tummy', 'Moves both arms and both legs', 'Opens hands briefly'],
  },
  4: {
    social: ['Smiles on their own to get your attention', 'Chuckles (not yet a full laugh) when you try to make them laugh', 'Looks at you, moves, or makes sounds to get or keep your attention'],
    language: ['Makes sounds like "oooo" and "aahh" (cooing)', 'Makes sounds back when you talk to them', 'Turns head towards the sound of your voice'],
    cognitive: ['If hungry, opens mouth when they see the breast or bottle', 'Looks at their hands with interest'],
    movement: ['Holds head steady without support when you are holding them', 'Holds a toy when you put it in their hand', 'Uses their arm to swing at toys', 'Brings hands to mouth', 'Pushes up onto elbows or forearms when on tummy'],
  },
  6: {
    social: ['Knows familiar people', 'Likes to look at themself in a mirror', 'Laughs'],
    language: ['Takes turns making sounds with you', 'Blows "raspberries" (sticks tongue out and blows)', 'Makes squealing noises'],
    cognitive: ['Puts things in their mouth to explore them', 'Reaches to grab a toy they want', "Closes lips to show they don't want more food"],
    movement: ['Rolls from tummy to back', 'Pushes up with straight arms when on tummy', 'Leans on hands to support themself when sitting'],
  },
  9: {
    social: ['Is shy, clingy, or fearful around strangers', 'Shows several facial expressions, like happy, sad, angry, and surprised', 'Looks when you call their name', 'Reacts when you leave (looks, reaches for you, or cries)', 'Smiles or laughs when you play peek-a-boo'],
    language: ['Makes a lot of different sounds like "mamamama" and "bababababa"', 'Lifts arms up to be picked up'],
    cognitive: ['Looks for objects when dropped out of sight (like a spoon or toy)', 'Bangs two things together'],
    movement: ['Gets to a sitting position by themself', 'Moves things from one hand to the other hand', 'Uses fingers to "rake" food towards themself', 'Sits without support'],
  },
  12: {
    social: ['Plays games with you, like pat-a-cake'],
    language: ['Waves "bye-bye"', 'Calls a parent "mama" or "dada" or another special name', 'Understands "no" (pauses briefly or stops when you say it)'],
    cognitive: ['Puts something in a container, like a block in a cup', 'Looks for things they see you hide, like a toy under a blanket'],
    movement: ['Pulls up to stand', 'Walks, holding on to furniture', 'Drinks from a cup without a lid, as you hold it', 'Picks things up between thumb and pointer finger, like small bits of food'],
  },
  15: {
    social: ['Copies other children while playing, like taking toys out of a container when another child does', 'Shows you an object they like', 'Claps when excited', 'Hugs a stuffed doll or other toy', 'Shows you affection (hugs, cuddles, or kisses you)'],
    language: ['Tries to say one or two words besides "mama" or "dada", like "ba" for ball or "da" for dog', 'Looks at a familiar object when you name it', 'Follows directions given with both a gesture and words, like giving you a toy when you hold out your hand and say "Give me the toy"', 'Points to ask for something or to get help'],
    cognitive: ['Tries to use things the right way, like a phone, cup, or book', 'Stacks at least two small objects, like blocks'],
    movement: ['Takes a few steps on their own', 'Uses fingers to feed themself some food'],
  },
  18: {
    social: ['Moves away from you, but looks to make sure you are close by', 'Points to show you something interesting', 'Puts hands out for you to wash them', 'Looks at a few pages in a book with you', 'Helps you dress them by pushing an arm through a sleeve or lifting up a foot'],
    language: ['Tries to say three or more words besides "mama" or "dada"', 'Follows one-step directions without any gestures, like giving you the toy when you say "Give it to me"'],
    cognitive: ['Copies you doing chores, like sweeping with a broom', 'Plays with toys in a simple way, like pushing a toy car'],
    movement: ['Walks without holding on to anyone or anything', 'Scribbles', 'Drinks from a cup without a lid and may spill sometimes', 'Feeds themself with their fingers', 'Tries to use a spoon', 'Climbs on and off a couch or chair without help'],
  },
  24: {
    social: ['Notices when others are hurt or upset, like pausing or looking sad when someone is crying', 'Looks at your face to see how to react in a new situation'],
    language: ['Points to things in a book when you ask, like "Where is the bear?"', 'Says at least two words together, like "More milk"', 'Points to at least two body parts when you ask them to show you', 'Uses more gestures than just waving and pointing, like blowing a kiss or nodding yes'],
    cognitive: ['Holds something in one hand while using the other hand, like holding a container and taking the lid off', 'Tries to use switches, knobs, or buttons on a toy', 'Plays with more than one toy at the same time, like putting toy food on a toy plate'],
    movement: ['Kicks a ball', 'Runs', 'Walks (not climbs) up a few stairs with or without help', 'Eats with a spoon'],
  },
  30: {
    social: ['Plays next to other children and sometimes plays with them', 'Shows you what they can do by saying "Look at me!"', 'Follows simple routines when told, like helping to pick up toys when you say "It\'s clean-up time"'],
    language: ['Says about 50 words', 'Says two or more words together, with one action word, like "Doggie run"', 'Names things in a book when you point and ask "What is this?"', 'Says words like "I," "me," or "we"'],
    cognitive: ['Uses things to pretend, like feeding a block to a doll as if it were food', 'Shows simple problem-solving skills, like standing on a small stool to reach something', 'Follows two-step instructions like "Put the toy down and close the door"', 'Shows they know at least one color, like pointing to a red crayon when you ask "Which one is red?"'],
    movement: ['Uses hands to twist things, like turning doorknobs or unscrewing lids', 'Takes some clothes off by themself, like loose pants or an open jacket', 'Jumps off the ground with both feet', 'Turns book pages, one at a time, when you read to them'],
  },
  36: {
    social: ['Calms down within 10 minutes after you leave them, like at a childcare drop off', 'Notices other children and joins them to play'],
    language: ['Talks with you in conversation using at least two back-and-forth exchanges', 'Asks "who," "what," "where," or "why" questions, like "Where is mommy/daddy?"', 'Says what action is happening in a picture or book when asked, like "running," "eating," or "playing"', 'Says their first name, when asked', 'Talks well enough for others to understand, most of the time'],
    cognitive: ['Draws a circle, when you show them how', 'Avoids touching hot objects, like a stove, when you warn them'],
    movement: ['Strings items together, like large beads or macaroni', 'Puts on some clothes by themself, like loose pants or a jacket', 'Uses a fork'],
  },
}

/** Every item, with a stable id such as `6-movement-1` (age in months, area, position). */
export const DEFAULT_MILESTONES: Milestone[] = Object.entries(CHECKLISTS).flatMap(([age, byArea]) =>
  MILESTONE_AREAS.flatMap((area, a) =>
    byArea[area.id].map((text, i) => ({ id: `${age}-${area.id}-${i + 1}`, ageMonths: Number(age), area: area.id, text, sort: a * 100 + i })),
  ),
)

/** What the CDC says to do when a milestone is not met yet. */
export const ACT_EARLY =
  'If your child is not meeting one or more milestones, has lost skills they once had, or you have other concerns, talk with their doctor, share your concerns and ask about developmental screening. You know your child best, so do not wait.'
