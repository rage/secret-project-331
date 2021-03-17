import '../styles/globals.css'
import '../styles/playground.scss'
import type { AppProps } from 'next/app'
import { RecoilRoot } from 'recoil'

import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles'
import React from 'react'

const muiTheme = createMuiTheme({
  typography: {
    button: {
      textTransform: 'none',
    },
  },
  props: {
    MuiButton: {
      variant: 'outlined',
    },
  },
})

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <RecoilRoot>
      <ThemeProvider theme={muiTheme}>
        <Component {...pageProps} />
      </ThemeProvider>
    </RecoilRoot>
  )
}

export default MyApp
