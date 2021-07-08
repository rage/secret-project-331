import React, { useContext } from "react"

import PageContext from "../../contexts/PageContext"
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import GenericLoading from "../GenericLoading"

import NextPage from "./NextPage"

const NavigationContainer: React.FC = () => {
  const currentPageId = useContext(PageContext)?.id

  if (currentPageId) {
    return (
      <div className={normalWidthCenteredComponentStyles}>
        <NextPage currentPageId={currentPageId} />
      </div>
    )
  }

  return <GenericLoading />
}

export default NavigationContainer
