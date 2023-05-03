use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, punctuated::Punctuated, token::Colon, Expr, PathSegment};

pub fn example_impl(input: TokenStream) -> TokenStream {
    let derive_input = parse_macro_input!(input as Expr);

    match derive_input {
        Expr::Struct(e) => {
            // struct/enum struct variant
            let ident = e.path;
            let fields = e.fields.into_iter().map(|f| {
                let member = f.member;
                if f.colon_token.is_some() {
                    let expr = f.expr;
                    quote! { #member: #expr }
                } else {
                    quote! { #member: Example::example() }
                }
            });
            return quote! {
                impl Example for #ident {
                    fn example() -> Self {
                        #ident { #(#fields),* }
                    }
                }
            }
            .into();
        }
        Expr::Call(e) => {
            if let Expr::Path(p) = *e.func {
                // tuple enum
                let underscore: Expr = syn::parse_str("_").unwrap();
                let segments = p.path.segments;

                // remove the trailing (:: VariantName) to get the type pathPathS
                let len = segments.len();
                let ty: Punctuated<PathSegment, Colon> =
                    segments.clone().into_iter().take(len - 1).collect();
                let args = e
                    .args
                    .into_iter()
                    .map(|a| {
                        if a == underscore {
                            quote! { Example::example() }
                        } else {
                            quote! { #a }
                        }
                    })
                    .collect::<Vec<_>>();
                return quote! {
                    impl Example for #ty {
                        fn example() -> Self {
                            #segments ( #(#args),* )
                        }
                    }
                }
                .into();
            }
        }
        Expr::Path(e) => {
            // unit enum

            let segments = e.path.segments;
            // remove the trailing (:: VariantName) to get the type path
            let len = segments.len();
            let ty: Punctuated<PathSegment, Colon> =
                segments.clone().into_iter().take(len - 1).collect();

            return quote! {
                impl Example for #ty {
                    fn example() -> Self {
                        #segments
                    }
                }
            }
            .into();
        }
        _ => {}
    }
    panic!("invalid input, should be struct or enum literal");
}
