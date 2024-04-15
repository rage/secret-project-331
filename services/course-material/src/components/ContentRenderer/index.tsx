/* eslint-disable i18next/no-literal-string */
import { css, cx } from "@emotion/css"
import DOMPurify from "dompurify"
import dynamic from "next/dynamic"
import React from "react"
import { useTranslation } from "react-i18next"

import { Block } from "../../services/backend"
import { NewProposedBlockEdit } from "../../shared-module/bindings"
import useQueryParameter from "../../shared-module/hooks/useQueryParameter"
import { baseTheme } from "../../shared-module/styles"
import { linkWithExtraIconClass } from "../../shared-module/styles/constants"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import {
  COURSE_MATERIAL_DEFAULT_BLOCK_MARGIN_REM,
  courseMaterialBlockClass,
} from "../../utils/constants"

import DefaultBlock from "./DefaultBlock"
import AudioBlock from "./core/common/Audio/AudioBlock"
import FileBlock from "./core/common/File/FileBlock"
import HeadingBlock from "./core/common/Heading/HeadingBlock"
import ImageBlock from "./core/common/Image/ImageBlock"
import ListBlock from "./core/common/List/ListBlock"
import ListItemBlock from "./core/common/List/ListItemBlock"
import ParagraphBlock from "./core/common/Paragraph"
import QuoteBlock from "./core/common/Quote/QuoteBlock"
import EmbedBlock from "./core/embeds/EmbedBlock"
import CodeBlock from "./core/formatting/CodeBlock"
import CustomHTMLBlock from "./core/formatting/CustomHTMLBlock"
import PreformattedBlock from "./core/formatting/PreformattedBlock"
import PullquoteBlock from "./core/formatting/PullquoteBlock"
import TableBlock from "./core/formatting/TableBlock"
import VerseBlock from "./core/formatting/VerseBlock"
import ButtonsBlock from "./core/layout/Buttons/ButtonsBlock"
import ColumnBlock from "./core/layout/ColumnBlock"
import ColumnsBlock from "./core/layout/ColumnsBlock"
import SeparatorBlock from "./core/layout/Separator"
import SpacerBlock from "./core/layout/SpacerBlock"
import AsideBlock from "./moocfi/AsideBlock"
import AudioPlayer from "./moocfi/AudioPlayer/index"
import AuthorBlock from "./moocfi/AuthorBlock"
import AuthorInnerBlock from "./moocfi/AuthorInnerBlock"
import ChapterProgressBlock from "./moocfi/ChapterProgressBlock"
import ConditionalBlock from "./moocfi/ConditionalBlock"
import CongratulationsBlock from "./moocfi/CongratulationsBlock"
import CourseChapterGridBlock from "./moocfi/CourseChapterGridBlock"
import CourseObjectiveSectionBlock from "./moocfi/CourseObjectiveSectionBlock"
import CourseProgressBlock from "./moocfi/CourseProgressBlock"
import ExerciseBlock from "./moocfi/ExerciseBlock"
import ExerciseCustomViewBlock from "./moocfi/ExerciseCustomViewBlock"
import ExerciseInChapterBlock from "./moocfi/ExerciseInChapterBlock/index"
import GlossaryBlock from "./moocfi/Glossary"
import HeroSectionBlock from "./moocfi/HeroSectionBlock"
import HighlightBox from "./moocfi/HighglightBox"
import { IframeBlock } from "./moocfi/IframeBlock"
import InfoBox from "./moocfi/InfoBox"
import InstructionBoxBlock from "./moocfi/InstructionBox"
import LandingPageCopyTextBlock from "./moocfi/LandingPageCopyTextBlock"
import LandingPageHeroSectionBlock from "./moocfi/LandingPageHeroSectionBlock"
import LearningObjectiveBlock from "./moocfi/LearningObjectiveBlock"
import Map from "./moocfi/Map"
import PagesInChapterBlock from "./moocfi/PagesInChapterBlock"
import PartnersBlock from "./moocfi/PartnersBlock"
import ResearchConsentQuestionBlock from "./moocfi/ResearchConsentQuestionBlock"
import TableBox from "./moocfi/TableBox"
import TopLevelPageBlock from "./moocfi/TopLevelPagesBlock/index"

