import styled from "@emotion/styled"
import React from "react"

import { baseTheme, secondaryFont } from "../../styles"

const Wrapper = styled.div`
  border-radius: 10px;
  position: relative;
  width: 100%;
`

const PageBoxRow = styled.div`
  position: relative;
  padding: 0.6em 1em;
  list-style-type: none;
  color: ${baseTheme.colors.clear[100]};
  text-decoration: none;
  border-radius: 2px;
  background: ${baseTheme.colors.blue[600]};
  margin: 5px 0 5px 0;

  span {
    vertical-align: top;
    font-family: ${secondaryFont};
    font-size: clamp(16px, 1vw, 18px);
    display: inline-block;
    width: 75%;
    margin: 0.4em 0 0.4em 0.2em;
    text-transform: uppercase;
  }
`

export interface PageBoxExtraProps {
  pageTitle: string
}

export type PageBoxProps = React.HTMLAttributes<HTMLDivElement> & PageBoxExtraProps

const PageBox: React.FC<React.PropsWithChildren<React.PropsWithChildren<PageBoxProps>>> = (
  props,
) => {
  return (
    <Wrapper>
      <PageBoxRow>
        <span>{props.pageTitle}</span>
      </PageBoxRow>
    </Wrapper>
  )
}

export default PageBox
