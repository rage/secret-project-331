import { css } from "@emotion/css"

import CardOpensText from "./CardOpensText"

interface CardOpensTextProps {
  open: boolean | undefined
  date: string | undefined
  time: string | undefined
}

const CardOpensTextOverlay: React.FC<CardOpensTextProps> = ({ open, date, time }) => {
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
            background: #cac9c9;
            padding: 2rem;
            position: absolute;
            width: 100%;
            z-index: 100;

            color: #303030;
            font-size: 1.2em;
            font-weight: 500;
          `}
        >
          <CardOpensText open={open} date={date} time={time} />
        </div>
      )}
    </div>
  )
}

export default CardOpensTextOverlay
