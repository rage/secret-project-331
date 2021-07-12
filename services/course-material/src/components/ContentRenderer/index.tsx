import React from "react"

import { Block } from "../../services/backend"

import AudioBlock from "./AudioBlock"
import ButtonBlock from "./ButtonBlock"
import CodeBlock from "./CodeBlock"
import CourseChapterGrid from "./CourseChapterGrid"
import CourseProgressBlock from "./CourseProgressBlock"
import CoverBlock from "./CoverBlock"
import CustomHTMLBlock from "./CustomHTMLBlock"
import DefaultBlock from "./DefaultBlock"
import ExerciseBlock from "./ExerciseBlock"
import ExerciseListBlock from "./ExerciseListBlock/index"
import HeadingBlock from "./HeadingBlock"
import ImageBlock from "./ImageBlock"
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

const blockToRendererMap: { [blockName: string]: any } = {
  "core/paragraph": ParagraphBlock,
  "core/list": ListBlock,
  "core/image": ImageBlock,
  "core/heading": HeadingBlock,
  "core/buttons": ButtonBlock,
  "core/code": CodeBlock,
  "core/quote": QuoteBlock,
  "core/html": CustomHTMLBlock,
  "core/verse": VerseBlock,
  "core/cover": CoverBlock,
  "core/pullquote": PullquoteBlock,
  "core/preformatted": PreformatterBlock,
  "core/columns": TableBlock,
  "moocfi/course-progress": CourseProgressBlock,
  "moocfi/exercise": ExerciseBlock,
  "moocfi/exercises-in-chapter": ExerciseListBlock,
  "moocfi/pages-in-chapter": PagesListBlock,
  "moocfi/course-chapter-grid": CourseChapterGrid,
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
        return <Component key={block.clientId} data={block} />
      })}
    </>
  )
}

export default ContentRenderer
