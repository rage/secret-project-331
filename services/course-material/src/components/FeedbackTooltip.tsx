import { css } from "@emotion/css"

interface FeedbackProps {
  show: boolean
  selectionRect: DOMRect | null
  onClick: () => void
}

const FeedbackTooltip: React.FC<FeedbackProps> = ({ onClick, show, selectionRect }) => {
  if (selectionRect === null) {
    return <></>
  }

  const x = window.scrollX + selectionRect.x
  const y = Math.max(35, window.scrollY + selectionRect.y - 40)
  return (
    <button
      hidden={!show}
      onClick={onClick}
      className={css`
        position: absolute;
        top: ${y}px;
        left: ${x}px;
      `}
    >
      Give feedback
    </button>
  )
}

export default FeedbackTooltip
