(function() {var implementors = {};
implementors["headless_lms_actix"] = [{"text":"impl&lt;'a, R:&nbsp;<a class=\"trait\" href=\"sqlx_core/row/trait.Row.html\" title=\"trait sqlx_core::row::Row\">Row</a>&gt; <a class=\"trait\" href=\"sqlx_core/from_row/trait.FromRow.html\" title=\"trait sqlx_core::from_row::FromRow\">FromRow</a>&lt;'a, R&gt; for <a class=\"struct\" href=\"headless_lms_actix/models/exercise_items/struct.ExerciseItem.html\" title=\"struct headless_lms_actix::models::exercise_items::ExerciseItem\">ExerciseItem</a> <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;&amp;'a <a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.str.html\">str</a>: <a class=\"trait\" href=\"sqlx_core/column/trait.ColumnIndex.html\" title=\"trait sqlx_core::column::ColumnIndex\">ColumnIndex</a>&lt;R&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,&nbsp;</span>","synthetic":false,"types":["headless_lms_actix::models::exercise_items::ExerciseItem"]},{"text":"impl&lt;'a, R:&nbsp;<a class=\"trait\" href=\"sqlx_core/row/trait.Row.html\" title=\"trait sqlx_core::row::Row\">Row</a>&gt; <a class=\"trait\" href=\"sqlx_core/from_row/trait.FromRow.html\" title=\"trait sqlx_core::from_row::FromRow\">FromRow</a>&lt;'a, R&gt; for <a class=\"struct\" href=\"headless_lms_actix/models/pages/struct.Exercise.html\" title=\"struct headless_lms_actix::models::pages::Exercise\">Exercise</a> <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;&amp;'a <a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.str.html\">str</a>: <a class=\"trait\" href=\"sqlx_core/column/trait.ColumnIndex.html\" title=\"trait sqlx_core::column::ColumnIndex\">ColumnIndex</a>&lt;R&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,&nbsp;</span>","synthetic":false,"types":["headless_lms_actix::models::pages::Exercise"]},{"text":"impl&lt;'a, R:&nbsp;<a class=\"trait\" href=\"sqlx_core/row/trait.Row.html\" title=\"trait sqlx_core::row::Row\">Row</a>&gt; <a class=\"trait\" href=\"sqlx_core/from_row/trait.FromRow.html\" title=\"trait sqlx_core::from_row::FromRow\">FromRow</a>&lt;'a, R&gt; for <a class=\"struct\" href=\"headless_lms_actix/models/pages/struct.ExerciseWithExerciseItems.html\" title=\"struct headless_lms_actix::models::pages::ExerciseWithExerciseItems\">ExerciseWithExerciseItems</a> <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;&amp;'a <a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.str.html\">str</a>: <a class=\"trait\" href=\"sqlx_core/column/trait.ColumnIndex.html\" title=\"trait sqlx_core::column::ColumnIndex\">ColumnIndex</a>&lt;R&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/naive/datetime/struct.NaiveDateTime.html\" title=\"struct chrono::naive::datetime::NaiveDateTime\">NaiveDateTime</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/vec/struct.Vec.html\" title=\"struct alloc::vec::Vec\">Vec</a>&lt;<a class=\"struct\" href=\"headless_lms_actix/models/exercise_items/struct.ExerciseItem.html\" title=\"struct headless_lms_actix::models::exercise_items::ExerciseItem\">ExerciseItem</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/vec/struct.Vec.html\" title=\"struct alloc::vec::Vec\">Vec</a>&lt;<a class=\"struct\" href=\"headless_lms_actix/models/exercise_items/struct.ExerciseItem.html\" title=\"struct headless_lms_actix::models::exercise_items::ExerciseItem\">ExerciseItem</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,&nbsp;</span>","synthetic":false,"types":["headless_lms_actix::models::pages::ExerciseWithExerciseItems"]}];
implementors["sqlx_core"] = [];
if (window.register_implementors) {window.register_implementors(implementors);} else {window.pending_implementors = implementors;}})()