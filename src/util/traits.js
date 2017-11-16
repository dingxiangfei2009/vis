define([], function() {
'use strict';

function is_number(value) {
	return 'number' === typeof value;
}

function is_string(value) {
	return 'string' === typeof value;
}

function is_object(value) {
	return value && 'object' === typeof value;
}

function is_array(value) {
	return Array.isArray(value);
}

function is_map(value) {
	return value instanceof Map;
}

function is_set(value) {
	return value instanceof Set;
}

function is_function(value) {
	return 'function' === typeof value;
}

function is_symbol(value) {
	return 'symbol' === typeof value;
}

function is_undefined(value) {
	return 'undefined' === typeof value;
}

function is_null(value) {
	return value === null;
}

function EMPTY_FUNCTION() {
}

function IDENTITY_FUNCTION(x) {
	return x;
}

function CONST_FUNCTION(x) {
	return function() {
		return x;
	};
}

return Object.freeze({
	is_number: is_number,
	is_function: is_function,
	is_object: is_object,
	is_array: is_array,
	is_symbol: is_symbol,
	is_string: is_string,
	is_map: is_map,
	is_set: is_set,
	is_undefined: is_undefined,
	is_null: is_null,
	EMPTY_FUNCTION: EMPTY_FUNCTION,
	IDENTITY_FUNCTION: IDENTITY_FUNCTION,
	CONST_FUNCTION: CONST_FUNCTION
});

});
