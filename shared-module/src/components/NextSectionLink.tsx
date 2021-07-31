import styled from "@emotion/styled"
import React, { Fragment } from "react"

import next from "../img/next.png"

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
    text-align: left !important;
  }
`

const StyledArrow = styled.img`
  position: absolute;
  top: 0%;
  right: 0%;
  width: 14.5px;
  padding: 1.2rem;
  background: #cacaca;
  cursor: pointer;
  display: inline-block;

  &:hover {
    .arrow {
      fill: #fe9677;
    }
  }
  &.arrow {
    transition: fill 0.2s ease-in;
    fill: rgb(22, 179, 199);
  }
`

const StyledLink = styled.a`
  position: relative;
  color: #c4c4c4;
  text-decoration: none;
  padding: 1rem 1.4rem;
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
    color: white !important;
    line-height: 1.3;
  }

  &:after {
    content: "";
    background: red;
    height: 100%;
    width: 100px;
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
        <h2>Impressive! you’ve reach the end of this topic.</h2>
        <p>proceed to the next section </p>
        <ButtonWrapper>
          <StyledLink href={"source"}>
            <span>Introduction to Rust</span>
            <StyledArrow src={next} />
          </StyledLink>
        </ButtonWrapper>
      </Fragment>
    </SectionWrapper>
  )
}

export default NextSectionLink
