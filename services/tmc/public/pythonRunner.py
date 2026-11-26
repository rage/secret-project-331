# Loaded by pythonWorker.js into its own namespace; `run_main` is the worker's entry point for Run.
import ast
import builtins
import sys
import traceback

import js
from pyodide.ffi import can_run_sync, run_sync


_builtin_input = builtins.input


async def _input_async(prompt=""):
    sys.stdout.flush()
    return str(await js.requestStdinLine(str(prompt)))


def _input_blocking(prompt=""):
    return run_sync(_input_async(prompt))


def _input_unsupported(prompt=""):
    raise RuntimeError(
        "input() inside a function needs a newer browser; call input() outside functions"
    )


class _AwaitTopLevelInput(ast.NodeTransformer):
    """Makes module-level `input()` calls awaitable where blocking input is not available."""

    def visit_FunctionDef(self, node):
        return node

    visit_AsyncFunctionDef = visit_FunctionDef
    visit_Lambda = visit_FunctionDef
    visit_ClassDef = visit_FunctionDef

    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name) and node.func.id == "input":
            awaited = ast.Await(
                ast.Call(
                    func=ast.Name(id="__tmc_input_async__", ctx=ast.Load()),
                    args=node.args,
                    keywords=node.keywords,
                )
            )
            return ast.copy_location(awaited, node)
        return node


def _error_message(error, filename):
    frames = [f for f in traceback.extract_tb(error.__traceback__) if f.filename == filename]
    line = frames[-1].lineno if frames else getattr(error, "lineno", None) or 0
    message = error.msg if isinstance(error, SyntaxError) else str(error)
    return f"{type(error).__name__} on line {line}: {message}"


async def run_main(source, filename, blocking_input=None):
    """Runs `source` as `__main__` in a fresh namespace.

    Returns None on success (including `exit()`), else a one-line error message.
    `blocking_input` defaults to whether the runtime can suspend on a promise (JSPI).
    """
    if blocking_input is None:
        blocking_input = can_run_sync()
    builtins.input = _input_blocking if blocking_input else _input_unsupported
    builtins.__tmc_input_async__ = _input_async
    try:
        tree = ast.parse(source, filename)
        if not blocking_input:
            tree = ast.fix_missing_locations(_AwaitTopLevelInput().visit(tree))
        code = compile(tree, filename, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
        namespace = {"__name__": "__main__", "__file__": filename, "__builtins__": builtins}
        result = eval(code, namespace)
        if result is not None:
            await result
    except SystemExit:
        pass
    except BaseException as error:  # noqa: BLE001
        return _error_message(error, filename)
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
    return None


def restore_input():
    """Undoes `run_main`'s `input()` so code that is not a Run (tests) gets the builtin back."""
    builtins.input = _builtin_input
