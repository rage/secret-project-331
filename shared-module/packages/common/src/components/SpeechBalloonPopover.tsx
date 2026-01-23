"use client"

import { css } from "@emotion/css"
import React, { Ref } from "react"
import { Dialog, OverlayArrow, Popover, PopoverProps } from "react-aria-components"

import { baseTheme } from "../styles"
import { respondToOrLarger } from "../styles/respond"

interface SpeechBalloonPopoverProps extends Omit<PopoverProps, "children"> {
  children: React.ReactNode
  popoverLabel: string
  offset?: number
  popoverRef?: Ref<HTMLElement>
}

const COLORS = {
  bg: "#ffffff",
  border: baseTheme.colors.green[400],
  text: baseTheme.colors.gray[700],
  shadow: "rgba(0, 0, 0, 0.4)",
}

// modified from SpeechBalloon
const BORDER_RADIUS = "8px"
const BORDER_WIDTH = "2px"
const POINTER_SIZE = "12px"

const popoverStyle = css`
  transition:
    transform 300ms,
    opacity 300ms;

  &[data-entering],
  &[data-exiting] {
    transform: var(--origin);
    opacity: 0;
  }

  &[data-placement="top"] {
    flex-flow: column nowrap;
    --origin: translateY(8px);
    & > * {
      margin-bottom: ${POINTER_SIZE};
    }
  }

  &[data-placement="bottom"] {
    flex-flow: column-reverse nowrap;
    --origin: translateY(-8px);
    .react-aria-OverlayArrow svg {
      transform: scaleY(-1);
    }
    & > * {
      margin-top: ${POINTER_SIZE};
    }
  }

  &[data-placement="right"] {
    --origin: translateX(-8px);
    .react-aria-OverlayArrow svg {
      transform: rotate(90deg);
    }
  }

  &[data-placement="left"] {
    --origin: translateX(8px);
    .react-aria-OverlayArrow svg {
      transform: rotate(-90deg);
    }
  }
`

const speechBalloonStyle = css`
  display: flex;
  width: 66vw;
  ${respondToOrLarger.xs} {
    width: 330px;
  }
  flex-flow: inherit;
  gap: 0.5em;
  position: relative;
  background: ${COLORS.bg};
  color: ${COLORS.text};
  padding: 1rem 1.5rem;
  border-radius: ${BORDER_RADIUS};
  border: ${BORDER_WIDTH} solid ${COLORS.border};
  box-shadow: 0 3px 15px 0px ${COLORS.shadow};

  .react-aria-OverlayArrow svg {
    display: flex;
    fill: ${COLORS.bg};
    stroke: ${COLORS.border};
    stroke-width: ${BORDER_WIDTH};
  }
`

const SpeechBalloonPopover = ({
  children,
  popoverLabel,
  offset = 0,
  popoverRef,
  ...props
}: SpeechBalloonPopoverProps) => {
  return (
    <Popover offset={offset} className={popoverStyle} {...props}>
      <Dialog ref={popoverRef} aria-label={popoverLabel} className={speechBalloonStyle}>
        {children}
        <OverlayArrow>
          <svg width={19} height={19} viewBox="2 1 19 19">
            <path d="M0 0 L9.5 10 L19 0" />
          </svg>
        </OverlayArrow>
      </Dialog>
    </Popover>
  )
}

export default SpeechBalloonPopover
