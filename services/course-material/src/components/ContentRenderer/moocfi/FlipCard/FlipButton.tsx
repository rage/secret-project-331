import { css } from "@emotion/css"
import { ReplayArrowLeftRight } from "@vectopus/atlas-icons-react"
import { t } from "i18next"
import React from "react"

import Button from "@/shared-module/common/components/Button"

const FlipButton: React.FC = () => {
  return (
    <Button variant={"icon"} size={"small"}>
      <div
        className={css`
          position: fixed;
          bottom: 10px;
          right: 10px;
          backface-visibility: hidden;

          & * {
            backface-visibility: hidden;
          }
          border-radius: 10px;
          width: 54px;
          height: 42px;
          background: #f9f9f9;
          box-shadow: 0 4px 0px 0px #c4c4c4;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #57606fcc;
          :hover {
            color: green;
          }
        `}
      >
        <div
          className={css`
            font-size: 9px;
          `}
        >
          {t("button-text-flip")}
        </div>
        <ReplayArrowLeftRight size={16} />
      </div>
    </Button>
  )
}

export default FlipButton
