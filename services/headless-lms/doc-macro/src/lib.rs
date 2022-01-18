use proc_macro::TokenStream;
use quote::ToTokens;
use syn::{Attribute, ItemFn, Type};

/// Includes the type's JSON example generated by doc-file-generator as a string.
/// Convenience alias for #[cfg_attr(doc, doc = generated_docs!(MyType))]
#[proc_macro_attribute]
pub fn generated_doc(attr: TokenStream, item: TokenStream) -> TokenStream {
    let arg = syn::parse_macro_input!(attr as Type);
    let attr: Attribute = syn::parse_quote!(#[cfg_attr(doc, doc = generated_docs!(#arg))]);

    let mut item = syn::parse_macro_input!(item as ItemFn);
    item.attrs.push(attr);

    item.into_token_stream().into()
}
