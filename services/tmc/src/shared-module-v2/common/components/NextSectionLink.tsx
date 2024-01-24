import { css } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import React, { Fragment } from "react"
import { useTranslation } from "react-i18next"

import ArrowSVGIcon from "../img/arrow.svg"
import BackArrowIcon from "../img/backarrow.svg"
import LockIcon from "../img/lock.svg"
import TopArrowSVGIcon from "../img/up-arrow.svg"
import { baseTheme, headingFont, typography } from "../styles"
import { respondToOrLarger } from "../styles/respond"

import LinkOrNoLink from "./LinkOrNoLink"
import HideTextInSystemTests from "./system-tests/HideTextInSystemTests"

export interface NextSectionLinkExtraProps {
  title: string
  subtitle: string
  nextTitle: string
  url?: string
  previous?: string
  chapterFrontPageURL?: string
}

const Wrapper = styled.div`
  overflow: hidden;
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  width: calc(0px + 100vw);
  ${respondToOrLarger.md} {
    margin-top: 2rem;
    margin-bottom: 2rem;
    padding: 3rem 0 3.5rem 0;
  }
  background: #f4f6f8;
  padding: 1.5rem 1rem 2rem 1.4rem;
`

// eslint-disable-next-line i18next/no-literal-string
const StyledLink = styled(Link)`
  border: 1px solid ${baseTheme.colors.blue[200]};
  padding: 0.3rem 1rem;
  background: #fff;
  display: inline-block;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  margin-bottom: 2.4rem;

  span {
    font-size: 15px;
    font-weight: 500;
    padding-left: 8px;
    color: ${baseTheme.colors.blue[700]};
  }

  .arrow {
    fill: ${baseTheme.colors.blue[500]};
  }

  &:hover {
    cursor: pointer;
    background: ${baseTheme.colors.blue[100]};

    span {
      color: ${baseTheme.colors.blue[600]};
    }

    .arrow {
      fill: ${baseTheme.colors.blue[600]};
    }
  }
`

export type NextSectionLinkProps = React.HTMLAttributes<HTMLDivElement> & NextSectionLinkExtraProps

const NextSectionLink: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<NextSectionLinkProps>>
> = ({ title, subtitle, nextTitle, url, previous, chapterFrontPageURL }) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <div
        className={css`
          font-family: ${headingFont};
          min-height: auto;
          max-width: 48rem;
          margin-left: auto;
          margin-right: auto;
        `}
      >
        {chapterFrontPageURL && (
          <StyledLink href={chapterFrontPageURL}>
            <TopArrowSVGIcon id="up-svg-icon" role="presentation" alt="" />
            <span>{t("chapter-front-page")}</span>
          </StyledLink>
        )}

        <Fragment>
          <h2
            className={css`
              font-size: clamp(28px, 3vw, 2rem);
              line-height: 1.3;
              font-weight: 600;
              opacity: 0.9;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {title}
          </h2>
          <p
            className={css`
              font-size: 18px;
              color: ${baseTheme.colors.gray[700]};
              font-weight: 500;
              margin: 0.3rem 0;
              padding: 0;
              display: flex;

              ${respondToOrLarger.md} {
                font-size: 20px;
              }
            `}
          >
            {subtitle}
          </p>
          <div
            className={css`
              display: grid;
              grid-template-columns: ${previous ? "60px 1fr" : "1fr"};
              column-gap: 10px;
              margin-top: 1.5rem;

              ${respondToOrLarger.md} {
                grid-template-columns: ${previous ? "80px 1fr" : "1fr"};
                column-gap: 12px;
              }
            `}
          >
            {previous && (
              <Link href={previous} aria-label={t("previous-page")}>
                <div
                  className={css`
                    background: ${baseTheme.colors.green[100]};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100%;

                    &:hover {
                      filter: brightness(95%) contrast(110%);
                      cursor: pointer;
                    }

                    svg {
                      fill: #44827e;
                      width: 30%;
                      ${respondToOrLarger.md} {
                        width: 100%;
                      }
                    }
                  `}
                >
                  <BackArrowIcon
                    id="back-arrow-icon"
                    role="presentation"
                    alt=""
                    width="25"
                    height="25"
                    viewBox="0 0 39 39"
                  />
                </div>
              </Link>
            )}
            <LinkOrNoLink
              url={url}
              linkClassName={css`
                overflow: hidden;
                text-decoration: none;
                &:focus-visible {
                  outline: 2px solid ${baseTheme.colors.green[500]};
                  outline-offset: 2px;
                }
              `}
            >
              <div
                className={css`
                  display: flex;
                  flex-direction: row;
                  width: 100%;
                  transition: filter 0.2s;
                  cursor: ${url ? "pointer" : "not-allowed"};
                  &:hover {
                    text-decoration: none;
                    filter: brightness(92%) contrast(110%);
                  }
                `}
              >
                <div
                  className={css`
                    background-color: ${url
                      ? baseTheme.colors.green[600]
                      : baseTheme.colors.gray[600]};

                    flex: 1;
                    line-height: 1.3;
                    width: 100%;
                    padding: 1.2rem 1rem;

                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;

                    .next-page-title {
                      display: block;
                      width: 100%;
                      font-size: ${typography.h5};
                      font-weight: 600;
                      color: #fff;
                      white-space: nowrap;
                      text-overflow: ellipsis;
                      overflow: hidden;
                    }
                    .next-page-subtitle {
                      font-weight: medium;
                      color: #dae6e5;
                      font-size: 15px;

                      ${respondToOrLarger.md} {
                        font-size: ${typography.paragraph};
                      }
                    }

                    ${respondToOrLarger.md} {
                      width: 68%;
                      padding: 1.2rem 1.8rem;
                    }
                  `}
                >
                  <span className="next-page-subtitle">{t("next-page")}:</span>
                  <span className="next-page-title">
                    <HideTextInSystemTests
                      text={nextTitle}
                      testPlaceholder={"Title of the next page"}
                    />
                  </span>
                </div>
                <div
                  className={css`
                    color: white;
                    padding: 16px 16px 16px 0;
                    background-color: ${url
                      ? baseTheme.colors.green[600]
                      : baseTheme.colors.gray[600]};
                    display: flex;
                    justify-content: center;
                    align-items: center;

                    .arrow {
                      fill: #fff;
                    }

                    ${respondToOrLarger.sm} {
                      padding: 1.6rem;
                      width: auto;
                    }

                    svg {
                      width: auto;
                    }
                  `}
                >
                  {url ? (
                    <ArrowSVGIcon
                      id="right-svg-icon"
                      role="presentation"
                      alt=""
                      width="30"
                      height="30"
                      viewBox="0 0 39 39"
                    />
                  ) : (
                    <LockIcon
                      id="svg-icon"
                      role="presentation"
                      alt=""
                      width="24"
                      height="36"
                      viewBox="0 0 24 36"
                    />
                  )}
                </div>
              </div>
            </LinkOrNoLink>
          </div>
        </Fragment>
      </div>
    </Wrapper>
  )
}

export default NextSectionLink
