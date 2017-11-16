define(['./el_const'], function(CONST){
'use strict';

function Scope(model, super_scope) {
	if (super_scope instanceof Scope || super_scope === null || super_scope === undefined) {
		this.model = model || {};
		this[CONST.SUPER] = super_scope || null;
		this[CONST.ROOT] = super_scope instanceof Scope ? super_scope[CONST.ROOT] : this.model;
		Object.freeze(this);
	} else {
		throw new Error('Expecting Scope');
	}
}

return Object.defineProperties({}, {
	Scope: {
		value: Scope,
		enumerable: true
	}
});

});