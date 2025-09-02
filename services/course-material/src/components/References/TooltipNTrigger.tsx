import { TooltipTrigger } from "react-aria-components"

import { Reference } from "."

interface TooltipNTriggerProps {
  reference: Reference
}

const TooltipNTrigger: React.FC<TooltipNTriggerProps> = ({ reference }) => {
  return (
    <TooltipTrigger>
      <span>[1]</span>
      <Tooltip>
    </Tooltip>
  )
}

export default TooltipNTrigger
