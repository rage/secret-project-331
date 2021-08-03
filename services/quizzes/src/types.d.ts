import { ActionType } from "typesafe-actions"

import * as editorActions from "./store/editor/editorActions"
import * as itemActions from "./store/editor/items/itemActions"
import * as optionActions from "./store/editor/options/optionActions"
import * as peerReviewActions from "./store/editor/peerReviewCollections/peerReviewCollectionActions"
import * as questionActions from "./store/editor/questions/questionActions"
import * as quizActions from "./store/editor/quiz/quizActions"

const actionTypes = {
  ...editorActions,
  ...itemActions,
  ...optionActions,
  ...quizActions,
  ...peerReviewActions,
  ...questionActions,
}

export type RootAction = ActionType<typeof actionTypes>

declare module "typesafe-actions" {
  interface Types {
    RootAction: RootAction
  }
}
