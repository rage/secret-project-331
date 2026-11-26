import unittest
from unittest.mock import patch

from tmc import points
from tmc.utils import get_stdout, load_module, reload_module

exercise = "src.hello_name"


@points("1.1")
class HelloNameTest(unittest.TestCase):
    def test_greets_by_name(self):
        with patch("builtins.input", return_value="Ada"):
            reload_module(load_module(exercise))
        self.assertEqual(get_stdout(), "Hello Ada")


if __name__ == "__main__":
    unittest.main()
