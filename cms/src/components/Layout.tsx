import React, { ReactNode } from "react"
import Link from "next/link"
import Head from "next/head"

type Props = {
  children?: ReactNode
  title?: string
}

const Layout: React.FC<Props> = ({ children, title = "Päätön CMS" }) => (
  <div style={{ margin: "1em" }}>
    <Head>
      <title>{title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <header>
      <nav>
        <Link href="/">
          <a>Home</a>
        </Link>{" "}
        |{" "}
        <Link href="/organizations">
          <a>Organizations</a>
        </Link>{" "}
        |{" "}
        <Link href="/courses">
          <a>Courses</a>
        </Link>{" "}
      </nav>
    </header>
    {children}
    <footer>
      <span>2021 Helsingin yliopisto</span>
    </footer>
  </div>
)

export default Layout
