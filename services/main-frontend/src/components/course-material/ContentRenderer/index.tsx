"use client"

/* oxlint-disable i18next/no-literal-string */
import { css, cx } from "@emotion/css"
import DOMPurify from "dompurify"
import { useSearchParams } from "next/navigation"
import React, { createContext, useContext } from "react"
import { useTranslation } from "react-i18next"

import { BreakFromCenteredDisabledContext } from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles"
import { linkWithExtraIconClass } from "@/shared-module/common/styles/constants"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { Block } from "@/types/courseMaterialBlock"
import {
  COURSE_MATERIAL_DEFAULT_BLOCK_MARGIN_REM,
  courseMaterialBlockClass,
} from "@/utils/course-material/constants"

import AudioBlock from "./core/common/Audio/AudioBlock"
import FileBlock from "./core/common/File/FileBlock"
import HeadingBlock from "./core/common/Heading/HeadingBlock"
import ImageBlock from "./core/common/Image/ImageBlock"
import ListBlock from "./core/common/List/ListBlock"
import ListItemBlock from "./core/common/List/ListItemBlock"
import ParagraphBlock from "./core/common/Paragraph"
import QuoteBlock from "./core/common/Quote/QuoteBlock"
import VideoBlock from "./core/common/Video/VideoBlock"
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
import DefaultBlock from "./DefaultBlock"
import AsideBlock from "./moocfi/AsideBlock"
import AsideWithImageBlock from "./moocfi/AsideWithImageBlock"
import AudioPlayer from "./moocfi/AudioPlayer/index"
import AuthorBlock from "./moocfi/AuthorBlock"
import AuthorInnerBlock from "./moocfi/AuthorInnerBlock"
import ChapterProgressBlock from "./moocfi/ChapterProgressBlock"
import ChatbotBlock from "./moocfi/ChatbotBlock/ChatbotBlock"
import CodeGiveawayBlock from "./moocfi/CodeGiveAway"
import ConditionalBlock from "./moocfi/ConditionalBlock"
import CongratulationsBlock from "./moocfi/CongratulationsBlock"
import CourseChapterGridBlock from "./moocfi/CourseChapterGridBlock"
import CourseObjectiveSectionBlock from "./moocfi/CourseObjectiveSectionBlock"
import CourseProgressBlock from "./moocfi/CourseProgressBlock"
import ExerciseBlock from "./moocfi/ExerciseBlock"
import ExerciseCustomViewBlock from "./moocfi/ExerciseCustomViewBlock"
import ExerciseInChapterBlock from "./moocfi/ExerciseInChapterBlock/index"
import ExpandableContentBlock from "./moocfi/ExpandableContentBlock/ExpandableContentBlock"
import ExpandableContentInnerBlock from "./moocfi/ExpandableContentBlock/ExpandableContentInnerBlock"
import FlipCardBlock from "./moocfi/FlipCard/FlipCardBlock"
import InnerCardBlock from "./moocfi/FlipCard/InnerCardBlock"
import GlossaryBlock from "./moocfi/Glossary"
import HeroSectionBlock from "./moocfi/HeroSectionBlock"
import HighlightBox from "./moocfi/HighglightBox"
import { IframeBlock } from "./moocfi/IframeBlock"
import InfoBox from "./moocfi/InfoBox"
import Ingress from "./moocfi/Ingress"
import InstructionBoxBlock from "./moocfi/InstructionBox"
import LandingPageCopyTextBlock from "./moocfi/LandingPageCopyTextBlock"
import LandingPageHeroSectionBlock from "./moocfi/LandingPageHeroSectionBlock"
import LearningObjectiveBlock from "./moocfi/LearningObjectiveBlock"
import LockChapterBlock from "./moocfi/LockChapterBlock"
import LogoLink from "./moocfi/LogoLink"
import Map from "./moocfi/Map"
import PagesInChapterBlock from "./moocfi/PagesInChapterBlock"
import PartnersBlock from "./moocfi/PartnersBlock"
import ResearchConsentQuestionBlock from "./moocfi/ResearchConsentQuestionBlock"
import RevealableContentBlock from "./moocfi/RevealableContentBlock/RevealableContentBlock"
import RevealableHiddenContentBlock from "./moocfi/RevealableContentBlock/RevealableHiddenContentBlock"
import TableBox from "./moocfi/TableBox"
import TerminologyBlock from "./moocfi/TerminologyBlock"
import TopLevelPageBlock from "./moocfi/TopLevelPagesBlock/index"
import { blockGapRem } from "./util/blockGap"
import { isEmptyBlock } from "./util/isEmptyBlock"

