import styled from "@emotion/styled"
import React from "react"

import Next from "../../img/next.svg"

import ReadOnlyBanner from "./ReadOnlyBanner"

const BannerWrapper = styled.div`
  background: rgba(212, 212, 217, 1);
  width: 100%;
  position: relative;
  margin: 0 auto;
  display: block;

  @media (min-width: 600px) {
    max-width: 1984px;
  }

  &:before {
    content: "+";
    color: black;
    position: absolute;
    font-size: 2.4rem;
    line-height: 0;
    margin-top: 0.75rem;
    top: 18px;
    right: 2rem;
    font-weight: 200;
    transform-origin: center;
    transition: all 200ms linear;
    transform: rotate(45deg);

    @media (min-width: 600px) {
      top: 30px;
      right: 4rem;
    }
  }
`

const Content = styled.div`
  padding: 3.5rem 1.4rem 2rem 1.4rem;
  max-width: 1760px;
  font-weight: 500;
  font-size: 1rem;
  line-height: 1.4;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2rem;

  @media (min-width: 600px) {
    padding: 2rem 4rem 2.5rem 4rem;
    grid-template-columns: repeat(12, 1fr);
  }

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
  linkHref?: string
}

export type BannerProps = React.HTMLAttributes<HTMLDivElement> & BannerExtraProps

const Banner: React.FC<BannerProps> = ({ content, variant, linkHref }, props) => {
  if (variant === "readOnly") {
    return <ReadOnlyBanner {...props}>{content}</ReadOnlyBanner>
  }
  return (
      <BannerWrapper {...props}>
        <Content>
          <Text>
            <div>{content}</div>
            {variant === "link" && (
              <a href={linkHref}>
                <div>Click link</div>
                <span>
                  <Next alt="next icon" width="12px" />
                </span>
              </a>
            )}
          </Text>
        </Content>
      </BannerWrapper>
  )
}

export default Banner
