import { Block } from "../../services/backend";
import DefaultBlock from "./DefaultBlock";
import ParagraphBlock from "./ParagraphBlock";

export interface ContentRendererProps {
  data: Block[]
}

export interface BlockRendererProps {
  data: Block
}

const blockToRendererMap: {[blockName: string]: any} = {
  "core/paragraph": ParagraphBlock
}

const ContentRenderer = (props: ContentRendererProps) => {
  return <>
  {props.data.map(block => {
      const Component = blockToRendererMap[block.name] ?? DefaultBlock
      return <Component key={block.clientId} data={block} />
    })}
  </>
}

export default ContentRenderer
