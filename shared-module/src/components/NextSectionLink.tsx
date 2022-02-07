import { css } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import React, { Fragment } from "react"

import ArrowSVGIcon from "../img/arrow.svg"
import LockIcon from "../img/lock.svg"
import { baseTheme, typography } from "../styles"
import { respondToOrLarger } from "../styles/respond"

const SectionWrapper = styled.div`
  margin-top: 3rem;
  background: #f0f0f0;
  padding: 3rem 2rem;

  p {
    font-size: 1rem;
    color: ${baseTheme.colors.grey[700]};
    margin: 0;
    padding: 0;
    display: flex;
  }

  p:nth-child(1) {
    font-size: 2rem;
    font-weight: 500;
  }

  h2 {
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
  padding: 1rem 1rem;
  background: #cacaca;
  display: flex;
  justify-content: center;
  align-items: center;

  ${respondToOrLarger.sm} {
    padding: 1rem 1.6rem;
    width: auto;
  }

  svg {
    width: 60%;

    ${respondToOrLarger.sm} {
      width: 80%;
    }
  }

  &:hover {
    .arrow {
      fill: #fe9677;
    }
  }
`

// eslint-disable-next-line i18next/no-literal-string
const StyledLinkWrapper = styled.div`
  position: relative;
  color: #c4c4c4;
  text-decoration: none;
  padding: 1.2rem 1.2rem;
  margin: 1rem 0;
  display: flex;
  min-width: 100%;
  background-color: ${baseTheme.colors.grey[700]};
  transition: background-color 0.2s;

  ${respondToOrLarger.sm} {
    padding: 1.4rem 1.4rem;
    background-color: ${baseTheme.colors.grey[700]};
  }

  &:hover {
    text-decoration: none;
    color: white;
    background-color: ${baseTheme.colors.grey[700]};
  }

  span {
    font-size: ${typography.h6};
    color: white !important;
    line-height: 1.3;
    width: 68%;

    ${respondToOrLarger.sm} {
      width: 100%;
    }
  }
`

export interface NextSectionLinkExtraProps {
  title: string
  subtitle: string
  nextTitle: string
  url?: string
}

export type NextSectionLinkProps = React.HTMLAttributes<HTMLDivElement> & NextSectionLinkExtraProps

const NextSectionLink: React.FC<NextSectionLinkProps> = ({ title, subtitle, nextTitle, url }) => {
  return (
    <SectionWrapper>
      <Fragment>
        <h2
          className={css`
            font-size: 1.25rem;
          `}
        >
          {title}
        </h2>
        <p>{subtitle}</p>
        <div
          className={css`
            display: flex;
            align-items: center;
            margin-top: 0.5rem;
          `}
        >
          <StyledLinkWrapper>
            {url ? (
              <>
                <Link href={url} passHref>
                  <a
                    href="replace"
                    className={css`
                      text-decoration: none;
                    `}
                  >
                    <span>{nextTitle}</span>
                    <StyledArrow>
                      <ArrowSVGIcon
                        id="svg-icon"
                        role="presentation"
                        alt=""
                        width="38.7"
                        height="38.7"
                        viewBox="0 0 39 39"
                      />
                    </StyledArrow>
                  </a>
                </Link>
              </>
            ) : (
              <div
                className={css`
                  cursor: not-allowed;
                `}
              >
                <span>{nextTitle}</span>
                <StyledArrow>
                  <LockIcon
                    id="svg-icon"
                    role="presentation"
                    alt=""
                    width="24"
                    height="36"
                    viewBox="0 0 24 36"
                  />
                </StyledArrow>
              </div>
            )}
          </StyledLinkWrapper>
        </div>
      </Fragment>
    </SectionWrapper>
  )
}

export default NextSectionLink
