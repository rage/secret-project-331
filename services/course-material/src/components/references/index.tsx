import { css, keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import React, { ReactPortal, useLayoutEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import TooltipNTrigger from "./TooltipNTrigger"

import { baseTheme } from "@/shared-module/common/styles"

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
  margin-top: 4rem;
  background: rgb(242, 245, 247);

  details[open] summary ~ * {
    animation: ${openAnimation} 0.3s ease-in-out;
    color: ${baseTheme.colors.gray[700]};
  }

  details {
    border-left: 4px solid #90abc3;
  }

  details[open] > div {
    animation-name: ${slideDown};
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
  }

  details summary {
    padding: 1.4rem 1rem 1.4rem 3.5rem;
    position: relative;
    cursor: pointer;
    font-size: 1.8rem;
    font-weight: 400;
    font-family: "Inter", sans-serif;
    list-style: none;
    outline: 0;
    height: auto;
    color: ${baseTheme.colors.gray[700]};
    justify-content: center;
  }

  details summary::-webkit-details-marker {
    display: none;
  }

  details[open] > summary {
    color: #1c1c1c;
  }

  details summary:after {
    content: "+";
    color: #6b8faf;
    position: absolute;
    font-size: 3rem;
    line-height: 0.3;
    margin-top: 0.75rem;
    left: 20px;
    font-weight: 200;
    transform-origin: center;
    transition: all 200ms linear;
  }
  details[open] summary:after {
    transform: rotate(45deg);
    font-size: 3rem;
  }

  ul {
    padding: 0 4.5rem 3rem 4.5rem;
    counter-reset: ref;
  }

  details ul li {
    counter-increment: ref;
    font-size: 1.2rem;
    line-height: 1.6;
    margin: 1rem 0 1rem 0.2rem;
    padding-left: 8px;
    list-style-position: outside;
    overflow-wrap: break-word;
    overflow-wrap: break-word;
  }

  ul li::marker {
    display: list-item;
    content: "[" counter(ref) "]";
    text-align: center;
    margin-left: 2rem !important;
  }
`

export interface Reference {
  id: string
  text: string
}

export interface ReferenceProps {
  data: Reference[]
}

const ReferenceComponent: React.FC<ReferenceProps> = ({ data }) => {
  const { t } = useTranslation()
  const [active] = useState<string>()
  const [readyForPortal, setReadyForPortal] = useState(false)
  useLayoutEffect(() => {
    setReadyForPortal(true)
  }, [])

  let portals: ReactPortal[] | null = useMemo(() => {
    if (!readyForPortal) {
      return null
    }
    return Array.from(document.querySelectorAll<HTMLElement>("[data-citation-id]")).map(
      (node, idx) => {
        const reference = data.find((o) => {
          return o.id === node.dataset.citationId
        })
        return createPortal(<TooltipNTrigger reference={reference} />, node, idx)
      },
    )
  }, [data, readyForPortal])

  return (
    <TextWrapper>
      <details id="reference">
        <summary>{t("title-references")}</summary>
        <ul>
          {data.map(({ id, text }, index) => {
            return (
              <li
                key={id}
                id={`ref-${index + 1}`}
                className={css`
                  ${active === `ref-${index + 1}` && `background: #DAE3EB;`}
                `}
              >
                {text}
              </li>
            )
          })}
        </ul>
      </details>
      {portals}
    </TextWrapper>
  )
}

export default ReferenceComponent
