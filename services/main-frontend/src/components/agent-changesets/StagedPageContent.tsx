"use client"

import { css } from "@emotion/css"
import { createStore, Provider as JotaiProvider } from "jotai"
import React, { createContext, useContext, useEffect, useId, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer, {
  BlockRendererOverridesContext,
  type BlockRendererProps,
} from "@/components/course-material/ContentRenderer"
import InnerBlocks from "@/components/course-material/ContentRenderer/util/InnerBlocks"
import {
  ExerciseCardHeader,
  ExerciseCardTitle,
  ExerciseCardWrapper,
} from "@/components/exercise-card"
import type { PreviewExercise, PreviewPage } from "@/generated/api/types.generated"
import type { Page } from "@/generated/course-material-api/types.generated"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { viewParamsAtom } from "@/state/course-material/params"
import { inlineColorStyles } from "@/styles/course-material/inlineColorStyles"
import type { Block } from "@/types/courseMaterialBlock"

/** Blocks that show data about the student viewing them; the preview names them instead. */
const STUDENT_SPECIFIC_BLOCKS = [
  "moocfi/chapter-progress",
  "moocfi/course-progress",
  "moocfi/congratulations",
  "moocfi/chatbot",
  "moocfi/research-consent-question",
  "moocfi/exercise-custom-view-block",
  "moocfi/exercises-in-chapter",
  "moocfi/map",
]

/** Blocks that show their inner blocks only to some students; the preview shows them to all. */
const STUDENT_SPECIFIC_CONTAINERS = [
  "moocfi/conditional-block",
  "moocfi/lock-chapter",
  "moocfi/code-giveaway",
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

const StudentSpecificContainer: React.FC<BlockRendererProps<unknown>> = (props) => {
  const { t } = useTranslation()
  return (
    <div className={placeholderCss} data-testid="agent-preview-student-specific-container">
      <p
        className={css`
          margin: 0 0 1rem 0;
        `}
      >
        {t("agent-preview-student-specific-container", { name: props.data.name })}
      </p>
      <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
    </div>
  )
}

const StagedPageContext = createContext<PreviewPage | null>(null)

/** Where students read the review instructions: above the answer they review. */
const StagedReviewInstructions: React.FC<{ exercise: PreviewExercise }> = ({ exercise }) => {
  const { t } = useTranslation()
  const instructions = exercise.review_instructions as Block<unknown>[] | null | undefined
  if (!instructions || instructions.length === 0) {
    return exercise.uses_course_default_review_config ? (
      <p data-testid="agent-preview-review-instructions-default">
        {t("agent-preview-review-instructions-course-default")}
      </p>
    ) : null
  }
  return (
    <div data-testid="agent-preview-review-instructions">
      <h4
        className={css`
          padding-bottom: 0.5rem;
          font-size: 1.125rem;
        `}
      >
        {t("title-peer-review-instructions")}
      </h4>
      <ContentRenderer data={instructions} isExam={false} />
    </div>
  )
}

const ExercisePlaceholder: React.FC<BlockRendererProps<{ id?: string }>> = ({ data }) => {
  const { t } = useTranslation()
  const page = useContext(StagedPageContext)
  if (page === null) {
    throw new Error("ExercisePlaceholder rendered outside StagedPageContent")
  }
  const exercise = page.exercises.find((e) => e.id === data.attributes.id)
  const assignments = (exercise?.assignment ?? []) as Block<unknown>[]

  return (
    <ExerciseCardWrapper>
      <ExerciseCardHeader title={<ExerciseCardTitle name={exercise?.name ?? t("exercise")} />} />
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
        {exercise?.has_reviews && <StagedReviewInstructions exercise={exercise} />}
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
  ...Object.fromEntries(
    STUDENT_SPECIFIC_CONTAINERS.map((name) => [name, StudentSpecificContainer]),
  ),
  "moocfi/exercise": ExercisePlaceholder,
}

/** The preview page in the page shape the course material blocks read. */
function coursePageOf(page: PreviewPage): Page {
  return {
    id: page.id,
    course_id: page.course_id,
    chapter_id: page.chapter_id ?? null,
    url_path: page.url_path,
    title: page.title,
    hidden: page.hidden,
    order_number: page.order_number,
    content: page.content,
    // No block reads these, and a staged page has none of its own.
    created_at: "",
    updated_at: "",
  }
}

const ID_REFERENCE_ATTRIBUTES = [
  "aria-activedescendant",
  "aria-controls",
  "aria-describedby",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
  "aria-labelledby",
  "aria-owns",
  "for",
]
const OBSERVED_ATTRIBUTES = ["id", "href", ...ID_REFERENCE_ATTRIBUTES]
const HEADING = /^h[1-6]$/
const EMBEDDED_ELEMENTS = [
  "[id]",
  ...ID_REFERENCE_ATTRIBUTES.map((attribute) => `[${attribute}]`),
  'a[href^="#"]',
  "h1, h2, h3, h4, h5, h6",
].join(", ")

/**
 * Lets rendered content sit next to other copies of itself: element ids and the references to
 * them get a prefix of their own, and headings are announced below `headingLevel`. Rewrites the
 * DOM React rendered, so it reaches every block without each block knowing.
 */
function useEmbeddedContent(
  containerRef: React.RefObject<HTMLDivElement | null>,
  headingLevel: number | undefined,
) {
  const prefix = useId()
  useEffect(() => {
    const container = containerRef.current
    if (container === null || headingLevel === undefined) {
      return
    }
    const withPrefix = (id: string) => (id.startsWith(prefix) ? id : `${prefix}${id}`)
    const setAttribute = (element: Element, attribute: string, value: string) => {
      if (element.getAttribute(attribute) !== value) {
        element.setAttribute(attribute, value)
      }
    }
    const embedElement = (element: Element) => {
      const id = element.getAttribute("id")
      if (id !== null) {
        setAttribute(element, "id", withPrefix(id))
      }
      for (const attribute of ID_REFERENCE_ATTRIBUTES) {
        const referencedIds = element.getAttribute(attribute)?.split(/\s+/)
        if (referencedIds !== undefined) {
          setAttribute(
            element,
            attribute,
            referencedIds
              .filter((referencedId) => referencedId !== "")
              .map((referencedId) => withPrefix(referencedId))
              .join(" "),
          )
        }
      }
      const href = element.getAttribute("href")
      if (element.localName === "a" && href?.startsWith("#")) {
        setAttribute(element, "href", `#${withPrefix(href.slice(1))}`)
      }
      if (HEADING.test(element.localName)) {
        setAttribute(
          element,
          "aria-level",
          String(headingLevel + Number(element.localName.slice(1))),
        )
      }
    }
    const embedSubtree = (root: Element) => {
      if (root.matches(EMBEDDED_ELEMENTS)) {
        embedElement(root)
      }
      for (const element of root.querySelectorAll(EMBEDDED_ELEMENTS)) {
        embedElement(element)
      }
    }
    embedSubtree(container)
    // Blocks keep rendering after mount, for example when their data loads.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") {
          embedElement(record.target as Element)
          continue
        }
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            embedSubtree(node as Element)
          }
        }
      }
    })
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
    })
    return () => observer.disconnect()
  }, [containerRef, headingLevel, prefix])
}

