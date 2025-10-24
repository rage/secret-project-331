/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { Button as AriaButton, Dialog, Modal, ModalOverlay, TextField } from "react-aria-components"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const iconBtn = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: background 120ms ease;

  &:hover,
  &[data-hovered] {
    background: #f3f4f6;
  }
  &[data-pressed] {
    background: #e5e7eb;
  }
  &[data-focus-visible] {
    box-shadow: 0 0 0 2px #111827;
  }

  /* hide on small screens, show at md+ */
  display: none;
  ${respondToOrLarger.md} {
    display: inline-flex;
  }
`

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden focusable="false">
    <path
      d="M21 21l-4.2-4.2m1.7-5.3a7 7 0 11-14 0 7 7 0 0114 0z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const SearchButton: React.FC = () => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <AriaButton aria-label="Open search" className={iconBtn} onPress={() => setOpen(true)}>
        <SearchIcon />
      </AriaButton>

      {/* Lightweight command palette modal (optional) */}
      <ModalOverlay
        isOpen={open}
        onOpenChange={setOpen}
        className={css`
          position: fixed;
          inset: 0;
          background: rgba(17, 24, 39, 0.4);
          display: grid;
          place-items: start center;
          padding-top: 10vh;
          z-index: 1000;

          &[data-exiting],
          &[data-entering] {
            transition: opacity 120ms ease;
          }
        `}
      >
        <Modal
          className={css`
            width: min(720px, 92vw);
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
            padding: 16px;
          `}
        >
          <Dialog
            aria-label="Search"
            className={css`
              display: grid;
              gap: 12px;
            `}
          >
            <TextField
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false)
                }
                if (e.key === "Enter") {
                  const target = e.target as HTMLInputElement
                  const q = target?.value?.trim()
                  if (q) {
                    window.location.href = `/search?q=${encodeURIComponent(q)}`
                  }
                }
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className={css`
                position: relative;
                display: flex;
                align-items: center;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                padding: 10px 12px;
                gap: 8px;

                &:focus-within {
                  box-shadow: 0 0 0 2px #111827;
                }

                input {
                  border: none;
                  outline: none;
                  width: 100%;
                  font-size: 14px;
                }
              `}
            >
              <SearchIcon />
              <input placeholder="Search…" />
            </TextField>
            <div
              className={css`
                font-size: 12px;
                color: #6b7280;
              `}
            >
              Press Enter to search • Esc to close
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  )
}

export default SearchButton
