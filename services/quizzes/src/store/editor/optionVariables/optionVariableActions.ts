import { createAction } from "typesafe-actions"

export const setOptionEditing = createAction(
  "SET_EDITING_OPTION",
  (optionId: string, editing: boolean) => ({
    optionId: optionId,
    editing: editing,
  }),
)<{ optionId: string; editing: boolean }>()
