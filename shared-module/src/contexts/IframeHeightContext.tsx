import React from "react"

interface IframeHeightContextProps {
  height: number
}

const IframeHeightContext = React.createContext<IframeHeightContextProps>({ height: 0 })

export default IframeHeightContext