interface StagedBlocksProps {
  blocks: unknown
  /** Keeps full-width blocks inside the container, for side-by-side columns. */
  isConstrainedToContainer?: boolean
  /** See [`StagedPageContentProps.embeddedUnderHeadingLevel`]. */
  embeddedUnderHeadingLevel?: number
  /** The page the blocks belong to, for blocks that read it. */
  page?: PreviewPage
}

/** Stored blocks rendered read-only like a page's content, for content that has no page of its own. */
export const StagedBlocks: React.FC<StagedBlocksProps> = ({
  blocks,
  isConstrainedToContainer = false,
  embeddedUnderHeadingLevel,
  page,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  useEmbeddedContent(containerRef, embeddedUnderHeadingLevel)
  const store = useMemo(() => {
    const pageStore = createStore()
    if (page) {
      pageStore.set(viewParamsAtom, { type: "preview", page: coursePageOf(page) })
    }
    return pageStore
  }, [page])

  return (
    <JotaiProvider store={store}>
      <StagedPageContext.Provider value={page ?? null}>
        <BlockRendererOverridesContext.Provider value={BLOCK_RENDERER_OVERRIDES}>
          <div ref={containerRef} className={inlineColorStyles}>
            <ContentRenderer
              data={blocks as Block<unknown>[]}
              isExam={false}
              dontAllowBlockToBeWiderThanContainerWidth={isConstrainedToContainer}
            />
          </div>
        </BlockRendererOverridesContext.Provider>
      </StagedPageContext.Provider>
    </JotaiProvider>
  )
}

interface StagedPageContentProps {
  page: PreviewPage
  /** Keeps full-width blocks inside the container, for side-by-side columns. */
  isConstrainedToContainer?: boolean
  /**
   * Set when the page is shown inside another page, under a heading of this level: the page's
   * headings are announced below it, and its element ids can't clash with another copy's.
   */
  embeddedUnderHeadingLevel?: number
}

/**
 * Renders a page's blocks with the course material renderer, read-only: exercises and blocks that
 * show data about the student viewing them are placeholders, and content only some students see
 * is shown with a note saying so.
 */
const StagedPageContent: React.FC<StagedPageContentProps> = ({ page, ...options }) => (
  <StagedBlocks blocks={page.content} page={page} {...options} />
)

export default StagedPageContent
