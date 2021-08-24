import { css } from "@emotion/css"
import Head from "next/head"
import React, { ReactNode } from "react"

import Footer from "../shared-module/components/Footer"
import SimpleNav from "../shared-module/components/Navigation"

import ScrollIndicator from "./ScrollIndicator"

type LayoutProps = {
  children: ReactNode
  frontPageUrl: string
  faqUrl: string
  title?: string
  licenseUrl?: string
}

const Layout: React.FC<LayoutProps> = ({ children, title, frontPageUrl, faqUrl, licenseUrl }) => (
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
        <ScrollIndicator />
        <SimpleNav faqUrl={faqUrl} frontPageUrl={frontPageUrl} variant="simple"></SimpleNav>
      </header>
      {/* Do not touch flex */}
      <div
        className={css`
          flex: 1;
        `}
      >
        {children}
      </div>
      <Footer licenseUrl={licenseUrl} />
    </div>
  </>
)

export default Layout
