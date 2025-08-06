import { css } from "@emotion/css"
import React from "react"
import { Dialog, OverlayArrow, Popover, PopoverProps } from "react-aria-components"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface MyPopoverProps extends Omit<PopoverProps, "children"> {
  children: React.ReactNode
  popoverLabel: string
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
  display: flex;
  width: 66vw;
  ${respondToOrLarger.sm} {
    width: 330px;
  }
  flex-flow: column nowrap;
  position: relative;
  background: ${COLORS.bg};
  color: ${COLORS.text};
  padding: 1rem 1.5rem;
  border-radius: ${BORDER_RADIUS};
  border: ${BORDER_WIDTH} solid ${COLORS.border};
  box-shadow: 0 3px 15px 0px ${COLORS.shadow};
  margin-bottom: ${POINTER_SIZE};
  transition: filter 0.3s;

  transition:
    transform 200ms,
    opacity 200ms;

  .react-aria-OverlayArrow svg {
    display: block;
    fill: ${COLORS.bg};
    stroke: ${COLORS.border};
    stroke-width: ${BORDER_WIDTH};
  }

  &[data-entering],
  &[data-exiting] {
    transform: var(--origin);
    opacity: 0;
  }

  &[data-placement="top"] {
    --origin: translateY(8px);

    &:has(.react-aria-OverlayArrow) {
      margin-bottom: 6px;
    }
  }

  &[data-placement="bottom"] {
    --origin: translateY(-8px);

    &:has(.react-aria-OverlayArrow) {
      margin-top: 6px;
    }

    .react-aria-OverlayArrow svg {
      transform: rotate(180deg);
    }
  }

  &[data-placement="right"] {
    --origin: translateX(-8px);

    &:has(.react-aria-OverlayArrow) {
      margin-left: 6px;
    }

    .react-aria-OverlayArrow svg {
      transform: rotate(90deg);
    }
  }

  &[data-placement="left"] {
    --origin: translateX(8px);

    &:has(.react-aria-OverlayArrow) {
      margin-right: 6px;
    }

    .react-aria-OverlayArrow svg {
      transform: rotate(-90deg);
    }
  }
`

const MyPopover = ({ children, popoverLabel, ...props }: MyPopoverProps) => {
  return (
    <Popover className={popoverStyle} {...props}>
      <OverlayArrow>
        <svg width={19} height={19} viewBox="0 1 19 19">
          <path d="M0 0 L9.5 10 L19 0" />
        </svg>
      </OverlayArrow>
      <Dialog aria-label={popoverLabel}>{children}</Dialog>
    </Popover>
  )
}

export default React.memo(MyPopover)
