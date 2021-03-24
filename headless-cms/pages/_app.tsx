import '../styles/globals.css'
import '../styles/playground.scss'
// import '../components/GutenbergEditor/styles/styles.scss'
import type { AppProps } from 'next/app'
import { RecoilRoot } from 'recoil'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'

import { ThemeProvider } from '@material-ui/core/styles'
import React from 'react'
import muiTheme from '../utils/muiTheme'
import { CssBaseline } from '@material-ui/core'
import Devtools from '../components/RecoilDevtools'

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

function MyApp({ Component, pageProps }: AppProps) {
  React.useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector('#jss-server-side')
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        <Devtools />
        <ThemeProvider theme={muiTheme}>
          {/* Material UI default CSS */}
          <CssBaseline />
          <Component {...pageProps} />
          <ReactQueryDevtools initialIsOpen={false} />
        </ThemeProvider>
      </RecoilRoot>
    </QueryClientProvider>
  )
}

export default MyApp
