import dynamic from "next/dynamic"
import React from "react"

import { Block } from "../../services/backend"
import { courseMaterialBlockClass } from "../../utils/constants"

import AudioBlock from "./AudioBlock"
import ButtonBlock from "./ButtonBlock"
import ChapterProgressBlock from "./ChapterProgressBlock"
import CodeBlock from "./CodeBlock"
import ColumnBlock from "./ColumnBlock"
import ColumnsBlock from "./ColumnsBlock"
import CourseChapterGridBlock from "./CourseChapterGridBlock"
import CourseObjectiveSectionBlock from "./CourseObjectiveSectionBlock"
import CourseProgressBlock from "./CourseProgressBlock"
import CustomHTMLBlock from "./CustomHTMLBlock"
import DefaultBlock from "./DefaultBlock"
import EmbedBlock from "./EmbedBlock"
import ExerciseBlock from "./ExerciseBlock"
import ExerciseInChapterBlock from "./ExerciseInChapterBlock/index"
import HeadingBlock from "./Headings/HeadingBlock"
import HeroSectionBlock from "./HeroSectionBlock"
import ImageBlock from "./ImageBlock"
import LandingPageHeroSectionBlock from "./LandingPageHeroSectionBlock"
import ListBlock from "./ListBlock"
import PagesInChapterBlock from "./PagesInChapterBlock"
import ParagraphBlock from "./ParagraphBlock"
import PreformatterBlock from "./PreformatterBlock"
import PullquoteBlock from "./PullquoteBlock"
import QuoteBlock from "./QuoteBlock"
import SeparatorBlock from "./Separator"
import SpacerBlock from "./SpacerBlock"
import TableBlock from "./TableBlock"
import VerseBlock from "./VerseBlock"
export interface ContentRendererProps {
  data: Block<unknown>[]
}

export interface BlockRendererProps<T> {
  data: Block<T>
}

const LatexBlock = dynamic(() => import("./LatexBlock"))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const blockToRendererMap: { [blockName: string]: any } = {
  // "core/shortcode",
  // "core/button",
  "core/columns": ColumnsBlock,
  "core/column": ColumnBlock,
  "core/embed": EmbedBlock, // This is used by youtube, twitter etc.
  // "core/file",
  // "core/group",
  // "core/rss",
  "core/separator": SeparatorBlock,
  // "core/block",
  "core/spacer": SpacerBlock,
  // "core/text-columns",
  "core/audio": AudioBlock,
  "core/paragraph": ParagraphBlock,
  "core/list": ListBlock,
  "core/image": ImageBlock,
  "core/heading": HeadingBlock,
  "core/buttons": ButtonBlock,
  "core/code": CodeBlock,
  "core/quote": QuoteBlock,
  "core/html": CustomHTMLBlock,
  "core/verse": VerseBlock,
  "core/pullquote": PullquoteBlock,
  "core/preformatted": PreformatterBlock,
  "core/table": TableBlock,
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
            <Component data={block} />
          </div>
        )
      })}
    </>
  )
}

export default ContentRenderer
