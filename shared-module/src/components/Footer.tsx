import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { Fragment } from "react"

import UHLogo from "../img/UHLogo.svg"
import MOOCfi from "../img/moocfi.svg"

import Banner from "./Banner/Banner"

const Wrapper = styled.div`
  display: grid;
  background: #f1f1f1;
  grid-template-columns: 0.5fr 1fr 0.5fr;
  padding: 4.5rem;
  color: #231f20;
  position: relative;

  h3 {
    margin-bottom: 1rem;
  }

  div:first-of-type {
    img {
      display: inline-block;
      margin: 0 8px;
    }
  }

  svg {
    transition: fill 0.2s ease-in;

    :hover {
      fill: #fe9677;
    }
  }
`

const StyledLink = styled.a`
  text-decoration: none;
  color: #333;
  font-size: 1.2rem;
  opacity: 0.7;
  transition: opacity 0.2s ease-in;
  margin-bottom: 10px;

  :hover {
    text-decoration: none;
    opacity: 1;
  }
`
const Text = styled.div`
  width: 70%;
  span {
    font-size: 16px;
    padding-right: 10rem;
    opacity: 0.7;
  }
`
const Links = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: end;
`

export interface FooterExtraProps {
  url: string
}

export type FooterProps = React.HTMLAttributes<HTMLDivElement> & FooterExtraProps

const Footer: React.FC<FooterProps> = () => {
  return (
    <Fragment>
      <Banner
        variant="readOnly"
        content="Secret project is a system developed by the MOOC centre of Univeristy of Helsinki that enables teachers in all institutions to create online courses for free."
      />
      <Wrapper>
        <div
          className={css`
            margin: 0 auto;
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-content: space-between;
            grid-gap: 1em;
          `}
        >
          <MOOCfi alt="MOOC.fi" />
          <UHLogo alt="University of Helsinki" />
        </div>
        <Text>
          <h3>WHO WE ARE</h3>
          <span>
            MOOC center is responsible for creating custom online courses for univeristy of
            Helsinki. Its responsible for all the higlhy popular courses that have been available in
            mooc.fi from 2012.
          </span>
        </Text>
        <Links>
          <h3>RESOURCES</h3>
          <StyledLink href="/faq">Privacy</StyledLink>
          <StyledLink href="/creators">Accessibility</StyledLink>
          <StyledLink href="/license">License?</StyledLink>
        </Links>
      </Wrapper>
    </Fragment>
  )
}

export default Footer
