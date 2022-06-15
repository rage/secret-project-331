import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import MOOCfi from "../img/MOOCLogo.svg"
import UHLogo from "../img/UH.png"
import { baseTheme, headingFont, typography } from "../styles"
import { respondToOrLarger } from "../styles/respond"

import Banner from "./Banner/Banner"
import ContriButeBanner from "./Banner/ContributeBanner"

const PRIVACY_LINK = "https://www.mooc.fi/faq/tietosuojaseloste/"

// To be link in the future
// const CREATORS_LINK = "https://www.mooc.fi/en/"

const Wrapper = styled.div`
  display: grid;
  background: #d8dbdd;
  grid-template-rows: 1fr;
  padding: 1.5rem;
  color: #231f20;
  position: relative;
  gap: 40px;

  ${respondToOrLarger.md} {
    grid-template-columns: 0.5fr 1fr 0.5fr;
    padding: 5rem 4.5rem 4.5rem 4.5rem;
    gap: 20px;
  }

  h1 {
    margin-bottom: 1rem;
    opacity: 0.8;
    line-height: 1;
    color: ${baseTheme.colors.grey[700]};
  }

  div:first-of-type {
    margin-left: 4em;

    ${respondToOrLarger.md} {
      padding-right: 20px;
    }
  }
`

const StyledLink = styled.a`
  text-decoration: none;
  color: ${baseTheme.colors.grey[700]};
  font-size: 1.2rem;
  opacity: 0.7;
  transition: opacity 0.2s ease-in;
  margin-bottom: 5px;
  font-family: ${headingFont};

  ${respondToOrLarger.md} {
    margin-bottom: 10px;
  }

  :hover {
    text-decoration: none;
    opacity: 1;
  }
`
const Text = styled.div`
  width: 80%;
  padding: 0;

  ${respondToOrLarger.md} {
    padding: 0 2rem 0 2rem;
  }
  span {
    font-size: 20px;
    padding-right: 0;
    opacity: 0.7;
  }
`
const Links = styled.div`
  display: flex;
  flex-direction: column;
  /* justify-content: end; */
`

export interface FooterExtraProps {
  licenseUrl?: string
}

export type FooterProps = React.HTMLAttributes<HTMLDivElement> & FooterExtraProps

const Footer: React.FC<FooterProps> = ({ licenseUrl }) => {
  const { t } = useTranslation()
  return (
    <footer
      role="contentinfo"
      className={css`
        margin-top: 2rem;

        h1 {
          font-size: ${typography.h6};
        }
      `}
    >
      <ContriButeBanner />
      {/*       <Banner variant="readOnly">
        <>{t("project-description")}</>
      </Banner> */}
      <Wrapper>
        <div
          className={css`
            display: grid;
            grid-template-rows: 1fr;
            align-content: space-between;
            grid-gap: 1.6em;
            opacity: 0.9;
            ${respondToOrLarger.md} {
              grid-template-rows: 1fr;
            }
          `}
        >
          <img src={UHLogo} alt={t("university-of-helsinki")} width="277px" />
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <MOOCfi alt="MOOC.fi" />
        </div>
        <Text>
          <h1
            className={css`
              text-transform: uppercase;
            `}
          >
            {t("about-mooc-center")}
          </h1>
          <span>{t("about-mooc-center-description")}</span>
        </Text>
        <Links>
          <h1
            className={css`
              text-transform: uppercase;
            `}
          >
            {t("resources")}
          </h1>
          <StyledLink href={PRIVACY_LINK}>{t("privacy")}</StyledLink>
          {/* <StyledLink href={basePath() + "/accessibility"}>{t("accessibility")}</StyledLink>
          <StyledLink href={CREATORS_LINK}>{t("creators")}</StyledLink> */}
          {licenseUrl ? <StyledLink href={licenseUrl}>{t("license")}</StyledLink> : null}
        </Links>
      </Wrapper>
    </footer>
  )
}

export default Footer
