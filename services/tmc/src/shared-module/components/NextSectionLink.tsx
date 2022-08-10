import { css } from "@emotion/css"
import React, { Fragment } from "react"

import ArrowSVGIcon from "../img/arrow.svg"
import LockIcon from "../img/lock.svg"
import { baseTheme, typography } from "../styles"
import { respondToOrLarger } from "../styles/respond"

import HideTextInSystemTests from "./HideTextInSystemTests"
import LinkOrNoLink from "./LinkOrNoLink"

export interface NextSectionLinkExtraProps {
  title: string
  subtitle: string
  nextTitle: string
  url?: string
}

export type NextSectionLinkProps = React.HTMLAttributes<HTMLDivElement> & NextSectionLinkExtraProps

const NextSectionLink: React.FC<NextSectionLinkProps> = ({ title, subtitle, nextTitle, url }) => {
  return (
    <div
      className={css`
        margin-top: 3rem;
        ${respondToOrLarger.sm} {
          margin-top: 6rem;
          margin-bottom: 4rem;
        }
        background: ${baseTheme.colors.clear[100]};
        padding: 4rem 3rem;
      `}
    >
      <Fragment>
        <h2
          className={css`
            font-size: 1.6rem;
            line-height: 1.4;
            margin-bottom: 0.5rem;
          `}
        >
          {title}
        </h2>
        <p
          className={css`
            font-size: 1.1rem;
            color: ${baseTheme.colors.grey[500]};
            margin: 0.5rem 0;
            padding: 0;
            display: flex;
          `}
        >
          {subtitle}
        </p>
        <LinkOrNoLink url={url}>
          <div
            className={css`
              margin-top: 1.5rem;
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
                background-color: ${baseTheme.colors.green[100]};

                flex: 1;
                font-size: ${typography.h6};
                font-weight: bold;
                line-height: 1.3;
                width: 68%;
                color: black;
                padding: 1.6rem;

                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;

                ${respondToOrLarger.sm} {
                  width: 100%;
                }
              `}
            >
              <HideTextInSystemTests text={nextTitle} testPlaceholder={"Title of the next page"} />
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
                  id="svg-icon"
                  role="presentation"
                  alt=""
                  width="25"
                  height="25"
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
      </Fragment>
    </div>
  )
}

export default NextSectionLink
