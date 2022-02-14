import styled from "@emotion/styled"
import { Box } from "@mui/material"
import React from "react"

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
