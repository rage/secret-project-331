/**
 * PlaceholderWrapper used by blocks that do not allow editing directly, i.e. no nested blocks.
 * Has a black border around the block and text is centered vertically.
 */

interface BlockPlaceholderWrapperProps {
  id: string
  title: string
  explanation: string
}

const BlockPlaceholderWrapper: React.FC<React.PropsWithChildren<BlockPlaceholderWrapperProps>> = ({
  id,
  children,
  title,
  explanation,
}) => {
  return (
    <div className={"wp-block wp-block-embed"} id={"placeholder-block-" + id}>
      <div className={"components-placeholder"}>
        <h3>{title}</h3>
        <p>{explanation}</p>
        {children}
      </div>
    </div>
  )
}

export default BlockPlaceholderWrapper
