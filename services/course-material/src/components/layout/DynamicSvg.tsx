import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"

import { baseTheme } from "@/shared-module/common/styles"

interface DynamicSvgProps {
  src: string // URL of the SVG
}

const DynamicSvg: React.FC<DynamicSvgProps> = ({ src }) => {
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
    return <p>Loading SVG...</p>
  }

  return (
    <div
      className={css`
        path {
          fill: ${baseTheme.colors.gray[500]};
        }

        svg {
          width: 6.5rem;
          height: 6.5rem;
        }
      `}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}

export default DynamicSvg
