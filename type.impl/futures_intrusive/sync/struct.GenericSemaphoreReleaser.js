(function() {var type_impls = {
"futures_intrusive":[["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-GenericSemaphoreReleaser%3C'_,+MutexType%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#313-325\">source</a><a href=\"#impl-GenericSemaphoreReleaser%3C'_,+MutexType%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>&gt; <a class=\"struct\" href=\"futures_intrusive/sync/struct.GenericSemaphoreReleaser.html\" title=\"struct futures_intrusive::sync::GenericSemaphoreReleaser\">GenericSemaphoreReleaser</a>&lt;'_, MutexType&gt;</h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.disarm\" class=\"method\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#320-324\">source</a><h4 class=\"code-header\">pub fn <a href=\"futures_intrusive/sync/struct.GenericSemaphoreReleaser.html#tymethod.disarm\" class=\"fn\">disarm</a>(&amp;mut self) -&gt; <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.usize.html\">usize</a></h4></section></summary><div class=\"docblock\"><p>Prevents the SemaphoreReleaser from automatically releasing the permits\nwhen it gets dropped.\nThis is helpful if the permits must be acquired for a longer lifetime\nthan the one of the SemaphoreReleaser.\nIf this method is used it is important to release the acquired permits\nmanually back to the Semaphore.</p>\n</div></details></div></details>",0,"futures_intrusive::sync::semaphore::if_std::SemaphoreReleaser","futures_intrusive::sync::semaphore::LocalSemaphoreReleaser"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Debug-for-GenericSemaphoreReleaser%3C'_,+MutexType%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#305-311\">source</a><a href=\"#impl-Debug-for-GenericSemaphoreReleaser%3C'_,+MutexType%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a> for <a class=\"struct\" href=\"futures_intrusive/sync/struct.GenericSemaphoreReleaser.html\" title=\"struct futures_intrusive::sync::GenericSemaphoreReleaser\">GenericSemaphoreReleaser</a>&lt;'_, MutexType&gt;</h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.fmt\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#308-310\">source</a><a href=\"#method.fmt\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html#tymethod.fmt\" class=\"fn\">fmt</a>(&amp;self, f: &amp;mut <a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/struct.Formatter.html\" title=\"struct core::fmt::Formatter\">Formatter</a>&lt;'_&gt;) -&gt; <a class=\"type\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/type.Result.html\" title=\"type core::fmt::Result\">Result</a></h4></section></summary><div class='docblock'>Formats the value using the given formatter. <a href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html#tymethod.fmt\">Read more</a></div></details></div></details>","Debug","futures_intrusive::sync::semaphore::if_std::SemaphoreReleaser","futures_intrusive::sync::semaphore::LocalSemaphoreReleaser"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Drop-for-GenericSemaphoreReleaser%3C'_,+MutexType%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#327-334\">source</a><a href=\"#impl-Drop-for-GenericSemaphoreReleaser%3C'_,+MutexType%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/ops/drop/trait.Drop.html\" title=\"trait core::ops::drop::Drop\">Drop</a> for <a class=\"struct\" href=\"futures_intrusive/sync/struct.GenericSemaphoreReleaser.html\" title=\"struct futures_intrusive::sync::GenericSemaphoreReleaser\">GenericSemaphoreReleaser</a>&lt;'_, MutexType&gt;</h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.drop\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#328-333\">source</a><a href=\"#method.drop\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.76.0/core/ops/drop/trait.Drop.html#tymethod.drop\" class=\"fn\">drop</a>(&amp;mut self)</h4></section></summary><div class='docblock'>Executes the destructor for this type. <a href=\"https://doc.rust-lang.org/1.76.0/core/ops/drop/trait.Drop.html#tymethod.drop\">Read more</a></div></details></div></details>","Drop","futures_intrusive::sync::semaphore::if_std::SemaphoreReleaser","futures_intrusive::sync::semaphore::LocalSemaphoreReleaser"]]
};if (window.register_type_impls) {window.register_type_impls(type_impls);} else {window.pending_type_impls = type_impls;}})()