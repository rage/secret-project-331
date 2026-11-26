from inspect import isclass, isfunction
from collections import defaultdict

point_register = {'suite': defaultdict(list), 'test': defaultdict(list)}


def qualifier(test):
    return "%s.%s" % (test.__module__, test.__qualname__)


def save_points(o, points, dst):
    q = qualifier(o)
    dst[q] += filter(lambda point: point not in dst[q], points)


def points(*points):

    def points_wrapper(o):
        if isclass(o):
            save_points(o, points, point_register['suite'])
        elif isfunction(o):
            save_points(o, points, point_register['test'])
        else:
            raise Exception("Expected decorator object '%s' type to be Class or Function but was %s." % (o, type(o)))
        return o

    if not points:
        raise Exception("You need to define at least one point in the points decorator declaration")
    for point in points:
        if type(point) is not str:
            msg = "Points decorator argument '%s' needs to be a string, but was %s." % (point, type(point).__name__)
            raise Exception(msg)
    return points_wrapper


def _parse_points(test):
    name = _name_test(test)
    testPoints = point_register['test']
    points = testPoints[name]
    key = name[:name.rfind('.')]
    suitePoints = point_register['suite'][key]
    points += suitePoints
    return points


def _name_test(test):
    module = test.__module__
    classname = test.__class__.__name__
    testName = test._testMethodName
    return module + '.' + classname + '.' + testName
