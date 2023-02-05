import styled from "@emotion/styled"
import React from "react"

import AccordionIcon from "../../img/accordion-arrow.svg"
import { baseTheme, headingFont } from "../../styles"

interface StyledPageBoxProps {
  accordion: boolean
}

const Wrapper = styled.div`
  border-radius: 10px;
  position: relative;
  width: 100%;
  margin-top: 5px;
`

const PageBoxRow = styled.div<StyledPageBoxProps>`
  position: relative;
  padding: 0.6em 1em;
  list-style-type: none;
  color: ${baseTheme.colors.gray[600]};
  text-decoration: none;
  border-radius: 2px;
  background: #f2f5f7;
  margin: 5px 0 5px 0;
  display: flex;
  justify-content: center;

  span {
    vertical-align: top;
    font-family: ${headingFont};
    font-size: clamp(16px, 1vw, 18px);
    font-weight: 600;
    display: inline-block;
    width: 100%;
    margin: ${(props) => (props.accordion ? "0.4em 0 0.4em 1.2em" : "0.4em 0 0.4em 0.2em")};
  }
`

export interface PageBoxExtraProps {
  pageTitle: string
  accordion: boolean
}

export type PageBoxProps = React.HTMLAttributes<HTMLDivElement> & PageBoxExtraProps

const PageBox: React.FC<React.PropsWithChildren<React.PropsWithChildren<PageBoxProps>>> = (
  props,
) => {
  return (
    <Wrapper>
      <PageBoxRow accordion={props.accordion}>
        {props.accordion && <AccordionIcon />}
        <span>{props.pageTitle}</span>
      </PageBoxRow>
    </Wrapper>
  )
}

export default PageBox
