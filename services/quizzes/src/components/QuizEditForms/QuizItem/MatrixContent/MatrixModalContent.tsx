import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { NormalizedQuizItem } from "../../../../../types/types"
import { ModalWrapper } from "../../../Shared/Modal"

import TableContent from "./TableContent"

const ModalContentTitleWrapper = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: center;
  @media only screen and (max-width: 600px) {
    width: auto !important;
  }
`
const Spacer = styled.div`
  margin: 5% 0;
`

interface EditorModalProps {
  item: NormalizedQuizItem
}

export const MatrixModalContent: React.FC<React.PropsWithChildren<EditorModalProps>> = ({
  item,
}) => {
  const { t } = useTranslation()
  return (
    <ModalWrapper>
      <ModalContentTitleWrapper>
        <h4>{t("title-advanced-editing")}</h4>
      </ModalContentTitleWrapper>
      <TableContent item={item}> </TableContent>
      <Spacer />
    </ModalWrapper>
  )
}

export default MatrixModalContent
