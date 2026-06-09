"use client"

import { injectGlobal } from "@emotion/css"

// A small global reset for the example. Real exercise services share a richer reset and typography
// setup from the common package (via exercise-plugins); the example keeps it minimal and
// dependency-free so it stays a lean, self-contained template.
injectGlobal`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 16px;
  }
`

const GlobalStyles = () => null

export default GlobalStyles
