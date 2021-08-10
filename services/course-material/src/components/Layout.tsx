import { css } from "@emotion/css"
import Head from "next/head"
import React, { ReactNode } from "react"

import Footer from "../shared-module/components/Footer"
import SimpleNav from "../shared-module/components/Navigation"

type Props = {
  children?: ReactNode
  title?: string
}

const Layout: React.FC<Props> = ({ children, title = "Course Material" }) => (
  <div
    className={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 100vh;
    `}
  >
    <Head>
      <title>{title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <header>
      <SimpleNav variant="simple"></SimpleNav>
    </header>
    <div>{children}</div>
    <Footer url="www.google.com" />
  </div>
)

export default Layout
