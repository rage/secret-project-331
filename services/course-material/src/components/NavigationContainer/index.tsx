import React from "react"
import { useContext } from "react"
import PageContext from "../../contexts/PageContext"
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import GenericLoading from "../GenericLoading"
import NextPage from "./Nextpage"
import PreviousPage from "./PreviousPage"

const NavigationContainer: React.FC = () => {
  const currentPageId = useContext(PageContext)?.id

  if (currentPageId) {
    return (
      <div className={normalWidthCenteredComponentStyles}>
        {/* <PreviousPage currentPageId={currentPageId} /> */}
        <NextPage currentPageId={currentPageId} />
      </div>
    )
  }

  return <GenericLoading />
}

export default NavigationContainer
