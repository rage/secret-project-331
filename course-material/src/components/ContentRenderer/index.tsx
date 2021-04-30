import { Block } from "../../services/backend"
import DefaultBlock from "./DefaultBlock"
import ListBlock from "./ListBlock"
import ParagraphBlock from "./ParagraphBlock"
import ImageBlock from "./ImageBlock"
import HeadingBlock from "./HeadingBlock"
<<<<<<< HEAD
import ButtonBlock from "./ButtonBlock"
import CodeBlock from "./CodeBlock"
import QuoteBlock from "./QuoteBlock"
import AudioBlock from "./AudioBlock"
import TableBlock from "./TableBlock"
=======
import ExerciseBlock from "./ExerciseBlock"
>>>>>>> d8cb6d3e1b36ea98130c35c915ef835cae323901

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
<<<<<<< HEAD
  "core/buttons": ButtonBlock,
  "core/code": CodeBlock,
  "core/quote": QuoteBlock,
  "core/audio": AudioBlock,
  "core/columns": TableBlock,
=======
  "moocfi/exercise": ExerciseBlock,
>>>>>>> d8cb6d3e1b36ea98130c35c915ef835cae323901
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
