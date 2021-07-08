import React, { useEffect, useState } from "react"
import DockMonitor from "recoil-devtools-dock"
import LogMonitor from "recoil-devtools-log-monitor"
import { RecoilLogger } from "recoil-devtools-logger"

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
