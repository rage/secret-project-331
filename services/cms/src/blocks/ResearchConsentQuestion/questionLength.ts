const MIN_QUESTION_WORDS = 3

/** Whether a question is too short to be a sentence students can consent to. */
export function isResearchQuestionTooShort(question: string | undefined): boolean {
  return (question ?? "").trim().split(/\s+/).filter(Boolean).length < MIN_QUESTION_WORDS
}
