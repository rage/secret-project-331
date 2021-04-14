import "./app.css"
import type { AppProps } from "next/app"

import React from "react"

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  return <Component {...pageProps} />
}

export default MyApp
