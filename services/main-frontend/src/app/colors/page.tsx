"use client"

import ColorPalette from "./ColorPalette"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"

const Home: React.FC = () => {
  // eslint-disable-next-line i18next/no-literal-string
  usePageTitle("Colors")
  return (
    <div>
      <ColorPalette />
    </div>
  )
}

export default Home