/** The props that this component receives */
export interface ContentRendererProps {
  data: Block<unknown>[]
  isExam: boolean
  /// This wrapper div providing styles must be skipped for innerblocks because list block's inner blocks cannot contain any div elements. See: https://dequeuniversity.com/rules/axe/4.4/list
  dontAddWrapperDivMeantForMostOutermostContentRenderer?: boolean
  // e.g. makes embed blocks less wide inside exercise task blocks.
  dontAllowBlockToBeWiderThanContainerWidth?: boolean
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

const LatexBlock = dynamicImport(() => import("./moocfi/LatexBlock"))
const ChartBlock = dynamicImport(() => import("./moocfi/ChartBlock"))

// oxlint-disable-next-line typescript/no-explicit-any
export const blockToRendererMap: Record<string, any> = {
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
  "core/video": VideoBlock,

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
  "moocfi/chart": ChartBlock,
  "moocfi/chapter-progress": ChapterProgressBlock,
  "moocfi/chatbot": ChatbotBlock,
  "moocfi/conditional-block": ConditionalBlock,
  "moocfi/lock-chapter": LockChapterBlock,
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
  "moocfi/expandable-content": ExpandableContentBlock,
  "moocfi/expandable-content-inner-block": ExpandableContentInnerBlock,
  "moocfi/revelable-content": RevealableContentBlock,
  "moocfi/revealable-hidden-content": RevealableHiddenContentBlock,
  "moocfi/flip-card": FlipCardBlock,
  "moocfi/front-card": InnerCardBlock,
  "moocfi/back-card": InnerCardBlock,
  "moocfi/code-giveaway": CodeGiveawayBlock,
  "moocfi/ingress": Ingress,
  "moocfi/terminology-block": TerminologyBlock,
  "moocfi/logo-link": LogoLink,
  "moocfi/aside-with-image": AsideWithImageBlock,
}

/**
 * Renderers that replace the regular ones by block name in this subtree, e.g. read-only stand-ins
 * for interactive blocks in a preview.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export const BlockRendererOverridesContext = createContext<Record<string, any>>({})

const highlightedBlockStyles = css`
  outline: 2px solid ${baseTheme.colors.red[400]};
  outline-offset: 10px;
`

// Blocks own no outer margin: the gap above each one depends on it and the block before it (blockGapRem).
// Blocks that sit flush against their siblings, like list items, set dontUseDefaultBlockMargin.
const blockMarginStyles = (topRem: number, bottomRem: number) => css`
  margin: ${topRem}rem 0 ${bottomRem}rem;
`

// True inside a block's own block list (hero, column, flip card...), which must not get the page's edge spacing.
const NestedContentRendererContext = createContext(false)

const ContentRenderer: React.FC<React.PropsWithChildren<ContentRendererProps>> = ({
  data,
  isExam,
  dontAddWrapperDivMeantForMostOutermostContentRenderer,
  dontAllowBlockToBeWiderThanContainerWidth = true,
}) => {
  const searchParams = useSearchParams()
  const highlightBlocks = (searchParams.get("highlight-blocks") ?? "")
    .split(",")
    .filter((id) => id !== "")
  const { t } = useTranslation()
  const blockRendererOverrides = useContext(BlockRendererOverridesContext)
  const isNested = useContext(NestedContentRendererContext)
  if (data.constructor !== Array) {
    return (
      <div>
        <p>{t("error-page-data-in-invalid-format")}</p>
        <pre>{JSON.stringify(data, undefined, 2)}</pre>
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

  const visibleBlocks = data.filter((block) => !isEmptyBlock(block))
  const content = (
    <NestedContentRendererContext.Provider value={true}>
      {visibleBlocks.map((block, index) => {
        const Component =
          blockRendererOverrides[block.name] ?? blockToRendererMap[block.name] ?? DefaultBlock
        const isHighlighted = highlightBlocks.includes(block.clientId)
        const dontUseDefaultBlockMargin = Component.dontUseDefaultBlockMargin === true
        // The page's own block list keeps room at its top and bottom edges.
        const isOutermost = !isNested
        const topRem =
          isOutermost && index === 0
            ? COURSE_MATERIAL_DEFAULT_BLOCK_MARGIN_REM
            : blockGapRem(visibleBlocks[index - 1], block)
        const bottomRem =
          isOutermost && index === visibleBlocks.length - 1
            ? COURSE_MATERIAL_DEFAULT_BLOCK_MARGIN_REM
            : 0
        const wrapperClassName = cx(
          courseMaterialBlockClass,
          (isHighlighted && highlightedBlockStyles) ?? undefined,
          dontUseDefaultBlockMargin ? undefined : blockMarginStyles(topRem, bottomRem),
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
              isExam={isExam}
              wrapperClassName={wrapperClassName}
              dontAllowBlockToBeWiderThanContainerWidth={dontAllowBlockToBeWiderThanContainerWidth}
            />
          )
        }

        return (
          <div
            key={block.clientId}
            id={block.clientId}
            className={wrapperClassName}
            data-block-name={block.name}
          >
            <Component
              id={block.clientId}
              data={block}
              isExam={isExam}
              wrapperClassName={wrapperClassName}
              dontAllowBlockToBeWiderThanContainerWidth={dontAllowBlockToBeWiderThanContainerWidth}
            />
          </div>
        )
      })}
    </NestedContentRendererContext.Provider>
  )

  if (dontAddWrapperDivMeantForMostOutermostContentRenderer) {
    return (
      <BreakFromCenteredDisabledContext.Provider value={dontAllowBlockToBeWiderThanContainerWidth}>
        {content}
      </BreakFromCenteredDisabledContext.Provider>
    )
  }
  return (
    <BreakFromCenteredDisabledContext.Provider value={dontAllowBlockToBeWiderThanContainerWidth}>
      <div
        className={css`
          font-size: 20px;
          text-underline-offset: 4.6px;
          text-decoration-thickness: 1.6px;
          /* Long Finnish compounds and URLs would otherwise run out of the column on phones. */
          overflow-wrap: break-word;

          /* Narrow columns only: there long words leave ragged gaps. Follows the content language set on
          #content, and only splits words of 10+ letters. */
          p {
            hyphens: auto;
            hyphenate-limit-chars: 10 4 4;
          }
          ${respondToOrLarger.sm} {
            p {
              hyphens: manual;
            }
          }
          h1,
          h2,
          h3,
          h4,
          h5,
          h6 {
            text-wrap: balance;
          }

          a[data-button-variant] {
            max-width: 100%;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          a:not([data-button-variant]) {
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

          /* Styling for inline code elements */
          code:not(pre code) {
            background: #e5e5e5;
            padding: 0 0.4rem 0.2rem 0.4rem;
            border-radius: 3px;
          }

          /* The grey fill is unreadable under a button's light text; keep the button's own contrast. */
          a[data-button-variant] code:not(pre code) {
            background: transparent;
            color: inherit;
            box-shadow: inset 0 0 0 1px currentColor;
          }

          /* Styling for highlighted text */
          mark {
            padding: 0 0.4rem 0.2rem 0.4rem;
            border-radius: 3px;
          }
        `}
      >
        {content}
      </div>
    </BreakFromCenteredDisabledContext.Provider>
  )
}

export default withErrorBoundary(ContentRenderer)
