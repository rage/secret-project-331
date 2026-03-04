export type AiActionGroupId =
  | "generate"
  | "improve"
  | "structure"
  | "learning-support"
  | "summaries"

export type AiSubmenuId = "tone" | "translate"

export interface AiActionMeta {
  tone?: string
  language?: string
  settingType?: "audience" | "reading-level" | "tone-preference"
}

export interface AiActionDefinition {
  id: string
  abilityName: string
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

export const AI_ACTIONS: AiActionDefinition[] = [
  {
    id: "generate-draft-from-notes",
    abilityName: "moocfi/ai/generate-draft-from-notes",
    labelKey: "ai-generate-draft-from-notes",
    group: "generate",
  },
  {
    id: "generate-continue-paragraph",
    abilityName: "moocfi/ai/generate-continue-paragraph",
    labelKey: "ai-generate-continue-paragraph",
    group: "generate",
  },
  {
    id: "generate-add-example",
    abilityName: "moocfi/ai/generate-add-example",
    labelKey: "ai-generate-add-example",
    group: "generate",
  },
  {
    id: "generate-add-counterpoint",
    abilityName: "moocfi/ai/generate-add-counterpoint",
    labelKey: "ai-generate-add-counterpoint",
    group: "generate",
  },
  {
    id: "generate-add-concluding-sentence",
    abilityName: "moocfi/ai/generate-add-concluding-sentence",
    labelKey: "ai-generate-add-concluding-sentence",
    group: "generate",
  },
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
    id: "structure-create-topic-sentence",
    abilityName: "moocfi/ai/structure-create-topic-sentence",
    labelKey: "ai-structure-create-topic-sentence",
    group: "structure",
  },
  {
    id: "structure-reorder-sentences",
    abilityName: "moocfi/ai/structure-reorder-sentences",
    labelKey: "ai-structure-reorder-sentences",
    group: "structure",
  },
  {
    id: "structure-split-into-paragraphs",
    abilityName: "moocfi/ai/structure-split-into-paragraphs",
    labelKey: "ai-structure-split-into-paragraphs",
    group: "structure",
  },
  {
    id: "structure-combine-into-one",
    abilityName: "moocfi/ai/structure-combine-into-one",
    labelKey: "ai-structure-combine-into-one",
    group: "structure",
  },
  {
    id: "structure-to-bullets",
    abilityName: "moocfi/ai/structure-to-bullets",
    labelKey: "ai-structure-to-bullets",
    group: "structure",
  },
  {
    id: "structure-from-bullets",
    abilityName: "moocfi/ai/structure-from-bullets",
    labelKey: "ai-structure-from-bullets",
    group: "structure",
  },
  {
    id: "learning-simplify-beginners",
    abilityName: "moocfi/ai/learning-simplify-beginners",
    labelKey: "ai-learning-simplify-beginners",
    group: "learning-support",
  },
  {
    id: "learning-add-definitions",
    abilityName: "moocfi/ai/learning-add-definitions",
    labelKey: "ai-learning-add-definitions",
    group: "learning-support",
  },
  {
    id: "learning-add-analogy",
    abilityName: "moocfi/ai/learning-add-analogy",
    labelKey: "ai-learning-add-analogy",
    group: "learning-support",
  },
  {
    id: "learning-add-practice-question",
    abilityName: "moocfi/ai/learning-add-practice-question",
    labelKey: "ai-learning-add-practice-question",
    group: "learning-support",
  },
  {
    id: "learning-add-check-understanding",
    abilityName: "moocfi/ai/learning-add-check-understanding",
    labelKey: "ai-learning-add-check-understanding",
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
    id: "generate",
    labelKey: "ai-group-generate",
    actions: AI_ACTIONS.filter((action) => action.group === "generate"),
  },
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
      id: "translate-swedish",
      abilityName: "moocfi/ai/translate-swedish",
      labelKey: "ai-translate-swedish",
      group: "translate",
      meta: { language: "sv" },
    },
  ],
}
