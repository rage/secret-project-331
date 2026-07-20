import type { UpdateCertificateConfigurationData } from "@/generated/api/types.generated"

import { createCertificateConfigurationFormData } from "../certificateConfigurationFormData"

const readBlobAsText = async (blob: Blob): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader()
    // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
    reader.onload = () => resolve(String(reader.result))
    // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
    reader.onerror = () => reject(reader.error)
    // oxlint-disable-next-line unicorn/prefer-blob-reading-methods -- FileReader-based blob reading is intentional in this test
    reader.readAsText(blob)
  })

describe("createCertificateConfigurationFormData", () => {
  it("serializes metadata as a JSON blob and preserves uploaded files", async () => {
    const metadata: UpdateCertificateConfigurationData["body"]["metadata"] = {
      course_module_id: "d4c8760f-7b84-4eba-91c8-a54de34a22df",
      course_instance_id: "7fb6fa7f-1697-488d-8356-d675ef63de4f",
      certificate_owner_name_y_pos: "70%",
      certificate_owner_name_x_pos: "50%",
      certificate_owner_name_font_size: "150px",
      certificate_owner_name_text_color: "#000000",
      certificate_owner_name_text_anchor: "middle",
      certificate_validate_url_y_pos: "88.5%",
      certificate_validate_url_x_pos: "80%",
      certificate_validate_url_font_size: "30px",
      certificate_validate_url_text_color: "#000000",
      certificate_validate_url_text_anchor: "end",
      certificate_date_y_pos: "88.5%",
      certificate_date_x_pos: "15%",
      certificate_date_font_size: "30px",
      certificate_date_text_color: "#000000",
      certificate_date_text_anchor: "start",
      certificate_locale: "en",
      paper_size: "horizontal-a4",
      background_svg_file_name: "background.svg",
      overlay_svg_file_name: null,
      clear_overlay_svg_file: false,
      render_certificate_grade: false,
      certificate_grade_y_pos: null,
      certificate_grade_x_pos: null,
      certificate_grade_font_size: null,
      certificate_grade_text_color: null,
      certificate_grade_text_anchor: null,
    }
    const file = new File(["<svg />"], "background.svg", { type: "image/svg+xml" })

    const formData = createCertificateConfigurationFormData(metadata, [file])
    const metadataPart = formData.get("metadata")
    const fileParts = formData.getAll("file")

    expect(metadataPart).toBeInstanceOf(Blob)
    expect((metadataPart as Blob).type).toBe("application/json")
    await expect(readBlobAsText(metadataPart as Blob)).resolves.toBe(JSON.stringify(metadata))
    expect(fileParts).toEqual([file])
  })
})
