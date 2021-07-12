import "./app.css"
import type { AppProps } from "next/app"

import React from "react"
import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  return (
    <LoginStateContextProvider>
      <Component {...pageProps} />
    </LoginStateContextProvider>
  )
}

export default MyApp
