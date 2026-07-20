"use client"

import { useTranslation } from "react-i18next"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"

import ColorPalette from "./ColorPalette"

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
