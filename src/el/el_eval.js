define(['util/util', './el_const', './scope', './standard', 'compat/observe', 'observe/observe'],
function (util, CONST, el_scope, el_standard, _proxy, observe){
'use strict';

var min = Math.min;
var PLACEHOLDER = Symbol('?');

function EvaluateResult(value, traits) {
	this.traits = traits;
	this.value = value;
}

function unwrap_evaluation_result(value) {
	if (value instanceof EvaluateResult)
		return value.value;
	else
		return value;
}

function make_return_value(value, traits, lazy) {
	return new EvaluateResult(value, traits, lazy);
}

function make_catch_return_value(action) {
	try {
		return action();
	} catch(e){
		throw make_return_value(e, []);
	}
}

function add_trait_properties(trait, object, property) {
	if (util.traits.is_object(object))
		trait.push([object, property]);
}

function merge_traits(traits, keep) {
	if (!traits.length)
		return [];
	var new_trait = [];
	for (var i = 0, endi = traits.length; i < endi; ++i)
		for (var j = 0, endj = traits[i].length; j < endj; ++j)
			new_trait.push(traits[i][j]);
	if (keep) {
		new_trait.bindable = traits[0].bindable;
		new_trait.context = traits[0].context;
		new_trait.bind_path = traits[0].bind_path;
	}
	return new_trait;
}

function evaluate_primitive(expression) {
	return make_return_value(expression.value, []);
}

// this one is special
function evaluate_iterate(expression, scope) {
	var collection = evaluate_el(expression.collection, scope);
	if (collection instanceof EvaluateResult && util.traits.is_array(collection.value))
		add_trait_properties(collection.traits, collection.value, CONST.SPLICE);
	return {
		iterate: true,
		element: expression.element,
		index: expression.index,
		reference: expression.reference,
		collection: collection
	};
}

function lookup_chain(scope, property) {
	var ptr = scope;
	while (!(property in ptr.model) &&
		ptr[CONST.SUPER] &&
		util.traits.is_object(ptr[CONST.SUPER])) {
		ptr = ptr[CONST.SUPER];
	}
	if (property in ptr.model) {
		return ptr.model;
	} else {
		return null;
	}
}

function full_scope_chain(scope, property) {
	var ptr = scope;
	var chain = [];
	while (ptr && !(property in ptr.model)) {
		chain.push(ptr.model);
		ptr = ptr[CONST.SUPER];
	}
	if (ptr)
		chain.unshift(ptr.model);	// actual bindable scope
	return chain;
}

function evaluate_identifier(expression, scope) {
	var model = lookup_chain(scope, expression.name);
	var trait =
		full_scope_chain(scope, expression.name)
			.map(model => [model, expression.name]);
	trait.bindable = true;
	trait.context = model || scope.model;
	trait.bind_path = [trait.context, expression.name];
	return make_return_value(
		model ? model[expression.name] : undefined,
		trait
	);
}

function evaluate_computed_identifier(expression, scope) {
	var value = evaluate_el(expression.value, scope.model);
	var model = lookup_chain(scope, value.value);
	var trait =
		merge_traits([
			value.traits,
			full_scope_chain(scope, value.value)
				.map(model => [model, value.value])
		]);
	trait.bindable = true;
	trait.context = model || scope.model;
	trait.bind_path = [trait.context, value.value];
	return make_return_value(model ? model[valeu.value] : undefined, trait);
}

function evaluate_add(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value + right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_sub(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value - right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_mul(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value * right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_div(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value / right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_mod(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value % right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_gt(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value > right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_ge(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value >= right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_lt(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value < right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_le(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value <= right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_eq(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value === right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_neq(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	var right = force(evaluate_el(expression.right, scope));
	return make_return_value(left.value !== right.value, merge_traits([left.traits, right.traits]));
}

function evaluate_and(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	if (left.value) {
		var right = evaluate_el(expression.right, scope);
		return make_return_value(right.value, merge_traits([left.traits, right.traits]));
	} else {
		return left;
	}
}

function evaluate_or(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	if (left.value) {
		return left;
	} else {
		var right = evaluate_el(expression.right, scope);
		return make_return_value(right.value, merge_traits([left.traits, right.traits]));
	}
}

function evaluate_neg(expression, scope) {
	var value = force(evaluate_el(expression.value, scope));
	return make_return_value(-value.value, value.traits);
}

function evaluate_bool_neg(expression, scope) {
	var value = force(evaluate_el(expression.value, scope));
	return make_return_value(!value.value, value.traits);
}

function evaluate_conditional(expression, scope) {
	var conditional = force(evaluate_el(expression.condition, scope));
	var value = conditional.value ?
				evaluate_el(expression.consequent, scope) :
				evaluate_el(expression.alternative, scope);
	return make_return_value(value.value, merge_traits([conditional.traits, value.traits]));
}

function evaluate_pipe(expression, scope) {
	var value = evaluate_el(expression.left, scope);
	var pipe_functor = evaluate_el(expression.right, scope);
	if (util.traits.is_function(pipe_functor.value)) {
		// assuming pure functions
		var result = apply_el_function(
			pipe_functor,
			value.value === CONST.VOID ? [] : [value.value]);
		if (result instanceof EvaluateResult)
			return make_return_value(result.value,
					merge_traits([value.traits, pipe_functor.traits, result.traits]));
		else
			return make_return_value(
					result,
					merge_traits([
						value.traits,
						pipe_functor.traits]));
	} else
		return make_return_value(undefined,
				merge_traits([value.traits, pipe_functor.traits]));
}

function evaluate_list_pipe(expression, scope) {
	var parameters = [];
	var traits = [];
	var force_parameters = expression.force;
	for (var i = 0, end = expression.left.length; i < end; ++i) {
		var value = evaluate_el(expression.left[i], scope);
		if (force_parameters)
			value = force(value);

		parameters.push(value.value);
		traits.push(value.traits);
	}
	var pipe_functor = evaluate_el(expression.right, scope);
	traits.push(pipe_functor.traits);
	if (util.traits.is_function(pipe_functor.value)) {
		var result = apply_el_function(pipe_functor, parameters);
		if (result instanceof EvaluateResult) {
			traits.push(result.traits);
			return make_return_value(
				result.value,
				merge_traits(traits));
		} else
			return make_return_value(
				result,
				merge_traits(traits));
	} else
		return make_return_value(undefined, merge_traits(traits));
}

function evaluate_promise(expression, scope) {
	var promise_value;
	(function() {
		try {
			promise_value = evaluate_el(expression.promise, scope);
		} catch (e) {
			return make_return_value(
				Promise.reject(make_return_value(e, [])),
				[]);
		}
	})();

	function resolve_respond(value) {
		var resolve_value = evaluate_el(expression.resolve, scope);
		var value_traits;
		if (value instanceof EvaluateResult) {
			value_traits = value.traits; value = value.value;
		} else
			value_traits = [];

		if (util.traits.is_function(resolve_value.value))
			return make_catch_return_value(function () {
				return make_return_value(
					apply_el_function(resolve_value, [value]),
					merge_traits([
						promise_value.traits,
						resolve_value.traits,
						value_traits
					]));
			});
		else
			return make_return_value(
				resolve_value.value,
				merge_traits([
					promise_value.traits,
					resolve_value.traits,
					value_traits
				]));
	}
	function reject_respond(reason) {
		var reason_traits;
		if (reason instanceof EvaluateResult) {
			reason_traits = reason.traits; reason = reason.value;
		} else
			reason_traits = [];

		if (expression.reject) {
			var reject_value = evaluate_el(expression.reject, scope);
			if (util.traits.is_function(reject_value.value))
				return make_catch_return_value(function () {
					return make_return_value(
						apply_el_function(reject_value.value, [reason.value]),
						merge_traits([
							promise_value.traits,
							reject_value.traits,
							reason_traits]));
				});
			else
				return make_return_value(
					reject_value.value,
					merge_traits([
						promise_value.traits,
						reject_value.traits,
						reason_traits]));
		} else
			throw reason;
	}

	if (promise_value.value instanceof Promise)
		return make_return_value(
			promise_value.value.then(resolve_respond, reject_respond),
			promise_value.traits);
	else
		return make_return_value(Promise.resolve(promise_value), promise_value.traits);
}

function evaluate_access(expression, scope) {
	var left = force(evaluate_el(expression.left, scope));
	if (util.traits.is_null(left.value) || util.traits.is_undefined(left.value)) {
		left.value = undefined;
		return left;
	} else if (util.traits.is_string(expression.right)) {
		if (left.traits.bindable)
			left.traits.bind_path.push(expression.right);
		left.traits.context = left.value;
		add_trait_properties(left.traits, left.value, expression.right);
		left.value = left.value[expression.right];
		return left;
	} else {
		var right = force(evaluate_el(expression.right, scope));
		var traits = merge_traits([left.traits, right.traits], true);
		if (traits.bindable)
			traits.bind_path.push(right.value);
		traits.context = left.value;
		add_trait_properties(traits, left.value, right.value);
		return make_return_value(left.value[right.value], traits);
	}
}

function evaluate_global_access (expression) {
	if (util.traits.is_string(expression.name))
		return make_return_value(el_standard.library[expression.name], []);
	else {
		var name = force(evaluate_el(expression.name));
		return make_return_value(el_standard.library[name.value], name.traits);
	}
}

function evaluate_object(expression, scope) {
	var object = {};
	var traits = [];
	expression.entries.forEach(function (pair) {
		var key;
		if (util.traits.is_string(pair[0]))
			key = pair[0];
		else {
			var key_result = force(evaluate_el(pair[0], scope));
			key = key_result.value;
			traits.push(key_result.traits);
		}
		var value = weak_force(evaluate_el(pair[1], scope));
		object[key] = value.value;
		traits.push(value.traits);
	});
	return make_return_value(object, merge_traits(traits));
}

function evaluate_array (expression, scope) {
	var values = [], traits = [];
	expression.array.map(function (entry) {
		var value;
		if (entry.type === 'spread') {
			value = force(evaluate_el(entry.value, scope));
			values.push(...value.value);
		} else {
			value = evaluate_el(entry, scope);
			values.push(value.value);
		}
		traits.push(value.traits);
	});
	return make_return_value(values, merge_traits(traits));
}

function evaluate_stream (expression, scope) {
	var value = evaluate_el(expression.start, scope);
	var traits = [value.traits];
	var start = value.value;
	var next;
	var step;
	if (expression.step) {
		value = evaluate_el(expression.step, scope);
		step = value.value;
		next = start + step;
		traits.push(value.traits);
	} else if (expression.next) {
		value = evaluate_el(expression.next, scope);
		next = value.value;
		step = next - start;
		traits.push(value.traits);
	}
	var end;
	if (expression.end) {
		value = evaluate_el(expression.end, scope);
		end = value.value;
		traits.push(value.traits);
	}
	var filter;
	if (expression.filter) {
		value = evaluate_el(expression.filter, scope);
		filter = value.value;
		traits.push(value.traits);
	}

	function test_filter(value) {
		var filter_value;
		if (filter) {
			filter_value = force(filter(value));
			if (filter_value instanceof EvaluateResult)
				return filter_value.value;
			else
				return filter_value;
		} else return true;
	}

	function *stream_generator() {
		if (start >= end)
			return;
		else if (test_filter(start))
			yield start;

		if (expression.next || expression.step) {
			if (next >= end)
				return;
			else if (test_filter(next))
				yield next;

			next += step;
			while (!(next >= end)) {
				if (test_filter(next))
					yield next;
				next += step;
			}
		} else {
			++start;
			while (!(start >= end)) {
				if (test_filter(start))
					yield start;
				++start;
			}
		}
	}
	return make_return_value(stream_generator, merge_traits(traits));
}

function evaluate_stream_map(expression, scope) {
	function make_sub_scope(collection, key, value) {
		var model = {};
		Object.defineProperty(model, iterator.element, {
			value: value,
			writable: true
		});
		util.traits.is_undefined(iterator.index) ||
			Object.defineProperty(model, iterator.index, {value: key});
		util.traits.is_undefined(iterator.reference) ||
			Object.defineProperty(model, iterator.reference, {value: collection});
		return new el_scope.Scope(model, scope);
	}
	var values;
	var iterator = evaluate_iterate(expression.iterator, scope);
	var collection = force(iterator.collection);
	var traits = [collection.traits];
	if (collection.value instanceof Map) {
		values = new Map;
		collection.value.forEach(function (value, key) {
			var result = evaluate_el(
				expression.map,
				make_sub_scope(collection.value, key, value));
			values.set(key, result.value);
			traits.push(result.traits);
		});
	} else if (util.traits.is_array(collection.value)) {
		values = [];
		for (var i = 0, end = collection.value.length; i < end; ++i) {
			var result = evaluate_el(
				expression.map,
				make_sub_scope(collection.value, i, collection.value[i]));
			values.push(result.value);
			traits.push(result.traits);
		}
	} else if (collection.value && collection.value[Symbol.iterator]) {
		values = [];
		var count = 0;
		for (var element of collection.value) {
			var result = evaluate_el(
				expression.map,
				make_sub_scope(collection.value, count, element));
			values.push(result.value);
			traits.push(result.traits);
		}
	}
	return make_return_value(values, merge_traits(traits));
}

function evaluate_self_reference (expression, scope) {
	return make_return_value(scope.model, []);
}

function evaluate_apply(expression, scope) {
	var force_parameters = expression.force;
	var functor = force(evaluate_el(expression.functor, scope));
	var parameters = [];
	var traits = [functor.traits];
	expression.parameters.forEach(function (parameter) {
		var spread = parameter.type === 'spread';
		var result = spread ?
			force(evaluate_el(parameter.value, scope)) :
			evaluate_el(parameter, scope);
		if (force_parameters)
			result = force(result);
		if (spread)
			parameters.push(...result.value);
		else
			parameters.push(result.value);
		traits.push(result.traits);
	});
	var parameter_length = parameters.length;
	var incomplete_parameter =
		parameters.some(parameter => parameter === PLACEHOLDER);
	if (incomplete_parameter) {
		return make_return_value(function bound(...args) {
			var fill_args = [];
			var arg_length = args.length;
			var curry_ptr = 0, arg_ptr = 0;
			while (curry_ptr < parameter_length) {
				if (parameters[curry_ptr] === PLACEHOLDER)
					if (arg_ptr < arg_length)
						fill_args.push(args[arg_ptr++]);
					else
						fill_args.push(undefined);
				else
					fill_args.push(parameters[curry_ptr]);
				++curry_ptr;
			}
			while (arg_ptr < arg_length)
				fill_args.push(args[arg_ptr++]);
			return apply_el_function(functor, fill_args);
		}, merge_traits(traits));
	} else if (util.traits.is_function(functor.value)) {
		var return_value =
			apply_el_function(functor, parameters);
		if (return_value instanceof EvaluateResult) {
			traits.push(return_value.traits);
			return_value = return_value.value;	// unwrap
		}
		return make_return_value(return_value, merge_traits(traits));
	} else
		return make_return_value(undefined, merge_traits(traits));
}

function evaluate_placeholder() {
	return make_return_value(PLACEHOLDER, []);
}

function apply_el_function(functor, parameters) {
	return new LazyApplication(functor.value, functor.traits.context, parameters);
}

function force(value) {
	if (value instanceof EvaluateResult &&
		!(value.value instanceof Expression ||
		value.value instanceof LazyApplication))
		return value;
	var traits = [];
	while (true) {
		if (value instanceof EvaluateResult) {
			traits.push(value.traits);
			value = value.value;
		}
		if (value instanceof Expression)
			value = value.evaluate();
		else if (value instanceof LazyApplication)
			value = value.apply();
		else
			break;
	}
	if (value instanceof EvaluateResult) {
		traits.push(value.traits);
		value = value.value;
	}
	return make_return_value(value, merge_traits(traits));
}

// only force lazy applications
function weak_force(value) {
	if (value instanceof LazyApplication ||
		value instanceof EvaluateResult && value.value instanceof LazyApplication) {
		var traits = [];
		while (true) {
			if (value instanceof EvaluateResult) {
				traits.push(value.traits);
				value = value.value;
			}
			if (value instanceof LazyApplication)
				value = value.apply();
			else
				break;
		}
		if (value instanceof EvaluateResult) {
			traits.push(value.traits);
			value = value.value;
		}
		return make_return_value(value, merge_traits(traits));
	} else
		return value;
}

function force_values(values) {
	return values.map(force);
}

function evaluate_force(expression, scope) {
	return force(evaluate_el(expression.value, scope));
}

function evaluate_force_primitive(expression, scope) {
	return make_return_value(
		weak_force(evaluate_el(expression.value, scope)).value,
		[]);
}

function evaluate_all_properties(expression, scope) {
	var value = evaluate_el(expression.value, scope);
	add_trait_properties(value.traits, value.value, CONST.ALL_PROP);
	return value;
}

function evaluate_arrow_function (expression, scope) {
	var set_context = (model, context) => {
		model['this'] = context || scope.model;
	};
	var set_parameters = () => void 0;
	if (expression.input) {
		var parameters = expression.input.parameters;
		var parameter_length = parameters.length;
		set_parameters = (model, args) => {
			for (var i = 0, end = parameter_length; i < end; ++i)
				model[parameters[i]] = args[i];
			if (expression.input.spread)
				model[expression.input.spread] = args.slice(parameter_length);
			model['arguments'] = args.slice();
		};
		if (expression.input.context)
			set_context = (model, context, traits) => {
				var value = evaluate_el(expression.input.context, scope);
				traits.push(value.traits);
				model['this'] = value.value || context || scope.model;
			};
	}
	function invoke() {
		var traits = [];
		var pseudo_model = {'this': null, '$self': invoke};
		set_context(pseudo_model, this);
		var args = [];
		for (var i = 0, end = arguments.length; i < end; ++i)
			args.push(arguments[i]);
		set_parameters(pseudo_model, args);

		var sub_scope = new el_scope.Scope(pseudo_model, scope);
		var result = evaluate_el(expression.value, sub_scope);
		traits.push(result.traits);
		return make_return_value(result.value, merge_traits(traits));
	}
	Object.defineProperty(invoke, CONST.EL, {
		value: true
	});
	return make_return_value(invoke, []);
}

function Expression(expression, scope) {
	this.expression = expression;
	this.scope = scope;
}

Expression.prototype.evaluate = function () {
	return evaluate_el(this.expression, this.scope);
};

function Substitute(expression, scope, precondition, postcondition) {
	this.expression = expression;
	this.scope = scope;
	this.precondition = precondition;
	this.postcondition = postcondition;
}

function LazyApplication(functor, context, parameters) {
	this.functor = functor;
	this.context = context;
	this.parameters = parameters;
}

LazyApplication.prototype.apply = function () {
	function unwrap(value) {
		if (value instanceof EvaluateResult) {
			traits.push(value.traits);
			return value.value;
		} else
			return value;
	}
	var traits = [];
	var functor = unwrap(force(this.functor));
	var context = unwrap(force(this.context));
	var traits_container = {traits: traits};
	var parameters =
		this.parameters.map(function(parameter) {
			parameter = weak_force(parameter);
			if (parameter instanceof EvaluateResult) {
				traits.push(parameter.traits);
				parameter = parameter.value;
			}
			if (!functor[CONST.EL])
				return wrap_el_function(parameter, traits_container);
			else
				return parameter;
		});
	var result = functor.apply(context, parameters);
	traits_container.traits = null;
	if (result instanceof EvaluateResult) {
		traits.push(result.traits);
		result = result.value;
	}
	return make_return_value(result, merge_traits(traits));
};
	
function wrap_el_function(functor, traits_container) {
	if (util.traits.is_function(functor) && functor[CONST.EL])
		return function (...args) {
			var result = force(functor(...args));
			if (traits_container && traits_container.traits)
				traits_container.traits.push(result.traits);
			return result.value;
		};
	else
		return functor;
}

function evaluate_el_evaluator (expression, scope) {
	return make_return_value(
		new Expression(expression.expression, scope),
			[]);
}

function evaluate_el_substitute (expression, scope) {
	var sub_scope =
		unwrap_evaluation_result(
			force(evaluate_el(expression.scope, scope)));
	if (!sub_scope)
		sub_scope = new el_scope.Scope({}, scope);
	else if (!(sub_scope instanceof el_scope.Scope))
		sub_scope = new el_scope.Scope(sub_scope, scope);
	return make_return_value(
		new Substitute(expression.value, sub_scope,
				expression.precondition, expression.postcondition),
			[]);
}

function evaluate_substitue(substitute) {
	var post = [];
	var current = substitute;
	var traits = [];
	var precondition_assertion_failed = false;
	while (current instanceof Substitute) {
		while (current.precondition) {
			var precondition_result = force(evaluate_el(current.precondition, current.scope));
			if (precondition_result.value) {
				if (precondition_result.value instanceof Substitute) {
					current = precondition_result.value;
				} else
					break;
			} else {
				precondition_assertion_failed = true;
				break;
			}
		}
		if (precondition_assertion_failed) {
			current = undefined;
		} else {
			if (current.postcondition)
				post.push(current.postcondition);
			var eval_result = force(evaluate_el(current.expression, current.scope));
			current = eval_result.value;
			traits.unshift(eval_result.traits);
		}
	}
	for (var i = post.length - 1; i >= 0; ++i)
		evaluate_substitue(post[i]);
	return make_return_value(current, merge_traits(traits, true));
}

function evaluate_substitue_evaluator (expression, scope) {
	var substitute = force(evaluate_el(expression.value, scope));
	if (substitute.value instanceof Substitute) {
		var result = evaluate_substitue(substitute.value);
		return make_return_value(result.value, merge_traits([result.traits, substitute.traits]));
	} else
		return substitute;
}

function evaluate_scope (expression, scope) {
	return make_return_value(scope, []);
}

function evaluate_scope_uplift (expression, scope) {
	return evaluate_el(expression.expression, scope[CONST.SUPER] || scope);
}

function evaluate_last_value (expression, scope) {
	var traits = [];
	for (var i = 0, end = expression.list.length - 1; i < end; ++i) {
		traits.push(force(evaluate_el(expression.list[i], scope)).traits);
	}
	var last = evaluate_el(expression.list[expression.list.length - 1], scope);
	traits.unshift(last.traits);
	return make_return_value(last.value, merge_traits(traits, true));
}

function evaluate_void(){
	return make_return_value(CONST.VOID, []);
}

function evaluate_sequence (expression, scope) {
	var end = expression.sequence.length - 1
	for (var i = 0; i < end; ++i)
		force(evaluate_el(expression.sequence[i], scope));
	return evaluate_el(expression.sequence[end], scope); // last value
}

function evaluate_object_property_assignment (expression, scope) {
	var target = force(evaluate_el(expression.target, scope));
	var value = weak_force(evaluate_el(expression.value, scope));
	var target_object = _proxy(target.value);
	if (!target.value)
		return value;
	else if (util.traits.is_string(expression.name))
		return make_return_value(
			target_object[expression.name] = value.value,
			merge_traits([target.traits, value.traits]));
	else {
		var name = force(evaluate_el(expression.name, scope));
		return make_return_value(
			target_object[name.value] = value.value,
			merge_traits([target.traits, name.traits, value.traits]));
	}
}

function evaluate_identifier_assignment (expression, scope) {
	var model = lookup_chain(scope, expression.target) || scope.model;
	var value = weak_force(evaluate_el(expression.value, scope));
	_proxy(model)[expression.target] = value.value;
	value.traits.bindable = false;
	return value;
}

function evaluate_computed_identifier_assignment (expression, scope) {
	var name = force(evaluate_el(expression.target, scope));
	var value = weak_force(evaluate_el(expression.value, scope));
	var model = lookup_chain(scope, expression.target) || scope.model;
	return make_return_value(
		_proxy(model)[name.value] = value.value,
		merge_traits([
			name.traits,
			value.traits
		]));
}

function evaluate_assignment (expression, scope) {
	if (!util.traits.is_undefined(expression.name))
		return evaluate_object_property_assignment(expression, scope);
	else if (util.traits.is_string(expression.target))
		return evaluate_identifier_assignment(expression, scope);
	else
		return evaluate_computed_identifier_assignment(expression, scope);
}

function evaluate_touch (expression, scope) {
	var value = force(evaluate_el(expression.value, scope));
	if (value.traits.bindable) {
		var bind_path = value.traits.bind_path;
		Object.getNotifier(value.traits.context).notify({
			type: 'update',
			name: bind_path[bind_path.length - 1]
		});
	}
	return make_return_value(value.value, []);
}

function evaluate_negative_touch (expression, scope) {
	observe.flush(true);
	try {
		var value = force(evaluate_el(expression.value, scope));
		return value;
	} finally {
		observe.flush();
	}
}

function evaluate_bind(expression, scope) {
	var value = force(evaluate_el(expression.value, scope));
	var functor = force(evaluate_el(expression.functor, scope));
	var traits = [value.traits, functor.traits];
	if (value.value && MONADS.has(value.value.constructor)) {
		value = force(MONADS.get(value.value.constructor)['bind'](functor.value, value.value));
		traits.push(value.traits);
		return make_return_value(value.value, merge_traits(traits));
	} else
		return make_return_value(undefined, merge_traits(traits));
}

function evaluate_return(expression, scope) {
	var container = force(evaluate_el(expression.container, scope));
	var value = force(evaluate_el(expression.value, scope));
	var traits = [container.traits, value.traits];
	if (value.value && MONADS.has(value.value.constructor)) {
		value = force(MONADS.get(container.value)['return'](value.value));
		traits.push(value.traits);
		return make_return_value(value.value, merge_traits(traits));
	} else
		return make_return_value(undefined, merge_traits(traits));
}

var MONADS = new Map([
	[
		Array,
		{
			'return': function(x) {return make_return_value([x],[]);},
			'bind': function (f, x) {
				var traits = [];
				var ret = x.map(function (x) {
					var ret = force(f(x));
					traits.push(ret.traits);
					return ret.value;
				});
				return make_return_value(ret, merge_traits(traits));
			}
		}],
	[
		Object,
		{
			'return': function (x) {return make_return_value({[x[0]]: x[1]}, []); },
			'bind': function (f, x) {
				var traits = [];
				var o = {};
				for (var key in x) {
					var v = force(f(x[key]));
					traits.push(v.traits);
					o[key] = v.value;
				}
				return make_return_value(o, merge_traits(traits));
			}
		}],
	[
		Set,
		{
			'return': function (x) {return make_return_value(new Set([x]), []);},
			'bind': function (f, x) {
				var traits = [];
				var s = new Set;
				for (var e of x) {
					var v = force(f(x));
					traits.push(v.traits);
					s.add(v.value);
				}
				return make_return_value(s, merge_traits(traits));
			}
		}],
	[
		Map,
		{
			'return': function (x) {return new Map([x]);},
			'bind': function (f, x) {
				var traits = [];
				var m = new Map;
				x.forEach(function(v, k) {
					v = force(f(v));
					traits.push(v.traits);
					m.set(k, v.value);
				});
				return make_return_value(m, merge_traits(traits));
			}
	}]
]);

var EVALUATERS = new Map([
	['primitive',		evaluate_primitive],
	['identifier',		evaluate_identifier],
	['iterate',			evaluate_iterate],
	['add',				evaluate_add],
	['sub',				evaluate_sub],
	['mul',				evaluate_mul],
	['div',				evaluate_div],
	['mod',				evaluate_mod],
	['gt',				evaluate_gt],
	['ge',				evaluate_ge],
	['lt',				evaluate_lt],
	['le',				evaluate_le],
	['eq',				evaluate_eq],
	['neq',				evaluate_neq],
	['and',				evaluate_and],
	['or',				evaluate_or],
	['neg',				evaluate_neg],
	['bool_neg',		evaluate_bool_neg],
	['conditional',		evaluate_conditional],
	['object',			evaluate_object],
	['array',			evaluate_array],
	['stream',			evaluate_stream],
	['stream_map',		evaluate_stream_map],
	['pipe',			evaluate_pipe],
	['list_pipe',		evaluate_list_pipe],
	['bind',			evaluate_bind],
	['return',			evaluate_return],
	['promise',			evaluate_promise],
	['global_access',	evaluate_global_access],
	['access',			evaluate_access],
	['apply',			evaluate_apply],
	['placeholder',		evaluate_placeholder],
	['void',			evaluate_void],
	['self_reference',	evaluate_self_reference],
	['computed_identifier',	evaluate_computed_identifier],
	['arrow',			evaluate_arrow_function],
	['el',				evaluate_el_evaluator],
	['el_substitute',	evaluate_el_substitute],
	['evaluate_substitue', evaluate_substitue_evaluator],
	['scope',			evaluate_scope],
	['scope_uplift',	evaluate_scope_uplift],
	['last_value',		evaluate_last_value],
	['sequence',		evaluate_sequence],
	['assignment',		evaluate_assignment],
	['force',			evaluate_force],
	['force_primitive',	evaluate_force_primitive],
	['all_properties',	evaluate_all_properties],
	['touch',			evaluate_touch],
	['negative_touch',	evaluate_negative_touch]
]);

function evaluate_el(expression, scope) {
	return EVALUATERS.get(expression.type)(expression, scope);
}

function bind_value(path, value) {
	var ptr = path[0];
	var i = 1, length = path.length - 1;
	while (i < length)
		if (util.traits.is_object(ptr) || util.traits.is_function(ptr))
			ptr = ptr[path[i++]];
		else
			return ;
	_proxy(ptr)[path[length]] = value;
}

function set_global_monad_registry(constructor, monad_ops) {
	MONADS.set(constructor, monad_ops);
}

return {
	apply_el_function: apply_el_function,
	bind_value: bind_value,
	evaluate_el: evaluate_el,
	evaluate_substitue: evaluate_substitue,
	EvaluateResult: EvaluateResult,
	Expression: Expression,
	Substitute: Substitute,
	force: force,
	lookup_chain: lookup_chain,
	merge_traits: merge_traits,
	make_return_value: make_return_value,
	wrap_el_function: wrap_el_function,
	set_global_monad_registry: set_global_monad_registry
};

});
