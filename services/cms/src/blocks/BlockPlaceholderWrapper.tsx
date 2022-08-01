/**
 * PlaceholderWrapper used by blocks that do not allow editing directly, i.e. no nested blocks.
 * Has a black border around the block and text is centered vertically.
 */

interface BlockPlaceholderWrapperProps {
  id: string
}

const BlockPlaceholderWrapper: React.FC<React.PropsWithChildren<BlockPlaceholderWrapperProps>> = ({
  id,
  children,
}) => {
  return (
    <div className={"wp-block wp-block-embed"} id={"placeholder-block-" + id}>
      <div className={"components-placeholder"}>{children}</div>
    </div>
  )
}

export default BlockPlaceholderWrapper
