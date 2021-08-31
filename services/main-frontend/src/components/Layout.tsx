import { css } from "@emotion/css"
import Head from "next/head"
import React, { ReactNode } from "react"

import Footer from "../shared-module/components/Footer"
import Navbar from "../shared-module/components/Navigation"

type LayoutProps = {
  children: ReactNode
  frontPageUrl: string
  navVariant: "simple" | "complex"
  faqUrl?: string
  title?: string
  licenseUrl?: string
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  navVariant,
  frontPageUrl,
  faqUrl,
  licenseUrl,
}) => (
  <>
    <Head>
      <title>{title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <div
      // Push footer to bottom of page, e.g. on empty body
      className={css`
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 100vh;
      `}
    >
      <header>
        <Navbar faqUrl={faqUrl} frontPageUrl={frontPageUrl} variant={navVariant}></Navbar>
      </header>
      {/* Do not touch flex */}
      <main
        className={css`
          flex: 1;
        `}
      >
        {children}
      </main>
      <Footer licenseUrl={licenseUrl} />
    </div>
  </>
)

export default Layout
