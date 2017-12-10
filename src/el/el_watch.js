define(['./runtime', './el_const', 'util/util'],
function (runtime, CONST, util) {
'use strict';

function attempt_bind(eval_result) {
	if (util.traits.is_function(eval_result.value))
		return eval_result.value.bind(eval_result.traits.context);
	else
		return eval_result.value;
}

function sorter(a, b) {
	return (a[0] > b[0]) - (a[0] < b[0]);
}

function swap(vector, a, b) {
	if (a === b) return;
	var t = vector[a];
	vector[a] = vector[b];
	vector[b] = t;
}

function compare_dependencies(prev, curr) {
	// not stable but never mind
	function qsort(vector, start, end) {
		if (start < end - 1) {
			swap(vector, start, (Math.random() * (end - start + 1) | 0) + start);
			var i = start, j = start + 1, b = vector[start], k = b[0];
			while (j <= end) {
				while (j <= end && vector[j][0] > k)
					++j;
				if (j <= end) {
					++i;
					swap(vector, i, j);
					++j;
				}
			}
			swap(vector, start, i);
			qsort(vector, start, i - 1);
			qsort(vector, i + 1, end);
		} else if (start < end && vector[start][0] > vector[end][0])
			swap(vector, start, end);
	}
  function sort(deps) {
		var result = [];
		var end = deps.length;
		for (var i = 0; i < end; ++i) {
			var p = deps[i];
			var a = runtime.unwrap_proxy(p[0]);
			var b = runtime.unwrap_proxy(p[1]);
			var hash = make_object_id(a) + '#';
			if (util.traits.is_number(b))
				hash += '#' + b;
			else
				hash += make_object_id(b);
			result.push([hash, a, b]);
		}
		qsort(result, 0, result.length - 1);
		var final = [];
		for (var i = 0; i < end; ++i) {
			var p = result[i];
			if (i === 0 || result[i - 1][0] !== p[0])
				final.push(p);
		}
    return final;
  }
  function make_object_id(object) {
    if (object_id.has(object))
      return object_id.get(object);
    var id = counter[0]++;
    object_id.set(object, id);
    return id;
  }
  function hash_pair(target, name) {
    if (util.traits.is_number(name) || util.traits.is_string(name))
      return `${make_object_id(target)}#${name}`;
    else
      return `#${make_object_id(target)}#${make_object_id(name)}`;
  }
  var counter = new Uint32Array(1);
  var object_id = new Map;
  prev = sort(prev); curr = sort(curr);
  var pp = 0, pc = 0, endp = prev.length, endc = curr.length;
  var removed = [], added = [];
  while (pp < endp && pc < endc) {
    if (prev[pp][0] < curr[pc][0]) {
      removed.push([prev[pp][1], prev[pp][2]]);
      ++pp;
    } else if (prev[pp][0] > curr[pc][0]) {
      added.push([curr[pc][1], curr[pc][2]]);
      ++pc;
    } else {
      ++pp; ++pc;
    }
  }
  for (;pp < endp;++pp)
    removed.push([prev[pp][1], prev[pp][2]]);
  for (;pc < endc;++pc)
    added.push([curr[pc][1], curr[pc][2]]);
  return {
    removed: removed,
    added: added
  };
}

// evaluate and watch expression
// no need for old values or such
function watch_and_evaluate_el(instructions, options) {
	var
		scope = options.scope,
		observe_scope = options.observe_scope,
		handler = options.handler,
		splice_handler = options.splice_handler,
		watch_traits = [],
		removed = false,
		substitute = null;

	observe_scope.add(watch_handler);

	function update_dependencies(new_dependencies) {
		var {removed, added} = compare_dependencies(watch_traits, new_dependencies);
		runtime.unwatch(removed, watch_handler);
		runtime.watch(added, watch_handler);
		watch_traits = new_dependencies;
	}

	function evaluate() {
		if (substitute)
			return runtime.force(substitute.execute());
		var env = new runtime.Environment(scope);
		env.instructions = instructions;
		var result = runtime.force(env.execute());
		if (result.value instanceof runtime.Substitute) {
			substitute = result.value;
			return runtime.force(substitute.execute());
		} else
			return result;
	}

	function watch_handler(change) {
		if (removed) {
			runtime.unwatch_all(watch_handler);
			return;
		}
		var eval_result = evaluate();
		if (eval_result.value instanceof runtime.Iterator) {
			return watch_iterate(eval_result, change);
		} else if (eval_result.value instanceof Promise) {
			// promise style
			eval_result.value.then(function (return_value) {
				update_dependencies(return_value.traits);
				return handler(attempt_bind(return_value));
			});
		} else {
			update_dependencies(eval_result.traits);
			return handler(attempt_bind(eval_result));
		}
	}

	function watch_iterate(eval_result, change) {
		function dispatch(collection) {
			update_dependencies(collection.traits);
			switch(change.type) {
			case 'splice':
			case 'add':
			case 'update':
			case 'delete':
				if (util.traits.is_array(collection.value) &&
					change.target === collection.value &&
					!change.splice_emitted)
					return splice_handler(
						change.type,
						collection.value,
						util.traits.is_undefined(change.index) ?
							change.name : change.index,
						change.added,
						change.removed);
			default:
				return handler(collection.value);
			}
		}

		if (eval_result.value.collection instanceof Promise)
			// resolves later
			eval_result.value.collection.then(dispatch);
		else
			dispatch(new runtime.Value(eval_result.value.collection, eval_result.traits));	// resolve now
	}

	function bind_handler(value) {
		// trace and assign new value
		if (watch_traits.bindable)
			runtime.bind_value(watch_traits.bind_path, value);
	}

	function get_context(value) {
		return watch_traits.context;
	}

	function unwatch() {
		observe_scope.remove(watch_handler);
		runtime.unwatch_all(watch_handler);
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
