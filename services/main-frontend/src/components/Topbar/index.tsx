/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import React from "react"
import { Separator } from "react-aria-components"

import Brand from "./Brand"
import LanguageMenu from "./LanguageMenu"
import QuickActionsMenu from "./QuickActionsMenu"
import SearchButton from "./SearchButton"
import UserMenu from "./UserMenu"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface TopbarProps {
  children?: React.ReactNode
}

const Topbar: React.FC<TopbarProps> = ({ children }) => {
  return (
    <header
      className={css`
        width: 100%;
        border-bottom: 1px solid #e5e7eb;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: saturate(180%) blur(10px);
      `}
    >
      <div
        className={css`
          margin: 0 auto;
          max-width: 1280px;
          padding-inline: 1rem;
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            height: 56px;
            gap: 8px;
          `}
          aria-label="Top bar"
        >
          <Brand />

          {/* Middle: primary navigation slot (visible on md+) */}
          <nav
            aria-label="Primary"
            className={css`
              margin-inline-start: 8px;
              min-width: 0;
              flex: 1;
              display: none;
              gap: 8px;
              align-items: center;

              ${respondToOrLarger.md} {
                display: flex;
              }
            `}
          >
            {children}
          </nav>

          {/* Right cluster: account THEN quick actions (hamburger is rightmost) */}
          <div
            className={css`
              margin-inline-start: auto;
              display: flex;
              align-items: center;
              gap: 6px;
            `}
          >
            <SearchButton />
            <LanguageMenu />

            <Separator
              orientation="vertical"
              className={css`
                height: 24px;
                background: #e5e7eb;
                margin-inline: 6px;
                display: none;
                ${respondToOrLarger.md} {
                  display: block;
                }
              `}
            />

            <UserMenu />

            <Separator
              orientation="vertical"
              className={css`
                height: 24px;
                background: #e5e7eb;
                margin-inline: 6px;
                display: none;
                ${respondToOrLarger.md} {
                  display: block;
                }
              `}
            />

            <QuickActionsMenu />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Topbar
