import { injectGlobal } from "@emotion/css"

injectGlobal`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  @font-face {
    font-family: "Josefin Sans", -apple-system, BlinkMacSystemFont, sans-serif,
    "Segoe UI", Roboto, "Helvetica Neue", Arial, Noto Sans, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    font-size: 18px;
    font-weight: 400;
    line-height: 1.5;
    color: #333;
  }
`
