(function() {
    var type_impls = Object.fromEntries([["infer",[]],["libssh2_sys",[]],["libz_sys",[]],["openssl_sys",[]]]);
    if (window.register_type_impls) {
        window.register_type_impls(type_impls);
    } else {
        window.pending_type_impls = type_impls;
    }
})()
//{"start":55,"fragment_lengths":[12,19,16,19]}