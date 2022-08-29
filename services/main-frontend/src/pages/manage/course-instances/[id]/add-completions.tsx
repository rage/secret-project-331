import React from "react"

import Layout from "../../../../components/Layout"
import AddCompletionsForm from "../../../../components/forms/AddCompletionsForm"

const AddCompletions: React.FC = () => {
  return (
    <Layout navVariant="simple">
      <AddCompletionsForm onSubmit={(data) => console.log(data)} />
    </Layout>
  )
}

export default AddCompletions
