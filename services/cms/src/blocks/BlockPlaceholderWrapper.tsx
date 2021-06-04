import styled from "@emotion/styled"

interface BlockPlaceholderWrapperProps {
  id: string
}

const PlaceholderWrapperDiv = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const BlockPlaceholderWrapper: React.FC<BlockPlaceholderWrapperProps> = ({ id, children }) => {
  return <PlaceholderWrapperDiv id={id}>{children}</PlaceholderWrapperDiv>
}

export default BlockPlaceholderWrapper
