import React, { ReactNode } from "react"
import Link from "next/link"
import Head from "next/head"
import { css } from "@emotion/css"
import { normalWidthCenteredComponentStyles } from "../styles/componentStyles"

type Props = {
  children?: ReactNode
  title?: string
}

const NavStyles = css`
  margin-bottom: 10px;
`

const FooterStyles = css`
  margin-top: 10px;
`

const Layout: React.FC<Props> = ({ children, title = "Päätön CMS" }) => (
  <div style={{ margin: "1em" }}>
    <Head>
      <title>{title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <header>
      <nav className={NavStyles}>
        <Link href="/">Home</Link> | <Link href="/organizations">Organizations</Link> |{" "}
        <Link href="/courses">Courses</Link>{" "}
      </nav>
    </header>
    <div
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {children}
    </div>
    <footer className={FooterStyles}>
      <span>2021 Helsingin yliopisto</span>
    </footer>
  </div>
)

export default Layout
