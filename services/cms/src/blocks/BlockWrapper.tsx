/**
 * Wrapper for edible blocks.
 */
interface BlockWrapperProps {
  id: string
}

const BlockWrapper: React.FC<BlockWrapperProps> = ({ id, children }) => {
  return <div id={"block-" + id}>{children}</div>
}

export default BlockWrapper
