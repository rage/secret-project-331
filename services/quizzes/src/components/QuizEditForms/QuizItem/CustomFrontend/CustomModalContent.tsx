import { Box } from "@material-ui/core"
import React from "react"
import styled from "styled-components"

const EmptyBox = styled(Box)`
  width: 100%;
  height: 200px;
`

export const CustomModalContent: React.FC = () => {
  return (
    <>
      <EmptyBox />
    </>
  )
}

export default CustomModalContent
