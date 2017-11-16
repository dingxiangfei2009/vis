define([], function () {
'use strict';

function inherit(subclass, base, proto) {
	subclass.prototype = Object.assign(Object.create(base.prototype), proto);
	subclass.prototype.constructor = subclass;
}

return inherit;

});