define(['observe/observe'], function (observe) {
'use strict';

return Object.freeze({

SPLICE: observe.SPLICE,
SUPER: Symbol('super'),
ROOT: Symbol('root'),
VOID: Symbol('void'),
ALL_PROP: observe.ALL_PROP,
NOTIFIER: Symbol('notifier'),
EL: Symbol('el')

});

});
