//! The socket stream libgit2 opens every repository-clone connection through.
//!
//! Registered as libgit2's standard stream, it carries plain http, https (libgit2's TLS stream
//! wraps it and still verifies the certificate) and ssh. It resolves the host once, refuses unless
//! every address is public, and connects only to those addresses, so a DNS answer that changes
//! between validating the name and connecting to it cannot reach a private address.

use std::{
    ffi::{CStr, CString, c_char, c_int, c_uint, c_void},
    io::{self, Read, Write},
    net::{SocketAddr, TcpStream, ToSocketAddrs},
    os::fd::AsRawFd,
    panic::AssertUnwindSafe,
    sync::OnceLock,
    time::Duration,
};

use crate::domain::oauth::client_metadata_document::is_public_address;

/// `git_stream` from `include/git2/sys/stream.h`.
#[repr(C)]
struct GitStream {
    version: c_int,
    /// The `encrypted:1, proxy_support:1` bitfield; both are 0 for a plain socket.
    flags: c_uint,
    timeout: c_int,
    connect_timeout: c_int,
    connect: unsafe extern "C" fn(*mut GitStream) -> c_int,
    certificate: unsafe extern "C" fn(*mut *mut c_void, *mut GitStream) -> c_int,
    set_proxy: unsafe extern "C" fn(*mut GitStream, *const c_void) -> c_int,
    read: unsafe extern "C" fn(*mut GitStream, *mut c_void, usize) -> isize,
    write: unsafe extern "C" fn(*mut GitStream, *const c_char, usize, c_int) -> isize,
    close: unsafe extern "C" fn(*mut GitStream) -> c_int,
    free: unsafe extern "C" fn(*mut GitStream),
}

/// `git_stream_registration` from `include/git2/sys/stream.h`.
#[repr(C)]
struct GitStreamRegistration {
    version: c_int,
    init: Option<unsafe extern "C" fn(*mut *mut GitStream, *const c_char, *const c_char) -> c_int>,
    wrap: Option<unsafe extern "C" fn(*mut *mut GitStream, *mut GitStream, *const c_char) -> c_int>,
}

const GIT_STREAM_VERSION: c_int = 1;
const GIT_STREAM_STANDARD: c_int = 1;

unsafe extern "C" {
    fn git_stream_register(kind: c_int, registration: *mut GitStreamRegistration) -> c_int;
}

/// libgit2's ssh transport casts the stream to its own `git_socket_stream` and hands `socket` to
/// libssh2, so the first four fields must match that struct exactly.
#[repr(C)]
struct PinnedStream {
    parent: GitStream,
    host: *const c_char,
    port: *const c_char,
    socket: c_int,
    host_name: CString,
    port_name: CString,
    tcp: Option<TcpStream>,
}

/// Makes every connection libgit2 opens in this process go through [`PinnedStream`]. Must run
/// before any clone; later calls are no-ops that return the first call's result.
pub(super) fn register() -> anyhow::Result<()> {
    static REGISTERED: OnceLock<Result<(), String>> = OnceLock::new();
    REGISTERED
        .get_or_init(|| {
            libgit2_sys::init();
            let mut registration = GitStreamRegistration {
                version: GIT_STREAM_VERSION,
                init: Some(init),
                wrap: None,
            };
            // SAFETY: libgit2 is initialized and copies the registration before returning.
            match unsafe { git_stream_register(GIT_STREAM_STANDARD, &mut registration) } {
                0 => Ok(()),
                _ => Err(git2::Error::last_error(-1).message().to_string()),
            }
        })
        .clone()
        .map_err(|message| anyhow::anyhow!("Could not register the git socket stream: {message}"))
}

/// Returns `resolved` if it is non-empty and every address in it is public.
pub(super) fn public_addresses(
    host: &str,
    resolved: Vec<SocketAddr>,
) -> io::Result<Vec<SocketAddr>> {
    if resolved.is_empty() || resolved.iter().any(|a| !is_public_address(a.ip())) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            format!("{host} is not a public address"),
        ));
    }
    Ok(resolved)
}

/// Resolves `host` exactly once and hands only the checked addresses to `connect`.
fn connect_to_public_addresses<T>(
    host: &str,
    port: u16,
    resolve: impl FnOnce(&str, u16) -> io::Result<Vec<SocketAddr>>,
    connect: impl FnOnce(&[SocketAddr]) -> io::Result<T>,
) -> io::Result<T> {
    let addresses = public_addresses(host, resolve(host, port)?)?;
    connect(&addresses)
}

fn resolve_with_system_resolver(host: &str, port: u16) -> io::Result<Vec<SocketAddr>> {
    Ok((host, port).to_socket_addrs()?.collect())
}

fn connect_to_first_reachable(
    addresses: &[SocketAddr],
    connect_timeout: Option<Duration>,
) -> io::Result<TcpStream> {
    let mut last_error = io::Error::new(io::ErrorKind::NotFound, "no addresses to connect to");
    for address in addresses {
        let attempt = match connect_timeout {
            Some(timeout) => TcpStream::connect_timeout(address, timeout),
            None => TcpStream::connect(address),
        };
        match attempt {
            Ok(tcp) => return Ok(tcp),
            Err(err) => last_error = err,
        }
    }
    Err(last_error)
}

