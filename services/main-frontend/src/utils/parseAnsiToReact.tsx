"use client"

import React from "react"

export const parseAnsiToReact = (text: string): React.ReactNode[] => {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[([0-9;]*)m/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match
  let currentStyles: React.CSSProperties = {}

  const colorMap: Record<number, string> = {
    30: "#000000",
    31: "#cc0000",
    32: "#4e9a06",
    33: "#c4a000",
    34: "#3465a4",
    35: "#75507b",
    36: "#06989a",
    37: "#d3d7cf",
    90: "#555753",
    91: "#ef2929",
    92: "#8ae234",
    93: "#fce94f",
    94: "#729fcf",
    95: "#ad7fa8",
    96: "#34e2e2",
    97: "#eeeeec",
  }

  const applyAnsiCode = (code: number) => {
    if (code === 0) {
      currentStyles = {}
    } else if (code === 1) {
      // eslint-disable-next-line i18next/no-literal-string
      currentStyles.fontWeight = "bold"
    } else if (code === 2) {
      currentStyles.opacity = 0.6
    } else if (code === 3) {
      // eslint-disable-next-line i18next/no-literal-string
      currentStyles.fontStyle = "italic"
    } else if (code === 4) {
      // eslint-disable-next-line i18next/no-literal-string
      currentStyles.textDecoration = "underline"
    } else if (code >= 30 && code <= 37) {
      currentStyles.color = colorMap[code]
    } else if (code >= 90 && code <= 97) {
      currentStyles.color = colorMap[code]
    }
  }

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index)
      if (Object.keys(currentStyles).length > 0) {
        parts.push(
          // eslint-disable-next-line react/forbid-dom-props
          <span key={lastIndex} style={{ ...currentStyles }}>
            {textContent}
          </span>,
        )
      } else {
        parts.push(textContent)
      }
    }

    const codes = match[1].split(";").filter((c) => c !== "")
    if (codes.length === 0) {
      currentStyles = {}
    } else {
      codes.forEach((code) => applyAnsiCode(parseInt(code, 10)))
    }

    lastIndex = ansiRegex.lastIndex
  }

  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex)
    if (Object.keys(currentStyles).length > 0) {
      parts.push(
        // eslint-disable-next-line react/forbid-dom-props
        <span key={lastIndex} style={{ ...currentStyles }}>
          {textContent}
        </span>,
      )
    } else {
      parts.push(textContent)
    }
  }

  return parts
}
