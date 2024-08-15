(function() {var type_impls = {
"oauth2":[["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Client%3CTE,+TR,+TT,+TIR,+RT,+TRE%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#632-1033\">source</a><a href=\"#impl-Client%3CTE,+TR,+TT,+TIR,+RT,+TRE%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;TE, TR, TT, TIR, RT, TRE&gt; <a class=\"struct\" href=\"oauth2/struct.Client.html\" title=\"struct oauth2::Client\">Client</a>&lt;TE, TR, TT, TIR, RT, TRE&gt;<div class=\"where\">where\n    TE: <a class=\"trait\" href=\"oauth2/trait.ErrorResponse.html\" title=\"trait oauth2::ErrorResponse\">ErrorResponse</a> + 'static,\n    TR: <a class=\"trait\" href=\"oauth2/trait.TokenResponse.html\" title=\"trait oauth2::TokenResponse\">TokenResponse</a>&lt;TT&gt;,\n    TT: <a class=\"trait\" href=\"oauth2/trait.TokenType.html\" title=\"trait oauth2::TokenType\">TokenType</a>,\n    TIR: <a class=\"trait\" href=\"oauth2/trait.TokenIntrospectionResponse.html\" title=\"trait oauth2::TokenIntrospectionResponse\">TokenIntrospectionResponse</a>&lt;TT&gt;,\n    RT: <a class=\"trait\" href=\"oauth2/revocation/trait.RevocableToken.html\" title=\"trait oauth2::revocation::RevocableToken\">RevocableToken</a>,\n    TRE: <a class=\"trait\" href=\"oauth2/trait.ErrorResponse.html\" title=\"trait oauth2::ErrorResponse\">ErrorResponse</a> + 'static,</div></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.new\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#661-679\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.new\" class=\"fn\">new</a>(\n    client_id: <a class=\"struct\" href=\"oauth2/struct.ClientId.html\" title=\"struct oauth2::ClientId\">ClientId</a>,\n    client_secret: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"oauth2/struct.ClientSecret.html\" title=\"struct oauth2::ClientSecret\">ClientSecret</a>&gt;,\n    auth_url: <a class=\"struct\" href=\"oauth2/struct.AuthUrl.html\" title=\"struct oauth2::AuthUrl\">AuthUrl</a>,\n    token_url: <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"oauth2/struct.TokenUrl.html\" title=\"struct oauth2::TokenUrl\">TokenUrl</a>&gt;\n) -&gt; Self</h4></section></summary><div class=\"docblock\"><p>Initializes an OAuth2 client with the fields common to most OAuth2 flows.</p>\n<h5 id=\"arguments\"><a href=\"#arguments\">Arguments</a></h5>\n<ul>\n<li><code>client_id</code> -  Client ID</li>\n<li><code>client_secret</code> -  Optional client secret. A client secret is generally used for private\n(server-side) OAuth2 clients and omitted from public (client-side or native app) OAuth2\nclients (see <a href=\"https://tools.ietf.org/html/rfc8252\">RFC 8252</a>).</li>\n<li><code>auth_url</code> -  Authorization endpoint: used by the client to obtain authorization from\nthe resource owner via user-agent redirection. This URL is used in all standard OAuth2\nflows except the <a href=\"https://tools.ietf.org/html/rfc6749#section-4.3\">Resource Owner Password Credentials\nGrant</a> and the\n<a href=\"https://tools.ietf.org/html/rfc6749#section-4.4\">Client Credentials Grant</a>.</li>\n<li><code>token_url</code> - Token endpoint: used by the client to exchange an authorization grant\n(code) for an access token, typically with client authentication. This URL is used in\nall standard OAuth2 flows except the\n<a href=\"https://tools.ietf.org/html/rfc6749#section-4.2\">Implicit Grant</a>. If this value is set\nto <code>None</code>, the <code>exchange_*</code> methods will return <code>Err(RequestTokenError::Other(_))</code>.</li>\n</ul>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_auth_type\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#691-695\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.set_auth_type\" class=\"fn\">set_auth_type</a>(self, auth_type: <a class=\"enum\" href=\"oauth2/enum.AuthType.html\" title=\"enum oauth2::AuthType\">AuthType</a>) -&gt; Self</h4></section></summary><div class=\"docblock\"><p>Configures the type of client authentication used for communicating with the authorization\nserver.</p>\n<p>The default is to use HTTP Basic authentication, as recommended in\n<a href=\"https://tools.ietf.org/html/rfc6749#section-2.3.1\">Section 2.3.1 of RFC 6749</a>. Note that\nif a client secret is omitted (i.e., <code>client_secret</code> is set to <code>None</code> when calling\n<a href=\"oauth2/struct.Client.html#method.new\" title=\"associated function oauth2::Client::new\"><code>Client::new</code></a>), <a href=\"oauth2/enum.AuthType.html#variant.RequestBody\" title=\"variant oauth2::AuthType::RequestBody\"><code>AuthType::RequestBody</code></a> is used regardless of the <code>auth_type</code> passed to\nthis function.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_redirect_uri\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#700-704\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.set_redirect_uri\" class=\"fn\">set_redirect_uri</a>(self, redirect_url: <a class=\"struct\" href=\"oauth2/struct.RedirectUrl.html\" title=\"struct oauth2::RedirectUrl\">RedirectUrl</a>) -&gt; Self</h4></section></summary><div class=\"docblock\"><p>Sets the redirect URL used by the authorization endpoint.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_introspection_uri\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#710-714\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.set_introspection_uri\" class=\"fn\">set_introspection_uri</a>(self, introspection_url: <a class=\"struct\" href=\"oauth2/struct.IntrospectionUrl.html\" title=\"struct oauth2::IntrospectionUrl\">IntrospectionUrl</a>) -&gt; Self</h4></section></summary><div class=\"docblock\"><p>Sets the introspection URL for contacting the (<a href=\"https://tools.ietf.org/html/rfc7662\">RFC 7662</a>)\nintrospection endpoint.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_revocation_uri\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#721-725\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.set_revocation_uri\" class=\"fn\">set_revocation_uri</a>(self, revocation_url: <a class=\"struct\" href=\"oauth2/struct.RevocationUrl.html\" title=\"struct oauth2::RevocationUrl\">RevocationUrl</a>) -&gt; Self</h4></section></summary><div class=\"docblock\"><p>Sets the revocation URL for contacting the revocation endpoint (<a href=\"https://tools.ietf.org/html/rfc7009\">RFC 7009</a>).</p>\n<p>See: <a href=\"oauth2/struct.Client.html#method.revoke_token\" title=\"method oauth2::Client::revoke_token\"><code>revoke_token()</code></a></p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.set_device_authorization_url\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#731-738\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.set_device_authorization_url\" class=\"fn\">set_device_authorization_url</a>(\n    self,\n    device_authorization_url: <a class=\"struct\" href=\"oauth2/struct.DeviceAuthorizationUrl.html\" title=\"struct oauth2::DeviceAuthorizationUrl\">DeviceAuthorizationUrl</a>\n) -&gt; Self</h4></section></summary><div class=\"docblock\"><p>Sets the the device authorization URL used by the device authorization endpoint.\nUsed for Device Code Flow, as per <a href=\"https://tools.ietf.org/html/rfc8628\">RFC 8628</a>.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.authorize_url\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#758-772\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.authorize_url\" class=\"fn\">authorize_url</a>&lt;S&gt;(&amp;self, state_fn: S) -&gt; <a class=\"struct\" href=\"oauth2/struct.AuthorizationRequest.html\" title=\"struct oauth2::AuthorizationRequest\">AuthorizationRequest</a>&lt;'_&gt;<div class=\"where\">where\n    S: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/ops/function/trait.FnOnce.html\" title=\"trait core::ops::function::FnOnce\">FnOnce</a>() -&gt; <a class=\"struct\" href=\"oauth2/struct.CsrfToken.html\" title=\"struct oauth2::CsrfToken\">CsrfToken</a>,</div></h4></section></summary><div class=\"docblock\"><p>Generates an authorization URL for a new authorization request.</p>\n<h5 id=\"arguments-1\"><a href=\"#arguments-1\">Arguments</a></h5>\n<ul>\n<li><code>state_fn</code> - A function that returns an opaque value used by the client to maintain state\nbetween the request and callback. The authorization server includes this value when\nredirecting the user-agent back to the client.</li>\n</ul>\n<h5 id=\"security-warning\"><a href=\"#security-warning\">Security Warning</a></h5>\n<p>Callers should use a fresh, unpredictable <code>state</code> for each authorization request and verify\nthat this value matches the <code>state</code> parameter passed by the authorization server to the\nredirect URI. Doing so mitigates\n<a href=\"https://tools.ietf.org/html/rfc6749#section-10.12\">Cross-Site Request Forgery</a>\nattacks. To disable CSRF protections (NOT recommended), use <code>insecure::authorize_url</code>\ninstead.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.exchange_code\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#782-794\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.exchange_code\" class=\"fn\">exchange_code</a>(\n    &amp;self,\n    code: <a class=\"struct\" href=\"oauth2/struct.AuthorizationCode.html\" title=\"struct oauth2::AuthorizationCode\">AuthorizationCode</a>\n) -&gt; <a class=\"struct\" href=\"oauth2/struct.CodeTokenRequest.html\" title=\"struct oauth2::CodeTokenRequest\">CodeTokenRequest</a>&lt;'_, TE, TR, TT&gt;</h4></section></summary><div class=\"docblock\"><p>Exchanges a code produced by a successful authorization process with an access token.</p>\n<p>Acquires ownership of the <code>code</code> because authorization codes may only be used once to\nretrieve an access token from the authorization server.</p>\n<p>See <a href=\"https://tools.ietf.org/html/rfc6749#section-4.1.3\">https://tools.ietf.org/html/rfc6749#section-4.1.3</a>.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.exchange_password\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#801-820\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.exchange_password\" class=\"fn\">exchange_password</a>&lt;'a, 'b&gt;(\n    &amp;'a self,\n    username: &amp;'b <a class=\"struct\" href=\"oauth2/struct.ResourceOwnerUsername.html\" title=\"struct oauth2::ResourceOwnerUsername\">ResourceOwnerUsername</a>,\n    password: &amp;'b <a class=\"struct\" href=\"oauth2/struct.ResourceOwnerPassword.html\" title=\"struct oauth2::ResourceOwnerPassword\">ResourceOwnerPassword</a>\n) -&gt; <a class=\"struct\" href=\"oauth2/struct.PasswordTokenRequest.html\" title=\"struct oauth2::PasswordTokenRequest\">PasswordTokenRequest</a>&lt;'b, TE, TR, TT&gt;<div class=\"where\">where\n    'a: 'b,</div></h4></section></summary><div class=\"docblock\"><p>Requests an access token for the <em>password</em> grant type.</p>\n<p>See <a href=\"https://tools.ietf.org/html/rfc6749#section-4.3.2\">https://tools.ietf.org/html/rfc6749#section-4.3.2</a>.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.exchange_client_credentials\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#827-837\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.exchange_client_credentials\" class=\"fn\">exchange_client_credentials</a>(\n    &amp;self\n) -&gt; <a class=\"struct\" href=\"oauth2/struct.ClientCredentialsTokenRequest.html\" title=\"struct oauth2::ClientCredentialsTokenRequest\">ClientCredentialsTokenRequest</a>&lt;'_, TE, TR, TT&gt;</h4></section></summary><div class=\"docblock\"><p>Requests an access token for the <em>client credentials</em> grant type.</p>\n<p>See <a href=\"https://tools.ietf.org/html/rfc6749#section-4.4.2\">https://tools.ietf.org/html/rfc6749#section-4.4.2</a>.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.exchange_refresh_token\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#844-861\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.exchange_refresh_token\" class=\"fn\">exchange_refresh_token</a>&lt;'a, 'b&gt;(\n    &amp;'a self,\n    refresh_token: &amp;'b <a class=\"struct\" href=\"oauth2/struct.RefreshToken.html\" title=\"struct oauth2::RefreshToken\">RefreshToken</a>\n) -&gt; <a class=\"struct\" href=\"oauth2/struct.RefreshTokenRequest.html\" title=\"struct oauth2::RefreshTokenRequest\">RefreshTokenRequest</a>&lt;'b, TE, TR, TT&gt;<div class=\"where\">where\n    'a: 'b,</div></h4></section></summary><div class=\"docblock\"><p>Exchanges a refresh token for an access token</p>\n<p>See <a href=\"https://tools.ietf.org/html/rfc6749#section-6\">https://tools.ietf.org/html/rfc6749#section-6</a>.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.exchange_device_code\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#867-882\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.exchange_device_code\" class=\"fn\">exchange_device_code</a>(\n    &amp;self\n) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/result/enum.Result.html\" title=\"enum core::result::Result\">Result</a>&lt;<a class=\"struct\" href=\"oauth2/struct.DeviceAuthorizationRequest.html\" title=\"struct oauth2::DeviceAuthorizationRequest\">DeviceAuthorizationRequest</a>&lt;'_, TE&gt;, <a class=\"enum\" href=\"oauth2/enum.ConfigurationError.html\" title=\"enum oauth2::ConfigurationError\">ConfigurationError</a>&gt;</h4></section></summary><div class=\"docblock\"><p>Perform a device authorization request as per\n<a href=\"https://tools.ietf.org/html/rfc8628#section-3.1\">https://tools.ietf.org/html/rfc8628#section-3.1</a>.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.exchange_device_access_token\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#888-907\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.exchange_device_access_token\" class=\"fn\">exchange_device_access_token</a>&lt;'a, 'b, 'c, EF&gt;(\n    &amp;'a self,\n    auth_response: &amp;'b <a class=\"struct\" href=\"oauth2/devicecode/struct.DeviceAuthorizationResponse.html\" title=\"struct oauth2::devicecode::DeviceAuthorizationResponse\">DeviceAuthorizationResponse</a>&lt;EF&gt;\n) -&gt; <a class=\"struct\" href=\"oauth2/struct.DeviceAccessTokenRequest.html\" title=\"struct oauth2::DeviceAccessTokenRequest\">DeviceAccessTokenRequest</a>&lt;'b, 'c, TR, TT, EF&gt;<div class=\"where\">where\n    EF: <a class=\"trait\" href=\"oauth2/devicecode/trait.ExtraDeviceAuthorizationFields.html\" title=\"trait oauth2::devicecode::ExtraDeviceAuthorizationFields\">ExtraDeviceAuthorizationFields</a>,\n    'a: 'b,</div></h4></section></summary><div class=\"docblock\"><p>Perform a device access token request as per\n<a href=\"https://tools.ietf.org/html/rfc8628#section-3.4\">https://tools.ietf.org/html/rfc8628#section-3.4</a>.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.introspect\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#919-936\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.introspect\" class=\"fn\">introspect</a>&lt;'a&gt;(\n    &amp;'a self,\n    token: &amp;'a <a class=\"struct\" href=\"oauth2/struct.AccessToken.html\" title=\"struct oauth2::AccessToken\">AccessToken</a>\n) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/result/enum.Result.html\" title=\"enum core::result::Result\">Result</a>&lt;<a class=\"struct\" href=\"oauth2/struct.IntrospectionRequest.html\" title=\"struct oauth2::IntrospectionRequest\">IntrospectionRequest</a>&lt;'a, TE, TIR, TT&gt;, <a class=\"enum\" href=\"oauth2/enum.ConfigurationError.html\" title=\"enum oauth2::ConfigurationError\">ConfigurationError</a>&gt;</h4></section></summary><div class=\"docblock\"><p>Query the authorization server <a href=\"https://tools.ietf.org/html/rfc7662\"><code>RFC 7662 compatible</code></a> introspection\nendpoint to determine the set of metadata for a previously received token.</p>\n<p>Requires that <a href=\"oauth2/struct.Client.html#method.set_introspection_uri\" title=\"method oauth2::Client::set_introspection_uri\"><code>set_introspection_uri()</code></a> have already been called to set the\nintrospection endpoint URL.</p>\n<p>Attempting to submit the generated request without calling <a href=\"oauth2/struct.Client.html#method.set_introspection_uri\" title=\"method oauth2::Client::set_introspection_uri\"><code>set_introspection_uri()</code></a>\nfirst will result in an error.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.revoke_token\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#948-972\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.revoke_token\" class=\"fn\">revoke_token</a>(\n    &amp;self,\n    token: RT\n) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/result/enum.Result.html\" title=\"enum core::result::Result\">Result</a>&lt;<a class=\"struct\" href=\"oauth2/struct.RevocationRequest.html\" title=\"struct oauth2::RevocationRequest\">RevocationRequest</a>&lt;'_, RT, TRE&gt;, <a class=\"enum\" href=\"oauth2/enum.ConfigurationError.html\" title=\"enum oauth2::ConfigurationError\">ConfigurationError</a>&gt;</h4></section></summary><div class=\"docblock\"><p>Attempts to revoke the given previously received token using an <a href=\"https://tools.ietf.org/html/rfc7009\">RFC 7009 OAuth 2.0 Token Revocation</a>\ncompatible endpoint.</p>\n<p>Requires that <a href=\"oauth2/struct.Client.html#method.set_revocation_uri\" title=\"method oauth2::Client::set_revocation_uri\"><code>set_revocation_uri()</code></a> have already been called to set the\nrevocation endpoint URL.</p>\n<p>Attempting to submit the generated request without calling <a href=\"oauth2/struct.Client.html#method.set_revocation_uri\" title=\"method oauth2::Client::set_revocation_uri\"><code>set_revocation_uri()</code></a>\nfirst will result in an error.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.client_id\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#977-979\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.client_id\" class=\"fn\">client_id</a>(&amp;self) -&gt; &amp;<a class=\"struct\" href=\"oauth2/struct.ClientId.html\" title=\"struct oauth2::ClientId\">ClientId</a></h4></section></summary><div class=\"docblock\"><p>Returns the Client ID.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.auth_url\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#984-986\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.auth_url\" class=\"fn\">auth_url</a>(&amp;self) -&gt; &amp;<a class=\"struct\" href=\"oauth2/struct.AuthUrl.html\" title=\"struct oauth2::AuthUrl\">AuthUrl</a></h4></section></summary><div class=\"docblock\"><p>Returns the authorization endpoint.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.auth_type\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#992-994\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.auth_type\" class=\"fn\">auth_type</a>(&amp;self) -&gt; &amp;<a class=\"enum\" href=\"oauth2/enum.AuthType.html\" title=\"enum oauth2::AuthType\">AuthType</a></h4></section></summary><div class=\"docblock\"><p>Returns the type of client authentication used for communicating with the authorization\nserver.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.token_url\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#999-1001\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.token_url\" class=\"fn\">token_url</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"struct\" href=\"oauth2/struct.TokenUrl.html\" title=\"struct oauth2::TokenUrl\">TokenUrl</a>&gt;</h4></section></summary><div class=\"docblock\"><p>Returns the token endpoint.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.redirect_url\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#1006-1008\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.redirect_url\" class=\"fn\">redirect_url</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"struct\" href=\"oauth2/struct.RedirectUrl.html\" title=\"struct oauth2::RedirectUrl\">RedirectUrl</a>&gt;</h4></section></summary><div class=\"docblock\"><p>Returns the redirect URL used by the authorization endpoint.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.introspection_url\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#1014-1016\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.introspection_url\" class=\"fn\">introspection_url</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"struct\" href=\"oauth2/struct.IntrospectionUrl.html\" title=\"struct oauth2::IntrospectionUrl\">IntrospectionUrl</a>&gt;</h4></section></summary><div class=\"docblock\"><p>Returns the introspection URL for contacting the (<a href=\"https://tools.ietf.org/html/rfc7662\">RFC 7662</a>)\nintrospection endpoint.</p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.revocation_url\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#1023-1025\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.revocation_url\" class=\"fn\">revocation_url</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"struct\" href=\"oauth2/struct.RevocationUrl.html\" title=\"struct oauth2::RevocationUrl\">RevocationUrl</a>&gt;</h4></section></summary><div class=\"docblock\"><p>Returns the revocation URL for contacting the revocation endpoint (<a href=\"https://tools.ietf.org/html/rfc7009\">RFC 7009</a>).</p>\n<p>See: <a href=\"oauth2/struct.Client.html#method.revoke_token\" title=\"method oauth2::Client::revoke_token\"><code>revoke_token()</code></a></p>\n</div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.device_authorization_url\" class=\"method\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#1030-1032\">source</a><h4 class=\"code-header\">pub fn <a href=\"oauth2/struct.Client.html#tymethod.device_authorization_url\" class=\"fn\">device_authorization_url</a>(&amp;self) -&gt; <a class=\"enum\" href=\"https://doc.rust-lang.org/1.76.0/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;&amp;<a class=\"struct\" href=\"oauth2/struct.DeviceAuthorizationUrl.html\" title=\"struct oauth2::DeviceAuthorizationUrl\">DeviceAuthorizationUrl</a>&gt;</h4></section></summary><div class=\"docblock\"><p>Returns the the device authorization URL used by the device authorization endpoint.</p>\n</div></details></div></details>",0,"oauth2::basic::BasicClient"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Debug-for-Client%3CTE,+TR,+TT,+TIR,+RT,+TRE%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#610\">source</a><a href=\"#impl-Debug-for-Client%3CTE,+TR,+TT,+TIR,+RT,+TRE%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;TE, TR, TT, TIR, RT, TRE&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a> for <a class=\"struct\" href=\"oauth2/struct.Client.html\" title=\"struct oauth2::Client\">Client</a>&lt;TE, TR, TT, TIR, RT, TRE&gt;<div class=\"where\">where\n    TE: <a class=\"trait\" href=\"oauth2/trait.ErrorResponse.html\" title=\"trait oauth2::ErrorResponse\">ErrorResponse</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a>,\n    TR: <a class=\"trait\" href=\"oauth2/trait.TokenResponse.html\" title=\"trait oauth2::TokenResponse\">TokenResponse</a>&lt;TT&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a>,\n    TT: <a class=\"trait\" href=\"oauth2/trait.TokenType.html\" title=\"trait oauth2::TokenType\">TokenType</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a>,\n    TIR: <a class=\"trait\" href=\"oauth2/trait.TokenIntrospectionResponse.html\" title=\"trait oauth2::TokenIntrospectionResponse\">TokenIntrospectionResponse</a>&lt;TT&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a>,\n    RT: <a class=\"trait\" href=\"oauth2/revocation/trait.RevocableToken.html\" title=\"trait oauth2::revocation::RevocableToken\">RevocableToken</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a>,\n    TRE: <a class=\"trait\" href=\"oauth2/trait.ErrorResponse.html\" title=\"trait oauth2::ErrorResponse\">ErrorResponse</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html\" title=\"trait core::fmt::Debug\">Debug</a>,</div></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.fmt\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#610\">source</a><a href=\"#method.fmt\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html#tymethod.fmt\" class=\"fn\">fmt</a>(&amp;self, f: &amp;mut <a class=\"struct\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/struct.Formatter.html\" title=\"struct core::fmt::Formatter\">Formatter</a>&lt;'_&gt;) -&gt; <a class=\"type\" href=\"https://doc.rust-lang.org/1.76.0/core/fmt/type.Result.html\" title=\"type core::fmt::Result\">Result</a></h4></section></summary><div class='docblock'>Formats the value using the given formatter. <a href=\"https://doc.rust-lang.org/1.76.0/core/fmt/trait.Debug.html#tymethod.fmt\">Read more</a></div></details></div></details>","Debug","oauth2::basic::BasicClient"],["<details class=\"toggle implementors-toggle\" open><summary><section id=\"impl-Clone-for-Client%3CTE,+TR,+TT,+TIR,+RT,+TRE%3E\" class=\"impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#610\">source</a><a href=\"#impl-Clone-for-Client%3CTE,+TR,+TT,+TIR,+RT,+TRE%3E\" class=\"anchor\">§</a><h3 class=\"code-header\">impl&lt;TE, TR, TT, TIR, RT, TRE&gt; <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a> for <a class=\"struct\" href=\"oauth2/struct.Client.html\" title=\"struct oauth2::Client\">Client</a>&lt;TE, TR, TT, TIR, RT, TRE&gt;<div class=\"where\">where\n    TE: <a class=\"trait\" href=\"oauth2/trait.ErrorResponse.html\" title=\"trait oauth2::ErrorResponse\">ErrorResponse</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,\n    TR: <a class=\"trait\" href=\"oauth2/trait.TokenResponse.html\" title=\"trait oauth2::TokenResponse\">TokenResponse</a>&lt;TT&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,\n    TT: <a class=\"trait\" href=\"oauth2/trait.TokenType.html\" title=\"trait oauth2::TokenType\">TokenType</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,\n    TIR: <a class=\"trait\" href=\"oauth2/trait.TokenIntrospectionResponse.html\" title=\"trait oauth2::TokenIntrospectionResponse\">TokenIntrospectionResponse</a>&lt;TT&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,\n    RT: <a class=\"trait\" href=\"oauth2/revocation/trait.RevocableToken.html\" title=\"trait oauth2::revocation::RevocableToken\">RevocableToken</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,\n    TRE: <a class=\"trait\" href=\"oauth2/trait.ErrorResponse.html\" title=\"trait oauth2::ErrorResponse\">ErrorResponse</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html\" title=\"trait core::clone::Clone\">Clone</a>,</div></h3></section></summary><div class=\"impl-items\"><details class=\"toggle method-toggle\" open><summary><section id=\"method.clone\" class=\"method trait-impl\"><a class=\"src rightside\" href=\"src/oauth2/lib.rs.html#610\">source</a><a href=\"#method.clone\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html#tymethod.clone\" class=\"fn\">clone</a>(&amp;self) -&gt; <a class=\"struct\" href=\"oauth2/struct.Client.html\" title=\"struct oauth2::Client\">Client</a>&lt;TE, TR, TT, TIR, RT, TRE&gt;</h4></section></summary><div class='docblock'>Returns a copy of the value. <a href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html#tymethod.clone\">Read more</a></div></details><details class=\"toggle method-toggle\" open><summary><section id=\"method.clone_from\" class=\"method trait-impl\"><span class=\"rightside\"><span class=\"since\" title=\"Stable since Rust version 1.0.0\">1.0.0</span> · <a class=\"src\" href=\"https://doc.rust-lang.org/1.76.0/src/core/clone.rs.html#169\">source</a></span><a href=\"#method.clone_from\" class=\"anchor\">§</a><h4 class=\"code-header\">fn <a href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html#method.clone_from\" class=\"fn\">clone_from</a>(&amp;mut self, source: <a class=\"primitive\" href=\"https://doc.rust-lang.org/1.76.0/std/primitive.reference.html\">&amp;Self</a>)</h4></section></summary><div class='docblock'>Performs copy-assignment from <code>source</code>. <a href=\"https://doc.rust-lang.org/1.76.0/core/clone/trait.Clone.html#method.clone_from\">Read more</a></div></details></div></details>","Clone","oauth2::basic::BasicClient"]]
};if (window.register_type_impls) {window.register_type_impls(type_impls);} else {window.pending_type_impls = type_impls;}})()