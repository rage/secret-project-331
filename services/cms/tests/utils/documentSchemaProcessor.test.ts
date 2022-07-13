/* eslint-disable i18next/no-literal-string */
import { deepStrictEqual } from "assert"

import { ExerciseAttributes } from "../../src/blocks/Exercise"
import { ExerciseSlideAttributes } from "../../src/blocks/ExerciseSlide/ExerciseSlideEditor"
import { ExerciseTaskAttributes } from "../../src/blocks/ExerciseTask/ExerciseTaskEditor"
import { CmsPageUpdate } from "../../src/shared-module/bindings"
import {
  denormalizeDocument,
  normalizeDocument,
  UnnormalizedDocument,
} from "../../src/utils/documentSchemaProcessor"

const exampleCMSPageUpdate: CmsPageUpdate = {
  content: [
    {
      name: "moocfi/pages-in-part",
      isValid: true,
      clientId: "a2c2536b-4a28-41bd-a8f2-2541f5e8d650",
      attributes: {
        hidden: false,
      },
      innerBlocks: [],
    },
    {
      name: "core/paragraph",
      isValid: true,
      clientId: "c484685c-addf-49d6-a8aa-0efc5bc91d83",
      attributes: {
        align: "center",
        content: "Example paragraph",
        dropCap: false,
      },
      innerBlocks: [],
    },
    {
      name: "moocfi/exercise",
      isValid: true,
      clientId: "f5a4fa5c-68da-4fdb-9d16-e79d8c39c125",
      attributes: {
        id: "dd46fb67-d168-4554-b912-0018f812166d",
      },
      innerBlocks: [],
    },
    {
      name: "moocfi/exercises-in-part",
      isValid: true,
      clientId: "97ae4d17-ff8c-4a85-abb3-4089bb44423d",
      attributes: {
        hidden: false,
      },
      innerBlocks: [],
    },
  ],
  exercises: [
    {
      id: "dd46fb67-d168-4554-b912-0018f812166d",
      name: "exercise",
      order_number: 0,
      score_maximum: 5,
      max_tries_per_slide: 72,
      limit_number_of_tries: true,
      deadline: null,
      needs_peer_review: false,
    },
  ],
  exercise_slides: [
    {
      id: "a9d527a3-2728-4ca2-bd6f-f443914d8052",
      exercise_id: "dd46fb67-d168-4554-b912-0018f812166d",
      order_number: 0,
    },
  ],
  exercise_tasks: [
    {
      id: "b5d31a4f-2720-4582-93e7-13c4c0c2a9df",
      exercise_slide_id: "a9d527a3-2728-4ca2-bd6f-f443914d8052",
      assignment: [
        {
          name: "core/paragraph",
          isValid: true,
          clientId: "c484685c-addf-49d6-a8aa-0efc5bc91d83",
          attributes: {
            align: "center",
            content: "Example assignment",
            dropCap: false,
          },
          innerBlocks: [],
        },
      ],
      order_number: 0,
      exercise_type: "quiz",
      private_spec: {
        options: ["a", "b", "c"],
      },
    },
  ],
  peer_reviews: [
    {
      id: "f0ae5814-927d-4a38-a0c0-db66f08c2bee",
      course_id: "",
      exercise_id: "dd46fb67-d168-4554-b912-0018f812166d",
      accepting_strategy: "AutomaticallyAcceptOrManualReviewByAverage",
      accepting_threshold: 0.5,
      peer_reviews_to_give: 1,
      peer_reviews_to_receive: 1,
    },
  ],
  peer_review_questions: [
    {
      id: "f3c8eadd-75ca-409f-b1c6-31db65701930",
      peer_review_id: "f0ae5814-927d-4a38-a0c0-db66f08c2bee",
      answer_required: true,
      order_number: 0,
      question: "how about...",
      question_type: "Essay",
    },
  ],
  url_path: "/path/to/page",
  title: "Example page",
  chapter_id: "babb2322-8bdf-417f-be05-89b2263f4851",
}

