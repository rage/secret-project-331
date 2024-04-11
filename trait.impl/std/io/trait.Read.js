(function() {var implementors = {
"actix_http":[["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"actix_http/test/struct.TestSeqBuffer.html\" title=\"struct actix_http::test::TestSeqBuffer\">TestSeqBuffer</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"actix_http/test/struct.TestBuffer.html\" title=\"struct actix_http::test::TestBuffer\">TestBuffer</a>"]],
"atomic_write_file":[["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"atomic_write_file/struct.AtomicWriteFile.html\" title=\"struct atomic_write_file::AtomicWriteFile\">AtomicWriteFile</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for &amp;<a class=\"struct\" href=\"atomic_write_file/struct.AtomicWriteFile.html\" title=\"struct atomic_write_file::AtomicWriteFile\">AtomicWriteFile</a>"]],
"base64":[["impl&lt;'e, E: <a class=\"trait\" href=\"base64/engine/trait.Engine.html\" title=\"trait base64::engine::Engine\">Engine</a>, R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"base64/read/struct.DecoderReader.html\" title=\"struct base64::read::DecoderReader\">DecoderReader</a>&lt;'e, E, R&gt;"]],
"blake3":[["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"blake3/struct.OutputReader.html\" title=\"struct blake3::OutputReader\">OutputReader</a>"]],
"brotli":[["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>, BufferType: <a class=\"trait\" href=\"brotli/writer/trait.SliceWrapperMut.html\" title=\"trait brotli::writer::SliceWrapperMut\">SliceWrapperMut</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.u8.html\">u8</a>&gt;, Alloc: <a class=\"trait\" href=\"brotli/enc/combined_alloc/trait.BrotliAlloc.html\" title=\"trait brotli::enc::combined_alloc::BrotliAlloc\">BrotliAlloc</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"brotli/enc/reader/struct.CompressorReaderCustomAlloc.html\" title=\"struct brotli::enc::reader::CompressorReaderCustomAlloc\">CompressorReaderCustomAlloc</a>&lt;R, BufferType, Alloc&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"brotli/enc/reader/struct.CompressorReader.html\" title=\"struct brotli::enc::reader::CompressorReader\">CompressorReader</a>&lt;R&gt;"]],
"brotli_decompressor":[["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"brotli_decompressor/reader/struct.Decompressor.html\" title=\"struct brotli_decompressor::reader::Decompressor\">Decompressor</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>, BufferType: <a class=\"trait\" href=\"brotli_decompressor/trait.SliceWrapperMut.html\" title=\"trait brotli_decompressor::SliceWrapperMut\">SliceWrapperMut</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.u8.html\">u8</a>&gt;, AllocU8: <a class=\"trait\" href=\"brotli_decompressor/trait.Allocator.html\" title=\"trait brotli_decompressor::Allocator\">Allocator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.u8.html\">u8</a>&gt;, AllocU32: <a class=\"trait\" href=\"brotli_decompressor/trait.Allocator.html\" title=\"trait brotli_decompressor::Allocator\">Allocator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.u32.html\">u32</a>&gt;, AllocHC: <a class=\"trait\" href=\"brotli_decompressor/trait.Allocator.html\" title=\"trait brotli_decompressor::Allocator\">Allocator</a>&lt;<a class=\"struct\" href=\"brotli_decompressor/reader/struct.HuffmanCode.html\" title=\"struct brotli_decompressor::reader::HuffmanCode\">HuffmanCode</a>&gt;&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"brotli_decompressor/reader/struct.DecompressorCustomAlloc.html\" title=\"struct brotli_decompressor::reader::DecompressorCustomAlloc\">DecompressorCustomAlloc</a>&lt;R, BufferType, AllocU8, AllocU32, AllocHC&gt;"]],
"bytes":[["impl&lt;B: <a class=\"trait\" href=\"bytes/buf/trait.Buf.html\" title=\"trait bytes::buf::Buf\">Buf</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/marker/trait.Sized.html\" title=\"trait core::marker::Sized\">Sized</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"bytes/buf/struct.Reader.html\" title=\"struct bytes::buf::Reader\">Reader</a>&lt;B&gt;"]],
"combine":[["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"combine/stream/buf_reader/struct.BufReader.html\" title=\"struct combine::stream::buf_reader::BufReader\">BufReader</a>&lt;R&gt;"]],
"digest":[["impl&lt;T&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"digest/core_api/struct.XofReaderCoreWrapper.html\" title=\"struct digest::core_api::XofReaderCoreWrapper\">XofReaderCoreWrapper</a>&lt;T&gt;<div class=\"where\">where\n    T: <a class=\"trait\" href=\"digest/core_api/trait.XofReaderCore.html\" title=\"trait digest::core_api::XofReaderCore\">XofReaderCore</a>,\n    T::<a class=\"associatedtype\" href=\"digest/core_api/trait.BlockSizeUser.html#associatedtype.BlockSize\" title=\"type digest::core_api::BlockSizeUser::BlockSize\">BlockSize</a>: <a class=\"trait\" href=\"typenum/type_operators/trait.IsLess.html\" title=\"trait typenum::type_operators::IsLess\">IsLess</a>&lt;<a class=\"type\" href=\"digest/consts/type.U256.html\" title=\"type digest::consts::U256\">U256</a>&gt;,\n    <a class=\"type\" href=\"typenum/operator_aliases/type.Le.html\" title=\"type typenum::operator_aliases::Le\">Le</a>&lt;T::<a class=\"associatedtype\" href=\"digest/core_api/trait.BlockSizeUser.html#associatedtype.BlockSize\" title=\"type digest::core_api::BlockSizeUser::BlockSize\">BlockSize</a>, <a class=\"type\" href=\"digest/consts/type.U256.html\" title=\"type digest::consts::U256\">U256</a>&gt;: <a class=\"trait\" href=\"typenum/marker_traits/trait.NonZero.html\" title=\"trait typenum::marker_traits::NonZero\">NonZero</a>,</div>"]],
"either":[["impl&lt;L, R&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"enum\" href=\"either/enum.Either.html\" title=\"enum either::Either\">Either</a>&lt;L, R&gt;<div class=\"where\">where\n    L: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>,\n    R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>,</div>"]],
"flate2":[["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/struct.CrcReader.html\" title=\"struct flate2::CrcReader\">CrcReader</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/read/struct.ZlibEncoder.html\" title=\"struct flate2::read::ZlibEncoder\">ZlibEncoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/bufread/struct.GzEncoder.html\" title=\"struct flate2::bufread::GzEncoder\">GzEncoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/bufread/struct.GzDecoder.html\" title=\"struct flate2::bufread::GzDecoder\">GzDecoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/bufread/struct.ZlibEncoder.html\" title=\"struct flate2::bufread::ZlibEncoder\">ZlibEncoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/read/struct.GzEncoder.html\" title=\"struct flate2::read::GzEncoder\">GzEncoder</a>&lt;R&gt;"],["impl&lt;W: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/write/struct.DeflateEncoder.html\" title=\"struct flate2::write::DeflateEncoder\">DeflateEncoder</a>&lt;W&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/bufread/struct.MultiGzDecoder.html\" title=\"struct flate2::bufread::MultiGzDecoder\">MultiGzDecoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/read/struct.DeflateEncoder.html\" title=\"struct flate2::read::DeflateEncoder\">DeflateEncoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/bufread/struct.DeflateDecoder.html\" title=\"struct flate2::bufread::DeflateDecoder\">DeflateDecoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/bufread/struct.DeflateEncoder.html\" title=\"struct flate2::bufread::DeflateEncoder\">DeflateEncoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/write/struct.GzEncoder.html\" title=\"struct flate2::write::GzEncoder\">GzEncoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/read/struct.MultiGzDecoder.html\" title=\"struct flate2::read::MultiGzDecoder\">MultiGzDecoder</a>&lt;R&gt;"],["impl&lt;W: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/write/struct.GzDecoder.html\" title=\"struct flate2::write::GzDecoder\">GzDecoder</a>&lt;W&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/read/struct.GzDecoder.html\" title=\"struct flate2::read::GzDecoder\">GzDecoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/read/struct.DeflateDecoder.html\" title=\"struct flate2::read::DeflateDecoder\">DeflateDecoder</a>&lt;R&gt;"],["impl&lt;W: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/write/struct.ZlibDecoder.html\" title=\"struct flate2::write::ZlibDecoder\">ZlibDecoder</a>&lt;W&gt;"],["impl&lt;W: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/write/struct.ZlibEncoder.html\" title=\"struct flate2::write::ZlibEncoder\">ZlibEncoder</a>&lt;W&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/bufread/struct.ZlibDecoder.html\" title=\"struct flate2::bufread::ZlibDecoder\">ZlibDecoder</a>&lt;R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/read/struct.ZlibDecoder.html\" title=\"struct flate2::read::ZlibDecoder\">ZlibDecoder</a>&lt;R&gt;"],["impl&lt;W: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"flate2/write/struct.DeflateDecoder.html\" title=\"struct flate2::write::DeflateDecoder\">DeflateDecoder</a>&lt;W&gt;"]],
"futures_util":[["impl&lt;T&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"futures_util/io/struct.AllowStdIo.html\" title=\"struct futures_util::io::AllowStdIo\">AllowStdIo</a>&lt;T&gt;<div class=\"where\">where\n    T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>,</div>"]],
"git2":[["impl&lt;'repo&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"git2/struct.OdbReader.html\" title=\"struct git2::OdbReader\">OdbReader</a>&lt;'repo&gt;"]],
"mio":[["impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for &amp;'a <a class=\"struct\" href=\"mio/net/struct.UnixStream.html\" title=\"struct mio::net::UnixStream\">UnixStream</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for &amp;<a class=\"struct\" href=\"mio/unix/pipe/struct.Receiver.html\" title=\"struct mio::unix::pipe::Receiver\">Receiver</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"mio/net/struct.TcpStream.html\" title=\"struct mio::net::TcpStream\">TcpStream</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"mio/unix/pipe/struct.Receiver.html\" title=\"struct mio::unix::pipe::Receiver\">Receiver</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"mio/net/struct.UnixStream.html\" title=\"struct mio::net::UnixStream\">UnixStream</a>"],["impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for &amp;'a <a class=\"struct\" href=\"mio/net/struct.TcpStream.html\" title=\"struct mio::net::TcpStream\">TcpStream</a>"]],
"native_tls":[["impl&lt;S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"native_tls/struct.TlsStream.html\" title=\"struct native_tls::TlsStream\">TlsStream</a>&lt;S&gt;"]],
"openssl":[["impl&lt;S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"openssl/ssl/struct.SslStream.html\" title=\"struct openssl::ssl::SslStream\">SslStream</a>&lt;S&gt;"]],
"rand_core":[["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for dyn <a class=\"trait\" href=\"rand_core/trait.RngCore.html\" title=\"trait rand_core::RngCore\">RngCore</a>"]],
"reqwest":[["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"reqwest/blocking/struct.Response.html\" title=\"struct reqwest::blocking::Response\">Response</a>"]],
"rustls":[["impl&lt;'a, C, T, S&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"rustls/struct.Stream.html\" title=\"struct rustls::Stream\">Stream</a>&lt;'a, C, T&gt;<div class=\"where\">where\n    C: 'a + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/ops/deref/trait.DerefMut.html\" title=\"trait core::ops::deref::DerefMut\">DerefMut</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/ops/deref/trait.Deref.html\" title=\"trait core::ops::deref::Deref\">Deref</a>&lt;Target = <a class=\"struct\" href=\"rustls/struct.ConnectionCommon.html\" title=\"struct rustls::ConnectionCommon\">ConnectionCommon</a>&lt;S&gt;&gt;,\n    T: 'a + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>,\n    S: <a class=\"trait\" href=\"rustls/trait.SideData.html\" title=\"trait rustls::SideData\">SideData</a>,</div>"],["impl&lt;C, T, S&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"rustls/struct.StreamOwned.html\" title=\"struct rustls::StreamOwned\">StreamOwned</a>&lt;C, T&gt;<div class=\"where\">where\n    C: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/ops/deref/trait.DerefMut.html\" title=\"trait core::ops::deref::DerefMut\">DerefMut</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/ops/deref/trait.Deref.html\" title=\"trait core::ops::deref::Deref\">Deref</a>&lt;Target = <a class=\"struct\" href=\"rustls/struct.ConnectionCommon.html\" title=\"struct rustls::ConnectionCommon\">ConnectionCommon</a>&lt;S&gt;&gt;,\n    T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Write.html\" title=\"trait std::io::Write\">Write</a>,\n    S: <a class=\"trait\" href=\"rustls/trait.SideData.html\" title=\"trait rustls::SideData\">SideData</a>,</div>"],["impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"rustls/struct.Reader.html\" title=\"struct rustls::Reader\">Reader</a>&lt;'a&gt;"],["impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"rustls/server/struct.ReadEarlyData.html\" title=\"struct rustls::server::ReadEarlyData\">ReadEarlyData</a>&lt;'a&gt;"]],
"socket2":[["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"socket2/struct.Socket.html\" title=\"struct socket2::Socket\">Socket</a>"],["impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for &amp;'a <a class=\"struct\" href=\"socket2/struct.Socket.html\" title=\"struct socket2::Socket\">Socket</a>"]],
"tar":[["impl&lt;'a, R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"tar/struct.Entry.html\" title=\"struct tar::Entry\">Entry</a>&lt;'a, R&gt;"]],
"tempfile":[["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"tempfile/struct.SpooledTempFile.html\" title=\"struct tempfile::SpooledTempFile\">SpooledTempFile</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for &amp;<a class=\"struct\" href=\"tempfile/struct.NamedTempFile.html\" title=\"struct tempfile::NamedTempFile\">NamedTempFile</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/std/fs/struct.File.html\" title=\"struct std::fs::File\">File</a>&gt;"],["impl&lt;F: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"tempfile/struct.NamedTempFile.html\" title=\"struct tempfile::NamedTempFile\">NamedTempFile</a>&lt;F&gt;"]],
"tokio_native_tls":[["impl&lt;S&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"tokio_native_tls/struct.AllowStd.html\" title=\"struct tokio_native_tls::AllowStd\">AllowStd</a>&lt;S&gt;<div class=\"where\">where\n    S: <a class=\"trait\" href=\"tokio/io/async_read/trait.AsyncRead.html\" title=\"trait tokio::io::async_read::AsyncRead\">AsyncRead</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>,</div>"]],
"zstd":[["impl&lt;R, D&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"zstd/stream/zio/struct.Reader.html\" title=\"struct zstd::stream::zio::Reader\">Reader</a>&lt;R, D&gt;<div class=\"where\">where\n    R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>,\n    D: <a class=\"trait\" href=\"zstd/stream/raw/trait.Operation.html\" title=\"trait zstd::stream::raw::Operation\">Operation</a>,</div>"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"zstd/stream/read/struct.Decoder.html\" title=\"struct zstd::stream::read::Decoder\">Decoder</a>&lt;'_, R&gt;"],["impl&lt;R: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.BufRead.html\" title=\"trait std::io::BufRead\">BufRead</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/std/io/trait.Read.html\" title=\"trait std::io::Read\">Read</a> for <a class=\"struct\" href=\"zstd/stream/read/struct.Encoder.html\" title=\"struct zstd::stream::read::Encoder\">Encoder</a>&lt;'_, R&gt;"]]
};if (window.register_implementors) {window.register_implementors(implementors);} else {window.pending_implementors = implementors;}})()