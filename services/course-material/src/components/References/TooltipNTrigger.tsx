import { Button, OverlayArrow, Tooltip, TooltipTrigger } from "react-aria-components"

import { Reference } from "."

interface TooltipNTriggerProps {
  reference: Reference
}

const TooltipNTrigger: React.FC<TooltipNTriggerProps> = ({ reference }) => {
  return (
    <TooltipTrigger>
      <sup>
        <a href="ajdfa;lksj">[1]</a>
      </sup>

      <Tooltip id={`tooltip-${reference.id}`}>{reference.text}</Tooltip>
    </TooltipTrigger>
  )
}

export default TooltipNTrigger
