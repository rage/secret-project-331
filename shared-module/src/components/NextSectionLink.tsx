import styled from "@emotion/styled"
import React, { Fragment } from "react"

import { typography } from "../utils"

const SectionWrapper = styled.div`
  margin-top: 3rem;
  background: #f0f0f0;
  padding: 3rem 2rem;

  p {
    font-family: "Josefin Sans", sans-serif !important;
    font-size: 1.4rem;
    color: #333;
    margin: 0;
    padding: 0;
    display: flex;
  }

  p:nth-child(1) {
    font-size: 2rem;
    font-weight: 500;
  }

  h2 {
    font-size: ${typography.h4};
    line-height: 1.4;
    margin-bottom: 0.5rem;
  }
`

const StyledArrow = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  width: auto;
  height: 100%;
  padding: 1.2rem 1.6rem;
  background: #cacaca;
  cursor: pointer;
  display: inline-block;
  display: flex;

  &:hover {
    .arrow {
      fill: #fe9677;
    }
  }
  /*   &.arrow {
    transition: fill 0.2s ease-in;
    fill: rgb(22, 179, 199);
  } */
`

const StyledLink = styled.a`
  position: relative;
  color: #c4c4c4;
  text-decoration: none;
  padding: 1.4rem 1.4rem;
  margin: 1rem 0;
  display: flex;
  min-width: 90%;
  background-color: #333;
  transition: background-color 0.2s;

  &:hover {
    text-decoration: none;
    color: white;
    background-color: #333;
  }

  span {
    font-family: "Josefin Sans", sans-serif;
    font-size: ${typography.h6};
    color: white !important;
    line-height: 1.3;
  }
`

const ButtonWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-top: 0.5rem;
`

export interface NextSectionLinkExtraProps {
  content: string
}

export type NextSectionLinkProps = React.HTMLAttributes<HTMLDivElement> & NextSectionLinkExtraProps

const NextSectionLink: React.FC<NextSectionLinkProps> = () => {
  return (
    <SectionWrapper>
      <Fragment>
        <h2>
          Impressive! you’ve reach
          <br />
          the end of this topic.
        </h2>
        <p>proceed to the next section </p>
        <ButtonWrapper>
          <StyledLink href={"source"}>
            <span>Introduction to Rust</span>
            <StyledArrow>
              <img src={"../img/arrow.svg"} alt="next icon" width="20px" />
            </StyledArrow>
          </StyledLink>
        </ButtonWrapper>
      </Fragment>
    </SectionWrapper>
  )
}

export default NextSectionLink
