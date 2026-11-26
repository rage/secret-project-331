from unittest import TestProgram
from .runner import TMCTestRunner
import sys


if sys.argv.__len__() > 1 and sys.argv[1] == 'available_points':
    TMCTestRunner().available_points()
    sys.exit()

main = TestProgram
main(testRunner=TMCTestRunner, module=None, failfast=False, buffer=True)
