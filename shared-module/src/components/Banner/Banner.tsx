import styled from "@emotion/styled"
import React from "react"

import Next from "../../img/next.svg"

import ReadOnlyBanner from "./ReadOnlyBanner"

const Justify = styled.div`
  display: grid;
  justify-content: center;
`

const BannerWrapper = styled.div`
  background: rgba(212, 212, 217, 1);
  width: 100%;
  max-width: 1984px;
  position: relative;
  padding: 0 2rem;
  margin: 0 auto;
  display: block;

  &:before {
    content: "+";
    color: black;
    position: absolute;
    font-size: 2.4rem;
    line-height: 0;
    margin-top: 0.75rem;
    top: 30px;
    right: 4rem;
    font-weight: 200;
    transform-origin: center;
    font-family: none;
    transition: all 200ms linear;
    transform: rotate(45deg);
  }
`

const Content = styled.div`
  padding: 2rem 4rem 2.5rem 4rem;
  max-width: 1760px;
  font-weight: 500;
  font-size: 1rem;
  line-height: 1.4;
  font-family: "Lato", sans-serif;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 2rem;

  a {
    text-decoration: none;
    max-width: 100%;
    cursor: pointer;
    display: flex;
    height: 1rem;
    line-height: 1rem;
    margin-top: 1rem;

    span {
      display: flex;
      align-items: center;
      margin-left: 0.5rem;
    }
  }
`
const Text = styled.div`
  grid-column: span 8 / auto;
`

export interface BannerExtraProps {
  variant: "text" | "link" | "readOnly"
  content: string
}

export type BannerProps = React.HTMLAttributes<HTMLDivElement> & BannerExtraProps

const Quote: React.FC<BannerProps> = ({ content, variant }, props) => {
  if (variant === "readOnly") {
    return <ReadOnlyBanner {...props}>{content}</ReadOnlyBanner>
  }
  return (
    <Justify>
      <BannerWrapper {...props}>
        <Content>
          <Text>
            <div>{content}</div>
            {variant === "link" && (
              <a>
                <div>Click link</div>
                <span>
                  <Next alt="next icon" width="12px" />
                </span>
              </a>
            )}
          </Text>
        </Content>
      </BannerWrapper>
    </Justify>
  )
}

export default Quote