fn positive_millis(millis: c_int) -> Option<Duration> {
    u64::try_from(millis)
        .ok()
        .filter(|&millis| millis > 0)
        .map(Duration::from_millis)
}

fn set_error(message: &str) {
    let message = CString::new(message.replace('\0', "")).unwrap_or_default();
    let class = libgit2_sys::GIT_ERROR_NET as c_int;
    // SAFETY: libgit2 copies the message.
    unsafe { libgit2_sys::git_error_set_str(class, message.as_ptr()) };
}

/// Panics must not unwind into C.
fn guarded<T>(failure: T, f: impl FnOnce() -> T) -> T {
    std::panic::catch_unwind(AssertUnwindSafe(f)).unwrap_or_else(|_| {
        set_error("the git socket stream panicked");
        failure
    })
}

/// # Safety
/// `stream` must be a stream created by [`init`] and not yet freed.
unsafe fn pinned<'a>(stream: *mut GitStream) -> &'a mut PinnedStream {
    // SAFETY: `parent` is the first field of the repr(C) PinnedStream that `init` allocated.
    unsafe { &mut *stream.cast::<PinnedStream>() }
}

unsafe extern "C" fn init(
    out: *mut *mut GitStream,
    host: *const c_char,
    port: *const c_char,
) -> c_int {
    guarded(-1, || {
        // SAFETY: libgit2 passes NUL-terminated host and port strings.
        let (host_name, port_name) = unsafe {
            (
                CStr::from_ptr(host).to_owned(),
                CStr::from_ptr(port).to_owned(),
            )
        };
        // SAFETY: only reads libgit2's global settings, and libgit2 is initialized by now.
        let (timeout, connect_timeout) = unsafe {
            (
                git2::opts::get_server_timeout_in_milliseconds().unwrap_or(0),
                git2::opts::get_server_connect_timeout_in_milliseconds().unwrap_or(0),
            )
        };
        let stream = Box::new(PinnedStream {
            parent: GitStream {
                version: GIT_STREAM_VERSION,
                flags: 0,
                timeout,
                connect_timeout,
                connect,
                certificate,
                set_proxy,
                read,
                write,
                close,
                free,
            },
            host: host_name.as_ptr(),
            port: port_name.as_ptr(),
            socket: -1,
            host_name,
            port_name,
            tcp: None,
        });
        // SAFETY: libgit2 passes a valid out pointer and later frees the stream through `free`.
        unsafe { *out = Box::into_raw(stream).cast() };
        0
    })
}

unsafe extern "C" fn connect(stream: *mut GitStream) -> c_int {
    // SAFETY: libgit2 only calls back with streams `init` created.
    let stream = unsafe { pinned(stream) };
    guarded(-1, || {
        let host = stream.host_name.to_string_lossy().into_owned();
        let Ok(port) = stream.port_name.to_string_lossy().parse::<u16>() else {
            set_error(&format!("invalid port for {host}"));
            return -1;
        };
        let connect_timeout = positive_millis(stream.parent.connect_timeout);
        let connected =
            connect_to_public_addresses(&host, port, resolve_with_system_resolver, |addresses| {
                connect_to_first_reachable(addresses, connect_timeout)
            })
            .and_then(|tcp| {
                let timeout = positive_millis(stream.parent.timeout);
                tcp.set_read_timeout(timeout)?;
                tcp.set_write_timeout(timeout)?;
                Ok(tcp)
            });
        match connected {
            Ok(tcp) => {
                stream.socket = tcp.as_raw_fd();
                stream.tcp = Some(tcp);
                0
            }
            Err(err) => {
                set_error(&format!("failed to connect to {host}: {err}"));
                -1
            }
        }
    })
}

unsafe extern "C" fn certificate(_out: *mut *mut c_void, _stream: *mut GitStream) -> c_int {
    set_error("a plain socket has no certificate");
    -1
}

unsafe extern "C" fn set_proxy(_stream: *mut GitStream, _proxy_options: *const c_void) -> c_int {
    set_error("the git socket stream does not support proxies");
    -1
}

unsafe extern "C" fn read(stream: *mut GitStream, data: *mut c_void, len: usize) -> isize {
    // SAFETY: libgit2 only calls back with streams `init` created.
    let stream = unsafe { pinned(stream) };
    guarded(-1, || {
        let Some(tcp) = stream.tcp.as_mut() else {
            set_error("read from an unconnected socket");
            return -1;
        };
        // SAFETY: libgit2 passes a writable buffer of `len` bytes.
        let buffer = unsafe { std::slice::from_raw_parts_mut(data.cast::<u8>(), len) };
        loop {
            match tcp.read(buffer) {
                Ok(read) => return read as isize,
                Err(err) if err.kind() == io::ErrorKind::Interrupted => continue,
                Err(err) => {
                    set_error(&format!("error reading from socket: {err}"));
                    return -1;
                }
            }
        }
    })
}

