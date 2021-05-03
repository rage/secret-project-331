import { css } from "@emotion/css"
import { Fade } from "@material-ui/core"
import React from "react"

const GenericLoading: React.FC = () => {
  return (
    <Fade
      in={true}
      // @ts-ignore: normal css property, should work
      className={css`
        transition-delay: 800ms;
      `}
      unmountOnExit
    >
      <p>Loading...</p>
    </Fade>
  )
}

export default GenericLoading
