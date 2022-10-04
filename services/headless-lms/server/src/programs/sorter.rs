//! Manually sorts...
//! - ts_binding_generator's export blocks
pub fn sort() -> anyhow::Result<()> {
    sort_ts_binding_generator()?;
    Ok(())
}

// sort export blocks in ts_binding_generator
fn sort_ts_binding_generator() -> anyhow::Result<()> {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ts_binding_generator.rs");
    let contents = std::fs::read_to_string(path)?;

    let mut file_lines_after_sorting = vec![];
    let mut in_export = false;
    let mut current_exports = vec![];

    // process file line by line
    for line in contents.lines() {
        if in_export && line.contains('}') {
            // end of export block
            in_export = false;

            if !current_exports.is_empty() {
                // the first line should contain the target
                let target = current_exports.remove(0);
                file_lines_after_sorting.push(target);
                file_lines_after_sorting.push("");

                // sort all lines other than target
                current_exports.sort();

                // for large export blocks, group based on first letter
                if current_exports.len() > 64 {
                    let mut grouped_exports = Vec::new();
                    let mut current_group_letter = None;

                    // process export block line by line
                    for export in current_exports {
                        // trim starting whitespace to check the first letter
                        let trimmed = export.trim_start();
                        if current_group_letter
                            .map(|p| !trimmed.starts_with(p))
                            .unwrap_or(false)
                        {
                            // start of new group
                            grouped_exports.push("");
                        }
                        current_group_letter = trimmed.chars().next();
                        grouped_exports.push(export);
                    }
                    current_exports = grouped_exports;
                }

                file_lines_after_sorting.extend(current_exports.drain(0..));
            }
        }

        if in_export {
            if !line.trim().is_empty() {
                current_exports.push(line);
            }
        } else {
            // lines outside exports don't need to be sorted
            file_lines_after_sorting.push(line);
        }

        if line.contains("export!") {
            in_export = true;
        }
    }

    file_lines_after_sorting.push(""); // trailing newline
    std::fs::write(path, file_lines_after_sorting.join("\n"))?;
    Ok(())
}
