import type { ParagraphSuggestionAction } from "@/shared-module/common/bindings"

export type AiActionGroupId = "improve" | "structure" | "learning-support" | "summaries"

export type AiSubmenuId = "tone" | "translate"

export interface AiActionMeta {
  tone?: string
  language?: string
  settingType?: "audience" | "reading-level" | "tone-preference"
}

export interface AiActionDefinition {
  id: string
  abilityName: ParagraphSuggestionAction
  labelKey: string
  group: AiActionGroupId | AiSubmenuId
  meta?: AiActionMeta
}

export interface AiMenuGroup {
  id: AiActionGroupId
  labelKey: string
  actions: AiActionDefinition[]
}

export interface AiSubmenuGroup {
  id: AiSubmenuId
  labelKey: string
  actions: AiActionDefinition[]
}

/** Locale keys for group labels; use with t() so types match cms.json. */
export type AiGroupLabelKey =
  | "ai-group-improve"
  | "ai-group-structure"
  | "ai-group-learning-support"
  | "ai-group-summaries"

/** Locale keys for action labels; use with t() so types match cms.json. */
export type AiActionLabelKey =
  | "ai-improve-fix-spelling-grammar"
  | "ai-improve-clarity"
  | "ai-improve-flow"
  | "ai-improve-concise"
  | "ai-improve-expand-detail"
  | "ai-improve-academic-style"
  | "ai-structure-reorder-sentences"
  | "ai-learning-simplify-beginners"
  | "ai-summaries-one-sentence"
  | "ai-summaries-two-three-sentences"
  | "ai-summaries-key-takeaway"
  | "ai-tone-academic-formal"
  | "ai-tone-friendly-conversational"
  | "ai-tone-encouraging-supportive"
  | "ai-tone-neutral-objective"
  | "ai-tone-confident"
  | "ai-tone-serious"
  | "ai-translate-english"
  | "ai-translate-finnish"
  | "ai-translate-norwegian"
  | "ai-translate-swedish"

export const AI_ACTIONS: AiActionDefinition[] = [
  {
    id: "improve-fix-spelling-grammar",
    abilityName: "moocfi/fix-spelling",
    labelKey: "ai-improve-fix-spelling-grammar",
    group: "improve",
  },
  {
    id: "improve-clarity",
    abilityName: "moocfi/ai/improve-clarity",
    labelKey: "ai-improve-clarity",
    group: "improve",
  },
  {
    id: "improve-flow",
    abilityName: "moocfi/ai/improve-flow",
    labelKey: "ai-improve-flow",
    group: "improve",
  },
  {
    id: "improve-concise",
    abilityName: "moocfi/ai/improve-concise",
    labelKey: "ai-improve-concise",
    group: "improve",
  },
  {
    id: "improve-expand-detail",
    abilityName: "moocfi/ai/improve-expand-detail",
    labelKey: "ai-improve-expand-detail",
    group: "improve",
  },
  {
    id: "improve-academic-style",
    abilityName: "moocfi/ai/improve-academic-style",
    labelKey: "ai-improve-academic-style",
    group: "improve",
  },
  {
    id: "structure-reorder-sentences",
    abilityName: "moocfi/ai/structure-reorder-sentences",
    labelKey: "ai-structure-reorder-sentences",
    group: "structure",
  },
  {
    id: "learning-simplify-beginners",
    abilityName: "moocfi/ai/learning-simplify-beginners",
    labelKey: "ai-learning-simplify-beginners",
    group: "learning-support",
  },
  {
    id: "summaries-one-sentence",
    abilityName: "moocfi/ai/summaries-one-sentence",
    labelKey: "ai-summaries-one-sentence",
    group: "summaries",
  },
  {
    id: "summaries-two-three-sentences",
    abilityName: "moocfi/ai/summaries-two-three-sentences",
    labelKey: "ai-summaries-two-three-sentences",
    group: "summaries",
  },
  {
    id: "summaries-key-takeaway",
    abilityName: "moocfi/ai/summaries-key-takeaway",
    labelKey: "ai-summaries-key-takeaway",
    group: "summaries",
  },
]

export const AI_GROUPS: AiMenuGroup[] = [
  {
    id: "improve",
    labelKey: "ai-group-improve",
    actions: AI_ACTIONS.filter((action) => action.group === "improve"),
  },
  {
    id: "structure",
    labelKey: "ai-group-structure",
    actions: AI_ACTIONS.filter((action) => action.group === "structure"),
  },
  {
    id: "learning-support",
    labelKey: "ai-group-learning-support",
    actions: AI_ACTIONS.filter((action) => action.group === "learning-support"),
  },
  {
    id: "summaries",
    labelKey: "ai-group-summaries",
    actions: AI_ACTIONS.filter((action) => action.group === "summaries"),
  },
]

export const AI_TONE_SUBMENU: AiSubmenuGroup = {
  id: "tone",
  labelKey: "ai-submenu-tone-voice",
  actions: [
    {
      id: "tone-academic-formal",
      abilityName: "moocfi/ai/tone-academic-formal",
      labelKey: "ai-tone-academic-formal",
      group: "tone",
      meta: { tone: "academic-formal" },
    },
    {
      id: "tone-friendly-conversational",
      abilityName: "moocfi/ai/tone-friendly-conversational",
      labelKey: "ai-tone-friendly-conversational",
      group: "tone",
      meta: { tone: "friendly-conversational" },
    },
    {
      id: "tone-encouraging-supportive",
      abilityName: "moocfi/ai/tone-encouraging-supportive",
      labelKey: "ai-tone-encouraging-supportive",
      group: "tone",
      meta: { tone: "encouraging-supportive" },
    },
    {
      id: "tone-neutral-objective",
      abilityName: "moocfi/ai/tone-neutral-objective",
      labelKey: "ai-tone-neutral-objective",
      group: "tone",
      meta: { tone: "neutral-objective" },
    },
    {
      id: "tone-confident",
      abilityName: "moocfi/ai/tone-confident",
      labelKey: "ai-tone-confident",
      group: "tone",
      meta: { tone: "confident" },
    },
    {
      id: "tone-serious",
      abilityName: "moocfi/ai/tone-serious",
      labelKey: "ai-tone-serious",
      group: "tone",
      meta: { tone: "serious" },
    },
  ],
}

export const AI_TRANSLATE_SUBMENU: AiSubmenuGroup = {
  id: "translate",
  labelKey: "ai-submenu-translate",
  actions: [
    {
      id: "translate-english",
      abilityName: "moocfi/ai/translate-english",
      labelKey: "ai-translate-english",
      group: "translate",
      meta: { language: "en" },
    },
    {
      id: "translate-finnish",
      abilityName: "moocfi/ai/translate-finnish",
      labelKey: "ai-translate-finnish",
      group: "translate",
      meta: { language: "fi" },
    },
    {
      id: "translate-norwegian",
      abilityName: "moocfi/ai/translate-norwegian",
      labelKey: "ai-translate-norwegian",
      group: "translate",
      meta: { language: "no" },
    },
    {
      id: "translate-swedish",
      abilityName: "moocfi/ai/translate-swedish",
      labelKey: "ai-translate-swedish",
      group: "translate",
      meta: { language: "sv" },
    },
  ],
}
