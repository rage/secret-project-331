// oxlint-disable-next-line i18next/no-literal-string
const QUESTION_BLOCK_NAME = "moocfi/research-consent-question"

/**
 * Ids of the questions currently in a research form, in form order. The backend keys question rows
 * by the question block's clientId, so these match `research_form_question_id` on answers.
 */
export function researchFormQuestionIds(content: unknown): string[] {
  if (!Array.isArray(content)) {
    return []
  }
  return content.flatMap((block: unknown) =>
    typeof block === "object" &&
    block !== null &&
    "name" in block &&
    block.name === QUESTION_BLOCK_NAME &&
    "clientId" in block &&
    typeof block.clientId === "string"
      ? [block.clientId]
      : [],
  )
}
