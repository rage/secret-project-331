// rounds down the given number to have at most maxDecimals (default 0, max 20) decimals,
// leaves out trailing zeros and the decimal point if there are no decimals left
// roundDown(1.1199, 2) == 1.11
// roundDown(1.10, 2) == 1.1
// roundDown(1.00, 2) == 1
export function roundDown(n: number, maxDecimals?: number): string {
  const actualMaxDecimals = maxDecimals || 0
  if (actualMaxDecimals > 20) {
    // eslint-disable-next-line
    throw "maxDecimals cannot be higher than 20"
  }
  const fixed = n.toFixed(20).toString()

  // find decimal point
  const decimal = fixed.indexOf(".")
  // calculate how many unnecessary zeros need to be cut off
  let cutOff = 0
  for (let i = decimal + actualMaxDecimals; i > 1; i--) {
    if (fixed.charAt(i) == "0") {
      cutOff += 1
    } else {
      break
    }
  }
  if (cutOff == actualMaxDecimals) {
    // all decimals cut off, cut off the decimal point as well
    cutOff += 1
  }

  // from the start until the decimal point,
  // including the decimal point (+1),
  // all the decimals we wanted (+actualMaxDecimals),
  // minus the unnecessary characters (-cutOff)
  const rounded = fixed.slice(0, decimal + 1 + actualMaxDecimals - cutOff)
  return rounded
}
