(function() {var type_impls = {
"futures_intrusive":[["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Future-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#364-400\">source</a><a href=\"#impl-Future-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;'a, MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.75.0/core/future/future/trait.Future.html\" title=\"trait core::future::future::Future\">Future</a> for <a class=\"struct\" href=\"futures_intrusive/sync/struct.GenericSemaphoreAcquireFuture.html\" title=\"struct futures_intrusive::sync::GenericSemaphoreAcquireFuture\">GenericSemaphoreAcquireFuture</a>&lt;'a, MutexType&gt;</h3></section></summary><div class=\"impl-items\"><details class=\"toggle\" open><summary><section id=\"associatedtype.Output\" class=\"associatedtype trait-impl\"><a href=\"#associatedtype.Output\" class=\"anchor\">§</a><h4 class=\"code-header\">type <a href=\"https://doc.rust-lang.org/1.75.0/core/future/future/trait.Future.html#associatedtype.Output\" class=\"associatedtype\">Output</a> = <a class=\"struct\" href=\"futures_intrusive/sync/struct.GenericSemaphoreReleaser.html\" title=\"struct futures_intrusive::sync::GenericSemaphoreReleaser\">GenericSemaphoreReleaser</a>&lt;'a, MutexType&gt;</h4></section></summary><div class='docblock'>The type of value produced on completion.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.poll\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#369-399\">source</a><a href=\"#method.poll\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.75.0/core/future/future/trait.Future.html#tymethod.poll\" class=\"fn\">poll</a>(self: <a class=\"struct\" href=\"https://doc.rust-lang.org/1.75.0/core/pin/struct.Pin.html\" title=\"struct core::pin::Pin\">Pin</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.75.0/std/primitive.reference.html\">&amp;mut Self</a>&gt;, cx: &amp;mut <a class=\"struct\" href=\"https://doc.rust-lang.org/1.75.0/core/task/wake/struct.Context.html\" title=\"struct core::task::wake::Context\">Context</a>&lt;'_&gt;) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.75.0/core/task/poll/enum.Poll.html\" title=\"enum core::task::poll::Poll\">Poll</a>&lt;Self::<a class=\"associatedtype\" href=\"https://doc.rust-lang.org/1.75.0/core/future/future/trait.Future.html#associatedtype.Output\" title=\"type core::future::future::Future::Output\">Output</a>&gt;</h4></section></summary><div class='docblock'>Attempt to resolve the future to a final value, registering\nthe current task for wakeup if the value is not yet available. <a href=\"https://doc.rust-lang.org/1.75.0/core/future/future/trait.Future.html#tymethod.poll\">Read more</a></div></details></div></details>","Future","futures_intrusive::sync::semaphore::if_std::SemaphoreAcquireFuture","futures_intrusive::sync::semaphore::LocalSemaphoreAcquireFuture"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-FusedFuture-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#402-408\">source</a><a href=\"#impl-FusedFuture-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;'a, MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>&gt; <a class=\"trait\" href=\"futures_core/future/trait.FusedFuture.html\" title=\"trait futures_core::future::FusedFuture\">FusedFuture</a> for <a class=\"struct\" href=\"futures_intrusive/sync/struct.GenericSemaphoreAcquireFuture.html\" title=\"struct futures_intrusive::sync::GenericSemaphoreAcquireFuture\">GenericSemaphoreAcquireFuture</a>&lt;'a, MutexType&gt;</h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.is_terminated\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#405-407\">source</a><a href=\"#method.is_terminated\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"futures_core/future/trait.FusedFuture.html#tymethod.is_terminated\" class=\"fn\">is_terminated</a>(&amp;self) -&gt; <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.75.0/std/primitive.bool.html\">bool</a></h4></section></summary><div class='docblock'>Returns <code>true</code> if the underlying future should no longer be polled.</div></details></div></details>","FusedFuture","futures_intrusive::sync::semaphore::if_std::SemaphoreAcquireFuture","futures_intrusive::sync::semaphore::LocalSemaphoreAcquireFuture"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Debug-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#356-362\">source</a><a href=\"#impl-Debug-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;'a, MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.75.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a> for <a class=\"struct\" href=\"futures_intrusive/sync/struct.GenericSemaphoreAcquireFuture.html\" title=\"struct futures_intrusive::sync::GenericSemaphoreAcquireFuture\">GenericSemaphoreAcquireFuture</a>&lt;'a, MutexType&gt;</h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.fmt\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#359-361\">source</a><a href=\"#method.fmt\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.75.0/core/fmt/trait.Debug.html#tymethod.fmt\" class=\"fn\">fmt</a>(&amp;self, f: &amp;mut <a class=\"struct\" href=\"https://doc.rust-lang.org/1.75.0/core/fmt/struct.Formatter.html\" title=\"struct core::fmt::Formatter\">Formatter</a>&lt;'_&gt;) -&gt; <a class=\"type\" href=\"https://doc.rust-lang.org/1.75.0/core/fmt/type.Result.html\" title=\"type core::fmt::Result\">Result</a></h4></section></summary><div class='docblock'>Formats the value using the given formatter. <a href=\"https://doc.rust-lang.org/1.75.0/core/fmt/trait.Debug.html#tymethod.fmt\">Read more</a></div></details></div></details>","Debug","futures_intrusive::sync::semaphore::if_std::SemaphoreAcquireFuture","futures_intrusive::sync::semaphore::LocalSemaphoreAcquireFuture"],["<section id=\"impl-Send-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#351-354\">source</a><a href=\"#impl-Send-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;'a, MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.75.0/core/marker/trait.Sync.html\" title=\"trait core::marker::Sync\">Sync</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.75.0/core/marker/trait.Send.html\" title=\"trait core::marker::Send\">Send</a> for <a class=\"struct\" href=\"futures_intrusive/sync/struct.GenericSemaphoreAcquireFuture.html\" title=\"struct futures_intrusive::sync::GenericSemaphoreAcquireFuture\">GenericSemaphoreAcquireFuture</a>&lt;'a, MutexType&gt;</h3></section>","Send","futures_intrusive::sync::semaphore::if_std::SemaphoreAcquireFuture","futures_intrusive::sync::semaphore::LocalSemaphoreAcquireFuture"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Drop-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#410-430\">source</a><a href=\"#impl-Drop-for-GenericSemaphoreAcquireFuture%3C'a,+MutexType%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;'a, MutexType: <a class=\"trait\" href=\"lock_api/mutex/trait.RawMutex.html\" title=\"trait lock_api::mutex::RawMutex\">RawMutex</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.75.0/core/ops/drop/trait.Drop.html\" title=\"trait core::ops::drop::Drop\">Drop</a> for <a class=\"struct\" href=\"futures_intrusive/sync/struct.GenericSemaphoreAcquireFuture.html\" title=\"struct futures_intrusive::sync::GenericSemaphoreAcquireFuture\">GenericSemaphoreAcquireFuture</a>&lt;'a, MutexType&gt;</h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.drop\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/futures_intrusive/sync/semaphore.rs.html#413-429\">source</a><a href=\"#method.drop\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.75.0/core/ops/drop/trait.Drop.html#tymethod.drop\" class=\"fn\">drop</a>(&amp;mut self)</h4></section></summary><div class='docblock'>Executes the destructor for this type. <a href=\"https://doc.rust-lang.org/1.75.0/core/ops/drop/trait.Drop.html#tymethod.drop\">Read more</a></div></details></div></details>","Drop","futures_intrusive::sync::semaphore::if_std::SemaphoreAcquireFuture","futures_intrusive::sync::semaphore::LocalSemaphoreAcquireFuture"]]
};if (window.register_type_impls) {window.register_type_impls(type_impls);} else {window.pending_type_impls = type_impls;}})()