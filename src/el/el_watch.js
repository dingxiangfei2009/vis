define(['./el_eval', './el_const', 'util/util'],
function (el_eval, CONST, util) {
'use strict';

function attempt_bind(eval_result) {
	if (util.traits.is_function(eval_result.value))
		return eval_result.value.bind(eval_result.traits.context);
	else
		return eval_result.value;
}

// evaluate and watch expression
// no need for old values or such
function watch_and_evaluate_el(expression, options) {
	var
		scope = options.scope,
		observe_scope = options.observe_scope,
		handler = options.handler,
		splice_handler = options.splice_handler,
		watch_traits = [],
		watch_traits_set = new Set,
		removed = false,
		substitute = null;

	function update_dependencies(new_dependencies) {
		var
			current_dependencies = watch_traits,
			new_dependencies_set = new Set;
		// addition
		new_dependencies.forEach(function (pair) {
			var object = pair[0];
			var property = pair[1];
			var hash = observe_scope.object_property_hash(object, property);
			if (!watch_traits_set.has(hash))
				hash = observe_scope.attach(object, property, watch_handler);
			new_dependencies_set.add(hash);
		});
		current_dependencies.forEach(function(pair) {
			var object = pair[0];
			var property = pair[1];
			var hash = observe_scope.object_property_hash(object, property);
			if (!new_dependencies_set.has(hash))
				observe_scope.detach(object, property, watch_handler);
		});
		watch_traits = new_dependencies;
		watch_traits_set = new_dependencies_set;
	}

	function watch_handler(change) {
		if (removed) {
			watch_handler.disabled = true;
			return;
		}

		var eval_result;
		if (substitute) {
			eval_result = el_eval.evaluate_substitue(substitute);
		} else {
			eval_result = el_eval.force(el_eval.evaluate_el(expression, scope));
			if (eval_result.value instanceof el_eval.Substitute) {
				substitute = eval_result.value;
				eval_result = el_eval.evaluate_substitue(substitute);
			}
		}

		if (util.traits.is_object(eval_result.value) && eval_result.value.iterate) {
			watch_iterate(eval_result.value, change);
		} else if (eval_result.value instanceof Promise) {
			// promise style
			eval_result.value.then(function (return_value) {
				update_dependencies(return_value.traits);
				watch_handler.disabled = handler(attempt_bind(return_value));
			});
		} else {
			update_dependencies(eval_result.traits);
			watch_handler.disabled = handler(attempt_bind(eval_result));
			if (util.traits.is_undefined(watch_handler.disabled))
				watch_handler.disabled = true;
		}
	}

	function watch_iterate(eval_result, change) {
		var
			type = change.type,
			target = change.object,
			index = change.index,
			name = Number(String(change.name)),
			added = change.addedCount,
			removed = change.removed,
			splice_source = change[CONST.SPLICE];
		function dispatch(collection) {
			update_dependencies(collection.traits);
			switch(type) {
			case 'splice':
			case 'add':
			case 'update':
			case 'delete':
				if (util.traits.is_array(collection.value) &&
					util.traits.is_function(splice_handler) &&
					target === collection.value &&
					!splice_source)
					return watch_handler.disabled =
						splice_handler(
							type,
							collection.value,
							util.traits.is_undefined(index) ? name : index,
							added,
							removed);
			default:
				watch_handler.disabled = handler(collection.value);
			}
		}

		if (eval_result.collection instanceof Promise)
			// resolves later
			eval_result.collection.then(dispatch);
		else
			dispatch(el_eval.force(eval_result.collection));	// resolve now
	}

	function bind_handler(value) {
		// trace and assign new value
		if (watch_traits.bindable)
			el_eval.bind_value(watch_traits.bind_path, value);
	}

	function get_context(value) {
		return watch_traits.context;
	}

	function unwatch() {
		observe_scope.detach_all(watch_handler);
		watch_handler.disabled = true;
		removed = true;
	}

	watch_handler({});

	return {
		bind_handler: bind_handler,
		get_context: get_context,
		unwatch: unwatch
	};
}

return watch_and_evaluate_el;

});
