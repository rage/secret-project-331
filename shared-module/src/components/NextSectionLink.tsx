import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { Fragment } from "react"

import ArrowSVGIcon from "../img/arrow.svg"
import LockIcon from "../img/lock.svg"
import { baseTheme, headingFont, typography } from "../styles"
import { respondToOrLarger } from "../styles/respond"

import LinkOrNoLink from "./LinkOrNoLink"
import HideTextInSystemTests from "./system-tests/HideTextInSystemTests"

export interface NextSectionLinkExtraProps {
  title: string
  subtitle: string
  nextTitle: string
  url?: string
}

// eslint-disable-next-line i18next/no-literal-string
const StyledButton = styled.button`
  border: 1px solid ${baseTheme.colors.blue[200]};
  padding: 0.4rem 1rem;
  background: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;

  span {
    font-size: 15px;
    padding-left: 8px;
    color: ${baseTheme.colors.blue[600]};
  }

  .arrow {
    fill: ${baseTheme.colors.blue[300]};
  }
`

export type NextSectionLinkProps = React.HTMLAttributes<HTMLDivElement> & NextSectionLinkExtraProps

// eslint-disable-next-line i18next/no-literal-string
const nextPage = "Next Page:"
// eslint-disable-next-line i18next/no-literal-string
const chapterPage = "Chapter Page"

const NextSectionLink: React.FC<NextSectionLinkProps> = ({ title, subtitle, nextTitle, url }) => {
  return (
    <div
      className={css`
        margin-top: 3rem;
        font-family: ${headingFont};
        min-height: 300px;
        ${respondToOrLarger.md} {
          margin-top: 6rem;
          margin-bottom: 4rem;
          padding: 2rem 4rem 4rem 4rem;
        }
        background: ${baseTheme.colors.clear[100]};
        padding: 2rem 1rem 2rem 1.4rem;
      `}
    >
      <StyledButton>
        <ArrowSVGIcon
          id="up-svg-icon"
          role="presentation"
          alt=""
          width="15"
          height="15"
          viewBox="0 0 39 39"
          transform="rotate(270)"
        />
        <span>{chapterPage}</span>
      </StyledButton>
      <Fragment>
        <h2
          className={css`
            font-size: clamp(28px, 3vw, 2.4rem);
            line-height: 1.3;
            font-weight: 500;
            margin-bottom: 0.8rem;
            margin-top: 1.5rem;
          `}
        >
          {title}
        </h2>
        <p
          className={css`
            font-size: 1.2rem;
            color: ${baseTheme.colors.grey[500]};
            margin: 0.5rem 0;
            padding: 0;
            display: flex;

            ${respondToOrLarger.md} {
              font-size: 1.4rem;
            }
          `}
        >
          {subtitle}
        </p>
        <div
          className={css`
            display: grid;
            grid-template-columns: 80px 1fr;
            column-gap: 10px;
            margin-top: 1.5rem;

            ${respondToOrLarger.md} {
              margin-top: 2rem;
              grid-template-columns: 110px 1fr;
              column-gap: 20px;
            }
          `}
        >
          <div
            className={css`
              background: ${baseTheme.colors.green[100]};
              display: flex;
              justify-content: center;
              align-items: center;

              ${respondToOrLarger.md} {
                /* visibility: visible; */
              }

              .arrow {
                fill: #44827e;
              }
            `}
          >
            {" "}
            <ArrowSVGIcon
              id="left-svg-icon"
              role="presentation"
              alt=""
              width="30"
              height="30"
              viewBox="0 0 39 39"
              transform="rotate(180)"
            />
          </div>
          <LinkOrNoLink url={url}>
            <div
              className={css`
                display: flex;
                flex-direction: row;
                width: 100%;
                transition: filter 0.2s;

                ${!url && `cursor: not-allowed;`}

                &:hover {
                  text-decoration: none;
                  filter: brightness(92%) contrast(110%);
                  cursor: pointer;
                }
              `}
            >
              <div
                className={css`
                  background: ${baseTheme.colors.green[600]};

                  flex: 1;
                  line-height: 1.3;
                  width: 68%;
                  padding: 1.6rem 1.8rem;

                  overflow: hidden;
                  white-space: nowrap;
                  text-overflow: ellipsis;

                  .next-page-title {
                    display: block;
                    width: 68%;
                    font-size: ${typography.h4};
                    font-weight: medium;
                    color: #fff;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                  }
                  .next-page-subtitle {
                    font-weight: bold;
                    color: #dae6e5;
                    font-size: ${typography.h6};
                  }

                  ${respondToOrLarger.sm} {
                    width: 100%;
                  }
                `}
              >
                <span className="next-page-subtitle">{nextPage}</span>
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
                  padding: 1rem 1rem;
                  background: ${baseTheme.colors.green[600]};
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
                    width: 60%;
                    ${respondToOrLarger.sm} {
                      width: 80%;
                    }
                  }
                `}
              >
                {url ? (
                  <ArrowSVGIcon
                    id="right-svg-icon"
                    role="presentation"
                    alt=""
                    width="50"
                    height="50"
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
  )
}

export default NextSectionLink
