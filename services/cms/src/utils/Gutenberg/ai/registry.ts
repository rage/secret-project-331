import type { AbilityCategory, AbilityDefinition } from "./types"

/** Reserved for future ability grouping: `registerAbilityCategory` stores `AbilityCategory` metadata here. */
const categories = new Map<string, AbilityCategory>()
const abilities = new Map<string, AbilityDefinition<unknown, unknown>>()

/** Registers an ability category (e.g. "ai" for LLM actions). */
export function registerAbilityCategory(name: string, category: AbilityCategory): void {
  categories.set(name, category)
}

/** Registers a single ability with name, schemas, and callback. */
export function registerAbility<I, O>(definition: AbilityDefinition<I, O>): void {
  abilities.set(definition.name, definition as AbilityDefinition<unknown, unknown>)
}

/** Returns the ability definition for a given name, or undefined. */
export function getAbility(name: string): AbilityDefinition<unknown, unknown> | undefined {
  return abilities.get(name)
}

/** Executes an ability by name with the given input; validates output has required fields. */
export async function executeAbility<O extends { text: string }>(
  name: string,
  input: unknown,
): Promise<O> {
  const ability = abilities.get(name)
  if (!ability) {
    throw new Error(`Unknown ability: ${name}`)
  }
  const result = (await ability.callback(input)) as O
  if (typeof result !== "object" || result === null || typeof (result as O).text !== "string") {
    throw new Error(`Ability ${name} did not return { text: string }`)
  }
  return result
}
