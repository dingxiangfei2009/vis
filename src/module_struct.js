define([], function(){
'use strict';

function make_module_data_key(name) {
	return Symbol('vis-module: ' + name);
}

function module(module_name, options) {

	function instance() {
		var args = [];
		for (var i = 0, end = arguments.length; i < end; ++i) {
			args.push(arguments[i]);
		}
		return new options.instance(...args);
	}

	return Object.defineProperties({
		configure: options.configure,
		instance: instance,
		bootstrap: options.bootstrap
	},
	{
		identifier: {
			value: make_module_data_key(module_name)
		}
	});
}

return module;

});