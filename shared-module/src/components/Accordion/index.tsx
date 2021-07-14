import { keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { respond } from "../../utils/respond"

import DetailAccordion from "./DetailAccordion"

const openAnimation = keyframes`
0% { opacity: 0; }
100% { opacity: 1; }
`

const slideDown = keyframes`
from { opacity: 0; height: 0; padding: 0;}
to { opacity: 1; height: 100%; padding: 10px;}
`

const TextWrapper = styled.div`
  padding: 0rem 0rem 4rem 0rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-content: center;
  flex: 1;
  @media (max-width: 1000px) {
    width: 90%;
    padding-top: 5rem;
  }

  ${respond.sm`
  padding: 1rem;
  `}

  ${respond.md`
  width: 100%;
  padding: 0 1rem;
`}

details {
    border: 1px solid rgba(0, 0, 0, 0.2);
  }

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
    padding: 1rem 0;
    border-bottom: 1px solid #333;
    position: relative;
    cursor: pointer;
    font-size: 1.25rem;
    font-weight: medium;
    list-style: none;
    outline: 0;
    color: #333;
    font-family: "Josefin Sans", sans-serif;
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
    font-size: 1.75rem;
    line-height: 0;
    margin-top: 0.75rem;
    right: 0;
    font-weight: 200;
    transform-origin: center;
    font-family: none;
    transition: all 200ms linear;
  }
  details[open] summary:after {
    transform: rotate(45deg);
    font-size: 2rem;
  }
  details[open] summary {
    font-weight: 600;
    opacity: 0.9;
  }

  ul {
    padding: 0 0 0 0.6rem;
  }

  details ul li {
    font-size: 1.1rem;
    font-family: "Lato", sans-serif;
    margin: 0 0 0.2rem;
    padding-left: 8px;
    list-style-position: outside;
  }

  ul li::marker {
    content: "☉";
    text-align: center;
    margin-left: 2rem !important;
  }
`
export interface AccordionExtraProps {
  variant: "simple" | "detail"
}

export type AccordionProps = React.DetailsHTMLAttributes<HTMLDetailsElement> & AccordionExtraProps

const Accordion: React.FC<AccordionProps> = (props) => {
  if (props.variant === "detail") {
    return <DetailAccordion {...props}></DetailAccordion>
  }
  return (
    <div>
      <TextWrapper>
        <details>
          <summary>This is a heading:</summary>
          <ul>
            <li>This is a list item</li>
            <li>This is a list item</li>
            <li>This is a list item</li>
            <li>This is a list item</li>
          </ul>
        </details>
        <details>
          <summary>This is a heading:</summary>
          <ul>
            <li>This is a list item</li>
            <li>This is a list item</li>
            <li>This is a list item</li>
            <li>This is a list item</li>
          </ul>
        </details>
        <details>
          <summary>This is a heading:</summary>
          <ul>
            <li>This is a list item</li>
            <li>This is a list item</li>
            <li>This is a list item</li>
            <li>This is a list item</li>
          </ul>
        </details>
      </TextWrapper>
    </div>
  )
}

export default Accordion
