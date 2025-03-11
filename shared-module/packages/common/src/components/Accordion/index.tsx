import { keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { baseTheme } from "../../styles"

import DetailAccordion from "./DetailAccordion"

const openAnimation = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`

const slideDown = keyframes`
  from { opacity: 0; height: 0; padding: 0; }
  to { opacity: 1; height: 100%; padding: 10px; }
`

const TextWrapper = styled.div`
  padding: 0;
  margin: 0;

  details[open] summary ~ * {
    animation: ${openAnimation} 0.3s ease-in-out;
    color: ${baseTheme.colors.gray[700]};
  }

  details[open] > div {
    animation-name: ${slideDown};
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
  }

  details summary {
    padding: 1rem 0;
    border-bottom: 1px solid ${baseTheme.colors.gray[700]};
    position: relative;
    cursor: pointer;
    font-size: 1.25rem;
    font-weight: medium;
    list-style: none;
    outline: 0;
    color: ${baseTheme.colors.gray[700]};
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
    line-height: 1.6;
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

const Accordion: React.FC<React.PropsWithChildren<AccordionProps>> = ({
  variant,
  className,
  children,
  ...rest
}) => {
  if (variant === "detail") {
    return (
      <DetailAccordion className={className} {...rest}>
        {children}
      </DetailAccordion>
    )
  }

  return <TextWrapper className={className}>{children}</TextWrapper>
}

export default Accordion
