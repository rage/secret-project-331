import { css, cx } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { secondaryFont } from "../../styles"

interface CardOpensTextProps {
  open: boolean | undefined
  date: string | undefined
  time: string | undefined
}

const styledspan = css`
  font-family: ${secondaryFont} !important;
  font-size: 0.9rem;
  opacity: 0.8;
  text-transform: uppercase;
`

const CardOpensText: React.FC<React.PropsWithChildren<CardOpensTextProps>> = ({
  open,
  date,
  time,
}) => {
  const { t } = useTranslation()
  if (date && time) {
    return (
      <>
        <div className={cx(styledspan)}>{t("available")}</div>
        <div>{t("on-date-at-time", { date, time })}</div>
      </>
    )
  } else if (time) {
    return (
      <>
        <div className={cx(styledspan)}>{t("opens-in")}</div>
        <div>{time}</div>
      </>
    )
  } else if (open) {
    return <span className={cx(styledspan)}>{t("opens-now")}</span>
  } else {
    return <span>{t("closed")}</span>
  }
}

export default CardOpensText
