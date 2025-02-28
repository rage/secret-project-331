import { css, cx } from "@emotion/css"

import { headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const highlightItemStyle = css`
  align-items: center;
  display: flex;
  flex: 1;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: middle;
  padding: 0 0.5rem;
  text-align: center;
`

const highlightItemLeftBorder = css`
  border-left: 2px solid #e4eaee;
`

interface HighlightItemProps {
  highlightColor: string
  highlightDescription: string
  highlightText: string | number
  leftBorder?: boolean
}

const HighlightItem: React.FC<React.PropsWithChildren<HighlightItemProps>> = ({
  highlightColor,
  highlightDescription,
  highlightText,
  leftBorder,
}) => {
  const wrapperClassName = leftBorder
    ? cx(highlightItemStyle, highlightItemLeftBorder)
    : highlightItemStyle
  return (
    <div className={wrapperClassName}>
      <div
        className={css`
          font-family: ${headingFont};
          background: ${highlightColor};
          flex: 2;
          font-size: 2.5em;
          font-weight: bold;
          text-align: center;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        `}
      >
        {highlightText}
      </div>
      <div
        className={css`
          display: flex;
          line-height: 1.3;
          font-size: 15px;
          font-weight: 500;
          flex: 1 0 auto;
          font-family: ${headingFont};
          justify-content: middle;
          text-align: center;
          opacity: 0.8;

          ${respondToOrLarger.md} {
            font-size: 18px;
          }
        `}
      >
        {highlightDescription}
      </div>
    </div>
  )
}

export default HighlightItem
