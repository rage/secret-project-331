import importlib
import sys

_stdout_pointer = 0


def load_module(pkg, lang="en"):
    try:
        return importlib.import_module(pkg)
    except Exception as e:
        return AssertionError(e)


def reload_module(module):
    global _stdout_pointer
    if isinstance(module, AssertionError):
        raise module
    _stdout_pointer = len(sys.stdout.getvalue())
    importlib.reload(module)


def get_stdout():
    return sys.stdout.getvalue()[_stdout_pointer:].strip()
