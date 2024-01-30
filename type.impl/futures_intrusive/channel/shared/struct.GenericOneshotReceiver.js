(function() {var type_impls = {
"futures_intrusive":[["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-GenericOneshotReceiver%3CMutexType,+T%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/channel/oneshot.rs.html#399-412\">source</a><a href=\"#impl-GenericOneshotReceiver%3CMutexType,+T%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;MutexType, T&gt; <a class=\"struct\" href=\"futures_intrusive/channel/shared/struct.GenericOneshotReceiver.html\" title=\"struct futures_intrusive::channel::shared::GenericOneshotReceiver\">GenericOneshotReceiver</a>&lt;MutexType, T&gt;<span class=\"where fmt-newline\">where\n    MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a> + 'static,</span></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.receive\" class=\"method\"><a class=\"src rightside\" href=\"src/futures_intrusive/channel/oneshot.rs.html#405-411\">source</a><h4 class=\"code-header\">pub fn <a href=\"futures_intrusive/channel/shared/struct.GenericOneshotReceiver.html#tymethod.receive\" class=\"fn\">receive</a>(&amp;self) -&gt; <a class=\"struct\" href=\"futures_intrusive/channel/shared/struct.ChannelReceiveFuture.html\" title=\"struct futures_intrusive::channel::shared::ChannelReceiveFuture\">ChannelReceiveFuture</a>&lt;MutexType, T&gt; <a href=\"#\" class=\"tooltip\" data-notable-ty=\"ChannelReceiveFuture&lt;MutexType, T&gt;\">ⓘ</a></h4></section></summary><div class=\"docblock\"><p>Returns a future that gets fulfilled when a value is written to the channel.\nIf the channels gets closed, the future will resolve to <code>None</code>.</p>\n</div></details></div></details>",0,"futures_intrusive::channel::oneshot::if_alloc::shared::if_std::OneshotReceiver"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Drop-for-GenericOneshotReceiver%3CMutexType,+T%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/channel/oneshot.rs.html#345-354\">source</a><a href=\"#impl-Drop-for-GenericOneshotReceiver%3CMutexType,+T%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;MutexType, T&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.75.0/core/ops/drop/trait.Drop.html\" title=\"trait core::ops::drop::Drop\">Drop</a> for <a class=\"struct\" href=\"futures_intrusive/channel/shared/struct.GenericOneshotReceiver.html\" title=\"struct futures_intrusive::channel::shared::GenericOneshotReceiver\">GenericOneshotReceiver</a>&lt;MutexType, T&gt;<span class=\"where fmt-newline\">where\n    MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>,</span></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.drop\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/channel/oneshot.rs.html#349-353\">source</a><a href=\"#method.drop\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.75.0/core/ops/drop/trait.Drop.html#tymethod.drop\" class=\"fn\">drop</a>(&amp;mut self)</h4></section></summary><div class='docblock'>Executes the destructor for this type. <a href=\"https://doc.rust-lang.org/1.75.0/core/ops/drop/trait.Drop.html#tymethod.drop\">Read more</a></div></details></div></details>","Drop","futures_intrusive::channel::oneshot::if_alloc::shared::if_std::OneshotReceiver"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Debug-for-GenericOneshotReceiver%3CMutexType,+T%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/channel/oneshot.rs.html#325-332\">source</a><a href=\"#impl-Debug-for-GenericOneshotReceiver%3CMutexType,+T%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;MutexType, T&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.75.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a> for <a class=\"struct\" href=\"futures_intrusive/channel/shared/struct.GenericOneshotReceiver.html\" title=\"struct futures_intrusive::channel::shared::GenericOneshotReceiver\">GenericOneshotReceiver</a>&lt;MutexType, T&gt;<span class=\"where fmt-newline\">where\n    MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>,</span></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.fmt\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/channel/oneshot.rs.html#329-331\">source</a><a href=\"#method.fmt\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.75.0/core/fmt/trait.Debug.html#tymethod.fmt\" class=\"fn\">fmt</a>(&amp;self, f: &amp;mut <a class=\"struct\" href=\"https://doc.rust-lang.org/1.75.0/core/fmt/struct.Formatter.html\" title=\"struct core::fmt::Formatter\">Formatter</a>&lt;'_&gt;) -&gt; <a class=\"type\" href=\"https://doc.rust-lang.org/1.75.0/core/fmt/type.Result.html\" title=\"type core::fmt::Result\">Result</a></h4></section></summary><div class='docblock'>Formats the value using the given formatter. <a href=\"https://doc.rust-lang.org/1.75.0/core/fmt/trait.Debug.html#tymethod.fmt\">Read more</a></div></details></div></details>","Debug","futures_intrusive::channel::oneshot::if_alloc::shared::if_std::OneshotReceiver"]]
};if (window.register_type_impls) {window.register_type_impls(type_impls);} else {window.pending_type_impls = type_impls;}})()