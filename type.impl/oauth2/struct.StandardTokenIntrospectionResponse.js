(function() {var type_impls = {
"oauth2":[["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2884-2995\">source</a><a href=\"#impl-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;EF, TT&gt; <a class=\"struct\" href=\"oauth2/struct.StandardTokenIntrospectionResponse.html\" title=\"struct oauth2::StandardTokenIntrospectionResponse\">StandardTokenIntrospectionResponse</a>&lt;EF, TT&gt;<div class=\"where\">where\n    EF: <a class=\"trait\" href=\"oauth2/trait.ExtraTokenFields.html\" title=\"trait oauth2::ExtraTokenFields\">ExtraTokenFields</a>,\n    TT: <a class=\"trait\" href=\"oauth2/trait.TokenType.html\" title=\"trait oauth2::TokenType\">TokenType</a>,</div></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.new\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2892-2909\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.new\" class=\"fn\">new</a>(active: <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.bool.html\">bool</a>, extra_fields: EF) -&gt; Self</h4></section></summary><div class=\"docblock\"><p>Instantiate a new OAuth2 token introspection response.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_active\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2914-2916\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_active\" class=\"fn\">set_active</a>(&amp;mut self, active: <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.bool.html\">bool</a>)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_active</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_scopes\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2920-2922\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_scopes\" class=\"fn\">set_scopes</a>(&amp;mut self, scopes: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/vec/struct.Vec.html\" title=\"struct alloc::vec::Vec\">Vec</a>&lt;<a class=\"struct\" href=\"oauth2/struct.Scope.html\" title=\"struct oauth2::Scope\">Scope</a>&gt;&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_scopes</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_client_id\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2926-2928\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_client_id\" class=\"fn\">set_client_id</a>(&amp;mut self, client_id: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"oauth2/struct.ClientId.html\" title=\"struct oauth2::ClientId\">ClientId</a>&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_client_id</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_username\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2932-2934\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_username\" class=\"fn\">set_username</a>(&amp;mut self, username: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_username</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_token_type\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2938-2940\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_token_type\" class=\"fn\">set_token_type</a>(&amp;mut self, token_type: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;TT&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_token_type</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_exp\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2944-2946\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_exp\" class=\"fn\">set_exp</a>(&amp;mut self, exp: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_exp</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_iat\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2950-2952\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_iat\" class=\"fn\">set_iat</a>(&amp;mut self, iat: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_iat</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_nbf\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2956-2958\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_nbf\" class=\"fn\">set_nbf</a>(&amp;mut self, nbf: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_nbf</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_sub\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2962-2964\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_sub\" class=\"fn\">set_sub</a>(&amp;mut self, sub: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_sub</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_aud\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2968-2970\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_aud\" class=\"fn\">set_aud</a>(&amp;mut self, aud: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/vec/struct.Vec.html\" title=\"struct alloc::vec::Vec\">Vec</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>&gt;&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_aud</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_iss\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2974-2976\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_iss\" class=\"fn\">set_iss</a>(&amp;mut self, iss: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_iss</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_jti\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2980-2982\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_jti\" class=\"fn\">set_jti</a>(&amp;mut self, jti: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>&gt;)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_jti</code> field.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.extra_fields\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2986-2988\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.extra_fields\" class=\"fn\">extra_fields</a>(&amp;self) -&gt; <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.reference.html\">&amp;EF</a></h4></section></summary><div class=\"docblock\"><p>Extra fields defined by the client application.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_extra_fields\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2992-2994\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.StandardTokenIntrospectionResponse.html#tymethod.set_extra_fields\" class=\"fn\">set_extra_fields</a>(&amp;mut self, extra_fields: EF)</h4></section></summary><div class=\"docblock\"><p>Sets the <code>set_extra_fields</code> field.</p>\n</div></details></div></details>",0,"oauth2::basic::BasicTokenIntrospectionResponse"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Serialize-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2828\">source</a><a href=\"#impl-Serialize-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;EF, TT&gt; <a class=\"trait\" href=\"serde/ser/trait.Serialize.html\" title=\"trait serde::ser::Serialize\">Serialize</a> for <a class=\"struct\" href=\"oauth2/struct.StandardTokenIntrospectionResponse.html\" title=\"struct oauth2::StandardTokenIntrospectionResponse\">StandardTokenIntrospectionResponse</a>&lt;EF, TT&gt;<div class=\"where\">where\n    EF: <a class=\"trait\" href=\"oauth2/trait.ExtraTokenFields.html\" title=\"trait oauth2::ExtraTokenFields\">ExtraTokenFields</a>,\n    TT: <a class=\"trait\" href=\"oauth2/trait.TokenType.html\" title=\"trait oauth2::TokenType\">TokenType</a> + 'static,</div></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.serialize\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2828\">source</a><a href=\"#method.serialize\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"serde/ser/trait.Serialize.html#tymethod.serialize\" class=\"fn\">serialize</a>&lt;__S&gt;(&amp;self, __serializer: __S) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/result/enum.Result.html\" title=\"enum core::result::Result\">Result</a>&lt;__S::<a class=\"associatedtype\" href=\"serde/ser/trait.Serializer.html#associatedtype.Ok\" title=\"type serde::ser::Serializer::Ok\">Ok</a>, __S::<a class=\"associatedtype\" href=\"serde/ser/trait.Serializer.html#associatedtype.Error\" title=\"type serde::ser::Serializer::Error\">Error</a>&gt;<div class=\"where\">where\n    __S: <a class=\"trait\" href=\"serde/ser/trait.Serializer.html\" title=\"trait serde::ser::Serializer\">Serializer</a>,</div></h4></section></summary><div class='docblock'>Serialize this value into the given Serde serializer. <a href=\"serde/ser/trait.Serialize.html#tymethod.serialize\">Read more</a></div></details></div></details>","Serialize","oauth2::basic::BasicTokenIntrospectionResponse"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Deserialize%3C'de%3E-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2828\">source</a><a href=\"#impl-Deserialize%3C'de%3E-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;'de, EF, TT&gt; <a class=\"trait\" href=\"serde/de/trait.Deserialize.html\" title=\"trait serde::de::Deserialize\">Deserialize</a>&lt;'de&gt; for <a class=\"struct\" href=\"oauth2/struct.StandardTokenIntrospectionResponse.html\" title=\"struct oauth2::StandardTokenIntrospectionResponse\">StandardTokenIntrospectionResponse</a>&lt;EF, TT&gt;<div class=\"where\">where\n    EF: <a class=\"trait\" href=\"oauth2/trait.ExtraTokenFields.html\" title=\"trait oauth2::ExtraTokenFields\">ExtraTokenFields</a>,\n    TT: <a class=\"trait\" href=\"oauth2/trait.TokenType.html\" title=\"trait oauth2::TokenType\">TokenType</a> + 'static,</div></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.deserialize\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2828\">source</a><a href=\"#method.deserialize\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"serde/de/trait.Deserialize.html#tymethod.deserialize\" class=\"fn\">deserialize</a>&lt;__D&gt;(__deserializer: __D) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/result/enum.Result.html\" title=\"enum core::result::Result\">Result</a>&lt;Self, __D::<a class=\"associatedtype\" href=\"serde/de/trait.Deserializer.html#associatedtype.Error\" title=\"type serde::de::Deserializer::Error\">Error</a>&gt;<div class=\"where\">where\n    __D: <a class=\"trait\" href=\"serde/de/trait.Deserializer.html\" title=\"trait serde::de::Deserializer\">Deserializer</a>&lt;'de&gt;,</div></h4></section></summary><div class='docblock'>Deserialize this value from the given Serde deserializer. <a href=\"serde/de/trait.Deserialize.html#tymethod.deserialize\">Read more</a></div></details></div></details>","Deserialize<'de>","oauth2::basic::BasicTokenIntrospectionResponse"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-TokenIntrospectionResponse%3CTT%3E-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2996-3048\">source</a><a href=\"#impl-TokenIntrospectionResponse%3CTT%3E-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;EF, TT&gt; <a class=\"trait\" href=\"oauth2/trait.TokenIntrospectionResponse.html\" title=\"trait oauth2::TokenIntrospectionResponse\">TokenIntrospectionResponse</a>&lt;TT&gt; for <a class=\"struct\" href=\"oauth2/struct.StandardTokenIntrospectionResponse.html\" title=\"struct oauth2::StandardTokenIntrospectionResponse\">StandardTokenIntrospectionResponse</a>&lt;EF, TT&gt;<div class=\"where\">where\n    EF: <a class=\"trait\" href=\"oauth2/trait.ExtraTokenFields.html\" title=\"trait oauth2::ExtraTokenFields\">ExtraTokenFields</a>,\n    TT: <a class=\"trait\" href=\"oauth2/trait.TokenType.html\" title=\"trait oauth2::TokenType\">TokenType</a>,</div></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.active\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3001-3003\">source</a><a href=\"#method.active\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.active\" class=\"fn\">active</a>(&amp;self) -&gt; <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.bool.html\">bool</a></h4></section></summary><div class='docblock'>REQUIRED.  Boolean indicator of whether or not the presented token\nis currently active.  The specifics of a token’s “active” state\nwill vary depending on the implementation of the authorization\nserver and the information it keeps about its tokens, but a “true”\nvalue return for the “active” property will generally indicate\nthat a given token has been issued by this authorization server,\nhas not been revoked by the resource owner, and is within its\ngiven time window of validity (e.g., after its issuance time and\nbefore its expiration time).</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.scopes\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3005-3007\">source</a><a href=\"#method.scopes\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.scopes\" class=\"fn\">scopes</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/vec/struct.Vec.html\" title=\"struct alloc::vec::Vec\">Vec</a>&lt;<a class=\"struct\" href=\"oauth2/struct.Scope.html\" title=\"struct oauth2::Scope\">Scope</a>&gt;&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  A JSON string containing a space-separated list of\nscopes associated with this token, in the format described in\n<a href=\"https://tools.ietf.org/html/rfc7662#section-3.3\">Section 3.3 of RFC 7662</a>.\nIf included in the response,\nthis space-delimited field is parsed into a <code>Vec</code> of individual scopes. If omitted from\nthe response, this field is <code>None</code>.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.client_id\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3009-3011\">source</a><a href=\"#method.client_id\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.client_id\" class=\"fn\">client_id</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"struct\" href=\"oauth2/struct.ClientId.html\" title=\"struct oauth2::ClientId\">ClientId</a>&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  Client identifier for the OAuth 2.0 client that\nrequested this token.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.username\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3013-3015\">source</a><a href=\"#method.username\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.username\" class=\"fn\">username</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.str.html\">str</a>&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  Human-readable identifier for the resource owner who\nauthorized this token.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.token_type\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3017-3019\">source</a><a href=\"#method.token_type\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.token_type\" class=\"fn\">token_type</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.reference.html\">&amp;TT</a>&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  Type of the token as defined in\n<a href=\"https://tools.ietf.org/html/rfc7662#section-5.1\">Section 5.1 of RFC 7662</a>.\nValue is case insensitive and deserialized to the generic <code>TokenType</code> parameter.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.exp\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3021-3023\">source</a><a href=\"#method.exp\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.exp\" class=\"fn\">exp</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  Integer timestamp, measured in the number of seconds\nsince January 1 1970 UTC, indicating when this token will expire,\nas defined in JWT <a href=\"https://tools.ietf.org/html/rfc7519\">RFC7519</a>.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.iat\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3025-3027\">source</a><a href=\"#method.iat\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.iat\" class=\"fn\">iat</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  Integer timestamp, measured in the number of seconds\nsince January 1 1970 UTC, indicating when this token was\noriginally issued, as defined in JWT <a href=\"https://tools.ietf.org/html/rfc7519\">RFC7519</a>.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.nbf\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3029-3031\">source</a><a href=\"#method.nbf\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.nbf\" class=\"fn\">nbf</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  Integer timestamp, measured in the number of seconds\nsince January 1 1970 UTC, indicating when this token is not to be\nused before, as defined in JWT <a href=\"https://tools.ietf.org/html/rfc7519\">RFC7519</a>.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.sub\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3033-3035\">source</a><a href=\"#method.sub\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.sub\" class=\"fn\">sub</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.str.html\">str</a>&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  Subject of the token, as defined in JWT <a href=\"https://tools.ietf.org/html/rfc7519\">RFC7519</a>.\nUsually a machine-readable identifier of the resource owner who\nauthorized this token.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.aud\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3037-3039\">source</a><a href=\"#method.aud\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.aud\" class=\"fn\">aud</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/vec/struct.Vec.html\" title=\"struct alloc::vec::Vec\">Vec</a>&lt;<a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>&gt;&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  Service-specific string identifier or list of string\nidentifiers representing the intended audience for this token, as\ndefined in JWT <a href=\"https://tools.ietf.org/html/rfc7519\">RFC7519</a>.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.iss\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3041-3043\">source</a><a href=\"#method.iss\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.iss\" class=\"fn\">iss</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.str.html\">str</a>&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  String representing the issuer of this token, as\ndefined in JWT <a href=\"https://tools.ietf.org/html/rfc7519\">RFC7519</a>.</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.jti\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#3045-3047\">source</a><a href=\"#method.jti\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"oauth2/trait.TokenIntrospectionResponse.html#tymethod.jti\" class=\"fn\">jti</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.str.html\">str</a>&gt;</h4></section></summary><div class='docblock'>OPTIONAL.  String identifier for the token, as defined in JWT\n<a href=\"https://tools.ietf.org/html/rfc7519\">RFC7519</a>.</div></details></div></details>","TokenIntrospectionResponse<TT>","oauth2::basic::BasicTokenIntrospectionResponse"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Debug-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2828\">source</a><a href=\"#impl-Debug-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;EF, TT&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a> for <a class=\"struct\" href=\"oauth2/struct.StandardTokenIntrospectionResponse.html\" title=\"struct oauth2::StandardTokenIntrospectionResponse\">StandardTokenIntrospectionResponse</a>&lt;EF, TT&gt;<div class=\"where\">where\n    EF: <a class=\"trait\" href=\"oauth2/trait.ExtraTokenFields.html\" title=\"trait oauth2::ExtraTokenFields\">ExtraTokenFields</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a>,\n    TT: <a class=\"trait\" href=\"oauth2/trait.TokenType.html\" title=\"trait oauth2::TokenType\">TokenType</a> + 'static + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a>,</div></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.fmt\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2828\">source</a><a href=\"#method.fmt\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html#tymethod.fmt\" class=\"fn\">fmt</a>(&amp;self, f: &amp;mut <a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/struct.Formatter.html\" title=\"struct core::fmt::Formatter\">Formatter</a>&lt;'_&gt;) -&gt; <a class=\"type\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/type.Result.html\" title=\"type core::fmt::Result\">Result</a></h4></section></summary><div class='docblock'>Formats the value using the given formatter. <a href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html#tymethod.fmt\">Read more</a></div></details></div></details>","Debug","oauth2::basic::BasicTokenIntrospectionResponse"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Clone-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2828\">source</a><a href=\"#impl-Clone-for-StandardTokenIntrospectionResponse%3CEF,+TT%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;EF, TT&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a> for <a class=\"struct\" href=\"oauth2/struct.StandardTokenIntrospectionResponse.html\" title=\"struct oauth2::StandardTokenIntrospectionResponse\">StandardTokenIntrospectionResponse</a>&lt;EF, TT&gt;<div class=\"where\">where\n    EF: <a class=\"trait\" href=\"oauth2/trait.ExtraTokenFields.html\" title=\"trait oauth2::ExtraTokenFields\">ExtraTokenFields</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,\n    TT: <a class=\"trait\" href=\"oauth2/trait.TokenType.html\" title=\"trait oauth2::TokenType\">TokenType</a> + 'static + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,</div></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.clone\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#2828\">source</a><a href=\"#method.clone\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html#tymethod.clone\" class=\"fn\">clone</a>(&amp;self) -&gt; <a class=\"struct\" href=\"oauth2/struct.StandardTokenIntrospectionResponse.html\" title=\"struct oauth2::StandardTokenIntrospectionResponse\">StandardTokenIntrospectionResponse</a>&lt;EF, TT&gt;</h4></section></summary><div class='docblock'>Returns a copy of the value. <a href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html#tymethod.clone\">Read more</a></div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.clone_from\" class=\"method trait-impl\"><span class=\"rightside\"><span class=\"since\" title=\"Stable since Rust version 1.0.0\">1.0.0</span> · <a class=\"src\" href=\"https://doc.rust-lang.org/1.76.0/src/core/clone.rs.html#169\">source</a></span><a href=\"#method.clone_from\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html#method.clone_from\" class=\"fn\">clone_from</a>(&amp;mut self, source: <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.reference.html\">&amp;Self</a>)</h4></section></summary><div class='docblock'>Performs copy-assignment from <code>source</code>. <a href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html#method.clone_from\">Read more</a></div></details></div></details>","Clone","oauth2::basic::BasicTokenIntrospectionResponse"]]
};if (window.register_type_impls) {window.register_type_impls(type_impls);} else {window.pending_type_impls = type_impls;}})()