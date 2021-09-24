(function() {var implementors = {};
implementors["actix_codec"] = [{"text":"impl&lt;T, U&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"actix_codec/struct.Framed.html\" title=\"struct actix_codec::Framed\">Framed</a>&lt;T, U&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"actix_codec/trait.AsyncRead.html\" title=\"trait actix_codec::AsyncRead\">AsyncRead</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;U: <a class=\"trait\" href=\"actix_codec/trait.Decoder.html\" title=\"trait actix_codec::Decoder\">Decoder</a>,&nbsp;</span>","synthetic":false,"types":["actix_codec::framed::Framed"]}];
implementors["actix_http"] = [{"text":"impl&lt;B&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"enum\" href=\"actix_http/body/enum.ResponseBody.html\" title=\"enum actix_http::body::ResponseBody\">ResponseBody</a>&lt;B&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;B: <a class=\"trait\" href=\"actix_http/body/trait.MessageBody.html\" title=\"trait actix_http::body::MessageBody\">MessageBody</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;B::<a class=\"type\" href=\"actix_http/body/trait.MessageBody.html#associatedtype.Error\" title=\"type actix_http::body::MessageBody::Error\">Error</a>: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.55.0/core/convert/trait.Into.html\" title=\"trait core::convert::Into\">Into</a>&lt;<a class=\"struct\" href=\"actix_http/error/struct.Error.html\" title=\"struct actix_http::error::Error\">Error</a>&gt;,&nbsp;</span>","synthetic":false,"types":["actix_http::body::response_body::ResponseBody"]},{"text":"impl&lt;S&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"actix_http/encoding/struct.Decoder.html\" title=\"struct actix_http::encoding::Decoder\">Decoder</a>&lt;S&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a>&lt;Item = <a class=\"enum\" href=\"https://doc.rust-lang.org/1.55.0/core/result/enum.Result.html\" title=\"enum core::result::Result\">Result</a>&lt;<a class=\"struct\" href=\"bytes/bytes/struct.Bytes.html\" title=\"struct bytes::bytes::Bytes\">Bytes</a>, <a class=\"enum\" href=\"actix_http/error/enum.PayloadError.html\" title=\"enum actix_http::error::PayloadError\">PayloadError</a>&gt;&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.55.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>,&nbsp;</span>","synthetic":false,"types":["actix_http::encoding::decoder::Decoder"]},{"text":"impl&lt;S&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"enum\" href=\"actix_http/enum.Payload.html\" title=\"enum actix_http::Payload\">Payload</a>&lt;S&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a>&lt;Item = <a class=\"enum\" href=\"https://doc.rust-lang.org/1.55.0/core/result/enum.Result.html\" title=\"enum core::result::Result\">Result</a>&lt;<a class=\"struct\" href=\"bytes/bytes/struct.Bytes.html\" title=\"struct bytes::bytes::Bytes\">Bytes</a>, <a class=\"enum\" href=\"actix_http/error/enum.PayloadError.html\" title=\"enum actix_http::error::PayloadError\">PayloadError</a>&gt;&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.55.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>,&nbsp;</span>","synthetic":false,"types":["actix_http::payload::Payload"]},{"text":"impl <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"actix_http/h1/struct.Payload.html\" title=\"struct actix_http::h1::Payload\">Payload</a>","synthetic":false,"types":["actix_http::h1::payload::Payload"]},{"text":"impl <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"actix_http/h2/struct.Payload.html\" title=\"struct actix_http::h2::Payload\">Payload</a>","synthetic":false,"types":["actix_http::h2::Payload"]}];
implementors["actix_multipart"] = [{"text":"impl <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"actix_multipart/struct.Multipart.html\" title=\"struct actix_multipart::Multipart\">Multipart</a>","synthetic":false,"types":["actix_multipart::server::Multipart"]},{"text":"impl <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"actix_multipart/struct.Field.html\" title=\"struct actix_multipart::Field\">Field</a>","synthetic":false,"types":["actix_multipart::server::Field"]}];
implementors["actix_web"] = [{"text":"impl <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"actix_web/web/struct.Payload.html\" title=\"struct actix_web::web::Payload\">Payload</a>","synthetic":false,"types":["actix_web::types::payload::Payload"]},{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"actix_web/web/struct.Readlines.html\" title=\"struct actix_web::web::Readlines\">Readlines</a>&lt;T&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"actix_web/trait.HttpMessage.html\" title=\"trait actix_web::HttpMessage\">HttpMessage</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;T::<a class=\"type\" href=\"actix_web/trait.HttpMessage.html#associatedtype.Stream\" title=\"type actix_web::HttpMessage::Stream\">Stream</a>: <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a>&lt;Item = <a class=\"enum\" href=\"https://doc.rust-lang.org/1.55.0/core/result/enum.Result.html\" title=\"enum core::result::Result\">Result</a>&lt;<a class=\"struct\" href=\"actix_web/web/struct.Bytes.html\" title=\"struct actix_web::web::Bytes\">Bytes</a>, <a class=\"enum\" href=\"actix_web/error/enum.PayloadError.html\" title=\"enum actix_web::error::PayloadError\">PayloadError</a>&gt;&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.55.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>,&nbsp;</span>","synthetic":false,"types":["actix_web::types::readlines::Readlines"]}];
implementors["cloud_storage"] = [{"text":"impl&lt;S:&nbsp;<a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a>&lt;Item = <a class=\"type\" href=\"cloud_storage/type.Result.html\" title=\"type cloud_storage::Result\">Result</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.55.0/std/primitive.u8.html\">u8</a>&gt;&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.55.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"cloud_storage/object/struct.SizedByteStream.html\" title=\"struct cloud_storage::object::SizedByteStream\">SizedByteStream</a>&lt;S&gt;","synthetic":false,"types":["cloud_storage::resources::object::SizedByteStream"]}];
implementors["futures_channel"] = [{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"futures_channel/mpsc/struct.Receiver.html\" title=\"struct futures_channel::mpsc::Receiver\">Receiver</a>&lt;T&gt;","synthetic":false,"types":["futures_channel::mpsc::Receiver"]},{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"futures_channel/mpsc/struct.UnboundedReceiver.html\" title=\"struct futures_channel::mpsc::UnboundedReceiver\">UnboundedReceiver</a>&lt;T&gt;","synthetic":false,"types":["futures_channel::mpsc::UnboundedReceiver"]}];
implementors["futures_core"] = [];
implementors["futures_intrusive"] = [{"text":"impl&lt;'a, MutexType, T, A&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"futures_intrusive/channel/struct.ChannelStream.html\" title=\"struct futures_intrusive::channel::ChannelStream\">ChannelStream</a>&lt;'a, MutexType, T, A&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;A: <a class=\"trait\" href=\"futures_intrusive/buffer/trait.RingBuf.html\" title=\"trait futures_intrusive::buffer::RingBuf\">RingBuf</a>&lt;Item = T&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>,&nbsp;</span>","synthetic":false,"types":["futures_intrusive::channel::mpmc::ChannelStream"]},{"text":"impl&lt;MutexType, T, A&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"futures_intrusive/channel/shared/struct.SharedStream.html\" title=\"struct futures_intrusive::channel::shared::SharedStream\">SharedStream</a>&lt;MutexType, T, A&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;A: 'static + <a class=\"trait\" href=\"futures_intrusive/buffer/trait.RingBuf.html\" title=\"trait futures_intrusive::buffer::RingBuf\">RingBuf</a>&lt;Item = T&gt;,&nbsp;</span>","synthetic":false,"types":["futures_intrusive::channel::mpmc::if_alloc::shared::SharedStream"]}];
implementors["local_channel"] = [{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"local_channel/mpsc/struct.Receiver.html\" title=\"struct local_channel::mpsc::Receiver\">Receiver</a>&lt;T&gt;","synthetic":false,"types":["local_channel::mpsc::Receiver"]}];
implementors["tokio_stream"] = [{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_stream/wrappers/struct.ReceiverStream.html\" title=\"struct tokio_stream::wrappers::ReceiverStream\">ReceiverStream</a>&lt;T&gt;","synthetic":false,"types":["tokio_stream::wrappers::mpsc_bounded::ReceiverStream"]},{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_stream/wrappers/struct.UnboundedReceiverStream.html\" title=\"struct tokio_stream::wrappers::UnboundedReceiverStream\">UnboundedReceiverStream</a>&lt;T&gt;","synthetic":false,"types":["tokio_stream::wrappers::mpsc_unbounded::UnboundedReceiverStream"]},{"text":"impl <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_stream/wrappers/struct.IntervalStream.html\" title=\"struct tokio_stream::wrappers::IntervalStream\">IntervalStream</a>","synthetic":false,"types":["tokio_stream::wrappers::interval::IntervalStream"]},{"text":"impl <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_stream/wrappers/struct.ReadDirStream.html\" title=\"struct tokio_stream::wrappers::ReadDirStream\">ReadDirStream</a>","synthetic":false,"types":["tokio_stream::wrappers::read_dir::ReadDirStream"]},{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_stream/struct.Empty.html\" title=\"struct tokio_stream::Empty\">Empty</a>&lt;T&gt;","synthetic":false,"types":["tokio_stream::empty::Empty"]},{"text":"impl&lt;I&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_stream/struct.Iter.html\" title=\"struct tokio_stream::Iter\">Iter</a>&lt;I&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;I: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.55.0/core/iter/traits/iterator/trait.Iterator.html\" title=\"trait core::iter::traits::iterator::Iterator\">Iterator</a>,&nbsp;</span>","synthetic":false,"types":["tokio_stream::iter::Iter"]},{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_stream/struct.Once.html\" title=\"struct tokio_stream::Once\">Once</a>&lt;T&gt;","synthetic":false,"types":["tokio_stream::once::Once"]},{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_stream/struct.Pending.html\" title=\"struct tokio_stream::Pending\">Pending</a>&lt;T&gt;","synthetic":false,"types":["tokio_stream::pending::Pending"]},{"text":"impl&lt;K, V&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_stream/struct.StreamMap.html\" title=\"struct tokio_stream::StreamMap\">StreamMap</a>&lt;K, V&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;K: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.55.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.55.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;V: <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.55.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>,&nbsp;</span>","synthetic":false,"types":["tokio_stream::stream_map::StreamMap"]}];
implementors["tokio_util"] = [{"text":"impl&lt;T, U&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_util/codec/struct.Framed.html\" title=\"struct tokio_util::codec::Framed\">Framed</a>&lt;T, U&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"tokio/io/async_read/trait.AsyncRead.html\" title=\"trait tokio::io::async_read::AsyncRead\">AsyncRead</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;U: <a class=\"trait\" href=\"tokio_util/codec/trait.Decoder.html\" title=\"trait tokio_util::codec::Decoder\">Decoder</a>,&nbsp;</span>","synthetic":false,"types":["tokio_util::codec::framed::Framed"]},{"text":"impl&lt;T, D&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_util/codec/struct.FramedRead.html\" title=\"struct tokio_util::codec::FramedRead\">FramedRead</a>&lt;T, D&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"tokio/io/async_read/trait.AsyncRead.html\" title=\"trait tokio::io::async_read::AsyncRead\">AsyncRead</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;D: <a class=\"trait\" href=\"tokio_util/codec/trait.Decoder.html\" title=\"trait tokio_util::codec::Decoder\">Decoder</a>,&nbsp;</span>","synthetic":false,"types":["tokio_util::codec::framed_read::FramedRead"]},{"text":"impl&lt;T, D&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_util/codec/struct.FramedWrite.html\" title=\"struct tokio_util::codec::FramedWrite\">FramedWrite</a>&lt;T, D&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a>,&nbsp;</span>","synthetic":false,"types":["tokio_util::codec::framed_write::FramedWrite"]},{"text":"impl&lt;R:&nbsp;<a class=\"trait\" href=\"tokio/io/async_read/trait.AsyncRead.html\" title=\"trait tokio::io::async_read::AsyncRead\">AsyncRead</a>&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_util/io/struct.ReaderStream.html\" title=\"struct tokio_util::io::ReaderStream\">ReaderStream</a>&lt;R&gt;","synthetic":false,"types":["tokio_util::io::reader_stream::ReaderStream"]},{"text":"impl <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"struct\" href=\"tokio_util/sync/struct.PollSemaphore.html\" title=\"struct tokio_util::sync::PollSemaphore\">PollSemaphore</a>","synthetic":false,"types":["tokio_util::sync::poll_semaphore::PollSemaphore"]},{"text":"impl&lt;L, R&gt; <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a> for <a class=\"enum\" href=\"tokio_util/either/enum.Either.html\" title=\"enum tokio_util::either::Either\">Either</a>&lt;L, R&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;L: <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;R: <a class=\"trait\" href=\"futures_core/stream/trait.Stream.html\" title=\"trait futures_core::stream::Stream\">Stream</a>&lt;Item = L::<a class=\"type\" href=\"futures_core/stream/trait.Stream.html#associatedtype.Item\" title=\"type futures_core::stream::Stream::Item\">Item</a>&gt;,&nbsp;</span>","synthetic":false,"types":["tokio_util::either::Either"]}];
if (window.register_implementors) {window.register_implementors(implementors);} else {window.pending_implementors = implementors;}})()