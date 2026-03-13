"use client"

import { css, cx } from "@emotion/css"

import { cardTopBandStyle } from "./CardDeadlineOverlay"
import CardOpensText from "./CardOpensText"

interface CardOpensTextProps {
  open: boolean | undefined
  date: string | undefined
  time: string | undefined
}

const CardOpensTextOverlay: React.FC<React.PropsWithChildren<CardOpensTextProps>> = ({
  open,
  date,
  time,
}) => {
  return (
    <div
      className={css`
        position: relative;
      `}
    >
      {!open && (
        <div
          className={cx(
            cardTopBandStyle,
            css`
              position: absolute;
              width: 100%;
              z-index: 100;
            `,
          )}
        >
          <CardOpensText open={open} date={date} time={time} />
        </div>
      )}
    </div>
  )
}

export default CardOpensTextOverlay
