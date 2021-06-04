import { Alternative, PublicAlternative } from "./stateInterfaces"

export interface Specs {
  public_spec: PublicAlternative[] | null
  private_spec: Alternative[] | null
}

const convertStateToSpecs = (input: Alternative[] | null): Specs => {
  let public_spec: PublicAlternative[] | null = null
  if (input) {
    public_spec = input.map((alternative) => {
      return {
        id: alternative.id,
        name: alternative.name,
      }
    })
  }
  const specs: Specs = {
    private_spec: input,
    public_spec,
  }
  return specs
}

export default convertStateToSpecs
