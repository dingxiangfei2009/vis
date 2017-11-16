define([], function() {
'use strict';
//var immediate_queue = [];
//
//function immediate_run_all() {
//	var _queue = immediate_queue.slice();
//	immediate_queue.length = 0;
//	for (var functor of _queue) {
//		functor();
//	}
//}

function async(functor, next_cycle, timeout) {
	switch(next_cycle) {
	case 'animate':
		requestAnimationFrame(functor);
		break;
	case 'timeout':
		setTimeout(functor, timeout || 0);
		break;
	default:
		Promise.resolve().then(functor);
	}
}

return Object.defineProperties({}, {
	async: {
		value: async,
		enumerable: true
	}
});

});