import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { secondaryFont } from "../../styles"

interface CardOpensTextProps {
  open: boolean | undefined
  date: string | undefined
  time: string | undefined
}

// eslint-disable-next-line i18next/no-literal-string
const StyledSpan = styled.span`
  font-family: ${secondaryFont} !important;
  font-size: 0.9rem;
  opacity: 0.8;
  text-transform: uppercase;
`

const CardOpensText: React.FC<CardOpensTextProps> = ({ open, date, time }) => {
  const { t } = useTranslation()
  if (date && time) {
    return (
      <>
        <div
          className={css`
            text-transform: uppercase;
            font-family: ${secondaryFont} !important;
            font-size: 0.9rem;
            opacity: 0.8;
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
            font-family: ${secondaryFont} !important;
            font-size: 0.9rem;
            opacity: 0.8;
            text-transform: uppercase;
          `}
        >
          {t("opens-in")}
        </div>
        <div>{time}</div>
      </>
    )
  } else if (open) {
    return <StyledSpan>{t("opens-now")}</StyledSpan>
  } else {
    return <StyledSpan>{t("closed")}</StyledSpan>
  }
}

export default CardOpensText