unsafe extern "C" fn write(
    stream: *mut GitStream,
    data: *const c_char,
    len: usize,
    _flags: c_int,
) -> isize {
    // SAFETY: libgit2 only calls back with streams `init` created.
    let stream = unsafe { pinned(stream) };
    guarded(-1, || {
        let Some(tcp) = stream.tcp.as_mut() else {
            set_error("write to an unconnected socket");
            return -1;
        };
        // SAFETY: libgit2 passes a readable buffer of `len` bytes.
        let buffer = unsafe { std::slice::from_raw_parts(data.cast::<u8>(), len) };
        loop {
            match tcp.write(buffer) {
                Ok(written) => return written as isize,
                Err(err) if err.kind() == io::ErrorKind::Interrupted => continue,
                Err(err) => {
                    set_error(&format!("error writing to socket: {err}"));
                    return -1;
                }
            }
        }
    })
}

unsafe extern "C" fn close(stream: *mut GitStream) -> c_int {
    // SAFETY: libgit2 only calls back with streams `init` created.
    let stream = unsafe { pinned(stream) };
    stream.tcp = None;
    stream.socket = -1;
    0
}

unsafe extern "C" fn free(stream: *mut GitStream) {
    // SAFETY: `init` allocated the stream with Box::into_raw and libgit2 frees it exactly once.
    drop(unsafe { Box::from_raw(stream.cast::<PinnedStream>()) });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        cell::RefCell,
        net::TcpListener,
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };

    fn addresses(ips: &[&str]) -> Vec<SocketAddr> {
        ips.iter()
            .map(|ip| SocketAddr::new(ip.parse().unwrap(), 443))
            .collect()
    }

    #[test]
    fn only_all_public_resolutions_are_accepted() {
        for refused in [
            vec!["1.1.1.1", "127.0.0.1"],
            vec!["10.0.0.1"],
            vec!["::ffff:127.0.0.1"],
            vec!["169.254.169.254"],
            vec![],
        ] {
            assert!(
                public_addresses("example.com", addresses(&refused)).is_err(),
                "{refused:?}"
            );
        }
        let public = addresses(&["1.1.1.1", "2606:4700:4700::1111"]);
        assert_eq!(
            public_addresses("example.com", public.clone()).unwrap(),
            public
        );
    }

    #[test]
    fn connects_only_to_the_addresses_it_checked() {
        let resolutions = RefCell::new(0);
        let rebinding_resolver = |_: &str, port: u16| {
            *resolutions.borrow_mut() += 1;
            let ip = if *resolutions.borrow() == 1 {
                "1.1.1.1"
            } else {
                "127.0.0.1"
            };
            Ok(vec![SocketAddr::new(ip.parse().unwrap(), port)])
        };
        let mut connected_to = vec![];

        connect_to_public_addresses("rebinding.example", 443, rebinding_resolver, |addresses| {
            connected_to.extend_from_slice(addresses);
            Ok(())
        })
        .unwrap();

        assert_eq!(*resolutions.borrow(), 1);
        assert_eq!(connected_to, addresses(&["1.1.1.1"]));
    }

    #[test]
    fn libgit2_clones_cannot_reach_a_loopback_listener() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let port = listener.local_addr().unwrap().port();
        let clone_finished = Arc::new(AtomicBool::new(false));
        let accepted = std::thread::spawn({
            let clone_finished = Arc::clone(&clone_finished);
            move || {
                let mut accepted = 0;
                while !clone_finished.load(Ordering::SeqCst) {
                    match listener.accept() {
                        // Dropping the connection makes an unpinned clone fail fast instead of
                        // waiting for a response.
                        Ok(_) => accepted += 1,
                        Err(err) if err.kind() == io::ErrorKind::WouldBlock => {
                            std::thread::sleep(Duration::from_millis(10))
                        }
                        Err(err) => panic!("{err}"),
                    }
                }
                accepted
            }
        });
        let target = tempfile::tempdir().unwrap();

        register().unwrap();
        let Err(err) = git2::build::RepoBuilder::new()
            .clone(&format!("http://localhost:{port}/x.git"), target.path())
        else {
            panic!("cloning from a loopback address succeeded");
        };
        clone_finished.store(true, Ordering::SeqCst);

        assert!(
            err.message().contains("not a public address"),
            "{}",
            err.message()
        );
        assert_eq!(
            accepted.join().unwrap(),
            0,
            "libgit2 connected to the listener"
        );
    }

    /// The structs above mirror libgit2 1.9's `git_stream` and `git_socket_stream`, which libgit2
    /// may change in any release.
    #[test]
    fn libgit2_is_the_release_whose_layouts_are_mirrored() {
        let (major, minor, _) = git2::Version::get().libgit2_version();
        assert_eq!((major, minor), (1, 9));
    }
}
