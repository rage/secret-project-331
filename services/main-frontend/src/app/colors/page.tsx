"use client"

import { useTranslation } from "react-i18next"

import ColorPalette from "./ColorPalette"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"

const Home: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-color-palette"))
  return (
    <div>
      <ColorPalette />
    </div>
  )
}

export default Home
