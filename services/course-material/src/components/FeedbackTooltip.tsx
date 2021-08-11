import { css } from "@emotion/css"

interface Props {
  selection: string
}

const FeedbackTooltip: React.FC<Props> = ({ selection: _ }) => {
  return (
    <button
      className={css`
        position: absolute;
        overflow: hidden;
        width: 140px;
        height: 40px;
        user-select: none;
      `}
    >
      Give feedback
    </button>
  )
}

export default FeedbackTooltip
