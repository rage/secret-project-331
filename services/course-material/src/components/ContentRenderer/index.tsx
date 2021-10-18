import dynamic from "next/dynamic"
import React from "react"

import { Block } from "../../services/backend"
import { NewProposedBlockEdit } from "../../shared-module/bindings"
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
import ButtonBlock from "./core/layout/ButtonBlock"
import ColumnBlock from "./core/layout/ColumnBlock"
import ColumnsBlock from "./core/layout/ColumnsBlock"
import SeparatorBlock from "./core/layout/Separator"
import SpacerBlock from "./core/layout/SpacerBlock"
import RssBlock from "./core/widgets/RssBlock"
import ChapterProgressBlock from "./moocfi/ChapterProgressBlock"
import CourseChapterGridBlock from "./moocfi/CourseChapterGridBlock"
import CourseObjectiveSectionBlock from "./moocfi/CourseObjectiveSectionBlock"
import CourseProgressBlock from "./moocfi/CourseProgressBlock"
import ExerciseBlock from "./moocfi/ExerciseBlock"
import ExerciseInChapterBlock from "./moocfi/ExerciseInChapterBlock/index"
import HeroSectionBlock from "./moocfi/HeroSectionBlock"
import LandingPageHeroSectionBlock from "./moocfi/LandingPageHeroSectionBlock"
import PagesInChapterBlock from "./moocfi/PagesInChapterBlock"
export interface ContentRendererProps {
  data: Block<unknown>[]
  editing: boolean
  selectedBlockId: string | null
  setEdits: (m: Map<string, NewProposedBlockEdit>) => void
}

export interface BlockRendererProps<T> {
  data: Block<T>
  editing: boolean
  selectedBlockId: string | null
  setEdits: React.Dispatch<React.SetStateAction<Map<string, NewProposedBlockEdit>>>
  id: string
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
  // "core/button",
  "core/buttons": ButtonBlock,
  "core/column": ColumnBlock,
  "core/columns": ColumnsBlock,
  "core/separator": SeparatorBlock,
  "core/spacer": SpacerBlock,

  // core / widgets
  "core/rss": RssBlock,

  // moocfi
  "moocfi/exercise": ExerciseBlock,
  "moocfi/exercises-in-chapter": ExerciseInChapterBlock,
  "moocfi/pages-in-chapter": PagesInChapterBlock,
  "moocfi/course-chapter-grid": CourseChapterGridBlock,
  "moocfi/latex": LatexBlock,
  "moocfi/hero-section": HeroSectionBlock,
  "moocfi/landing-page-hero-section": LandingPageHeroSectionBlock,
  "moocfi/course-progress": CourseProgressBlock,
  "moocfi/course-objective-section": CourseObjectiveSectionBlock,
  "moocfi/chapter-progress": ChapterProgressBlock,
}

const ContentRenderer: React.FC<ContentRendererProps> = (props) => {
  if (props.data.constructor !== Array) {
    return (
      <div>
        <p>Error: tried to render something that was not an array.</p>
        <pre>{JSON.stringify(props.data, undefined, 2)}</pre>
      </div>
    )
  }
  return (
    <>
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
            />
          </div>
        )
      })}
    </>
  )
}

export default ContentRenderer
