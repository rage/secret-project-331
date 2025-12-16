(function() {
    var implementors = Object.fromEntries([["ed25519",[]],["ed25519_dalek",[]],["pkcs8",[]],["spki",[]]]);
    if (window.register_implementors) {
        window.register_implementors(implementors);
    } else {
        window.pending_implementors = implementors;
    }
})()
//{"start":57,"fragment_lengths":[14,21,13,12]}