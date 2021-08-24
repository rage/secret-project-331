import dynamic from "next/dynamic"
import React from "react"

import { Block } from "../../services/backend"
import { courseMaterialBlockClass } from "../../utils/constants"

import AudioBlock from "./AudioBlock"
import ButtonBlock from "./ButtonBlock"
import CodeBlock from "./CodeBlock"
import ColumnBlock from "./ColumnBlock"
import ColumnsBlock from "./ColumnsBlock"
import CourseChapterGridBlock from "./CourseChapterGridBlock"
import CourseObjectiveSectionBlock from "./CourseObjectiveSectionBlock"
import CourseProgressBlock from "./CourseProgressBlock"
import CustomHTMLBlock from "./CustomHTMLBlock"
import DefaultBlock from "./DefaultBlock"
import ExerciseBlock from "./ExerciseBlock"
import ExerciseListBlock from "./ExerciseListBlock/index"
import HeadingBlock from "./Headings/HeadingBlock"
import HeroSectionBlock from "./HeroSectionBlock"
import ImageBlock from "./ImageBlock"
import LandingPageHeroSectionBlock from "./LandingPageHeroSectionBlock"
import ListBlock from "./ListBlock"
import PagesListBlock from "./PagesListBlock"
import ParagraphBlock from "./ParagraphBlock"
import PreformatterBlock from "./PreformatterBlock"
import PullquoteBlock from "./PullquoteBlock"
import QuoteBlock from "./QuoteBlock"
import TableBlock from "./TableBlock"
import VerseBlock from "./VerseBlock"

export interface ContentRendererProps {
  data: Block<unknown>[]
}

export interface BlockRendererProps<T> {
  data: Block<T>
}

const LatexBlock = dynamic(() => import("./LatexBlock"))

export const blockToRendererMap: { [blockName: string]: any } = {
  // "core/shortcode",
  // "core/button",
  "core/columns": ColumnsBlock,
  "core/column": ColumnBlock,
  // "core/embed", // This is used by youtube, twitter etc.
  // "core/file",
  // "core/group",
  // "core/rss",
  // "core/separator",
  // "core/block",
  // "core/spacer",
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
  "moocfi/exercises-in-chapter": ExerciseListBlock,
  "moocfi/pages-in-chapter": PagesListBlock,
  "moocfi/course-chapter-grid": CourseChapterGridBlock,
  "moocfi/latex": LatexBlock,
  "moocfi/hero-section": HeroSectionBlock,
  "moocfi/landing-page-hero-section": LandingPageHeroSectionBlock,
  "moocfi/course-progress": CourseProgressBlock,
  "moocfi/course-objective-section": CourseObjectiveSectionBlock,
  "moocfi/chapter-progress": CourseProgressBlock,
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
