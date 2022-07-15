import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import UHLogo from "../img/UHBrandLogo.svg"
import MOOCfi from "../img/moocfiLogo.svg"
import { baseTheme, headingFont, secondaryFont, typography } from "../styles"
import { respondToOrLarger } from "../styles/respond"

import ContriButeBanner from "./Banner/ContributeBanner"

const PRIVACY_LINK = "https://www.mooc.fi/faq/tietosuojaseloste/"

// To be link in the future
// const CREATORS_LINK = "https://www.mooc.fi/en/"

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  display: grid;
  background: #ebedee;
  grid-template-rows: 1fr;
  padding: 1rem;
  color: #231f20;
  position: relative;
  gap: 40px;

  ${respondToOrLarger.sm} {
    grid-template-columns: 1fr;
    padding: 4rem;
    gap: 20px;
    row-gap: 40px;
  }

  ${respondToOrLarger.lg} {
    grid-template-columns: 0.3fr 1fr 0.3fr;
    padding: 4rem;
    gap: 20px;
    row-gap: 40px;
  }

  h1 {
    margin-bottom: 0.8rem;
    line-height: 1;
    font-size: 1.2rem;
    color: ${baseTheme.colors.grey[700]};
    font-family: ${secondaryFont};
  }

  div:first-of-type {
    margin-left: 0;

    ${respondToOrLarger.md} {
      margin-left: 0;
    }

    ${respondToOrLarger.lg} {
      margin-left: 2em;
    }
  }
`

const StyledLink = styled.a`
  text-decoration: none;
  color: ${baseTheme.colors.grey[700]};
  font-size: 18px;
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
  width: 100%;
  padding: 0;

  ${respondToOrLarger.sm} {
    padding: 0 2rem 0 0;
  }

  ${respondToOrLarger.md} {
    width: 90%;
  }

  ${respondToOrLarger.lg} {
    padding: 0 2rem 0 2rem;
  }
  ${respondToOrLarger.xxl} {
    padding: 0 2rem 0 2rem;
  }

  span {
    font-size: 18px;
    padding-right: 0;
    opacity: 0.7;
  }
`
const Links = styled.div`
  display: flex;
  flex-direction: column;
`

const LogoA = styled.a`
  filter: brightness(100%) contrast(100%);
  transition: filter 0.2s;
  &:hover {
    filter: brightness(34%) contrast(40%);
  }
`

export interface FooterExtraProps {
  licenseUrl?: string
}

export type FooterProps = React.HTMLAttributes<HTMLDivElement> & FooterExtraProps

const Footer: React.FC<FooterProps> = ({ licenseUrl }) => {
  const { t, i18n } = useTranslation()
  const useFinnishLinks = i18n.language === "fi" || i18n.language === "fi-FI"
  return (
    <footer
      role="contentinfo"
      className={css`
        margin-top: 2rem;

        h1 {
          font-size: ${typography.h5};
          font-weight: 500;
        }
      `}
    >
      <ContriButeBanner />
      <Wrapper>
        <div
          className={css`
            display: flex;
            flex-direction: column;
            align-content: space-between;
            row-gap: 1.4em;
            opacity: 0.9;
          `}
        >
          <LogoA
            href={useFinnishLinks ? "https://www.helsinki.fi" : "https://www.helsinki.fi/en"}
            aria-label={t("university-of-helsinki")}
          >
            <UHLogo />
          </LogoA>

          <LogoA
            href={useFinnishLinks ? "https://www.mooc.fi" : "https://www.mooc.fi/en"}
            // eslint-disable-next-line i18next/no-literal-string
            aria-label="MOOC.fi"
          >
            <MOOCfi />
          </LogoA>
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
