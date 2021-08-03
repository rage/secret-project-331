import { css } from "@emotion/css"
import Head from "next/head"
import React, { ReactNode } from "react"

type Props = {
  children?: ReactNode
  title?: string
}

const Layout: React.FC<Props> = ({ children, title = "Päätön CMS" }) => (
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
      <nav
        className={css`
          padding: 1rem;
        `}
      >
        <a href="/">Home</a>
      </nav>
    </header>
    <div>{children}</div>
    <footer
      className={css`
        margin-top: auto;
        background-color: #f1f1f1;
        height: 10rem;
      `}
    ></footer>
  </div>
)

export default Layout
