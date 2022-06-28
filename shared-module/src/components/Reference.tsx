import { css, keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../styles"

const openAnimation = keyframes`
0% { opacity: 0; }
100% { opacity: 1; }
`

const slideDown = keyframes`
from { opacity: 0; height: 0; padding: 0;}
to { opacity: 1; height: 100%; padding: 10px;}
`
// eslint-disable-next-line i18next/no-literal-string
const TextWrapper = styled.div`
  padding: 0;
  margin: 0;
  margin-top: 4rem;
  background: #f3f3f3;

  details[open] summary ~ * {
    animation: ${openAnimation} 0.3s ease-in-out;
    color: ${baseTheme.colors.grey[700]};
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
    font-family: "Josefin Sans", sans-serif;
    list-style: none;
    outline: 0;
    height: auto;
    color: ${baseTheme.colors.grey[700]};
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
  }

  ul li::marker {
    display: list-item;
    content: "[" counter(ref) "]";
    text-align: center;
    margin-left: 2rem !important;
  }
`

interface Reference {
  id: string
  text: string
}

export interface ReferenceExtraProps {
  data: Reference[]
}

const ELEMENT_ID = "#reference"
const BEHAVIOR = "smooth"

export type ReferenceProps = React.HTMLAttributes<HTMLDivElement> & ReferenceExtraProps

const Reference: React.FC<ReferenceProps> = ({ data }) => {
  const { t } = useTranslation()
  const [reference, setReference] = useState<Reference[]>([])
  const [active, setActive] = useState<string>()

  useEffect(() => {
    const arr: Reference[] = []
    // eslint-disable-next-line i18next/no-literal-string
    const referenceEl = Array.from(document.querySelectorAll<HTMLElement>("#ref"))

    referenceEl.forEach((ref) => {
      const { innerText: text, id } = ref
      arr.push({ id, text })
    })
    setReference(arr)
  }, [])

  useEffect(() => {
    const eventHandler = (evt: MouseEvent) => {
      const target = evt.target as HTMLInputElement
      if (reference) {
        reference.forEach(({ text }) => {
          if (text === target.innerText) {
            evt.preventDefault()
            let elementId = target.innerText
            elementId = elementId.substring(1, elementId.length - 1)
            const details = document.querySelector<HTMLDetailsElement>(ELEMENT_ID)
            // eslint-disable-next-line i18next/no-literal-string
            setActive(`ref-${elementId}`)

            if (details) {
              if (!details.open) {
                details.open = true
              }
            }
            document.querySelector(`#ref-${elementId}`)?.scrollIntoView({
              behavior: BEHAVIOR,
            })
          }
        })
      }
    }

    window.addEventListener("click", eventHandler)
    return () => {
      window.removeEventListener("click", eventHandler)
    }
  }, [reference])

  return (
    <TextWrapper>
      <details id="reference">
        <summary>{t("title-references")}</summary>
        <ul>
          {data.map(({ id, text }) => (
            <li
              key={id}
              id={id}
              className={css`
                ${active === id && `background: #DAE3EB;`}
              `}
            >
              {text}
            </li>
          ))}
        </ul>
      </details>
    </TextWrapper>
  )
}

export default Reference