/** The props that this component receives */
export interface ContentRendererProps {
  data: Block<unknown>[]
  editing: boolean
  selectedBlockId: string | null
  setEdits: React.Dispatch<React.SetStateAction<Map<string, NewProposedBlockEdit>>>
  isExam: boolean
  /// This wrapper div providing styles must be skipped for innerblocks because list block's inner blocks cannot contain any div elements. See: https://dequeuniversity.com/rules/axe/4.4/list
  dontAddWrapperDivMeantForMostOutermostContentRenderer?: boolean
}

/**
 * The props a block receives from the ContentRenderer. Generic over the block's attributes.
 *
 * Contains most attributes from `ContentRendererProps` to enable nesting blocks with InnerBlocks.
 * */
export type BlockRendererProps<T> = {
  data: Block<T>
  id: string
  wrapperClassName?: string
} & Omit<ContentRendererProps, "data">

const LatexBlock = dynamic(() => import("./moocfi/LatexBlock"))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const blockToRendererMap: { [blockName: string]: any } = {
  "core/block": DefaultBlock,

  // core / common
  "core/audio": AudioBlock,
  "core/file": FileBlock,
  "core/heading": HeadingBlock,
  "core/image": ImageBlock,
  "core/list": ListBlock,
  "core/list-item": ListItemBlock,
  "core/paragraph": ParagraphBlock,
  "core/quote": QuoteBlock,

  // core / embeds
  "core/embed": EmbedBlock, // This is used by youtube, twitter etc.

  // core / formatting
  "core/code": CodeBlock,
  "core/html": CustomHTMLBlock,
  "core/preformatted": PreformattedBlock,
  "core/pullquote": PullquoteBlock,
  "core/table": TableBlock,
  "core/verse": VerseBlock,

  // core / layout
  // "core/button": ButtonBlock, // Deprecated
  "core/buttons": ButtonsBlock,
  "core/column": ColumnBlock, // Inner block of Columns
  "core/columns": ColumnsBlock,
  "core/separator": SeparatorBlock,
  "core/spacer": SpacerBlock,

  // core / widgets
  // "core/rss": RssBlock, // TODO

  // moocfi
  "moocfi/aside": AsideBlock,
  "moocfi/chapter-progress": ChapterProgressBlock,
  "moocfi/conditional-block": ConditionalBlock,
  "moocfi/congratulations": CongratulationsBlock,
  "moocfi/course-chapter-grid": CourseChapterGridBlock,
  "moocfi/course-objective-section": CourseObjectiveSectionBlock,
  "moocfi/course-progress": CourseProgressBlock,
  "moocfi/exercise": ExerciseBlock,
  "moocfi/exercises-in-chapter": ExerciseInChapterBlock,
  "moocfi/glossary": GlossaryBlock,
  "moocfi/hero-section": HeroSectionBlock,
  "moocfi/infobox": InfoBox,
  "moocfi/landing-page-hero-section": LandingPageHeroSectionBlock,
  "moocfi/latex": LatexBlock,
  "moocfi/learning-objectives": LearningObjectiveBlock,
  "moocfi/pages-in-chapter": PagesInChapterBlock,
  "moocfi/partners": PartnersBlock,
  "moocfi/highlightbox": HighlightBox,
  "moocfi/instructionbox": InstructionBoxBlock,
  "moocfi/tablebox": TableBox,
  "moocfi/top-level-pages": TopLevelPageBlock,
  "moocfi/landing-page-copy-text": LandingPageCopyTextBlock,
  "moocfi/iframe": IframeBlock,
  "moocfi/audio-upload": AudioPlayer,
  "moocfi/map": Map,
  "moocfi/author": AuthorBlock,
  "moocfi/author-inner-block": AuthorInnerBlock,
  "moocfi/research-consent-question": ResearchConsentQuestionBlock,
  "moocfi/exercise-custom-view-block": ExerciseCustomViewBlock,
}

const highlightedBlockStyles = css`
  outline: 2px solid ${baseTheme.colors.red[400]};
  outline-offset: 10px;
`

// Adds a default margin between all blocks. If you would like to undo this margin in some cases, add a negative margin to the block implementation
// or add dontUseDefaultBlockMargin to the block implementation. See the Heading block for an example.
const defaultBlockMargin = css`
  margin: ${COURSE_MATERIAL_DEFAULT_BLOCK_MARGIN_REM}rem 0;
`

