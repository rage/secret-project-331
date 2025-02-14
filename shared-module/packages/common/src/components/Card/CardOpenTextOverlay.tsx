import { css } from "@emotion/css"

import { respondToOrLarger } from "../../styles/respond"

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
          className={css`
            flex: 0 1 auto;
            text-align: center;
            background: #e2e4e6;
            padding: 1rem 2rem;
            position: absolute;
            width: 100%;
            z-index: 100;

            color: #303030;
            font-size: 0.8em;
            font-weight: 500;

            ${respondToOrLarger.md} {
              font-size: 1em;
              padding: 1.5rem;
            }
          `}
        >
          <CardOpensText open={open} date={date} time={time} />
        </div>
      )}
    </div>
  )
}

export default CardOpensTextOverlay
