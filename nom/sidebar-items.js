initSidebarItems({"enum":[["CompareResult","Indicates wether a comparison was successful, an error, or if more data was needed"],["Err","The `Err` enum indicates the parser was not successful"],["Needed","Contains information on needed data if a parser returned `Incomplete`"]],"externcrate":[["bitvec",""]],"fn":[["dbg_dmp","Prints a message and the input if the parser fails."]],"macro":[["add_return_error","Add an error if the child parser fails."],["alt","Try a list of parsers and return the result of the first successful one"],["bits","Transforms its byte slice input into a bit stream for the underlying parser. This allows the given bit stream parser to work on a byte slice input."],["bytes","Counterpart to `bits`, `bytes!` transforms its bit stream input into a byte slice for the underlying parser, allowing byte-slice parsers to work on bit streams."],["call","Used to wrap common expressions and function as macros."],["char","Matches one character: `char!(char) => &[u8] -> IResult<&[u8], char>`."],["complete","Replaces a `Incomplete` returned by the child parser with an `Error`."],["cond","`cond!(bool, I -> IResult<I,O>) => I -> IResult<I, Option<O>>` Conditional combinator"],["count","`count!(I -> IResult<I,O>, nb) => I -> IResult<I, Vec<O>>` Applies the child parser a specified number of times."],["dbg_basic","Prints a message if the parser fails."],["dbg_dmp","Prints a message and the input if the parser fails."],["delimited","`delimited!(I -> IResult<I,T>, I -> IResult<I,O>, I -> IResult<I,U>) => I -> IResult<I, O>` `delimited(opening, X, closing)` returns X."],["do_parse","`do_parse!(I->IResult<I,A> >> I->IResult<I,B> >> ... I->IResult<I,X> , ( O ) ) => I -> IResult<I, O>` `do_parse` applies sub parsers in a sequence. It can store intermediary results and make them available for later parsers."],["eof","`eof!()` returns its input if it is at the end of input data."],["error_node_position","Creates a parse error from a `nom::ErrorKind`, the position in the input and the next error in the parsing tree"],["error_position","Creates a parse error from a `nom::ErrorKind` and the position in the input"],["escaped","`escaped!(T -> IResult<T, T>, U, T -> IResult<T, T>) => T -> IResult<T, T> where T: InputIter, U: AsChar` matches a byte string with escaped characters."],["escaped_transform","`escaped_transform!(&[T] -> IResult<&[T], &[T]>, T, &[T] -> IResult<&[T], &[T]>) => &[T] -> IResult<&[T], Vec<T>>` matches a byte string with escaped characters."],["exact","`exact!()` will fail if the child parser does not consume the whole data."],["fix_error","translate parser result from IResult<I,O,u32> to IResult<I,O,E> with a custom type"],["flat_map","`flat_map!(R -> IResult<R,S>, S -> IResult<S,T>) => R -> IResult<R, T>`"],["fold_many0","`fold_many0!(I -> IResult<I,O>, R, Fn(R, O) -> R) => I -> IResult<I, R>` Applies the parser 0 or more times and folds the list of return values."],["fold_many1","`fold_many1!(I -> IResult<I,O>, R, Fn(R, O) -> R) => I -> IResult<I, R>` Applies the parser 1 or more times and folds the list of return values."],["fold_many_m_n","`fold_many_m_n!(usize, usize, I -> IResult<I,O>, R, Fn(R, O) -> R) => I -> IResult<I, R>` Applies the parser between m and n times (n included) and folds the list of return value."],["i128","If the parameter is `nom::Endianness::Big`, parse a big endian i64 integer, otherwise a little endian i64 integer."],["i16","If the parameter is `nom::Endianness::Big`, parse a big endian i16 integer, otherwise a little endian i16 integer."],["i32","If the parameter is `nom::Endianness::Big`, parse a big endian i32 integer, otherwise a little endian i32 integer."],["i64","If the parameter is `nom::Endianness::Big`, parse a big endian i64 integer, otherwise a little endian i64 integer."],["into","`into!(I -> IResult<I, O1, E1>) => I -> IResult<I, O2, E2>` automatically converts the child parser’s result to another type"],["is_a","`is_a!(&[T]) => &[T] -> IResult<&[T], &[T]>` returns the longest list of bytes that appear in the provided array."],["is_not","`is_not!(&[T:AsBytes]) => &[T] -> IResult<&[T], &[T]>` returns the longest list of bytes that do not appear in the provided array."],["length_count","`length_count!(I -> IResult<I, nb>, I -> IResult<I,O>) => I -> IResult<I, Vec<O>>` Gets a number from the first parser, then applies the second parser that many times."],["length_data","`length_data!(I -> IResult<I, nb>) => O`"],["length_value","`length_value!(I -> IResult<I, nb>, I -> IResult<I,O>) => I -> IResult<I, O>`"],["many0","`many0!(I -> IResult<I,O>) => I -> IResult<I, Vec<O>>` Applies the parser 0 or more times and returns the list of results in a `Vec`."],["many0_count","`many0_count!(I -> IResult<I,O>) => I -> IResult<I, usize>` Applies the parser 0 or more times and returns the number of times the parser was applied."],["many1","`many1!(I -> IResult<I,O>) => I -> IResult<I, Vec<O>>` Applies the parser 1 or more times and returns the list of results in a `Vec`."],["many1_count","`many1_count!(I -> IResult<I,O>) => I -> IResult<I, usize>` Applies the parser 1 or more times and returns the number of times the parser was applied."],["many_m_n","`many_m_n!(usize, usize, I -> IResult<I,O>) => I -> IResult<I, Vec<O>>` Applies the parser between m and n times (n included) and returns the list of results in a `Vec`."],["many_till","`many_till!(I -> IResult<I,O>, I -> IResult<I,P>) => I -> IResult<I, (Vec<O>, P)>` Applies the first parser until the second applies. Returns a tuple containing the list of results from the first in a Vec and the result of the second."],["map","`map!(I -> IResult<I, O>, O -> P) => I -> IResult<I, P>`"],["map_opt","`map_opt!(I -> IResult<I, O>, O -> Option<P>) => I -> IResult<I, P>` maps a function returning an `Option` on the output of a parser."],["map_res","`map_res!(I -> IResult<I, O>, O -> Result<P>) => I -> IResult<I, P>` maps a function returning a `Result` on the output of a parser."],["named","Makes a function from a parser combination"],["named_args","Makes a function from a parser combination with arguments."],["named_attr","Makes a function from a parser combination, with attributes."],["none_of","Matches anything but the provided characters."],["not","`not!(I -> IResult<I,O>) => I -> IResult<I, ()>` returns a result only if the embedded parser returns `Error` or `Err(Err::Incomplete)`. Does not consume the input."],["one_of","Character level parsers Matches one of the provided characters."],["opt","`opt!(I -> IResult<I,O>) => I -> IResult<I, Option<O>>` make the underlying parser optional."],["opt_res","`opt_res!(I -> IResult<I,O>) => I -> IResult<I, Result<nom::Err,O>>` make the underlying parser optional."],["pair","`pair!(I -> IResult<I,O>, I -> IResult<I,P>) => I -> IResult<I, (O,P)>` `pair` returns a tuple of the results of its two child parsers of both succeed."],["parse_to","`parse_to!(O) => I -> IResult<I, O>` Uses the `parse` method from `std::str::FromStr` to convert the current input to the specified type."],["peek","`peek!(I -> IResult<I,O>) => I -> IResult<I, O>` returns a result without consuming the input."],["permutation","`permutation!(I -> IResult<I,A>, I -> IResult<I,B>, ... I -> IResult<I,X> ) => I -> IResult<I, (A,B,...X)>` applies its sub parsers in a sequence, but independent from their order this parser will only succeed if all of its sub parsers succeed."],["preceded","`preceded!(I -> IResult<I,T>, I -> IResult<I,O>) => I -> IResult<I, O>` `preceded` returns the result of its second parser if both succeed."],["recognize","`recognize!(I -> IResult<I, O> ) => I -> IResult<I, I>` if the child parser was successful, return the consumed input as produced value."],["return_error","Prevents backtracking if the child parser fails."],["separated_list0","`separated_list0!(I -> IResult<I,T>, I -> IResult<I,O>) => I -> IResult<I, Vec<O>>` `separated_list0(sep, X)` returns a `Vec<X>`."],["separated_list1","`separated_list1!(I -> IResult<I,T>, I -> IResult<I,O>) => I -> IResult<I, Vec<O>>` `separated_list1(sep, X)` returns a `Vec<X>`."],["separated_pair","`separated_pair!(I -> IResult<I,O>, I -> IResult<I, T>, I -> IResult<I,P>) => I -> IResult<I, (O,P)>` `separated_pair(X,sep,Y)` returns a tuple of its first and third child parsers if all 3 succeed."],["switch","`switch!(I -> IResult<I,P>, P => I -> IResult<I,O> | ... | P => I -> IResult<I,O> ) => I -> IResult<I, O>` choose the next parser depending on the result of the first one, if successful, and returns the result of the second parser"],["tag","`tag!(&[T]: nom::AsBytes) => &[T] -> IResult<&[T], &[T]>` declares a byte array as a suite to recognize."],["tag_bits","Matches the given bit pattern."],["tag_no_case","`tag_no_case!(&[T]) => &[T] -> IResult<&[T], &[T]>` declares a case insensitive ascii string as a suite to recognize."],["take","`take!(nb) => &[T] -> IResult<&[T], &[T]>` generates a parser consuming the specified number of bytes."],["take_bits","Consumes the specified number of bits and returns them as the specified type."],["take_str","`take_str!(nb) => &[T] -> IResult<&[T], &str>` same as `take!` but returning a `&str`."],["take_till","`take_till!(T -> bool) => &[T] -> IResult<&[T], &[T]>` returns the longest list of bytes until the provided function succeeds."],["take_till1","`take_till1!(T -> bool) => &[T] -> IResult<&[T], &[T]>` returns the longest non empty list of bytes until the provided function succeeds."],["take_until","`take_until!(tag) => &[T] -> IResult<&[T], &[T]>` consumes data until it finds the specified tag."],["take_until1","`take_until1!(tag) => &[T] -> IResult<&[T], &[T]>` consumes data (at least one byte) until it finds the specified tag."],["take_while","`take_while!(T -> bool) => &[T] -> IResult<&[T], &[T]>` returns the longest list of bytes until the provided function fails."],["take_while1","`take_while1!(T -> bool) => &[T] -> IResult<&[T], &[T]>` returns the longest (non empty) list of bytes until the provided function fails."],["take_while_m_n","`take_while_m_n!(m: usize, n: usize, T -> bool) => &[T] -> IResult<&[T], &[T]>` returns a list of bytes or characters for which the provided function returns true. The returned list’s size will be at least m, and at most n."],["tap","`tap!(name: I -> IResult<I,O> => { block }) => I -> IResult<I, O>` allows access to the parser’s result without affecting it."],["terminated","`terminated!(I -> IResult<I,O>, I -> IResult<I,T>) => I -> IResult<I, O>` `terminated` returns the result of its first parser if both succeed."],["try_parse","A bit like `std::try!`, this macro will return the remaining input and parsed value if the child parser returned `Ok`, and will do an early return for the `Err` side."],["tuple","`tuple!(I->IResult<I,A>, I->IResult<I,B>, ... I->IResult<I,X>) => I -> IResult<I, (A, B, ..., X)>` chains parsers and assemble the sub results in a tuple."],["u128","If the parameter is `nom::Endianness::Big`, parse a big endian u128 integer, otherwise a little endian u128 integer."],["u16","If the parameter is `nom::Endianness::Big`, parse a big endian u16 integer, otherwise a little endian u16 integer."],["u32","If the parameter is `nom::Endianness::Big`, parse a big endian u32 integer, otherwise a little endian u32 integer."],["u64","If the parameter is `nom::Endianness::Big`, parse a big endian u64 integer, otherwise a little endian u64 integer."],["value","`value!(T, R -> IResult<R, S> ) => R -> IResult<R, T>`"],["verify","`verify!(I -> IResult<I, O>, O -> bool) => I -> IResult<I, O>` returns the result of the child parser if it satisfies a verification function."]],"mod":[["bits","Bit level parsers"],["branch","Choice combinators"],["bytes","Parsers recognizing bytes streams"],["character","Character specific parsers and combinators"],["combinator","General purpose combinators"],["error","Error management"],["lib","Lib module to re-export everything needed from `std` or `core`/`alloc`. This is how `serde` does it, albeit there it is not public."],["multi","Combinators applying their child parser multiple times"],["number","Parsers recognizing numbers"],["sequence","Combinators applying parsers in sequence"]],"struct":[["And","Implementation of `Parser::and`"],["AndThen","Implementation of `Parser::and_then`"],["FlatMap","Implementation of `Parser::flat_map`"],["Into","Implementation of `Parser::into`"],["Map","Implementation of `Parser:::map`"],["Or","Implementation of `Parser::or`"]],"trait":[["AsBytes","Helper trait for types that can be viewed as a byte slice"],["AsChar","Transforms common types to a char for basic token parsing"],["Compare","Abstracts comparison operations"],["ErrorConvert","Equivalent From implementation to avoid orphan rules in bits parsers"],["ExtendInto","Abstracts something which can extend an `Extend`. Used to build modified input slices in `escaped_transform`"],["FindSubstring","Look for a substring in self"],["FindToken","Look for a token in self"],["Finish","Helper trait to convert a parser’s result to a more manageable type"],["HexDisplay","Helper trait to show a byte slice as a hex dump"],["InputIter","Abstracts common iteration operations on the input type"],["InputLength","Abstract method to calculate the input length"],["InputTake","Abstracts slicing operations"],["InputTakeAtPosition","Methods to take as much input as possible until the provided function returns true for the current element."],["Offset","Useful functions to calculate the offset between slices and show a hexdump of a slice"],["ParseTo","Used to integrate `str`’s `parse()` method"],["Parser","All nom parsers implement this trait"],["Slice","Slicing operations using ranges."],["ToUsize","Helper trait to convert numbers to usize."],["UnspecializedInput","Dummy trait used for default implementations (currently only used for `InputTakeAtPosition` and `Compare`)."]],"type":[["IResult","Holds the result of parsing functions"]]});