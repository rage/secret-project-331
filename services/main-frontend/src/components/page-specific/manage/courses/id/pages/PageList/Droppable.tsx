import { useDroppable } from "@dnd-kit/core"
import { css } from "@emotion/css"
import React from "react"

const Droppable: React.FC = (props) => {
  const { isOver, setNodeRef } = useDroppable({
    id: "droppable",
  })
  const style = {
    color: isOver ? "green" : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      // eslint-disable-next-line react/forbid-dom-props
      style={style}
      className={css`
        height: 50px;
        background-color: rebeccapurple;
      `}
    >
      {props.children}
    </div>
  )
}

export default Droppable
