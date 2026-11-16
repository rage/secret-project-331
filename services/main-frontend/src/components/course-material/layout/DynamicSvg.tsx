"use client"

import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

interface DynamicSvgProps {
  src: string // URL of the SVG
  // Accessible name; the SVG's own inner text is hidden. Without it the SVG is decorative.
  label?: string | undefined
}

const DynamicSvg: React.FC<DynamicSvgProps> = ({ src, label }) => {
  const { t } = useTranslation()
  const [svgContent, setSvgContent] = useState<string | null>(null)

  useEffect(() => {
    const fetchSvg = async () => {
      try {
        const response = await fetch(src)
        if (!response.ok) {
          throw new Error(`Failed to fetch SVG: ${response.statusText}`)
        }
        const text = await response.text()
        setSvgContent(text)
      } catch (error) {
        console.error("Error fetching SVG:", error)
      }
    }

    fetchSvg()
  }, [src])

  if (!svgContent) {
    return <p>{t("loading")}</p>
  }

  return (
    <div
      className={css`
        path {
          fill: ${baseTheme.colors.gray[500]};
        }

        svg {
          width: 5rem;
          height: 5rem;
        }
      `}
      // oxlint-disable-next-line i18next/no-literal-string
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}

export default DynamicSvg
