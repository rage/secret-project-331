(function() {var implementors = {
"dashmap":[["impl&lt;'a, K, V: 'a, S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/hash/trait.BuildHasher.html\" title=\"trait core::hash::BuildHasher\">BuildHasher</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>, Q&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.69.0/std/primitive.reference.html\">&amp;Q</a>&gt; for &amp;'a <a class=\"struct\" href=\"dashmap/struct.DashMap.html\" title=\"struct dashmap::DashMap\">DashMap</a>&lt;K, V, S&gt;<span class=\"where fmt-newline\">where\n    K: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/borrow/trait.Borrow.html\" title=\"trait core::borrow::Borrow\">Borrow</a>&lt;Q&gt; + 'a + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a>,\n    Q: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/hash/trait.Hash.html\" title=\"trait core::hash::Hash\">Hash</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/cmp/trait.Eq.html\" title=\"trait core::cmp::Eq\">Eq</a> + ?<a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/marker/trait.Sized.html\" title=\"trait core::marker::Sized\">Sized</a>,</span>"]],
"num_bigint":[["impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.69.0/std/primitive.usize.html\">usize</a>&gt; for &amp;'a <a class=\"struct\" href=\"num_bigint/struct.BigInt.html\" title=\"struct num_bigint::BigInt\">BigInt</a>"],["impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.69.0/std/primitive.usize.html\">usize</a>&gt; for &amp;'a <a class=\"struct\" href=\"num_bigint/struct.BigUint.html\" title=\"struct num_bigint::BigUint\">BigUint</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.69.0/std/primitive.usize.html\">usize</a>&gt; for <a class=\"struct\" href=\"num_bigint/struct.BigUint.html\" title=\"struct num_bigint::BigUint\">BigUint</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.69.0/std/primitive.usize.html\">usize</a>&gt; for <a class=\"struct\" href=\"num_bigint/struct.BigInt.html\" title=\"struct num_bigint::BigInt\">BigInt</a>"]],
"openssl":[["impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.69.0/std/primitive.i32.html\">i32</a>&gt; for &amp;'a <a class=\"struct\" href=\"openssl/bn/struct.BigNum.html\" title=\"struct openssl::bn::BigNum\">BigNum</a>"],["impl&lt;'a&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.69.0/std/primitive.i32.html\">i32</a>&gt; for &amp;'a <a class=\"struct\" href=\"openssl/bn/struct.BigNumRef.html\" title=\"struct openssl::bn::BigNumRef\">BigNumRef</a>"]],
"typenum":[["impl&lt;U: <a class=\"trait\" href=\"typenum/marker_traits/trait.Unsigned.html\" title=\"trait typenum::marker_traits::Unsigned\">Unsigned</a>, B: <a class=\"trait\" href=\"typenum/marker_traits/trait.Bit.html\" title=\"trait typenum::marker_traits::Bit\">Bit</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"struct\" href=\"typenum/bit/struct.B0.html\" title=\"struct typenum::bit::B0\">B0</a>&gt; for <a class=\"struct\" href=\"typenum/uint/struct.UInt.html\" title=\"struct typenum::uint::UInt\">UInt</a>&lt;U, B&gt;"],["impl&lt;U: <a class=\"trait\" href=\"typenum/marker_traits/trait.Unsigned.html\" title=\"trait typenum::marker_traits::Unsigned\">Unsigned</a>, B: <a class=\"trait\" href=\"typenum/marker_traits/trait.Bit.html\" title=\"trait typenum::marker_traits::Bit\">Bit</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"struct\" href=\"typenum/uint/struct.UTerm.html\" title=\"struct typenum::uint::UTerm\">UTerm</a>&gt; for <a class=\"struct\" href=\"typenum/uint/struct.UInt.html\" title=\"struct typenum::uint::UInt\">UInt</a>&lt;U, B&gt;"],["impl&lt;U, B: <a class=\"trait\" href=\"typenum/marker_traits/trait.Bit.html\" title=\"trait typenum::marker_traits::Bit\">Bit</a>, Ur: <a class=\"trait\" href=\"typenum/marker_traits/trait.Unsigned.html\" title=\"trait typenum::marker_traits::Unsigned\">Unsigned</a>, Br: <a class=\"trait\" href=\"typenum/marker_traits/trait.Bit.html\" title=\"trait typenum::marker_traits::Bit\">Bit</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"struct\" href=\"typenum/uint/struct.UInt.html\" title=\"struct typenum::uint::UInt\">UInt</a>&lt;Ur, Br&gt;&gt; for <a class=\"struct\" href=\"typenum/uint/struct.UInt.html\" title=\"struct typenum::uint::UInt\">UInt</a>&lt;U, B&gt;<span class=\"where fmt-newline\">where\n    <a class=\"struct\" href=\"typenum/uint/struct.UInt.html\" title=\"struct typenum::uint::UInt\">UInt</a>&lt;Ur, Br&gt;: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/arith/trait.Sub.html\" title=\"trait core::ops::arith::Sub\">Sub</a>&lt;<a class=\"struct\" href=\"typenum/bit/struct.B1.html\" title=\"struct typenum::bit::B1\">B1</a>&gt;,\n    U: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"type\" href=\"typenum/operator_aliases/type.Sub1.html\" title=\"type typenum::operator_aliases::Sub1\">Sub1</a>&lt;<a class=\"struct\" href=\"typenum/uint/struct.UInt.html\" title=\"struct typenum::uint::UInt\">UInt</a>&lt;Ur, Br&gt;&gt;&gt; + <a class=\"trait\" href=\"typenum/marker_traits/trait.Unsigned.html\" title=\"trait typenum::marker_traits::Unsigned\">Unsigned</a>,</span>"],["impl&lt;U: <a class=\"trait\" href=\"typenum/marker_traits/trait.Unsigned.html\" title=\"trait typenum::marker_traits::Unsigned\">Unsigned</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;U&gt; for <a class=\"struct\" href=\"typenum/uint/struct.UTerm.html\" title=\"struct typenum::uint::UTerm\">UTerm</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"struct\" href=\"typenum/bit/struct.B1.html\" title=\"struct typenum::bit::B1\">B1</a>&gt; for <a class=\"struct\" href=\"typenum/uint/struct.UTerm.html\" title=\"struct typenum::uint::UTerm\">UTerm</a>"],["impl <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"struct\" href=\"typenum/bit/struct.B0.html\" title=\"struct typenum::bit::B0\">B0</a>&gt; for <a class=\"struct\" href=\"typenum/uint/struct.UTerm.html\" title=\"struct typenum::uint::UTerm\">UTerm</a>"],["impl&lt;U: <a class=\"trait\" href=\"typenum/marker_traits/trait.Unsigned.html\" title=\"trait typenum::marker_traits::Unsigned\">Unsigned</a>, B: <a class=\"trait\" href=\"typenum/marker_traits/trait.Bit.html\" title=\"trait typenum::marker_traits::Bit\">Bit</a>&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.69.0/core/ops/bit/trait.Shr.html\" title=\"trait core::ops::bit::Shr\">Shr</a>&lt;<a class=\"struct\" href=\"typenum/bit/struct.B1.html\" title=\"struct typenum::bit::B1\">B1</a>&gt; for <a class=\"struct\" href=\"typenum/uint/struct.UInt.html\" title=\"struct typenum::uint::UInt\">UInt</a>&lt;U, B&gt;"]]
};if (window.register_implementors) {window.register_implementors(implementors);} else {window.pending_implementors = implementors;}})()