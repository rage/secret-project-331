import { AI_ACTIONS, AI_TONE_SUBMENU, AI_TRANSLATE_SUBMENU } from "./menu"
import { registerAbility } from "./registry"
import type { AbilityDefinition } from "./types"

import { requestParagraphSuggestions } from "@/services/backend/ai-suggestions"
import type {
  ParagraphSuggestionContext,
  ParagraphSuggestionRequest,
} from "@/shared-module/common/bindings"

export interface ParagraphAbilityInputMeta {
  tone?: string
  language?: string
  settingType?: string
  context?: ParagraphSuggestionContext | null
}

export interface ParagraphAbilityInput {
  text: string
  isHtml?: boolean
  meta?: ParagraphAbilityInputMeta
}

const BASE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    isHtml: { type: "boolean" },
    meta: { type: "object" },
  },
  required: ["text"],
}

const BASE_OUTPUT_SCHEMA = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
}

const buildParagraphSuggestionMeta = (
  meta?: ParagraphAbilityInputMeta,
): ParagraphSuggestionRequest["meta"] => {
  if (!meta) {
    return null
  }

  return {
    tone: meta.tone ?? null,
    language: meta.language ?? null,
    setting_type: meta.settingType ?? null,
  }
}

export const buildParagraphSuggestionRequest = (
  action: string,
  input: ParagraphAbilityInput,
): ParagraphSuggestionRequest => ({
  action,
  content: input.text,
  is_html: input.isHtml ?? false,
  meta: buildParagraphSuggestionMeta(input.meta),
  context: input.meta?.context ?? null,
})

const fixSpellingAbility: AbilityDefinition<
  ParagraphAbilityInput,
  { text: string; suggestions: string[] }
> = {
  name: "moocfi/fix-spelling",
  label: "Fix spelling",
  description: "Fix spelling and grammar in the selected text",
  category: "ai",
  input_schema: BASE_INPUT_SCHEMA,
  output_schema: BASE_OUTPUT_SCHEMA,
  callback: async (input) => {
    const payload = buildParagraphSuggestionRequest("moocfi/fix-spelling", input)
    const response = await requestParagraphSuggestions(payload)

    const suggestions = response.suggestions ?? []

    if (suggestions.length === 0) {
      throw new Error("No AI suggestions were returned for fix spelling")
    }

    return {
      text: suggestions[0] ?? input.text,
      suggestions,
    }
  },
}

function createPlaceholderAbility(
  abilityName: string,
  label: string,
  description: string,
): AbilityDefinition<ParagraphAbilityInput, { text: string; suggestions: string[] }> {
  return {
    name: abilityName,
    label,
    description,
    category: "ai",
    input_schema: BASE_INPUT_SCHEMA,
    output_schema: BASE_OUTPUT_SCHEMA,
    callback: async (input) => {
      const payload = buildParagraphSuggestionRequest(abilityName, input)
      const response = await requestParagraphSuggestions(payload)

      const suggestions = response.suggestions ?? []

      if (suggestions.length === 0) {
        throw new Error(`No AI suggestions were returned for ability ${abilityName}`)
      }

      return {
        text: suggestions[0] ?? input.text,
        suggestions,
      }
    },
  }
}

const allPlaceholderAbilities: AbilityDefinition<
  ParagraphAbilityInput,
  { text: string; suggestions: string[] }
>[] = [
  ...AI_ACTIONS.filter((action) => action.abilityName !== "moocfi/fix-spelling").map((action) =>
    createPlaceholderAbility(action.abilityName, action.id, `Placeholder for ${action.id}`),
  ),
  ...AI_TONE_SUBMENU.actions.map((action) =>
    createPlaceholderAbility(action.abilityName, action.id, `Placeholder for ${action.id}`),
  ),
  ...AI_TRANSLATE_SUBMENU.actions.map((action) =>
    createPlaceholderAbility(action.abilityName, action.id, `Placeholder for ${action.id}`),
  ),
]

/** Registers all editor AI abilities (call once when editor boots). */
export function registerEditorAiAbilities(): void {
  registerAbility(fixSpellingAbility)
  for (const ability of allPlaceholderAbilities) {
    registerAbility(ability)
  }
}

export { getAbility, executeAbility, registerAbilityCategory } from "./registry"
