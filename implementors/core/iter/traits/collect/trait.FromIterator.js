(function() {var implementors = {};
implementors["ahash"] = [{"text":"impl&lt;K, V, S&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">(</a>K, V<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">)</a>&gt; for <a class=\"struct\" href=\"ahash/struct.AHashMap.html\" title=\"struct ahash::AHashMap\">AHashMap</a>&lt;K, V, S&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;K: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.BuildHasher.html\" title=\"trait core::hash::BuildHasher\">BuildHasher</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>,&nbsp;</span>","synthetic":false,"types":["ahash::hash_map::AHashMap"]},{"text":"impl&lt;T, S&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"struct\" href=\"ahash/struct.AHashSet.html\" title=\"struct ahash::AHashSet\">AHashSet</a>&lt;T, S&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.BuildHasher.html\" title=\"trait core::hash::BuildHasher\">BuildHasher</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>,&nbsp;</span>","synthetic":false,"types":["ahash::hash_set::AHashSet"]}];
implementors["arrayvec"] = [{"text":"impl&lt;T, const CAP:&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/core/primitive.usize.html\">usize</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"struct\" href=\"arrayvec/struct.ArrayVec.html\" title=\"struct arrayvec::ArrayVec\">ArrayVec</a>&lt;T, CAP&gt;","synthetic":false,"types":["arrayvec::arrayvec::ArrayVec"]}];
implementors["bstr"] = [{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.char.html\">char</a>&gt; for <a class=\"struct\" href=\"bstr/struct.BString.html\" title=\"struct bstr::BString\">BString</a>","synthetic":false,"types":["bstr::bstring::BString"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.u8.html\">u8</a>&gt; for <a class=\"struct\" href=\"bstr/struct.BString.html\" title=\"struct bstr::BString\">BString</a>","synthetic":false,"types":["bstr::bstring::BString"]},{"text":"impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;&amp;'a <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.str.html\">str</a>&gt; for <a class=\"struct\" href=\"bstr/struct.BString.html\" title=\"struct bstr::BString\">BString</a>","synthetic":false,"types":["bstr::bstring::BString"]},{"text":"impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.slice.html\">&amp;'a [</a><a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.u8.html\">u8</a><a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.slice.html\">]</a>&gt; for <a class=\"struct\" href=\"bstr/struct.BString.html\" title=\"struct bstr::BString\">BString</a>","synthetic":false,"types":["bstr::bstring::BString"]},{"text":"impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;&amp;'a <a class=\"struct\" href=\"bstr/struct.BStr.html\" title=\"struct bstr::BStr\">BStr</a>&gt; for <a class=\"struct\" href=\"bstr/struct.BString.html\" title=\"struct bstr::BString\">BString</a>","synthetic":false,"types":["bstr::bstring::BString"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"bstr/struct.BString.html\" title=\"struct bstr::BString\">BString</a>&gt; for <a class=\"struct\" href=\"bstr/struct.BString.html\" title=\"struct bstr::BString\">BString</a>","synthetic":false,"types":["bstr::bstring::BString"]}];
implementors["bytes"] = [{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.u8.html\">u8</a>&gt; for <a class=\"struct\" href=\"bytes/struct.Bytes.html\" title=\"struct bytes::Bytes\">Bytes</a>","synthetic":false,"types":["bytes::bytes::Bytes"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.u8.html\">u8</a>&gt; for <a class=\"struct\" href=\"bytes/struct.BytesMut.html\" title=\"struct bytes::BytesMut\">BytesMut</a>","synthetic":false,"types":["bytes::bytes_mut::BytesMut"]},{"text":"impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;&amp;'a <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.u8.html\">u8</a>&gt; for <a class=\"struct\" href=\"bytes/struct.BytesMut.html\" title=\"struct bytes::BytesMut\">BytesMut</a>","synthetic":false,"types":["bytes::bytes_mut::BytesMut"]}];
implementors["csv"] = [{"text":"impl&lt;T:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/convert/trait.AsRef.html\" title=\"trait core::convert::AsRef\">AsRef</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.slice.html\">[</a><a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.u8.html\">u8</a><a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.slice.html\">]</a>&gt;&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"struct\" href=\"csv/struct.ByteRecord.html\" title=\"struct csv::ByteRecord\">ByteRecord</a>","synthetic":false,"types":["csv::byte_record::ByteRecord"]},{"text":"impl&lt;T:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/convert/trait.AsRef.html\" title=\"trait core::convert::AsRef\">AsRef</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.str.html\">str</a>&gt;&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"struct\" href=\"csv/struct.StringRecord.html\" title=\"struct csv::StringRecord\">StringRecord</a>","synthetic":false,"types":["csv::string_record::StringRecord"]}];
implementors["futures_util"] = [{"text":"impl&lt;F:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/future/future/trait.Future.html\" title=\"trait core::future::future::Future\">Future</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;F&gt; for <a class=\"struct\" href=\"futures_util/future/struct.JoinAll.html\" title=\"struct futures_util::future::JoinAll\">JoinAll</a>&lt;F&gt;","synthetic":false,"types":["futures_util::future::join_all::JoinAll"]},{"text":"impl&lt;Fut:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/future/future/trait.Future.html\" title=\"trait core::future::future::Future\">Future</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;Fut&gt; for <a class=\"struct\" href=\"futures_util/future/struct.SelectAll.html\" title=\"struct futures_util::future::SelectAll\">SelectAll</a>&lt;Fut&gt;","synthetic":false,"types":["futures_util::future::select_all::SelectAll"]},{"text":"impl&lt;F:&nbsp;<a class=\"trait\" href=\"futures_util/future/trait.TryFuture.html\" title=\"trait futures_util::future::TryFuture\">TryFuture</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;F&gt; for <a class=\"struct\" href=\"futures_util/future/struct.TryJoinAll.html\" title=\"struct futures_util::future::TryJoinAll\">TryJoinAll</a>&lt;F&gt;","synthetic":false,"types":["futures_util::future::try_join_all::TryJoinAll"]},{"text":"impl&lt;Fut:&nbsp;<a class=\"trait\" href=\"futures_util/future/trait.TryFuture.html\" title=\"trait futures_util::future::TryFuture\">TryFuture</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;Fut&gt; for <a class=\"struct\" href=\"futures_util/future/struct.SelectOk.html\" title=\"struct futures_util::future::SelectOk\">SelectOk</a>&lt;Fut&gt;","synthetic":false,"types":["futures_util::future::select_ok::SelectOk"]},{"text":"impl&lt;Fut:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/future/future/trait.Future.html\" title=\"trait core::future::future::Future\">Future</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;Fut&gt; for <a class=\"struct\" href=\"futures_util/stream/struct.FuturesOrdered.html\" title=\"struct futures_util::stream::FuturesOrdered\">FuturesOrdered</a>&lt;Fut&gt;","synthetic":false,"types":["futures_util::stream::futures_ordered::FuturesOrdered"]},{"text":"impl&lt;Fut&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;Fut&gt; for <a class=\"struct\" href=\"futures_util/stream/struct.FuturesUnordered.html\" title=\"struct futures_util::stream::FuturesUnordered\">FuturesUnordered</a>&lt;Fut&gt;","synthetic":false,"types":["futures_util::stream::futures_unordered::FuturesUnordered"]},{"text":"impl&lt;St:&nbsp;<a class=\"trait\" href=\"futures_util/stream/trait.Stream.html\" title=\"trait futures_util::stream::Stream\">Stream</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/marker/trait.Unpin.html\" title=\"trait core::marker::Unpin\">Unpin</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;St&gt; for <a class=\"struct\" href=\"futures_util/stream/struct.SelectAll.html\" title=\"struct futures_util::stream::SelectAll\">SelectAll</a>&lt;St&gt;","synthetic":false,"types":["futures_util::stream::select_all::SelectAll"]}];
implementors["generic_array"] = [{"text":"impl&lt;T, N&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"struct\" href=\"generic_array/struct.GenericArray.html\" title=\"struct generic_array::GenericArray\">GenericArray</a>&lt;T, N&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;N: <a class=\"trait\" href=\"generic_array/trait.ArrayLength.html\" title=\"trait generic_array::ArrayLength\">ArrayLength</a>&lt;T&gt;,&nbsp;</span>","synthetic":false,"types":["generic_array::GenericArray"]}];
implementors["hashbrown"] = [{"text":"impl&lt;K, V, S, A&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">(</a>K, V<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">)</a>&gt; for <a class=\"struct\" href=\"hashbrown/hash_map/struct.HashMap.html\" title=\"struct hashbrown::hash_map::HashMap\">HashMap</a>&lt;K, V, S, A&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;K: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.BuildHasher.html\" title=\"trait core::hash::BuildHasher\">BuildHasher</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;A: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a> + Allocator + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,&nbsp;</span>","synthetic":false,"types":["hashbrown::map::HashMap"]},{"text":"impl&lt;T, S, A&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"struct\" href=\"hashbrown/hash_set/struct.HashSet.html\" title=\"struct hashbrown::hash_set::HashSet\">HashSet</a>&lt;T, S, A&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.BuildHasher.html\" title=\"trait core::hash::BuildHasher\">BuildHasher</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;A: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a> + Allocator + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,&nbsp;</span>","synthetic":false,"types":["hashbrown::set::HashSet"]}];
implementors["hashlink"] = [{"text":"impl&lt;K:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a>, V, S:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.BuildHasher.html\" title=\"trait core::hash::BuildHasher\">BuildHasher</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">(</a>K, V<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">)</a>&gt; for <a class=\"struct\" href=\"hashlink/linked_hash_map/struct.LinkedHashMap.html\" title=\"struct hashlink::linked_hash_map::LinkedHashMap\">LinkedHashMap</a>&lt;K, V, S&gt;","synthetic":false,"types":["hashlink::linked_hash_map::LinkedHashMap"]},{"text":"impl&lt;T, S&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"struct\" href=\"hashlink/linked_hash_set/struct.LinkedHashSet.html\" title=\"struct hashlink::linked_hash_set::LinkedHashSet\">LinkedHashSet</a>&lt;T, S&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.BuildHasher.html\" title=\"trait core::hash::BuildHasher\">BuildHasher</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>,&nbsp;</span>","synthetic":false,"types":["hashlink::linked_hash_set::LinkedHashSet"]}];
implementors["http"] = [{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">(</a><a class=\"struct\" href=\"http/header/struct.HeaderName.html\" title=\"struct http::header::HeaderName\">HeaderName</a>, T<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">)</a>&gt; for <a class=\"struct\" href=\"http/header/struct.HeaderMap.html\" title=\"struct http::header::HeaderMap\">HeaderMap</a>&lt;T&gt;","synthetic":false,"types":["http::header::map::HeaderMap"]}];
implementors["indexmap"] = [{"text":"impl&lt;K, V, S&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">(</a>K, V<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">)</a>&gt; for <a class=\"struct\" href=\"indexmap/map/struct.IndexMap.html\" title=\"struct indexmap::map::IndexMap\">IndexMap</a>&lt;K, V, S&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;K: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.BuildHasher.html\" title=\"trait core::hash::BuildHasher\">BuildHasher</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>,&nbsp;</span>","synthetic":false,"types":["indexmap::map::IndexMap"]},{"text":"impl&lt;T, S&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"struct\" href=\"indexmap/set/struct.IndexSet.html\" title=\"struct indexmap::set::IndexSet\">IndexSet</a>&lt;T, S&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/hash/trait.BuildHasher.html\" title=\"trait core::hash::BuildHasher\">BuildHasher</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>,&nbsp;</span>","synthetic":false,"types":["indexmap::set::IndexSet"]}];
implementors["openssl"] = [{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/cms/struct.CMSOptions.html\" title=\"struct openssl::cms::CMSOptions\">CMSOptions</a>&gt; for <a class=\"struct\" href=\"openssl/cms/struct.CMSOptions.html\" title=\"struct openssl::cms::CMSOptions\">CMSOptions</a>","synthetic":false,"types":["openssl::cms::CMSOptions"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/ocsp/struct.OcspFlag.html\" title=\"struct openssl::ocsp::OcspFlag\">OcspFlag</a>&gt; for <a class=\"struct\" href=\"openssl/ocsp/struct.OcspFlag.html\" title=\"struct openssl::ocsp::OcspFlag\">OcspFlag</a>","synthetic":false,"types":["openssl::ocsp::OcspFlag"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/pkcs7/struct.Pkcs7Flags.html\" title=\"struct openssl::pkcs7::Pkcs7Flags\">Pkcs7Flags</a>&gt; for <a class=\"struct\" href=\"openssl/pkcs7/struct.Pkcs7Flags.html\" title=\"struct openssl::pkcs7::Pkcs7Flags\">Pkcs7Flags</a>","synthetic":false,"types":["openssl::pkcs7::Pkcs7Flags"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/ssl/struct.SslOptions.html\" title=\"struct openssl::ssl::SslOptions\">SslOptions</a>&gt; for <a class=\"struct\" href=\"openssl/ssl/struct.SslOptions.html\" title=\"struct openssl::ssl::SslOptions\">SslOptions</a>","synthetic":false,"types":["openssl::ssl::SslOptions"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/ssl/struct.SslMode.html\" title=\"struct openssl::ssl::SslMode\">SslMode</a>&gt; for <a class=\"struct\" href=\"openssl/ssl/struct.SslMode.html\" title=\"struct openssl::ssl::SslMode\">SslMode</a>","synthetic":false,"types":["openssl::ssl::SslMode"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/ssl/struct.SslVerifyMode.html\" title=\"struct openssl::ssl::SslVerifyMode\">SslVerifyMode</a>&gt; for <a class=\"struct\" href=\"openssl/ssl/struct.SslVerifyMode.html\" title=\"struct openssl::ssl::SslVerifyMode\">SslVerifyMode</a>","synthetic":false,"types":["openssl::ssl::SslVerifyMode"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/ssl/struct.SslSessionCacheMode.html\" title=\"struct openssl::ssl::SslSessionCacheMode\">SslSessionCacheMode</a>&gt; for <a class=\"struct\" href=\"openssl/ssl/struct.SslSessionCacheMode.html\" title=\"struct openssl::ssl::SslSessionCacheMode\">SslSessionCacheMode</a>","synthetic":false,"types":["openssl::ssl::SslSessionCacheMode"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/ssl/struct.ExtensionContext.html\" title=\"struct openssl::ssl::ExtensionContext\">ExtensionContext</a>&gt; for <a class=\"struct\" href=\"openssl/ssl/struct.ExtensionContext.html\" title=\"struct openssl::ssl::ExtensionContext\">ExtensionContext</a>","synthetic":false,"types":["openssl::ssl::ExtensionContext"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/ssl/struct.ShutdownState.html\" title=\"struct openssl::ssl::ShutdownState\">ShutdownState</a>&gt; for <a class=\"struct\" href=\"openssl/ssl/struct.ShutdownState.html\" title=\"struct openssl::ssl::ShutdownState\">ShutdownState</a>","synthetic":false,"types":["openssl::ssl::ShutdownState"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/x509/verify/struct.X509CheckFlags.html\" title=\"struct openssl::x509::verify::X509CheckFlags\">X509CheckFlags</a>&gt; for <a class=\"struct\" href=\"openssl/x509/verify/struct.X509CheckFlags.html\" title=\"struct openssl::x509::verify::X509CheckFlags\">X509CheckFlags</a>","synthetic":false,"types":["openssl::x509::verify::X509CheckFlags"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"openssl/x509/verify/struct.X509VerifyFlags.html\" title=\"struct openssl::x509::verify::X509VerifyFlags\">X509VerifyFlags</a>&gt; for <a class=\"struct\" href=\"openssl/x509/verify/struct.X509VerifyFlags.html\" title=\"struct openssl::x509::verify::X509VerifyFlags\">X509VerifyFlags</a>","synthetic":false,"types":["openssl::x509::verify::X509VerifyFlags"]}];
implementors["proc_macro2"] = [{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"enum\" href=\"proc_macro2/enum.TokenTree.html\" title=\"enum proc_macro2::TokenTree\">TokenTree</a>&gt; for <a class=\"struct\" href=\"proc_macro2/struct.TokenStream.html\" title=\"struct proc_macro2::TokenStream\">TokenStream</a>","synthetic":false,"types":["proc_macro2::TokenStream"]},{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"struct\" href=\"proc_macro2/struct.TokenStream.html\" title=\"struct proc_macro2::TokenStream\">TokenStream</a>&gt; for <a class=\"struct\" href=\"proc_macro2/struct.TokenStream.html\" title=\"struct proc_macro2::TokenStream\">TokenStream</a>","synthetic":false,"types":["proc_macro2::TokenStream"]}];
implementors["serde_json"] = [{"text":"impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">(</a><a class=\"struct\" href=\"https://doc.rust-lang.org/1.57.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>, <a class=\"enum\" href=\"serde_json/enum.Value.html\" title=\"enum serde_json::Value\">Value</a><a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">)</a>&gt; for <a class=\"struct\" href=\"serde_json/struct.Map.html\" title=\"struct serde_json::Map\">Map</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.57.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>, <a class=\"enum\" href=\"serde_json/enum.Value.html\" title=\"enum serde_json::Value\">Value</a>&gt;","synthetic":false,"types":["serde_json::map::Map"]},{"text":"impl&lt;T:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/convert/trait.Into.html\" title=\"trait core::convert::Into\">Into</a>&lt;<a class=\"enum\" href=\"serde_json/enum.Value.html\" title=\"enum serde_json::Value\">Value</a>&gt;&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"enum\" href=\"serde_json/enum.Value.html\" title=\"enum serde_json::Value\">Value</a>","synthetic":false,"types":["serde_json::value::Value"]},{"text":"impl&lt;K:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/convert/trait.Into.html\" title=\"trait core::convert::Into\">Into</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.57.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>&gt;, V:&nbsp;<a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/convert/trait.Into.html\" title=\"trait core::convert::Into\">Into</a>&lt;<a class=\"enum\" href=\"serde_json/enum.Value.html\" title=\"enum serde_json::Value\">Value</a>&gt;&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">(</a>K, V<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">)</a>&gt; for <a class=\"enum\" href=\"serde_json/enum.Value.html\" title=\"enum serde_json::Value\">Value</a>","synthetic":false,"types":["serde_json::value::Value"]}];
implementors["slab"] = [{"text":"impl&lt;T&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">(</a><a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.usize.html\">usize</a>, T<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">)</a>&gt; for <a class=\"struct\" href=\"slab/struct.Slab.html\" title=\"struct slab::Slab\">Slab</a>&lt;T&gt;","synthetic":false,"types":["slab::Slab"]}];
implementors["smallvec"] = [{"text":"impl&lt;A:&nbsp;<a class=\"trait\" href=\"smallvec/trait.Array.html\" title=\"trait smallvec::Array\">Array</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;&lt;A as <a class=\"trait\" href=\"smallvec/trait.Array.html\" title=\"trait smallvec::Array\">Array</a>&gt;::<a class=\"type\" href=\"smallvec/trait.Array.html#associatedtype.Item\" title=\"type smallvec::Array::Item\">Item</a>&gt; for <a class=\"struct\" href=\"smallvec/struct.SmallVec.html\" title=\"struct smallvec::SmallVec\">SmallVec</a>&lt;A&gt;","synthetic":false,"types":["smallvec::SmallVec"]}];
implementors["syn"] = [{"text":"impl&lt;T, P&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;T&gt; for <a class=\"struct\" href=\"syn/punctuated/struct.Punctuated.html\" title=\"struct syn::punctuated::Punctuated\">Punctuated</a>&lt;T, P&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;P: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>,&nbsp;</span>","synthetic":false,"types":["syn::punctuated::Punctuated"]},{"text":"impl&lt;T, P&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"enum\" href=\"syn/punctuated/enum.Pair.html\" title=\"enum syn::punctuated::Pair\">Pair</a>&lt;T, P&gt;&gt; for <a class=\"struct\" href=\"syn/punctuated/struct.Punctuated.html\" title=\"struct syn::punctuated::Punctuated\">Punctuated</a>&lt;T, P&gt;","synthetic":false,"types":["syn::punctuated::Punctuated"]}];
implementors["tinyvec"] = [{"text":"impl&lt;A:&nbsp;<a class=\"trait\" href=\"tinyvec/trait.Array.html\" title=\"trait tinyvec::Array\">Array</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;&lt;A as <a class=\"trait\" href=\"tinyvec/trait.Array.html\" title=\"trait tinyvec::Array\">Array</a>&gt;::<a class=\"type\" href=\"tinyvec/trait.Array.html#associatedtype.Item\" title=\"type tinyvec::Array::Item\">Item</a>&gt; for <a class=\"struct\" href=\"tinyvec/struct.ArrayVec.html\" title=\"struct tinyvec::ArrayVec\">ArrayVec</a>&lt;A&gt;","synthetic":false,"types":["tinyvec::arrayvec::ArrayVec"]},{"text":"impl&lt;A:&nbsp;<a class=\"trait\" href=\"tinyvec/trait.Array.html\" title=\"trait tinyvec::Array\">Array</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;&lt;A as <a class=\"trait\" href=\"tinyvec/trait.Array.html\" title=\"trait tinyvec::Array\">Array</a>&gt;::<a class=\"type\" href=\"tinyvec/trait.Array.html#associatedtype.Item\" title=\"type tinyvec::Array::Item\">Item</a>&gt; for <a class=\"enum\" href=\"tinyvec/enum.TinyVec.html\" title=\"enum tinyvec::TinyVec\">TinyVec</a>&lt;A&gt;","synthetic":false,"types":["tinyvec::tinyvec::TinyVec"]}];
implementors["tracing_subscriber"] = [{"text":"impl&lt;T, L&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/iter/traits/collect/trait.FromIterator.html\" title=\"trait core::iter::traits::collect::FromIterator\">FromIterator</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">(</a>T, L<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.57.0/std/primitive.tuple.html\">)</a>&gt; for <a class=\"struct\" href=\"tracing_subscriber/filter/targets/struct.Targets.html\" title=\"struct tracing_subscriber::filter::targets::Targets\">Targets</a> <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/convert/trait.Into.html\" title=\"trait core::convert::Into\">Into</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.57.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;L: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.57.0/core/convert/trait.Into.html\" title=\"trait core::convert::Into\">Into</a>&lt;<a class=\"struct\" href=\"tracing_subscriber/filter/struct.LevelFilter.html\" title=\"struct tracing_subscriber::filter::LevelFilter\">LevelFilter</a>&gt;,&nbsp;</span>","synthetic":false,"types":["tracing_subscriber::filter::targets::Targets"]}];
if (window.register_implementors) {window.register_implementors(implementors);} else {window.pending_implementors = implementors;}})()