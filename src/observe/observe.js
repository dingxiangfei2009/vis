define(['util/util', 'compat/observe'], function(util, _proxy) {
'use strict';

var
	SPLICE = Symbol('splice'),
	ALL_PROP = Symbol('all properties');

var NATIVE_EVENTS = ['add', 'update', 'delete', 'splice'];

var ALL_OBSERVE_FUNCTORS = new Set;

var shim_enabled = _proxy.shim_enabled;

function is_primitive_property(property) {
	return util.traits.is_string(property) ||
			util.traits.is_undefined(property) ||
			util.traits.is_null(property) ||
			util.traits.is_number(property);
}

var FLUSH_MODE_KEEP = true, FLUSH_MODE = false;

function flush(async_keep) {
	FLUSH_MODE = true;
	FLUSH_MODE_KEEP = async_keep;
	// synchronously flush all change records
	ALL_OBSERVE_FUNCTORS.forEach(functor => Object.deliverChangeRecords(functor));
	FLUSH_MODE = false;
}

function ObserveScope(events) {
	var object_set = new Map;
	var symbol_set = new Map;
	var objects = new util.BiMap;
	var symbols = new util.BiMap;
	var event_vector = NATIVE_EVENTS.concat(events);
	// Bijection map for handler/path
	var handlers = new Map;
	var handler_paths = new Map;
	ALL_OBSERVE_FUNCTORS.add(observer_handler);

	function attach_observer(target) {
		if (util.traits.is_array(target))
			Array.observe(target, observer_handler, event_vector);
		else if (util.traits.is_object(target))
			Object.observe(target, observer_handler, event_vector);
	}

	function detach_observer(target) {
		if (util.traits.is_array(target))
			Array.unobserve(target, observer_handler);
		else if (util.traits.is_object(target))
			Object.unobserve(target, observer_handler);
	}

	function observer_handler(change_set) {
		if (FLUSH_MODE)
			if (FLUSH_MODE_KEEP)
				util.async.async(
					() => observer_handler(change_set),
					shim_enabled ? 'animate' : null);
			else
				return;
		var handler_changes = new Map;
		function insert_change(object, property, change) {
			function aux(handler) {
				var o = Object.assign({
						object: object,
						name: property
					}, change);	// clone
				if (handler_changes.has(handler))
					handler_changes.get(handler).push(o);
				else
					handler_changes.set(handler, [o]);
			}
			var hash = object_property_hash(object, property);
			if (handlers.has(hash))
				handlers.get(hash).forEach(aux);
			hash = object_property_hash(object, SPLICE);
			if (handlers.has(hash) && (
				Number.isSafeInteger(Number(String(property))) ||
				property === 'length'))
				handlers.get(hash).forEach(aux);
			hash = object_property_hash(object, ALL_PROP);
			if (handlers.has(hash))
				handlers.get(hash).forEach(aux);
		}
		for (var change of change_set)
			if (object_set.has(change.object))
				if (change.type === 'splice' && ('index' in change)) {
					// additional change sets, for other non-splice watches
					insert_change(change.object, SPLICE, change);
					if (change.removed.length === change.addedCount)
						for (var i = 0; i < change.addedCount; ++i)
							insert_change(change.object, i + change.index, {
								name: i, type: 'update', [SPLICE]: true
							});
					else {
						for (var i = change.index, end = change.object.length; i < end; ++i)
							insert_change(change.object, i, {
								name: i, type: 'update', [SPLICE]: true
							});
						insert_change(change.object, 'length', {
							name: 'length',
							type: 'update',
							newValue: change.object.length,
							oldValue: change.object.length +
								(change.addedCount - change.removed.length)
						});
					}
				} else if (change.name)
					insert_change(change.object, change.name, change);
				else if (change.type === 'update')	// update all properties
					for (var property of Object.getOwnPropertyNames(change.object))
						insert_change(change.object, property, change);
		// handler invocations
		var handler_visit = new Set;
		handler_changes.forEach(function(changes, handler) {
			handler.disabled = false;
			if (util.traits.is_function(handler.init))
				handler.init();
			changes.some(function(change) {
				handler(change);
				return handler.disabled;
			});
		});
	}

	function object_property_hash(object, property) {
		var is_prim_prop = is_primitive_property(property);
		if (objects.has_object(object)) {
			var hash;
			if (is_prim_prop)
				hash = '';
			else if (symbols.has_object(property))
				hash = 's#';
			else
				return;
			hash += objects.id(object);
			hash += '#';
			if (is_prim_prop)
				hash += property;
			else
				hash += symbols.id(property);
			return hash;
		}
	}

	function reverse_hash(hash) {
		if (util.traits.is_string(hash)) {
			var object, property, v = hash.split('#');
			if (hash[0] === 's') {
				object = objects.object(Number(v[1]));
				property = symbols.object(Number(v[2]));
			} else {
				object = objects.object(Number(v[0]));
				property = v[1];
			}
			return [object, property];
		}
	}

	function attach (object, property, handler) {
		if (object_set.has(object)) {
			var count = object_set.get(object);
			object_set.set(object, count + 1);
		} else if (util.traits.is_object(object)) {
			object_set.set(object, 1);
			// object - id bijection mapping
			objects.add(object);
			attach_observer(object);
		} else
			return;
		if (symbol_set.has(property)) {
			var count = symbol_set.get(property);
			symbol_set.set(property, count + 1);
		} else if (!is_primitive_property(property)) {
			symbol_set.set(property, 1);
			symbols.add(property);
		}
		var hash = object_property_hash(object, property);
		if (handlers.has(hash))
			handlers.get(hash).add(handler);
		else
			handlers.set(hash, new Set([handler]));

		if (handler_paths.has(handler))
			handler_paths.get(handler).add(hash);
		else
			handler_paths.set(handler, new Set([hash]));
		return hash;
	}

	function detach (object, property, handler) {
		var hash = object_property_hash(object, property);
		if (handlers.has(hash) && handlers.get(hash).has(handler)) {
			handlers.get(hash).delete(handler);
			if (handlers.get(hash).size === 0)
				handlers.delete(hash);
			handler_paths.get(handler).delete(hash);
			if (handler_paths.get(handler).size === 0)
				handler_paths.delete(handler);
			// purge objects or symbols if necessary
			if (object_set.get(object) > 1) {
				var count = object_set.get(object);
				object_set.set(object, count - 1);
			} else if (object_set.has(object)) {
				object_set.delete(object);
				objects.delete_object(object);
				detach_observer(object);
			} else
				return;
			if (symbol_set.get(property) > 1) {
				var count = symbol_set.get(property);
				symbol_set.set(property, count - 1);
			} else if (symbol_set.has(property)) {
				symbol_set.delete(property);
				symbols.delete_object(property);
			} else
				return;
		}
	}

	function query_object_id (object) {
		return objects.id(object);
	}

	function query_object_by_id (id) {
		return objects.object(id);
	}

	function query_symbol_id (symbol) {
		return symbols.id(symbol);
	}

	function query_symbol_by_id (id) {
		return symbols.object(id);
	}

	function query_handler_paths (handler) {
		var list = new Set;
		handlers.forEach(function(handlers, hash) {
			if (handlers.has(handler))
				list.add(reverse_hash(hash));
		});
		return list;
	}

	function detach_all (handler) {
		if (handler_paths.has(handler))
			for (var hash of new Set(handler_paths.get(handler))) {
				var path = reverse_hash(hash);
				detach(path[0], path[1], handler);
			}
	}

	function destroy () {
		var object_set = new Set;
		for (var model of object_set) {
			detach_observer(model, object_set);
		}
		ALL_OBSERVE_FUNCTORS.delete(observer_handler);
	}

	return {
		attach: attach,
		detach: detach,
		query_object_id: query_object_id,
		query_object_by_id: query_object_by_id,
		query_symbol_id: query_symbol_id,
		query_symbol_by_id: query_symbol_by_id,
		query_handler_paths: query_handler_paths,
		object_property_hash: object_property_hash,
		detach_all: detach_all,
		destroy: destroy
	};
}

return Object.freeze({
	ObserveScope: ObserveScope,
	flush: flush,
	SPLICE: SPLICE,
	ALL_PROP: ALL_PROP
});

});
