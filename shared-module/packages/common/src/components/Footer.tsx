import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import UHLogo from "../img/UHBrandLogo.svg"
import MOOCfi from "../img/moocfiLogo.svg"
import { baseTheme, headingFont } from "../styles"
import { respondToOrLarger } from "../styles/respond"

const PRIVACY_LINK_FI = "https://www.mooc.fi/faq/tietosuojaseloste/"
const PRIVACY_LINK_EN = "https://www.mooc.fi/en/faq/tietosuojaseloste/"

// To be link in the future
// const CREATORS_LINK = "https://www.mooc.fi/en/"

const Container = styled.div`
  margin-top: 5em;
  padding: 1rem;
  background: #f7f8f9;

  ${respondToOrLarger.sm} {
    padding: 4rem;
  }

  ${respondToOrLarger.lg} {
    padding: 5rem 3rem;
  }

  h1 {
    margin-bottom: 0.8rem;
    line-height: 1;
    font-weight: 600;
    font-size: clamp(24px, 2vw, 30px);
    color: ${baseTheme.colors.gray[700]};
    padding: 0;

    ${respondToOrLarger.sm} {
      padding: 0 2rem 0 0;
    }
    ${respondToOrLarger.lg} {
      padding: 0 2rem 0 3rem;
    }
  }
`
const Wrapper = styled.div`
  display: grid;
  grid-template-rows: 1fr;
  color: #231f20;
  position: relative;
  row-gap: 20px;

  ${respondToOrLarger.sm} {
    grid-template-columns: 1fr;
    gap: 20px;
    row-gap: 20px;
  }

  ${respondToOrLarger.lg} {
    grid-template-columns: 0.9fr 0.2fr;
    gap: 20px;
    row-gap: 20px;
  }
`

const StyledLink = styled.a`
  text-decoration: none;
  color: ${baseTheme.colors.gray[700]};
  font-size: 18px;
  font-weight: 500;
  opacity: 0.8;
  transition: opacity 0.2s ease-in;
  margin-bottom: 5px;
  font-family: ${headingFont};
  padding-left: 0;

  ${respondToOrLarger.lg} {
    margin-bottom: 14px;
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
    width: 90%;
    padding: 0 5rem 0 3rem;
  }

  p {
    font-size: 18px;
    padding-right: 0;
    color: ${baseTheme.colors.gray[600]};
  }

  .mooc-description {
    display: inline-block;
    padding-top: 10px;
    opacity: 0.8;
  }
`
const Links = styled.div`
  display: flex;
  flex-direction: column;
`

const LogoA = styled.a`
  filter: brightness(100%) contrast(100%);
  transition: filter 0.2s;
  max-height: 98px;
  &:hover {
    filter: brightness(34%) contrast(40%);
  }

  &:first-of-type {
    margin-right: 1.5rem;
  }
`

export interface Props extends FooterProps {
  privacyLinks?: {
    linkTitle: string
    linkUrl: string
  }[]
}

export type FooterProps = React.HTMLAttributes<HTMLDivElement>

const Footer: React.FC<React.PropsWithChildren<Props>> = ({ privacyLinks = null }) => {
  const { t, i18n } = useTranslation()
  const useFinnishLinks = i18n.language === "fi" || i18n.language === "fi-FI"
  const defaultLink = useFinnishLinks ? PRIVACY_LINK_FI : PRIVACY_LINK_EN

  const displayedLinks =
    privacyLinks && privacyLinks?.length > 0
      ? privacyLinks
      : [{ linkTitle: t("privacy"), linkUrl: defaultLink }]

  return (
    <footer
      role="contentinfo"
      className={css`
        margin-top: 2rem;

        a {
          color: #065853;
          font-weight: 600;
        }
      `}
    >
      <Container>
        <h1>{t("about")}</h1>
        <Wrapper>
          <Text>
            <p>{t("about-mooc-center-description")}</p>
            <p className="mooc-description">
              {t("mooc-project-description")} {t("star-the-project-on-github")}:{" "}
              <a href="https://github.com/rage/secret-project-331/">{t("project-github")}</a>.
            </p>
          </Text>
          <Links>
            {displayedLinks?.map((link) => (
              <StyledLink key={`${link.linkTitle}-${link.linkUrl}`} href={link.linkUrl}>
                {link.linkTitle}
              </StyledLink>
            ))}
          </Links>
          <div
            className={css`
              display: flex;
              align-content: space-between;
              row-gap: 1.4em;
              opacity: 0.9;

              ${respondToOrLarger.sm} {
                padding: 0 2rem 0 0;
              }

              ${respondToOrLarger.md} {
                width: 90%;
              }

              ${respondToOrLarger.lg} {
                padding: 1rem 2rem 0 3rem;
              }
            `}
          >
            <LogoA
              href={useFinnishLinks ? "https://www.mooc.fi" : "https://www.mooc.fi/en"}
              // eslint-disable-next-line i18next/no-literal-string
              aria-label="MOOC.fi"
            >
              <MOOCfi />
            </LogoA>
            <LogoA
              href={useFinnishLinks ? "https://www.helsinki.fi" : "https://www.helsinki.fi/en"}
              aria-label={t("university-of-helsinki")}
            >
              <UHLogo />
            </LogoA>
          </div>
        </Wrapper>
      </Container>
    </footer>
  )
}

export default Footer
