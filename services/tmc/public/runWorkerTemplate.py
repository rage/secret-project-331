# Run worker template: receives user script via base64 from JS, parses and transforms
# only the user code (PatchCode), then runs it in an async wrapper. No string embedding
# of user code, so no escaping issues; PatchCode runs only on user AST.
import ast
import asyncio
import base64
import re
import sys
import traceback
from js import userScriptB64, exit, printError, inputPromise

user_source = base64.b64decode(userScriptB64).decode("utf-8")


class PatchCode(ast.NodeTransformer):
    def generic_visit(self, node):
        super().generic_visit(node)
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            remove_padding = re.sub(r"[\n] ", "\n", node.value)
            result = ast.Constant(remove_padding)
            return ast.copy_location(result, node)
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "input"
        ):
            result = ast.Await(node)
            return ast.copy_location(result, node)
        return node


try:
    tree = ast.parse(user_source)
    tree = PatchCode().visit(tree)
    user_code = compile(tree, " ", "exec")
except SyntaxError as e:
    printError(str(e.msg), "SyntaxError", e.lineno or 0, [])
    exit()
except Exception:
    t, v, tb = sys.exc_info()
    frames = traceback.extract_tb(tb)
    line = frames[-1].lineno if frames else 0
    printError(str(v), type(v).__name__, line, [])
    exit()


async def execute():
    __name__ = "__main__"
    exec(user_code, globals())


async def input_impl(prompt=None):
    return await inputPromise(prompt)


globals()["input"] = input_impl


async def wrap_execution():
    try:
        await execute()
        exit()
    except Exception:
        t, v, tb = sys.exc_info()
        frames = traceback.extract_tb(tb)
        line = frames[-1].lineno if frames else 0
        tb2 = ["Line " + str(f.lineno) + " in " + f.name + "()" for f in frames[2:]]
        printError(str(v), type(v).__name__, line, tb2)
        exit()


asyncio.create_task(wrap_execution())
