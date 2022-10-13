import { css } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import React from "react"

import { baseTheme, headingFont, secondaryFont } from "../../styles"
import CircularProgressBar from "../CircularProgressBar"

const Wrapper = styled.div`
  border-radius: 10px;
  position: relative;
  width: 100%;
  margin-bottom: 5px;

  h2 {
    text-align: center;
    color: #3b4754;
    font-family: ${secondaryFont};
    text-transform: uppercase;
    font-size: 1.6rem;
    margin-bottom: 2rem;
  }
`

const StyledLink = styled.div`
  :hover {
    cursor: pointer;
  }
`

const ImageBox = styled.div`
  width: 40px;
  height: 40px;
  position: relative;
  vertical-align: middle;
  display: inline-block;

  div {
    width: 100%;
    height: 100%;
    z-index: 2;
    text-align: center;
    display: flex;
    align-content: center;
    padding-top: 7px;
  }

  p {
    width: 100%;
    height: 100%;
    text-align: center;
    z-index: 3;
    color: ${baseTheme.colors.grey[700]};
    font-size: 16px;
    margin-bottom: 0;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const ExercisePart = styled.div<StyledProps>`
  position: relative;
  margin-left: 0em;
  padding-left: 1em;
  list-style-type: none;
  color: ${baseTheme.colors.grey[700]};
  text-decoration: none;
  background: ${({ bg }) => bg && bg};
  display: flex;
  align-items: center;

  :hover {
    background-color: rgb(235, 239, 242);
  }

  span {
    vertical-align: top;
    padding: 0.6em 0;
    font-size: 18px;
    display: inline-block;
    width: 80%;
    margin: 0.4em 0 0.4em 0.2em;
    font-family: ${headingFont};
  }

  div:last-of-type {
    margin-left: auto;
  }
`
export interface ExerciseBoxExtraProps {
  exerciseIndex: number
  exerciseTitle: string
  url: string
  scoreMaximum: number
  /// The caller will set this to null if the user is not logged in
  userPoints: number | null
  bg?: string
}
export interface StyledProps {
  bg?: string
}

export type ExerciseBox = React.HTMLAttributes<HTMLDivElement> & ExerciseBoxExtraProps

const ExerciseBox: React.FC<React.PropsWithChildren<React.PropsWithChildren<ExerciseBox>>> = ({
  exerciseIndex,
  exerciseTitle,
  url,
  scoreMaximum,
  userPoints,
  bg,
}) => {
  return (
    <Wrapper>
      <StyledLink>
        <Link href={url} passHref>
          <a
            className={css`
              text-decoration: none;
              &:focus-visible {
                & > div {
                  background-color: ${baseTheme.colors.grey[500]};
                  color: ${baseTheme.colors.clear[100]};
                }
              }
            `}
            href="replace"
          >
            <ExercisePart bg={bg}>
              <ImageBox>
                <div>
                  <p>{exerciseIndex}</p>
                </div>
              </ImageBox>
              <span>{exerciseTitle}</span>
              {userPoints !== null && (
                <div
                  className={css`
                    background: rgb(235, 239, 242);
                    width: 65px;
                    height: 62px;
                    display: flex;
                    align-items: center;
                  `}
                >
                  <CircularProgressBar
                    scoreMaximum={scoreMaximum}
                    userPoints={userPoints}
                    className="progress"
                  />
                </div>
              )}
            </ExercisePart>
          </a>
        </Link>
      </StyledLink>
    </Wrapper>
  )
}

export default ExerciseBox
