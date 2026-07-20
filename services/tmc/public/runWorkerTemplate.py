# Run worker template: receives user script via base64 from JS, parses and transforms
# only the user code (PatchCode), then runs it in an async wrapper. No string embedding
# of user code, so no escaping issues; PatchCode runs only on user AST.
import ast
import asyncio
import base64
import sys
import traceback
from js import userScriptB64, exit, printError, inputPromise

user_source = base64.b64decode(userScriptB64).decode("utf-8")

user_code = None


class PatchCode(ast.NodeTransformer):
    def __init__(self):
        super().__init__()
        self._in_async = False

    def visit_AsyncFunctionDef(self, node):
        old = self._in_async
        self._in_async = True
        try:
            return self.generic_visit(node)
        finally:
            self._in_async = old

    def visit_FunctionDef(self, node):
        """Don't rewrite input() inside sync functions (e.g. nested inside async)."""
        old = self._in_async
        self._in_async = False
        try:
            return self.generic_visit(node)
        finally:
            self._in_async = old

    def visit_Lambda(self, node):
        """Don't rewrite input() inside lambdas (e.g. nested inside async)."""
        old = self._in_async
        self._in_async = False
        try:
            return self.generic_visit(node)
        finally:
            self._in_async = old

    def generic_visit(self, node):
        super().generic_visit(node)
        if (
            self._in_async
            and isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "input"
        ):
            result = ast.Await(node)
            return ast.copy_location(result, node)
        return node


def _wrap_in_async_main(tree):
    """Wrap module body in async def __run__(); we await it from execute() to avoid module-level coroutine."""
    wrapped = ast.Module(
        body=[
            ast.AsyncFunctionDef(
                name="__run__",
                args=ast.arguments(
                    posonlyargs=[],
                    args=[],
                    vararg=None,
                    kwonlyargs=[],
                    kw_defaults=[],
                    kwarg=None,
                    defaults=[],
                ),
                body=tree.body,
                decorator_list=[],
                returns=None,
            ),
        ],
        type_ignores=[],
    )
    ast.fix_missing_locations(wrapped)
    return wrapped


try:
    tree = ast.parse(user_source)
    # Patch after wrapping: top-level user code lives inside async __run__ only after
    # _wrap_in_async_main. Otherwise module-level input() is never rewritten to await.
    wrapped = _wrap_in_async_main(tree)
    wrapped = PatchCode().visit(wrapped)
    ast.fix_missing_locations(wrapped)
    user_code = compile(wrapped, "<user-script>", "exec")
except SyntaxError as e:
    printError(str(e.msg), "SyntaxError", e.lineno or 0, [])
    exit()
except Exception:  # noqa: BLE001
    _t, v, tb = sys.exc_info()
    frames = traceback.extract_tb(tb)
    line = frames[-1].lineno if frames else 0
    printError(str(v), type(v).__name__, line, [])
    exit()

if user_code is None:
    exit()


async def execute():
    exec_globals = dict(globals())
    exec_globals["__name__"] = "__main__"
    exec(user_code, exec_globals)
    await exec_globals["__run__"]()


async def input_impl(prompt=None):
    return await inputPromise(prompt)


globals()["input"] = input_impl


async def wrap_execution():
    try:
        await execute()
        exit()
    except Exception:  # noqa: BLE001
        _t, v, tb = sys.exc_info()
        frames = traceback.extract_tb(tb)
        line = frames[-1].lineno if frames else 0
        tb2 = ["Line " + str(f.lineno) + " in " + f.name + "()" for f in frames[2:]]
        printError(str(v), type(v).__name__, line, tb2)
        exit()


if user_code is not None:
    _run_task = asyncio.create_task(wrap_execution())
