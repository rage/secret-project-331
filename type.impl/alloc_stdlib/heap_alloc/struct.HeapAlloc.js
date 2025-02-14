(function() {
    var type_impls = Object.fromEntries([["alloc_stdlib",[["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Allocator%3CT%3E-for-HeapAlloc%3CT%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/alloc_stdlib/heap_alloc.rs.html#86-97\">Source</a><a href=\"#impl-Allocator%3CT%3E-for-HeapAlloc%3CT%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.84.1/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>&gt; <a class=\"trait\" href=\"alloc_stdlib/trait.Allocator.html\" title=\"trait alloc_stdlib::Allocator\">Allocator</a>&lt;T&gt; for <a class=\"struct\" href=\"alloc_stdlib/heap_alloc/struct.HeapAlloc.html\" title=\"struct alloc_stdlib::heap_alloc::HeapAlloc\">HeapAlloc</a>&lt;T&gt;</h3></section></summary><div class=\"impl-items\"><section id=\"associatedtype.AllocatedMemory\" class=\"associatedtype trait-impl\"><a class=\"src rightside\" href=\"src/alloc_stdlib/heap_alloc.rs.html#87\">Source</a><a href=\"#associatedtype.AllocatedMemory\" class=\"anchor\">§</a><h4 class=\"code-header\">type <a href=\"alloc_stdlib/trait.Allocator.html#associatedtype.AllocatedMemory\" class=\"associatedtype\">AllocatedMemory</a> = <a class=\"struct\" href=\"alloc_stdlib/heap_alloc/struct.WrapBox.html\" title=\"struct alloc_stdlib::heap_alloc::WrapBox\">WrapBox</a>&lt;T&gt;</h4></section><section id=\"method.alloc_cell\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/alloc_stdlib/heap_alloc.rs.html#88-93\">Source</a><a href=\"#method.alloc_cell\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"alloc_stdlib/trait.Allocator.html#tymethod.alloc_cell\" class=\"fn\">alloc_cell</a>(self: &amp;mut <a class=\"struct\" href=\"alloc_stdlib/heap_alloc/struct.HeapAlloc.html\" title=\"struct alloc_stdlib::heap_alloc::HeapAlloc\">HeapAlloc</a>&lt;T&gt;, len: <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.84.1/std/primitive.usize.html\">usize</a>) -&gt; <a class=\"struct\" href=\"alloc_stdlib/heap_alloc/struct.WrapBox.html\" title=\"struct alloc_stdlib::heap_alloc::WrapBox\">WrapBox</a>&lt;T&gt;</h4></section><section id=\"method.free_cell\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/alloc_stdlib/heap_alloc.rs.html#94-96\">Source</a><a href=\"#method.free_cell\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"alloc_stdlib/trait.Allocator.html#tymethod.free_cell\" class=\"fn\">free_cell</a>(self: &amp;mut <a class=\"struct\" href=\"alloc_stdlib/heap_alloc/struct.HeapAlloc.html\" title=\"struct alloc_stdlib::heap_alloc::HeapAlloc\">HeapAlloc</a>&lt;T&gt;, _data: <a class=\"struct\" href=\"alloc_stdlib/heap_alloc/struct.WrapBox.html\" title=\"struct alloc_stdlib::heap_alloc::WrapBox\">WrapBox</a>&lt;T&gt;)</h4></section></div></details>","Allocator<T>","alloc_stdlib::heap_alloc::HeapAllocUninitialized"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Default-for-HeapAlloc%3CT%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/alloc_stdlib/heap_alloc.rs.html#74-78\">Source</a><a href=\"#impl-Default-for-HeapAlloc%3CT%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.84.1/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.84.1/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.84.1/core/default/trait.Default.html\" title=\"trait core::default::Default\">Default</a> for <a class=\"struct\" href=\"alloc_stdlib/heap_alloc/struct.HeapAlloc.html\" title=\"struct alloc_stdlib::heap_alloc::HeapAlloc\">HeapAlloc</a>&lt;T&gt;</h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.default\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/alloc_stdlib/heap_alloc.rs.html#75-77\">Source</a><a href=\"#method.default\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.84.1/core/default/trait.Default.html#tymethod.default\" class=\"fn\">default</a>() -&gt; Self</h4></section></summary><div class='docblock'>Returns the “default value” for a type. <a href=\"https://doc.rust-lang.org/1.84.1/core/default/trait.Default.html#tymethod.default\">Read more</a></div></details></div></details>","Default","alloc_stdlib::heap_alloc::HeapAllocUninitialized"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-HeapAlloc%3CT%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/alloc_stdlib/heap_alloc.rs.html#80-84\">Source</a><a href=\"#impl-HeapAlloc%3CT%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;T: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.84.1/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>&gt; <a class=\"struct\" href=\"alloc_stdlib/heap_alloc/struct.HeapAlloc.html\" title=\"struct alloc_stdlib::heap_alloc::HeapAlloc\">HeapAlloc</a>&lt;T&gt;</h3></section></summary><div class=\"impl-items\"><section id=\"method.new\" class=\"method\"><a class=\"src rightside\" href=\"src/alloc_stdlib/heap_alloc.rs.html#81-83\">Source</a><h4 class=\"code-header\">pub fn <a href=\"alloc_stdlib/heap_alloc/struct.HeapAlloc.html#tymethod.new\" class=\"fn\">new</a>(data: T) -&gt; <a class=\"struct\" href=\"alloc_stdlib/heap_alloc/struct.HeapAlloc.html\" title=\"struct alloc_stdlib::heap_alloc::HeapAlloc\">HeapAlloc</a>&lt;T&gt;</h4></section></div></details>",0,"alloc_stdlib::heap_alloc::HeapAllocUninitialized"]]]]);
    if (window.register_type_impls) {
        window.register_type_impls(type_impls);
    } else {
        window.pending_type_impls = type_impls;
    }
})()
//{"start":55,"fragment_lengths":[5689]}