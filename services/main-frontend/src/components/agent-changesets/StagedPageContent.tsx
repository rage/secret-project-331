"use client"

import { css } from "@emotion/css"
import { createStore, Provider as JotaiProvider } from "jotai"
import React, { createContext, useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer, {
  BlockRendererOverridesContext,
  type BlockRendererProps,
} from "@/components/course-material/ContentRenderer"
import { ExerciseCardHeader, ExerciseCardWrapper } from "@/components/exercise-card"
import type { PageSnapshot } from "@/generated/api/types.generated"
import type { Page } from "@/generated/course-material-api/types.generated"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { viewParamsAtom } from "@/state/course-material/params"
import { inlineColorStyles } from "@/styles/course-material/inlineColorStyles"
import type { Block } from "@/types/courseMaterialBlock"

/** Blocks whose content depends on the student viewing them; the preview names them instead. */
const STUDENT_SPECIFIC_BLOCKS = [
  "moocfi/chapter-progress",
  "moocfi/course-progress",
  "moocfi/congratulations",
  "moocfi/lock-chapter",
  "moocfi/chatbot",
  "moocfi/code-giveaway",
  "moocfi/research-consent-question",
  "moocfi/conditional-block",
]

const placeholderCss = css`
  border: 2px dashed ${baseTheme.colors.gray[300]};
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  font-family: ${headingFont};
  font-size: 1rem;
  color: ${baseTheme.colors.gray[600]};
`

const StudentSpecificBlockPlaceholder: React.FC<BlockRendererProps<unknown>> = ({ data }) => {
  const { t } = useTranslation()
  return (
    <div className={placeholderCss} data-testid="agent-preview-block-placeholder">
      {t("agent-preview-student-specific-block", { name: data.name })}
    </div>
  )
}

const StagedPageSnapshotContext = createContext<PageSnapshot | null>(null)

const ExercisePlaceholder: React.FC<BlockRendererProps<{ id?: string }>> = ({ data }) => {
  const { t } = useTranslation()
  const snapshot = useContext(StagedPageSnapshotContext)
  if (snapshot === null) {
    throw new Error("ExercisePlaceholder rendered outside StagedPageContent")
  }
  const exercise = snapshot.exercises.find((e) => e.id === data.attributes.id)
  const slideIds = new Set(
    snapshot.exercise_slides.filter((s) => s.exercise_id === exercise?.id).map((s) => s.id),
  )
  const assignments = snapshot.exercise_tasks
    .filter((task) => slideIds.has(task.exercise_slide_id))
    .toSorted((a, b) => a.order_number - b.order_number)
    .flatMap((task) =>
      Array.isArray(task.assignment) ? (task.assignment as Block<unknown>[]) : [],
    )

  return (
    <ExerciseCardWrapper>
      <ExerciseCardHeader
        title={
          <h2
            className={css`
              font-size: 1.5rem;
              font-weight: 500;
              margin: 0;
            `}
          >
            {exercise?.name ?? t("exercise")}
          </h2>
        }
      />
      <div
        className={css`
          padding: 0 1.25rem;
        `}
      >
        {assignments.length > 0 && (
          <ContentRenderer
            data={assignments}
            isExam={false}
            dontAddWrapperDivMeantForMostOutermostContentRenderer
          />
        )}
        <p className={placeholderCss} data-testid="agent-preview-exercise-placeholder">
          {t("agent-preview-exercise-placeholder")}
        </p>
      </div>
    </ExerciseCardWrapper>
  )
}

const BLOCK_RENDERER_OVERRIDES: Record<string, React.ComponentType<BlockRendererProps<never>>> = {
  ...Object.fromEntries(
    STUDENT_SPECIFIC_BLOCKS.map((name) => [name, StudentSpecificBlockPlaceholder]),
  ),
  "moocfi/exercise": ExercisePlaceholder,
}

/** The snapshot in the page shape the course material blocks read. */
function pageFromSnapshot(snapshot: PageSnapshot): Page {
  return {
    id: snapshot.id,
    course_id: snapshot.course_id,
    chapter_id: snapshot.chapter_id ?? null,
    url_path: snapshot.url_path,
    title: snapshot.title,
    hidden: snapshot.hidden,
    order_number: snapshot.order_number,
    content: snapshot.content,
    // No block reads these, and a staged page has none of its own.
    created_at: "",
    updated_at: "",
  }
}

interface StagedPageContentProps {
  snapshot: PageSnapshot
  /** Keeps full-width blocks inside the container, for side-by-side columns. */
  isConstrainedToContainer?: boolean
}

/**
 * Renders a page snapshot's blocks with the course material renderer, read-only: exercises and
 * blocks that depend on the student viewing them show as placeholders.
 */
const StagedPageContent: React.FC<StagedPageContentProps> = ({
  snapshot,
  isConstrainedToContainer = false,
}) => {
  const store = useMemo(() => {
    const pageStore = createStore()
    pageStore.set(viewParamsAtom, { type: "preview", page: pageFromSnapshot(snapshot) })
    return pageStore
  }, [snapshot])

  return (
    <JotaiProvider store={store}>
      <StagedPageSnapshotContext.Provider value={snapshot}>
        <BlockRendererOverridesContext.Provider value={BLOCK_RENDERER_OVERRIDES}>
          <div className={inlineColorStyles}>
            <ContentRenderer
              data={snapshot.content as Block<unknown>[]}
              isExam={false}
              dontAllowBlockToBeWiderThanContainerWidth={isConstrainedToContainer}
            />
          </div>
        </BlockRendererOverridesContext.Provider>
      </StagedPageSnapshotContext.Provider>
    </JotaiProvider>
  )
}

export default StagedPageContent
