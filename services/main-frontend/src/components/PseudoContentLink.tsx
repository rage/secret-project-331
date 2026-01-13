"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"

import { baseTheme } from "@/shared-module/common/styles"

interface PseudoContentLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  children: React.ReactNode
}

const PseudoContentLink: React.FC<PseudoContentLinkProps> = ({ children, ...linkProps }) => {
  return (
    <Link
      {...linkProps}
      className={css`
        text-decoration: none;
        color: inherit;

        &::after {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 100;
        }

        &:focus-visible {
          outline: 4px solid ${baseTheme.colors.green[500]};
          outline-offset: 2px;
        }

        * {
          position: relative;
          z-index: 101;
        }
      `}
    >
      {children}
    </Link>
  )
}

export default PseudoContentLink
