import React from "react"

interface Props {
  id: string
}

const ExamComponent: React.FC<Props> = ({ id }) => {
  return <p>{id}</p>
}

export default ExamComponent
