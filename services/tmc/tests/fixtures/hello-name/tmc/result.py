from unittest.runner import TextTestResult
from .points import _parse_points, _name_test
import atexit
import json
import traceback

results = []


class TMCResult(TextTestResult):

    def __init__(self, stream, descriptions, verbosity):
        super(TMCResult, self).__init__(stream, descriptions, verbosity)

    def startTest(self, test):
        super(TMCResult, self).startTest(test)

    def addSuccess(self, test):
        super(TMCResult, self).addSuccess(test)
        self.addResult(test, 'passed')

    def addFailure(self, test, err):
        super(TMCResult, self).addFailure(test, err)
        self.addResult(test, 'failed', err)

    def addError(self, test, err):
        super(TMCResult, self).addError(test, err)
        self.addResult(test, 'errored', err)

    def addResult(self, test, status, err=None):
        points = _parse_points(test)
        message = ""
        backtrace = []
        if err is not None:
            message = str(err[1])
            backtrace = traceback.format_tb(err[2])

        details = {
            'name': _name_test(test),
            'status': status,
            'message': message,
            'passed': status == 'passed',
            'points': points,
            'backtrace': backtrace
        }
        results.append(details)

    # TODO: Do not do this if not using TMCTestRunner
    @atexit.register
    def write_output():
        with open('.tmc_test_results.json', 'w') as f:
            json.dump(results, f, ensure_ascii=False)
