import { css, keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import { sortBy } from "lodash"
import React, { ReactPortal, useLayoutEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import TooltipNTrigger from "@/components/TooltipNTrigger"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"

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
  background: ${baseTheme.colors.clear[100]};

  details[open] summary ~ * {
    animation: ${openAnimation} 0.3s ease-in-out;
    color: ${baseTheme.colors.gray[700]};
  }

  details {
    border-left: 4px solid ${baseTheme.colors.blue[300]};
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
    font-family: ${primaryFont};
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
    color: ${baseTheme.colors.gray[700]};
  }

  details summary:after {
    content: "+";
    color: ${baseTheme.colors.blue[400]};
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

  ol {
    padding: 0 4.5rem 3rem 4.5rem;
    counter-reset: ref;
  }

  details ol li {
    counter-increment: ref;
    font-size: 1.2rem;
    line-height: 1.6;
    margin: 1rem 0 1rem 0.2rem;
    padding-left: 8px;
    list-style-position: outside;
    overflow-wrap: break-word;
  }

  ol li::marker {
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

  let [portals, citeOrder]: [ReactPortal[] | null, string[] | null] = useMemo(() => {
    if (!readyForPortal) {
      return [null, null]
    }
    const citeOrder: string[] = []
    const portals = Array.from(document.querySelectorAll<HTMLElement>("[data-citation-id]"))
      .map((node, idx) => {
        const reference = data.find((o) => o.id === node.dataset.citationId)

        if (!reference) {
          return null
        }

        let citeNumber: number = 0
        if (reference && !citeOrder.includes(reference.id)) {
          citeOrder.push(reference.id)
          citeNumber = citeOrder.length
        } else if (reference && citeOrder.includes(reference.id)) {
          citeNumber = citeOrder.indexOf(reference.id) + 1
        }
        return createPortal(
          <TooltipNTrigger
            variant="references"
            href={"#ref-" + citeNumber}
            tooltipContent={reference.text}
          >
            [{citeNumber}]
          </TooltipNTrigger>,
          node,
          idx,
        )
      })
      .filter((o) => !!o)
    return [portals, citeOrder]
  }, [data, readyForPortal])

  let sortedReferenceList = useMemo(() => {
    if (!citeOrder) {
      return []
    }
    return sortBy(data, (item) => {
      return citeOrder.indexOf(item.id)
    })
  }, [citeOrder, data])
  return (
    <TextWrapper>
      <details>
        <summary>{t("title-references")}</summary>
        <ol>
          {sortedReferenceList.map(({ id, text }, index) => {
            return (
              <li
                key={id}
                id={`ref-${index + 1}`}
                className={css`
                  ${active === `ref-${index + 1}` && `background: ${baseTheme.colors.blue[100]};`}
                `}
              >
                {text}
              </li>
            )
          })}
        </ol>
      </details>
      {portals}
    </TextWrapper>
  )
}

export default ReferenceComponent
