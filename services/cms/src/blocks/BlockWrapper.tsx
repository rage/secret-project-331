/**
 * Wrapper for editable blocks.
 */
interface BlockWrapperProps {
  id: string
}

const BlockWrapper: React.FC<BlockWrapperProps> = ({ id, children }) => {
  return <div id={"wrapper-block-" + id}>{children}</div>
}

export default BlockWrapper
