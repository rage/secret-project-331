from unittest import TextTestRunner, TestLoader
from .result import TMCResult
from .points import _parse_points, _name_test
from itertools import chain
import json


class TMCTestRunner(TextTestRunner):
    """A test runner for TMC exercises.
    """

    resultclass = TMCResult

    def __init__(self, *args, **kwargs):
        super(TMCTestRunner, self).__init__(*args, **kwargs)

    def run(self, test):
        print('Running tests with some TMC magic...')
        return super(TMCTestRunner, self).run(test)

    def available_points(self):
        testLoader = TestLoader()
        tests = testLoader.discover('.', 'test*.py', None)
        tests = list(chain(*chain(*tests._tests)))

        points = map(_parse_points, tests)
        names = map(_name_test, tests)

        result = dict(zip(names, points))

        with open('.available_points.json', 'w') as f:
            json.dump(result, f, ensure_ascii=False)
