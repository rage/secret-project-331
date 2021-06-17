(function() {var implementors = {};
implementors["headless_lms_actix"] = [{"text":"impl&lt;'a, R:&nbsp;<a class=\"trait\" href=\"sqlx_core/row/trait.Row.html\" title=\"trait sqlx_core::row::Row\">Row</a>&gt; <a class=\"trait\" href=\"sqlx_core/from_row/trait.FromRow.html\" title=\"trait sqlx_core::from_row::FromRow\">FromRow</a>&lt;'a, R&gt; for <a class=\"struct\" href=\"headless_lms_actix/models/exercise_tasks/struct.ExerciseTask.html\" title=\"struct headless_lms_actix::models::exercise_tasks::ExerciseTask\">ExerciseTask</a> <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;&amp;'a <a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.str.html\">str</a>: <a class=\"trait\" href=\"sqlx_core/column/trait.ColumnIndex.html\" title=\"trait sqlx_core::column::ColumnIndex\">ColumnIndex</a>&lt;R&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"enum\" href=\"serde_json/value/enum.Value.html\" title=\"enum serde_json::value::Value\">Value</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,&nbsp;</span>","synthetic":false,"types":["headless_lms_actix::models::exercise_tasks::ExerciseTask"]},{"text":"impl&lt;'a, R:&nbsp;<a class=\"trait\" href=\"sqlx_core/row/trait.Row.html\" title=\"trait sqlx_core::row::Row\">Row</a>&gt; <a class=\"trait\" href=\"sqlx_core/from_row/trait.FromRow.html\" title=\"trait sqlx_core::from_row::FromRow\">FromRow</a>&lt;'a, R&gt; for <a class=\"struct\" href=\"headless_lms_actix/models/pages/struct.NextPageMetadata.html\" title=\"struct headless_lms_actix::models::pages::NextPageMetadata\">NextPageMetadata</a> <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;&amp;'a <a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.str.html\">str</a>: <a class=\"trait\" href=\"sqlx_core/column/trait.ColumnIndex.html\" title=\"trait sqlx_core::column::ColumnIndex\">ColumnIndex</a>&lt;R&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,&nbsp;</span>","synthetic":false,"types":["headless_lms_actix::models::pages::NextPageMetadata"]},{"text":"impl&lt;'a, R:&nbsp;<a class=\"trait\" href=\"sqlx_core/row/trait.Row.html\" title=\"trait sqlx_core::row::Row\">Row</a>&gt; <a class=\"trait\" href=\"sqlx_core/from_row/trait.FromRow.html\" title=\"trait sqlx_core::from_row::FromRow\">FromRow</a>&lt;'a, R&gt; for <a class=\"struct\" href=\"headless_lms_actix/models/pages/struct.Exercise.html\" title=\"struct headless_lms_actix::models::pages::Exercise\">Exercise</a> <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;&amp;'a <a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.str.html\">str</a>: <a class=\"trait\" href=\"sqlx_core/column/trait.ColumnIndex.html\" title=\"trait sqlx_core::column::ColumnIndex\">ColumnIndex</a>&lt;R&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,&nbsp;</span>","synthetic":false,"types":["headless_lms_actix::models::pages::Exercise"]},{"text":"impl&lt;'a, R:&nbsp;<a class=\"trait\" href=\"sqlx_core/row/trait.Row.html\" title=\"trait sqlx_core::row::Row\">Row</a>&gt; <a class=\"trait\" href=\"sqlx_core/from_row/trait.FromRow.html\" title=\"trait sqlx_core::from_row::FromRow\">FromRow</a>&lt;'a, R&gt; for <a class=\"struct\" href=\"headless_lms_actix/models/pages/struct.ExerciseWithExerciseTasks.html\" title=\"struct headless_lms_actix::models::pages::ExerciseWithExerciseTasks\">ExerciseWithExerciseTasks</a> <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;&amp;'a <a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.str.html\">str</a>: <a class=\"trait\" href=\"sqlx_core/column/trait.ColumnIndex.html\" title=\"trait sqlx_core::column::ColumnIndex\">ColumnIndex</a>&lt;R&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/string/struct.String.html\" title=\"struct alloc::string::String\">String</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"enum\" href=\"https://doc.rust-lang.org/nightly/core/option/enum.Option.html\" title=\"enum core::option::Option\">Option</a>&lt;<a class=\"struct\" href=\"chrono/datetime/struct.DateTime.html\" title=\"struct chrono::datetime::DateTime\">DateTime</a>&lt;<a class=\"struct\" href=\"chrono/offset/utc/struct.Utc.html\" title=\"struct chrono::offset::utc::Utc\">Utc</a>&gt;&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"uuid/struct.Uuid.html\" title=\"struct uuid::Uuid\">Uuid</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/vec/struct.Vec.html\" title=\"struct alloc::vec::Vec\">Vec</a>&lt;<a class=\"struct\" href=\"headless_lms_actix/models/exercise_tasks/struct.ExerciseTask.html\" title=\"struct headless_lms_actix::models::exercise_tasks::ExerciseTask\">ExerciseTask</a>&gt;: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"struct\" href=\"https://doc.rust-lang.org/nightly/alloc/vec/struct.Vec.html\" title=\"struct alloc::vec::Vec\">Vec</a>&lt;<a class=\"struct\" href=\"headless_lms_actix/models/exercise_tasks/struct.ExerciseTask.html\" title=\"struct headless_lms_actix::models::exercise_tasks::ExerciseTask\">ExerciseTask</a>&gt;: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/decode/trait.Decode.html\" title=\"trait sqlx_core::decode::Decode\">Decode</a>&lt;'a, R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;<a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.i32.html\">i32</a>: <a class=\"trait\" href=\"sqlx_core/types/trait.Type.html\" title=\"trait sqlx_core::types::Type\">Type</a>&lt;R::<a class=\"type\" href=\"sqlx_core/row/trait.Row.html#associatedtype.Database\" title=\"type sqlx_core::row::Row::Database\">Database</a>&gt;,&nbsp;</span>","synthetic":false,"types":["headless_lms_actix::models::pages::ExerciseWithExerciseTasks"]}];
implementors["sqlx_core"] = [];
if (window.register_implementors) {window.register_implementors(implementors);} else {window.pending_implementors = implementors;}})()