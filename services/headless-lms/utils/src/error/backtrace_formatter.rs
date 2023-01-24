/*!
Custom formatting for stack backtraces inteded to be printed to the console for developers.
*/

use core::fmt;

use backtrace::{Backtrace, BacktraceFmt, BacktraceFrame, PrintFmt, SymbolName};

/**
Formats backtraces for printing but omits unnecessary stack frames.

Customized version of `impl fmt::Debug` from the `Backtrace` crate.
*/
pub fn format_backtrace(backtrace: &Backtrace, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
    let cwd = std::env::current_dir().ok();
    let cwd_copy = cwd.clone();
    let mut print_path = move |fmt: &mut fmt::Formatter<'_>,
                               path: backtrace::BytesOrWideString<'_>| {
        let cwd_path_buf = path.into_path_buf();

        if let Some(cwd) = &cwd_copy {
            if let Ok(suffix) = cwd_path_buf.strip_prefix(cwd) {
                return fmt::Display::fmt(&suffix.display(), fmt);
            }
        }

        fmt::Display::fmt(&cwd_path_buf.display(), fmt)
    };

    let mut f = BacktraceFmt::new(fmt, PrintFmt::Short, &mut print_path);
    f.add_context()?;

    let mut skipped_n_frames = 0;
    let frames = backtrace.frames();
    // Skip 1 because our errors are always contructed with a constructor and we want the trace to start where the constructor was called.
    for frame in frames.iter().skip(1) {
        let frame_from_this_project = frame.symbols().iter().any(|symbol| {
            symbol
                .filename()
                .map(|path| {
                    if let Some(cwd) = cwd.clone() {
                        // If the path starts with the cwd, we assume it's from the current crate
                        path.starts_with(cwd)
                    } else {
                        false
                    }
                })
                .unwrap_or(false)
        });
        if !frame_from_this_project {
            skipped_n_frames += 1;
            continue;
        } else {
            if skipped_n_frames > 0 {
                print_filtered_frame_placeholder(skipped_n_frames, &mut f, frame)?;
            }
            skipped_n_frames = 0;
        }

        f.frame().backtrace_frame(frame)?;
    }
    if skipped_n_frames > 0 {
        // Just need some frame, taking the first one because the last one has a null adddress and those are not printed by default.
        if let Some(some_frame) = frames.first() {
            print_filtered_frame_placeholder(skipped_n_frames, &mut f, some_frame)?;
        }
    }

    f.finish()?;
    Ok(())
}

fn print_filtered_frame_placeholder(
    skipped_n_frames: i32,
    f: &mut BacktraceFmt,
    reference_frame: &BacktraceFrame,
) -> fmt::Result {
    let mut backtrace_frame_fmt = f.frame();
    let word = if skipped_n_frames == 1 {
        "frame"
    } else {
        "frames"
    };
    backtrace_frame_fmt.print_raw(
        // Using some frame ip to get the formatter to print.
        reference_frame.ip(),
        Some(SymbolName::new(
            format!("<----- {} filtered {} ----->", skipped_n_frames, word).as_bytes(),
        )),
        None,
        None,
    )?;
    Ok(())
}
