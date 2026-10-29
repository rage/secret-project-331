import type { QuizItemOption } from "../../../../../../types/quizTypes/privateSpec"
import type { OptionChanges } from "./MultipleChoiceOption"

/** Applies `changes` to the option with `optionId` inside an immer draft of an item's options. */
const applyOptionChanges = (
  draft: { options: QuizItemOption[] } | null,
  optionId: string,
  changes: OptionChanges,
): void => {
  const draftOption = draft?.options.find((opt) => opt.id === optionId)
  if (draftOption) {
    Object.assign(draftOption, changes)
  }
}

export default applyOptionChanges
