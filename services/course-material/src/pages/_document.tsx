import { Head, Html, Main, NextScript } from "next/document"

const OUTDATED_BROWSER_SCRIPT = `alert("Your browser is so old that it won't work with this page. We recommend switching to Firefox.");`

export default function Document() {
  return (
    <Html>
      <Head />
      <body>
        <Main />
        <NextScript />
        <script noModule>{OUTDATED_BROWSER_SCRIPT}</script>
      </body>
    </Html>
  )
}
