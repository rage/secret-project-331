/**
 * Wrapper for edible blocks.
 */
interface BlockWrapperProps {
  id: string
}

const BlockWrapper: React.FC<React.PropsWithChildren<BlockWrapperProps>> = ({ id, children }) => {
  return <div id={"wrapper-block-" + id}>{children}</div>
}

export default BlockWrapper
