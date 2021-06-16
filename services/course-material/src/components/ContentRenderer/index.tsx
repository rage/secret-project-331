import { Block } from "../../services/backend"
import DefaultBlock from "./DefaultBlock"
import ListBlock from "./ListBlock"
import ParagraphBlock from "./ParagraphBlock"
import ImageBlock from "./ImageBlock"
import HeadingBlock from "./HeadingBlock"
import ButtonBlock from "./ButtonBlock"
import CodeBlock from "./CodeBlock"
import QuoteBlock from "./QuoteBlock"
import AudioBlock from "./AudioBlock"
import TableBlock from "./TableBlock"
import ExerciseBlock from "./ExerciseBlock"
import CustomHTMLBlock from "./CustomHTMLBlock"
import PreformatterBlock from "./PreformatterBlock"
import VerseBlock from "./VerseBlock"
import PullquoteBlock from "./PullquoteBlock"
import CoverBlock from "./CoverBlock"
import ExerciseListBlock from "./ExerciseListBlock/index"

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
  "moocfi/exercise": ExerciseBlock,
  "moocfi/exercises-in-chapter": ExerciseListBlock,
}

const ContentRenderer: React.FC<ContentRendererProps> = (props) => {
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