// Doing this separately so that we get type errors when the type changes
const exampleUnnormalizedDocumentExerciseAttributes: ExerciseAttributes = {
  id: "dd46fb67-d168-4554-b912-0018f812166d",
  name: "exercise",
  score_maximum: 5,
  max_tries_per_slide: 72,
  limit_number_of_tries: true,
  needs_peer_review: false,
  peer_review_config:
    '[{"id":"f0ae5814-927d-4a38-a0c0-db66f08c2bee","course_id":"","exercise_id":"dd46fb67-d168-4554-b912-0018f812166d","accepting_strategy":"AutomaticallyAcceptOrManualReviewByAverage","accepting_threshold":"0.5","peer_reviews_to_give":"1","peer_reviews_to_receive":"1"}]',
  peer_review_questions_config:
    '[{"id":"f3c8eadd-75ca-409f-b1c6-31db65701930","peer_review_id":"f0ae5814-927d-4a38-a0c0-db66f08c2bee","answer_required":"true","order_number":"0","question":"how about...","question_type":"Essay"}]',
}

// Doing this separately so that we get type errors when the type changes
const exampleUnnormalizedDocumentExerciseSlideAttributes: ExerciseSlideAttributes = {
  id: "a9d527a3-2728-4ca2-bd6f-f443914d8052",
  order_number: 0,
}

// Doing this separately so that we get type errors when the type changes
const exampleUnnormalizedDocumentExerciseTaskAttributes: ExerciseTaskAttributes = {
  id: "b5d31a4f-2720-4582-93e7-13c4c0c2a9df",
  exercise_type: "quiz",
  private_spec: '{"options":["a","b","c"]}',
  show_editor: false,
  order_number: 0,
}

const exampleUnnormalizedDocument: UnnormalizedDocument = {
  content: [
    {
      name: "moocfi/pages-in-part",
      isValid: true,
      clientId: "a2c2536b-4a28-41bd-a8f2-2541f5e8d650",
      attributes: { hidden: false },
      innerBlocks: [],
    },
    {
      name: "core/paragraph",
      isValid: true,
      clientId: "c484685c-addf-49d6-a8aa-0efc5bc91d83",
      attributes: { align: "center", content: "Example paragraph", dropCap: false },
      innerBlocks: [],
    },
    {
      name: "moocfi/exercise",
      isValid: true,
      clientId: "f5a4fa5c-68da-4fdb-9d16-e79d8c39c125",
      attributes: exampleUnnormalizedDocumentExerciseAttributes,
      innerBlocks: [
        {
          // When denormalizing in tests, this is inferred from exercise slide id so that the whole operation is reversible
          clientId: "a9d527a3-2728-4ca2-bd6f-f443914d8052",
          name: "moocfi/exercise-slide",
          attributes: exampleUnnormalizedDocumentExerciseSlideAttributes,
          isValid: true,
          innerBlocks: [
            {
              // When denormalizing in tests, this is inferred from exercise task id so that the whole operation is reversible
              clientId: "b5d31a4f-2720-4582-93e7-13c4c0c2a9df",
              name: "moocfi/exercise-task",
              attributes: exampleUnnormalizedDocumentExerciseTaskAttributes,
              isValid: true,
              innerBlocks: [
                {
                  name: "core/paragraph",
                  isValid: true,
                  clientId: "c484685c-addf-49d6-a8aa-0efc5bc91d83",
                  attributes: { align: "center", content: "Example assignment", dropCap: false },
                  innerBlocks: [],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "moocfi/exercises-in-part",
      isValid: true,
      clientId: "97ae4d17-ff8c-4a85-abb3-4089bb44423d",
      attributes: { hidden: false },
      innerBlocks: [],
    },
  ],
  title: "Example page",
  urlPath: "/path/to/page",
  chapterId: "babb2322-8bdf-417f-be05-89b2263f4851",
}

test("We get the original document if we first denormalize and then normalize", async () => {
  const res = normalizeDocument(denormalizeDocument(exampleCMSPageUpdate))
  deepStrictEqual(res, exampleCMSPageUpdate)
})

test("We get the original document if we first normalize and then denormalize", async () => {
  const res = denormalizeDocument(normalizeDocument(exampleUnnormalizedDocument))
  deepStrictEqual(res, exampleUnnormalizedDocument)
})
