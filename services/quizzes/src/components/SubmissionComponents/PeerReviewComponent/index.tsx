import { keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import * as React from "react"

import { baseTheme, headingFont } from "../../../shared-module/styles"

import Reviews from "./Reviews"

const openAnimation = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`

const slideDown = keyframes`
  from { opacity: 0; height: 0; padding: 0;}
  to { opacity: 1; height: 100%; padding: 10px;}
`
const PLACEHOLDER_HEADING = "Recieved peer review from other students"

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  details {
    transition: all 0.3s ease-in-out;
  }

  details[open] summary ~ * {
    animation: ${openAnimation} 0.3s ease-in-out;
    color: ${baseTheme.colors.grey[700]};
  }

  details[open] > div {
    animation-name: ${slideDown};
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
    padding: 1rem 1rem 1rem 1rem;
  }

  details summary {
    padding: 1rem;
    position: relative;
    cursor: pointer;
    font-weight: 500;
    font-family: ${headingFont};
    list-style: none;
    color: ${baseTheme.colors.grey[700]};
    outline: 0;
    background: ${baseTheme.colors.clear[100]};
    margin-bottom: 5px;
  }

  details summary::-webkit-details-marker {
    display: none;
  }

  details[open] > summary {
    color: ${baseTheme.colors.grey[700]};
  }

  details summary:after {
    content: "+";
    position: absolute;
    font-size: 2.4rem;
    color: ${baseTheme.colors.grey[700]};
    line-height: 0;
    margin-top: 0.75rem;
    top: 14px;
    right: 4%;
    font-weight: 200;
    transform-origin: center;
    transition: all 200ms linear;
  }
  details[open] summary:after {
    transform: rotate(45deg);
    font-size: 2.4rem;
  }
  details[open] summary {
    opacity: 0.9;
  }
`
const arr = [{ peerReview: 1 }, { peerReview: 2 }, { peerReview: 3 }]

// interface PeerReviewProps {}

const PeerReview: React.FunctionComponent /*<PeerReviewProps>*/ = () => {
  return (
    <Wrapper>
      <details>
        <summary>{PLACEHOLDER_HEADING}</summary>
        {arr?.map((item, index) => (
          <Reviews orderNumber={index} key={index} />
        ))}
      </details>
    </Wrapper>
  )
}

export default PeerReview
