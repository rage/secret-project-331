import { css } from "@emotion/css"
import { Global } from "@emotion/react"
import { CssBaseline } from "@material-ui/core"
import { ThemeProvider } from "@material-ui/core/styles"
import type { AppProps } from "next/app"
import React from "react"
import { QueryClient, QueryClientProvider } from "react-query"
import { ReactQueryDevtools } from "react-query/devtools"
import { RecoilRoot } from "recoil"

import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"
import muiTheme from "../utils/muiTheme"

import "@fontsource/montserrat"
import "@fontsource/montserrat/700.css"

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
      retry: (failureCount, error) => {
        // Don't want to retry any client errors (4XX) -- it just gives the impression of slowness.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusCode: number | undefined = (error as any)?.status
        if (statusCode && Math.floor(statusCode / 100) === 4) {
          return false
        }
        return failureCount < 3
      },
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
              html {
                box-sizing: border-box;
              }

              *,
              *::before,
              *::after {
                box-sizing: inherit;
              }

              html,
              body {
                margin: 0;
                padding: 0;
                font-family: "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif, "Segoe UI",
                  Roboto, "Helvetica Neue", Arial, Noto Sans, "Apple Color Emoji", "Segoe UI Emoji",
                  "Segoe UI Symbol", "Noto Color Emoji";
                font-size: 1rem;
                font-weight: 400;
                line-height: 1.5;
                color: #212529;
                background-color: #fff;
                -webkit-text-size-adjust: 100%;
                -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
              }

              h6,
              h5,
              h4,
              h3,
              h2,
              h1 {
                margin-top: 0;
                margin-bottom: 0.5rem;
                font-weight: 500;
                line-height: 1.2;
              }

              h1 {
                font-size: calc(1.375rem + 1.5vw);
              }

              @media (min-width: 1200px) {
                h1 {
                  font-size: 2.5rem;
                }
              }

              h2 {
                font-size: calc(1.325rem + 0.9vw);
              }

              @media (min-width: 1200px) {
                h2 {
                  font-size: 2rem;
                }
              }

              h3 {
                font-size: calc(1.3rem + 0.6vw);
              }

              @media (min-width: 1200px) {
                h3 {
                  font-size: 1.75rem;
                }
              }

              h4 {
                font-size: calc(1.275rem + 0.3vw);
              }

              @media (min-width: 1200px) {
                h4 {
                  font-size: 1.5rem;
                }
              }

              h5 {
                font-size: 1.25rem;
              }

              h6 {
                font-size: 1rem;
              }

              p {
                margin-top: 0;
                margin-bottom: 1rem;
              }
            `}
          />
          <LoginStateContextProvider>
            <Component {...pageProps} />
          </LoginStateContextProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </ThemeProvider>
      </RecoilRoot>
    </QueryClientProvider>
  )
}

export default MyApp
