/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import DOMPurify from "dompurify"
import dynamic from "next/dynamic"
import React from "react"
import { useTranslation } from "react-i18next"

import { Block } from "../../services/backend"
import { NewProposedBlockEdit } from "../../shared-module/bindings"
import { linkWithExtraIconClass } from "../../shared-module/styles/constants"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { courseMaterialBlockClass } from "../../utils/constants"

import DefaultBlock from "./DefaultBlock"
import AudioBlock from "./core/common/Audio/AudioBlock"
import FileBlock from "./core/common/File/FileBlock"
import HeadingBlock from "./core/common/Heading/HeadingBlock"
import ImageBlock from "./core/common/Image/ImageBlock"
import ListBlock from "./core/common/List/ListBlock"
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
import BlockquoteBlock from "./moocfi/BlockquoteBlock"
import ChapterProgressBlock from "./moocfi/ChapterProgressBlock"
import CourseChapterGridBlock from "./moocfi/CourseChapterGridBlock"
import CourseObjectiveSectionBlock from "./moocfi/CourseObjectiveSectionBlock"
import CourseProgressBlock from "./moocfi/CourseProgressBlock"
import ExerciseBlock from "./moocfi/ExerciseBlock"
import ExerciseInChapterBlock from "./moocfi/ExerciseInChapterBlock/index"
import GlossaryBlock from "./moocfi/Glossary"
import HeroSectionBlock from "./moocfi/HeroSectionBlock"
import LandingPageHeroSectionBlock from "./moocfi/LandingPageHeroSectionBlock"
import PagesInChapterBlock from "./moocfi/PagesInChapterBlock"
export interface ContentRendererProps {
  data: Block<unknown>[]
  editing: boolean
  selectedBlockId: string | null
  setEdits: (m: Map<string, NewProposedBlockEdit>) => void
  isExam: boolean
}

export interface BlockRendererProps<T> {
  data: Block<T>
  editing: boolean
  selectedBlockId: string | null
  setEdits: React.Dispatch<React.SetStateAction<Map<string, NewProposedBlockEdit>>>
  id: string
  isExam: boolean
}

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
  "moocfi/exercise": ExerciseBlock,
  "moocfi/exercises-in-chapter": ExerciseInChapterBlock,
  "moocfi/pages-in-chapter": PagesInChapterBlock,
  "moocfi/course-chapter-grid": CourseChapterGridBlock,
  "moocfi/latex": LatexBlock,
  "moocfi/blockquote": BlockquoteBlock,
  "moocfi/aside": AsideBlock,
  "moocfi/hero-section": HeroSectionBlock,
  "moocfi/landing-page-hero-section": LandingPageHeroSectionBlock,
  "moocfi/course-progress": CourseProgressBlock,
  "moocfi/course-objective-section": CourseObjectiveSectionBlock,
  "moocfi/chapter-progress": ChapterProgressBlock,
  "moocfi/glossary": GlossaryBlock,
}

const ContentRenderer: React.FC<ContentRendererProps> = (props) => {
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

  return (
    <div
      className={css`
        font-size: 20px;
      `}
    >
      {props.data.map((block) => {
        const Component = blockToRendererMap[block.name] ?? DefaultBlock
        return (
          <div key={block.clientId} id={block.clientId} className={courseMaterialBlockClass}>
            <Component
              id={block.clientId}
              data={block}
              editing={props.editing}
              selectedBlockId={props.selectedBlockId}
              setEdits={props.setEdits}
              isExam={props.isExam}
            />
          </div>
        )
      })}
    </div>
  )
}

export default withErrorBoundary(ContentRenderer)
