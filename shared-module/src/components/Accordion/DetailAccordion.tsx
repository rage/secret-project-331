import { css, cx, keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { respondToOrLarger } from "../../styles/respond"

const openAnimation = keyframes`
0% { opacity: 0; }
100% { opacity: 1; }
`

const slideDown = keyframes`
from { opacity: 0; height: 0; padding: 0;}
to { opacity: 1; height: 100%; padding: 10px;}
`

const TextWrapper = styled.div`
  padding: 0;
  margin: 0;

  details[open] summary ~ * {
    animation: ${openAnimation} 0.3s ease-in-out;
    color: #333;
  }

  details[open] > div {
    animation-name: ${slideDown};
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
  }

  details summary {
    padding: 1rem;
    position: relative;
    cursor: pointer;
    font-size: 1.3rem;
    font-weight: medium;
    list-style: none;
    color: #333;
    outline: 0;
    background: rgba(0, 0, 0, 0.1);
    ${respondToOrLarger.sm} {
      padding: 1rem 1rem 1rem 2rem;
    }
  }

  details summary::-webkit-details-marker {
    display: none;
  }

  details[open] > summary {
    color: #1c1c1c;
  }

  details summary:after {
    content: "+";
    color: black;
    position: absolute;
    font-size: 2.4rem;
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
    font-weight: 600;
    opacity: 0.9;
  }

  ul {
    padding: 14px;
    margin: 0;

    ${respondToOrLarger.sm} {
      background: #f9f9f9;
      padding: 25px 35px 30px 35px;
    }
  }

  ul li {
    font-size: 1.1rem;
    margin: 0 0 0.2rem;
    line-height: 1.7;
    list-style: none;
  }
`
const border = css`
  border: 1px solid rgba(0, 0, 0, 0.2);
`

export type AccordionProps = React.DetailsHTMLAttributes<HTMLDetailsElement>

const DetailAccordion: React.FC<AccordionProps> = () => {
  return (
    <div>
      <TextWrapper>
        <details className={cx(border)}>
          <summary>This is a heading:</summary>
          <ul>
            <li>
              Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum
              has been the industrys standard dummy text ever since the 1500s, when an unknown
              printer took a galley of type and scrambled it to make a type specimen book. It has
              survived not only five centuries, but also the leap into electronic typesetting,
              remaining essentially unchanged. It was popularised in the 1960s with the release of
              Letraset sheets containing Lorem Ipsum passages, and more recently with desktop
              publishing software like Aldus PageMaker including versions of Lorem Ipsum
            </li>
          </ul>
        </details>
      </TextWrapper>
    </div>
  )
}

export default DetailAccordion