const ContentRenderer: React.FC<React.PropsWithChildren<ContentRendererProps>> = (props) => {
  const highlightBlocks = useQueryParameter("highlight-blocks")
    .split(",")
    .filter((id) => id !== "")
  const { t } = useTranslation()
  if (props.data.constructor !== Array) {
    return (
      <div>
        <p>{t("error-page-data-in-invalid-format")}</p>
        <pre>{JSON.stringify(props.data, undefined, 2)}</pre>
      </div>
    )
  }

  /**
   * Because DOMPurify.sanitize automatically removes target="_blank" from anchor elements,
   * this is to ensure that anchors gets correct target and rel
   */
  const TEMPORARY_ATTRIBUTE = "data-temp-href-target"
  DOMPurify.addHook("beforeSanitizeAttributes", function (node) {
    if (node.tagName === "A") {
      // Set target node value to default
      if (!node.hasAttribute("target")) {
        node.setAttribute("target", "_self")
      }

      if (node.hasAttribute("target")) {
        // Set the node target value to temp key, otherwise _self
        node.setAttribute(TEMPORARY_ATTRIBUTE, node.getAttribute("target") ?? "_self")
      }
    }
  })

  DOMPurify.addHook("afterSanitizeAttributes", function (node) {
    if (node.tagName === "A" && node.hasAttribute(TEMPORARY_ATTRIBUTE)) {
      node.setAttribute("target", node.getAttribute(TEMPORARY_ATTRIBUTE) ?? "_blank")
      node.removeAttribute(TEMPORARY_ATTRIBUTE)
      if (node.getAttribute("target") === "_blank") {
        node.setAttribute("rel", "noopener")
        // Class allows styling from GlobalStyles
        node.classList.add(linkWithExtraIconClass)
        // Ensure accessibility in an ugly way for target _blank
        const elements = `<span class="screen-reader-only"> ${t(
          "screen-reader-opens-in-new-tab",
        )}</span><svg aria-hidden="true" width="16px" height="16px" viewBox="0 0 24 24"><g stroke-width="2.1" stroke="#666" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 13.5 17 19.5 5 19.5 5 7.5 11 7.5"></polyline><path d="M14,4.5 L20,4.5 L20,10.5 M20,4.5 L11,13.5"></path></g></svg>`
        const text = node.innerHTML
        node.innerHTML = text + elements
      }
    }
  })

  const content = (
    <>
      {props.data.map((block) => {
        const Component = blockToRendererMap[block.name] ?? DefaultBlock
        const isHighlighted = highlightBlocks.includes(block.clientId)
        const dontUseDefaultBlockMargin = Component.dontUseDefaultBlockMargin === true
        const wrapperClassName = cx(
          courseMaterialBlockClass,
          (isHighlighted && highlightedBlockStyles) ?? undefined,
          dontUseDefaultBlockMargin ? undefined : defaultBlockMargin,
        )

        // In some cases we cannot use the wrapper div to get the correct HTML.
        // Those blocks can opt out of the wrapper div but they MUST render the same class names as the wrapper div
        // so that the features that depend on those class names don't break.
        // This is done by setting "className={props.wrapperClassName} id={props.id}" on the outermost returned element in the block
        if (Component.dontRenderWrapperDivIllDoItMySelf === true) {
          return (
            <Component
              key={block.clientId}
              id={block.clientId}
              data={block}
              editing={props.editing}
              selectedBlockId={props.selectedBlockId}
              setEdits={props.setEdits}
              isExam={props.isExam}
              wrapperClassName={wrapperClassName}
            />
          )
        }

        return (
          <div key={block.clientId} id={block.clientId} className={wrapperClassName}>
            <Component
              id={block.clientId}
              data={block}
              editing={props.editing}
              selectedBlockId={props.selectedBlockId}
              setEdits={props.setEdits}
              isExam={props.isExam}
              wrapperClassName={wrapperClassName}
            />
          </div>
        )
      })}
    </>
  )

  if (props.dontAddWrapperDivMeantForMostOutermostContentRenderer) {
    return content
  }
  return (
    <div
      className={css`
        font-size: 20px;
        text-underline-offset: 4.6px;
        text-decoration-thickness: 1.6px;

        a {
          color: #1072ea;
          &:hover {
            color: #096df1;
          }
          &:active {
            color: #0870d9;
          }
          &:visited {
            color: #8050f2;
          }
        }
      `}
    >
      {content}
    </div>
  )
}

export default withErrorBoundary(ContentRenderer)
