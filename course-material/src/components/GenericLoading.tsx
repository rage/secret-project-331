import { Fade } from "@material-ui/core"
import React from "react"

const GenericLoading: React.FC = () => {
  return (
    <Fade
      in={true}
      style={{
        transitionDelay: "800ms",
      }}
      unmountOnExit
    >
      <p>Loading...</p>
    </Fade>
  )
}

export default GenericLoading
