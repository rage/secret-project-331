import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { Fragment } from "react"

import UHLogo from "../img/UHLogo.svg"
import MOOCfi from "../img/moocfi.svg"
import { headingFont } from "../styles"
import basePath from "../utils/base-path"

import Banner from "./Banner/Banner"

const Wrapper = styled.div`
  display: grid;
  background: #f1f1f1;
  grid-template-rows: 1fr;
  padding: 1.5rem;
  color: #231f20;
  position: relative;
  gap: 40px;

  @media (min-width: 600px) {
    grid-template-columns: 0.5fr 1fr 0.5fr;
    padding: 4.5rem;
    gap: 20px;
  }

  h3 {
    margin-bottom: 1rem;
    opacity: 0.8;
    line-height: 1;
  }

  div:first-of-type {
    margin-right: 0;

    @media (min-width: 600px) {
      padding-right: 20px;
    }
  }
`

const StyledLink = styled.a`
  text-decoration: none;
  color: #333;
  font-size: 1.2rem;
  opacity: 0.7;
  transition: opacity 0.2s ease-in;
  margin-bottom: 5px;
  font-family: ${headingFont};

  @media (min-width: 600px) {
    margin-bottom: 10px;
  }

  :hover {
    text-decoration: none;
    opacity: 1;
  }
`
const Text = styled.div`
  width: 100%;
  padding: 0;

  @media (min-width: 600px) {
    width: 100%;
    padding: 0 2rem 0 2rem;
  }
  span {
    font-size: 16px;
    padding-right: 0;
    opacity: 0.7;

    @media (min-width: 600px) {
      /* padding: 0 rem; */
    }
  }
`
const Links = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: end;
`

export interface FooterExtraProps {
  licenseUrl?: string
}

export type FooterProps = React.HTMLAttributes<HTMLDivElement> & FooterExtraProps

const Footer: React.FC<FooterProps> = ({ licenseUrl }) => {
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
            place-self: center;
          `}
        >
          <MOOCfi alt="MOOC.fi" />
          <UHLogo alt="University of Helsinki" />
        </div>
        <Text>
          <h6>WHO WE ARE</h6>
          <span>
            MOOC center is responsible for creating custom online courses for univeristy of
            Helsinki. Its responsible for all the higlhy popular courses that have been available in
            mooc.fi from 2012.
          </span>
        </Text>
        <Links>
          <h6>RESOURCES</h6>
          <StyledLink href={basePath() + "/privacy"}>Privacy</StyledLink>
          <StyledLink href={basePath() + "/accessibility"}>Accessibility</StyledLink>
          <StyledLink href={basePath() + "/creators"}>Creators</StyledLink>
          {licenseUrl ? <StyledLink href={licenseUrl}>License</StyledLink> : null}
        </Links>
      </Wrapper>
    </Fragment>
  )
}

export default Footer
