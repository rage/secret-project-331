import React, { useEffect, useState } from "react"
import { RecoilLogger } from "recoil-devtools-logger"
import LogMonitor from "recoil-devtools-log-monitor"
import DockMonitor from "recoil-devtools-dock"

const Devtools: React.FC = () => {
  const [render, setRender] = useState(false)

  useEffect(() => {
    setRender(true)
  }, [])

  if (!render) {
    return null
  }

  return (
    <>
      <RecoilLogger />
      <DockMonitor
        toggleVisibilityKey="ctrl-h"
        changePositionKey="ctrl-q"
        changeMonitorKey="ctrl-m"
        defaultIsVisible={false}
      >
        <LogMonitor markStateDiff />
      </DockMonitor>
    </>
  )
}
export default Devtools
