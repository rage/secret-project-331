import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

interface CardOpensTextProps {
  open: boolean | undefined
  date: string | undefined
  time: string | undefined
}

const CardOpensText: React.FC<CardOpensTextProps> = ({ open, date, time }) => {
  const { t } = useTranslation()
  if (date && time) {
    return (
      <>
        <div
          className={css`
            text-transform: uppercase;
          `}
        >
          {t("available")}
        </div>
        <div>{t("on-date-at-time", { date, time })}</div>
      </>
    )
  } else if (time) {
    return (
      <>
        <div
          className={css`
            text-transform: uppercase;
          `}
        >
          {t("opens-in")}
        </div>
        <div>{time}</div>
      </>
    )
  } else if (open) {
    return (
      <span
        className={css`
          text-transform: uppercase;
        `}
      >
        {t("opens-now")}
      </span>
    )
  } else {
    return (
      <span
        className={css`
          text-transform: uppercase;
          color: black !important;
        `}
      >
        {t("closed")}
      </span>
    )
  }
}

export default CardOpensText
