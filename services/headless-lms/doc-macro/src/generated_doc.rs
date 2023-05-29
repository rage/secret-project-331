use proc_macro::TokenStream;
use quote::ToTokens;
use syn::{
    AngleBracketedGenericArguments, Attribute, GenericArgument, ItemFn, Path, PathArguments,
    ReturnType, Type, TypePath,
};

pub fn generated_doc_impl(item: TokenStream) -> TokenStream {
    let mut stream = TokenStream::new();
    stream.extend(
        "#[cfg_attr(doc, generated_doc_inner)]"
            .parse::<TokenStream>()
            .unwrap(),
    );
    stream.extend(item);
    stream
}

pub fn generated_doc_inner_impl(attr: TokenStream, item: TokenStream) -> TokenStream {
    let mut item = syn::parse_macro_input!(item as ItemFn);

    let storage;
    let (arg, generate_docs_for) = if attr.is_empty() {
        process_return_type(&item)
    } else {
        storage = syn::parse_macro_input!(attr as Type);
        (&storage, GenerateDocsFor::JsonAndTs)
    };
    let attr: Attribute = match generate_docs_for {
        GenerateDocsFor::Ts => syn::parse_quote!(#[doc = generated_docs!(#arg, ts)]),
        GenerateDocsFor::JsonAndTs => syn::parse_quote!(#[doc = generated_docs!(#arg)]),
    };

    item.attrs.push(attr);

    item.into_token_stream().into()
}

#[derive(Clone, Copy)]
enum GenerateDocsFor {
    Ts,
    JsonAndTs,
}

fn process_return_type(item: &ItemFn) -> (&Type, GenerateDocsFor) {
    // should have a path return type
    if let ReturnType::Type(_, ty) = &item.sig.output {
        if let Type::Path(TypePath {
            path: Path { segments, .. },
            ..
        }) = ty.as_ref()
        {
            // this is probably ControllerResult<web::Json<T>>
            let segment = segments
                .last()
                .expect("return type path shouldn't be empty");
            // this will probably contain web::Json<T> or Bytes, both the type and the inner segments for convenience
            let mut inner = (ty.as_ref(), segments);

            // extract inner segments from non-Json types, use as is otherwise
            if segment.ident != "Json" {
                if let PathArguments::AngleBracketed(AngleBracketedGenericArguments {
                    args, ..
                }) = &segment.arguments
                {
                    // extract inner generic (e.g. T from some::path::Result<T, E>)
                    let arg = args
                        .first()
                        .expect("return type generic list shouldn't be empty");
                    if let GenericArgument::Type(
                        ty @ Type::Path(TypePath {
                            path: Path { segments, .. },
                            ..
                        }),
                    ) = arg
                    {
                        inner = (ty, segments);
                    }
                }
            };

            // inner type
            if let Some(segments) = inner.1.last() {
                if segments.ident == "Bytes" {
                    return (inner.0, GenerateDocsFor::Ts);
                }
                // extract generics e.g. T from Json<T>
                if let PathArguments::AngleBracketed(AngleBracketedGenericArguments {
                    args, ..
                }) = &segments.arguments
                {
                    if let Some(GenericArgument::Type(t)) = args.first() {
                        return (t, GenerateDocsFor::JsonAndTs);
                    }
                }
            }
        }
    }
    panic!(
        "return type was expected to be `Json<_>` or `SomeGenericType<Json<_>>`, but it was `{:#?}`",
        item.sig.output
    )
}
