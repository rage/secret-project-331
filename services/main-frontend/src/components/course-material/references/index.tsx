"use client"

import { css, keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import { sortBy } from "lodash"
import React, { ReactPortal, useEffect, useLayoutEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import TooltipNTrigger from "@/components/course-material/TooltipNTrigger"
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

export function formatCitationText(
  citeNumber: number,
  prenote: string | undefined,
  postnote: string | undefined,
): string {
  const citationBrackets = `[${citeNumber}${postnote ? `, ${postnote}` : ""}]`
  return prenote ? `${prenote} ${citationBrackets}` : citationBrackets
}

const ReferenceComponent: React.FC<ReferenceProps> = ({ data }) => {
  const { t } = useTranslation()
  const [active] = useState<string>()
  const [readyForPortal, setReadyForPortal] = useState(false)
  // Bumped whenever citation markers are added/removed from the DOM so the
  // portal scan re-runs. Needed because markers can mount lazily, e.g. when an
  // expandable content block is opened after the initial scan.
  const [scanVersion, setScanVersion] = useState(0)
  useLayoutEffect(() => {
    setReadyForPortal(true)
  }, [])

  // Re-scan when the citation markers change in the page content. We compare a signature of the
  // marker sequence and their relevant attributes (not just the count), so replacements, reordering
  // and prenote/postnote edits also re-trigger the scan, while the DOM changes caused by rendering
  // the portals themselves don't.
  useEffect(() => {
    const container = document.getElementById("content")
    if (!container) {
      return
    }
    const getCitationSignature = () => {
      let signature = ""
      container.querySelectorAll<HTMLElement>("[data-citation-id]").forEach((node) => {
        const id = node.dataset.citationId ?? ""
        const prenote = node.dataset.citationPrenote ?? ""
        const postnote = node.dataset.citationPostnote ?? ""
        // Length-prefix each field so arbitrary note text can't forge a field/record boundary.
        signature += `${id.length}:${id}${prenote.length}:${prenote}${postnote.length}:${postnote};`
      })
      return signature
    }
    let lastSignature = getCitationSignature()
    let scheduled = 0
    const check = () => {
      scheduled = 0
      const signature = getCitationSignature()
      if (signature !== lastSignature) {
        lastSignature = signature
        setScanVersion((prev) => prev + 1)
      }
    }
    const observer = new MutationObserver(() => {
      // Coalesce bursts of mutations (lazy-mounting blocks, animations, typing) into one scan per
      // frame instead of re-scanning the whole subtree on every individual mutation.
      if (scheduled === 0) {
        scheduled = requestAnimationFrame(check)
      }
    })
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      // eslint-disable-next-line i18next/no-literal-string -- DOM attribute names, not user-facing text
      attributeFilter: ["data-citation-id", "data-citation-prenote", "data-citation-postnote"],
    })
    return () => {
      observer.disconnect()
      if (scheduled !== 0) {
        cancelAnimationFrame(scheduled)
      }
    }
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

        const citationContent = formatCitationText(
          citeNumber,
          node.dataset.citationPrenote,
          node.dataset.citationPostnote,
        )
        return createPortal(
          <TooltipNTrigger
            variant="references"
            href={"#ref-" + citeNumber}
            tooltipContent={reference.text}
          >
            {citationContent}
          </TooltipNTrigger>,
          node,
          idx,
        )
      })
      .filter((o) => !!o)
    return [portals, citeOrder]
  }, [data, readyForPortal, scanVersion])

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
