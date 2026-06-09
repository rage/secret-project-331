"use client"

import { injectGlobal } from "@emotion/css"

// A small global reset shared by exercise services. Real services may layer a richer reset and
// typography setup on top; this keeps the baseline minimal and dependency-free.
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
