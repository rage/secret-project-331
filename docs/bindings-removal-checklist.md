# Bindings Removal Checklist

Rules:

- One checklist item per file that previously imported `bindings` or `bindings.guard`.
- `quizzes` and `example-exercise` should use local utils copies for the exercise-service contracts they still need.
- Other callers should prefer generated OpenAPI types where current exported specs cover the model, and only keep small local compatibility types where there is no current spec coverage.

## Shared Module

- [x] `shared-module/packages/common/src/components/ErrorBanner/parseError.ts`
- [x] `shared-module/packages/common/src/components/OnlyRenderIfPermissions.tsx`
- [x] `shared-module/packages/common/src/exercise-service-protocol-types.ts`
- [x] `shared-module/packages/common/src/hooks/useAuthorizeMultiple.tsx`
- [x] `shared-module/packages/common/src/services/backend/auth.ts`
- [x] `shared-module/packages/common/src/utils/fetching.ts`
- [x] `shared-module/packages/common/src/utils/typeMappter.ts`

## CMS

- [x] `services/cms/src/blocks/Exercise/ExerciseTask/ChooseExerciseTaskType/ExerciseServiceList.tsx`
- [x] `services/cms/src/blocks/Exercise/ExerciseTask/ChooseExerciseTaskType/index.tsx`
- [x] `services/cms/src/components/PeerReviewEditor.tsx`
- [x] `services/cms/src/components/editors/EmailEditor.tsx`
- [x] `services/cms/src/components/editors/ExamsInstructionsEditor.tsx`
- [x] `services/cms/src/components/editors/PageEditor.tsx`
- [x] `services/cms/src/components/editors/PartnersBlockEditor.tsx`
- [x] `services/cms/src/components/editors/ResearchConsentFormEditor.tsx`
- [x] `services/cms/src/contexts/PageContext.tsx`
- [x] `services/cms/src/pages/courses/[id]/default-peer-review.tsx`
- [x] `services/cms/src/pages/courses/[id]/research-form-edit.tsx`
- [x] `services/cms/src/pages/email-templates/[id]/edit.tsx`
- [x] `services/cms/src/pages/exams/[id]/edit.tsx`
- [x] `services/cms/src/pages/pages/[id].tsx`
- [x] `services/cms/src/pages/partners-block/[id]/edit.tsx`
- [x] `services/cms/src/services/backend/ai-suggestions.ts`
- [x] `services/cms/src/services/backend/chapters.ts`
- [x] `services/cms/src/services/backend/course-instances.ts`
- [x] `services/cms/src/services/backend/courses.ts`
- [x] `services/cms/src/services/backend/email-templates.ts`
- [x] `services/cms/src/services/backend/exams.ts`
- [x] `services/cms/src/services/backend/exercise-services.ts`
- [x] `services/cms/src/services/backend/pages.ts`
- [x] `services/cms/src/services/backend/partners-block.ts`
- [x] `services/cms/src/services/backend/repository-exercises.ts`
- [x] `services/cms/src/utils/Gutenberg/ai/abilities.ts`
- [x] `services/cms/src/utils/Gutenberg/ai/menu.ts`
- [x] `services/cms/src/utils/Gutenberg/gutenbergBlocks.ts`
- [x] `services/cms/src/utils/documentSchemaProcessor.tsx`
- [x] `services/cms/src/utils/peerOrSelfReviewConfig.ts`
- [x] `services/cms/tests/utils/documentSchemaProcessor.test.ts`

## Quizzes

- [x] `services/quizzes/src/app/api/grade/route.ts`
- [x] `services/quizzes/src/app/api/model-solution/route.ts`
- [x] `services/quizzes/src/app/api/public-spec/route.ts`
- [x] `services/quizzes/src/app/api/service-info/route.ts`
- [x] `services/quizzes/src/app/iframe/page.tsx`
- [x] `services/quizzes/tests/api/grade.test.ts`
- [x] `services/quizzes/tests/api/model-solution-spec.test.ts`
- [x] `services/quizzes/tests/api/public-spec.test.ts`
- [x] `services/quizzes/tests/api/service-info.test.ts`

## Example Exercise

- [x] `services/example-exercise/src/app/api/model-solution/route.ts`
- [x] `services/example-exercise/src/app/api/public-spec/route.ts`
- [x] `services/example-exercise/src/app/api/service-info/route.ts`
- [x] `services/example-exercise/src/app/iframe/page.tsx`

## TMC

- [x] `services/tmc/src/app/api/grade/route.ts`
- [x] `services/tmc/src/app/api/model-solution/route.ts`
- [x] `services/tmc/src/app/api/public-spec/route.ts`
- [x] `services/tmc/src/app/api/service-info/route.ts`
- [x] `services/tmc/src/components/AnswerBrowserExercise/types.ts`
- [x] `services/tmc/src/components/AnswerExercise.tsx`
- [x] `services/tmc/src/hooks/useIframeProtocol.ts`
- [x] `services/tmc/src/util/helpers.ts`
- [x] `services/tmc/src/util/stateInterfaces.ts`

## Docs

- [x] `docs/frontend.md`
