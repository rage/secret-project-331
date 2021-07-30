import { ThemeProvider } from "@material-ui/core/styles"
import type { AppProps } from "next/app"
import React from "react"
import { QueryClient, QueryClientProvider } from "react-query"
import { ReactQueryDevtools } from "react-query/devtools"
import { RecoilRoot } from "recoil"

import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import muiTheme from "../shared-module/utils/muiTheme"

import "../styles/Gutenberg/style.scss"

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
        const statusCode: number | undefined = (error as any)?.response?.status
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
      jssStyles.parentElement?.removeChild(jssStyles)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        {/* <Devtools /> */}
        <ThemeProvider theme={muiTheme}>
          <GlobalStyles />
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
