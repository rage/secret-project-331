import type { AppProps } from "next/app"
import { RecoilRoot } from "recoil"
import { QueryClient, QueryClientProvider } from "react-query"
import { ReactQueryDevtools } from "react-query/devtools"

import { ThemeProvider } from "@material-ui/core/styles"
import React from "react"
import muiTheme from "../utils/muiTheme"
import { CssBaseline } from "@material-ui/core"
import "@fontsource/montserrat"
import "@fontsource/montserrat/700.css"
import { Global, css } from "@emotion/react"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Set default cache time to almost nothing because caching requests for
      // a long time by default violates the princible of least surprise.
      // Accidentally showing cached data to the user can be undesired
      // for example if the user is supposed to edit the data.
      // If caching is desired, this can be explicitly overriden when using
      // the hooks.
      cacheTime: 10,
      // Same applies here too
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  React.useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector("#jss-server-side")
    if (jssStyles) {
      jssStyles?.parentElement?.removeChild(jssStyles)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        <ThemeProvider theme={muiTheme}>
          {/* Material UI default CSS */}
          <CssBaseline />
          <Global
            styles={css`
              html,
              body {
                margin: 0;
                padding: 0;
                font-family: "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif, "Segoe UI",
                  Roboto, "Helvetica Neue", Arial, Noto Sans, "Apple Color Emoji", "Segoe UI Emoji",
                  "Segoe UI Symbol", "Noto Color Emoji";
              }
            `}
          />
          <Component {...pageProps} />
          <ReactQueryDevtools initialIsOpen={false} />
        </ThemeProvider>
      </RecoilRoot>
    </QueryClientProvider>
  )
}

export default MyApp
