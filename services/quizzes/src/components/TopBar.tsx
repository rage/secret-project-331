import { AppBar, Toolbar } from "@material-ui/core"
import Link from "next/link"
import * as React from "react"
import styled from "styled-components"

const StyledAppBar = styled(AppBar)`
  margin-bottom: 2rem;
`

const EmptySpace = styled.div`
  flex: 1;
`

const LinkWrapper = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
`

const TopBar: React.FC = () => {
  return (
    <StyledAppBar position="sticky">
      <Toolbar>
        <Link href="/">
          <LinkWrapper>
            <h4>Quizzes</h4>
          </LinkWrapper>
        </Link>
        <EmptySpace />
        <EmptySpace />
      </Toolbar>
    </StyledAppBar>
  )
}

export default TopBar
