interface BlockPlaceholderWrapperProps {
  id: string
}

const BlockPlaceholderWrapper: React.FC<BlockPlaceholderWrapperProps> = ({ id, children }) => {
  return (
    <div className={"wp-block wp-block-embed"} id={"block-" + id}>
      <div className={"components-placeholder"}>{children}</div>
    </div>
  )
}

export default BlockPlaceholderWrapper
