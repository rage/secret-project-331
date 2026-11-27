# Loaded by pythonWorker.js into its own namespace; `run_main` is the worker's entry point for Run.
import ast
import builtins
import sys
import traceback

import js
from pyodide.ffi import can_run_sync, run_sync


_builtin_input = builtins.input
# What a Run may change in the interpreter it shares with Test, as it was before any Run.
_initial_builtins = dict(vars(builtins))
_initial_modules = set(sys.modules)
_initial_recursion_limit = sys.getrecursionlimit()


async def _input_async(prompt=""):
    sys.stdout.flush()
    return str(await js.requestStdinLine(str(prompt)))


def _input_via_service_worker(prompt=""):
    sys.stdout.flush()
    return str(js.readStdinLineSync(str(prompt)))


def _input_via_jspi(prompt=""):
    return run_sync(_input_async(prompt))


def _input_unsupported(prompt=""):
    raise RuntimeError(
        "input() inside a function needs service workers, which this browser has disabled"
        " (for example in a private window); call input() outside functions"
    )


_BLOCKING_INPUTS = {"service-worker": _input_via_service_worker, "jspi": _input_via_jspi}


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


async def run_main(source, filename, input_mode=None):
    """Runs `source` as `__main__` in a fresh namespace.

    Returns None on success (including `exit()`), else a one-line error message.
    `input_mode` is how `input()` blocks: "service-worker" (stdinServiceWorker.js answers a
    synchronous request), "jspi" (WebAssembly stack switching) or "none", when only module-level
    `input()` works, rewritten into an await. Defaults to "jspi" where the runtime supports it.
    """
    if input_mode is None:
        input_mode = "jspi" if can_run_sync() else "none"
    blocking_input = _BLOCKING_INPUTS.get(input_mode)
    builtins.input = blocking_input or _input_unsupported
    builtins.__tmc_input_async__ = _input_async
    try:
        tree = ast.parse(source, filename)
        if blocking_input is None:
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


def reset_interpreter():
    """Undoes what Runs changed in builtins and `sys`, and forgets modules they imported, so tests
    see the interpreter much as it was loaded. Attributes a Run set on modules imported before
    stay. Also undoes `run_main`'s `input()`."""
    current = vars(builtins)
    current.clear()
    current.update(_initial_builtins)
    builtins.input = _builtin_input
    for name in set(sys.modules) - _initial_modules:
        del sys.modules[name]
    sys.setrecursionlimit(_initial_recursion_limit)
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
    sys.stdin = sys.__stdin__
