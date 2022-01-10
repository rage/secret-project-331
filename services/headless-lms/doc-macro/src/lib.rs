use proc_macro::TokenStream;

#[proc_macro_attribute]
pub fn generated_doc(attr: TokenStream, item: TokenStream) -> TokenStream {
    let attr: TokenStream = format!("#[cfg_attr(doc, doc = generated_docs!({}))]", attr)
        .parse()
        .expect("Invalid input, must be a type");

    let mut ts = TokenStream::new();
    ts.extend(attr);
    ts.extend(item);
    ts
}
