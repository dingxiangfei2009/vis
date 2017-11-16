define(['el/el', 'util/util', 'compat/input', 'compat/observe'],
function (el, util, input_setter, _proxy){
'use strict';

var unprocessedClass = 'vis-unprocessed';
var domBindHandlers = new Map;
var domBindElements = new Set;
var domBindRootElementScopes = new WeakMap;

function dom_observer_handler(changeset) {
	for (var change of changeset) {
		for (var removedElement of
			Array.prototype.slice.call(change.removedNodes)) {
			domBindElements.delete(removedElement);
			if (domBindHandlers.has(removedElement)) {
				for (var handler of domBindHandlers.get(removedElement))
					handler();
				domBindHandlers.delete(removedElement);
			}
		}
		for (var addedElement of
			Array.prototype.slice.call(change.addedNodes))
			if (!domBindElements.has(addedElement)) {
				var parent = addedElement.parentElement;
				while(parent && parent.nodeName.toLowerCase() !== 'template' && !check_static(parent))
					if (domBindRootElementScopes.has(parent)) {
						var context_scope = domBindRootElementScopes.get(parent);
						bind_element(addedElement, context_scope.scope, context_scope.context);
						break;
					} else
						parent = parent.parentElement;
			}
	}
}

var domObserver = new MutationObserver(dom_observer_handler);
domObserver.observe(document, {childList: true, subtree: true});

function registerDOMBindHandler(target, handler) {
	var handlers;
	if (domBindHandlers.has(target)) {
		handlers = domBindHandlers.get(target);
	} else {
		handlers = new Set;
		domBindHandlers.set(target, handlers);
	}
	handlers.add(handler);
}

function bind(target, instance) {
	if (util.traits.is_string(target)) {
		target = document.querySelectorAll(target);
	}

	var root_scope = new el.scope.Scope(instance.model, null);
	var context = new el.shadow.ShadowContext;	// start watching
	if (target instanceof NodeList)
		Array.prototype.forEach.call(
			target,
			target => domBindRootElementScopes.set(target, {scope: root_scope, context: context}));
	else if (target instanceof Node)
		domBindRootElementScopes.set(target, {scope: root_scope, context: context});
	bind_element(target, root_scope, context);
}

function check_static(target) {
	return target instanceof Element && target.hasAttribute('vis-static');
}

function bind_element(target, scope, context) {
	function visit_node(target) {
		try {
			var node_name = target.nodeName.toLowerCase();
			if (node_name === 'script' ||
					domBindElements.has(target) ||
					check_static(target))
				return NodeFilter.FILTER_REJECT;
			else
				domBindElements.add(target);

			bind_element_attribute(target, scope, context);
			bind_element_attribute_set(target, scope, context);
			bind_element_all_attributes(target, scope, context);
			switch (target.nodeName.toLowerCase()) {
			case '#text':
			case '#data':
				bind_text_template(target, scope, context);
			case 'script':
			case '#comment':
				return NodeFilter.FILTER_REJECT;
			}
			if (target instanceof Element)
				bind_action_attribute(target, scope, context);
			switch (target.nodeName.toLowerCase()) {
			case 'a':
			case 'button':
				bind_element(target.childNodes, scope, context);
				return NodeFilter.FILTER_ACCEPT;
			case 'select':
				bind_element(target.childNodes, scope, context);
			case 'input':
			case 'textarea':
				bind_value_attribute(target, scope, context);
				return NodeFilter.FILTER_ACCEPT;
			case 'canvas':
				bind_painter_attribute(target, scope, context);
				return NodeFilter.FILTER_REJECT;
			case 'template':
				bind_control_attributes(target, scope, context);
				return NodeFilter.FILTER_REJECT;
			default:
				return NodeFilter.FILTER_ACCEPT;
			}
		} catch(e) {
			return NodeFilter.FILTER_REJECT;
		} finally {
			if (target.classList)
				target.classList.remove(unprocessedClass);
		}
	}

	function walk_nodes(target) {
		visit_node(target);
		var itr = document.createTreeWalker(
			target,
			NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
			{acceptNode: visit_node});
			while (itr.nextNode()) ;
	}

	if (target instanceof NodeList)
		Array.prototype.forEach.call(target, walk_nodes);
	else if (target instanceof Node)
		walk_nodes(target);
	else
		for (var element of target)
			walk_nodes(element);
}

function bind_action_attribute(target, scope, context) {
	if (target.hasAttribute('vis-action')) {
		// onclick expression
		var handler_shadow = el.shadow.value(
			context,
			scope,
			target.getAttribute('vis-action'));
		target.addEventListener('click', function (event) {
			handler_shadow.context_invoke(this, event);
		});
		registerDOMBindHandler(target, () => handler_shadow.destroy());
	}
}

function bind_value_attribute(target, scope, context) {
	if (target.hasAttribute('vis-value')) {
		var type = target.getAttribute('vis-value-type');
		var on_change_hook = function (event) {
			var value;
			if (target.nodeName.toLowerCase() === 'select')
				value = Array.prototype.map.call(target.selectedOptions, e => e.value);
			else if (target.type === 'checkbox')
				value = target.checked;
			else
				value = target.value;
			switch (type) {
			case 'integer':
				if (Number.isNaN(value = Number.parseInt(value)))
					return;
				break;
			case 'number':
				if (Number.isNaN(value = Number(value)))
					return;
				break;
			case 'boolean':
				value = Boolean(value);
				break;
			case 'string':
				value = String(value);
			}
			// update value
			value_shadow.bind_handler(value);
			change_shadow.invoke(value);
		};
		if (target.nodeName.toLowerCase() === 'select' || target.type === 'checkbox')
			target.addEventListener('change', on_change_hook);
		else
			target.addEventListener('input', on_change_hook);
		var value_shadow = el.shadow.value(
			context,
			scope,
			target.getAttribute('vis-value'),
			function (value) {
				if (value || value === 0)
					target[target.type === 'checkbox' ? 'checked' : 'value'] = value;
				else
					target[target.type === 'checkbox' ? 'checked' : 'value'] = '';
			});
		var change_shadow =
			el.shadow.value(
				context,
				scope,
				target.getAttribute('vis-change'));
		registerDOMBindHandler(target, function(){
			value_shadow.destroy();
			if (change_shadow)
				change_shadow.destroy();
		});
	}
}

function bind_element_attribute(target, scope, context) {
	if (target instanceof Element && target.hasAttribute('vis-element')) {
		var shadow = el.shadow.value(
			context,
			scope,
			target.getAttribute('vis-element'),
			util.traits.EMPTY_FUNCTION);
		shadow.bind_handler({
			element: target,
			scope: scope
		});
		registerDOMBindHandler(target, () => shadow.destroy());
	}
}

function bind_element_attribute_set(target, scope, context) {
	function purge_event_handlers() {
		event_map.forEach(
			(handler, event_name) =>
				target.removeEventListener(event_name, handler));
		event_map.clear();
	}
	if (target instanceof Element && target.getAttribute('vis-attributes')) {
		var event_map = new Map;
		var shadow = el.shadow.value(
			context,
			scope,
			target.getAttribute('vis-attributes'),
			function (attr) {
				if (attr instanceof Map) {
					attr.forEach(function (value, key) {
						target.setAttribute(key, value);
					});
				} else if (util.traits.is_object(attr))
					Object.getOwnPropertyNames(attr)
					.forEach(function (key) {
						switch (key) {
						case '$event':
							purge_event_handlers();
							Object.getOwnPropertyNames(attr.$event)
							.forEach(function (event) {
								var handler = attr.$event[event];
								target.addEventListener(event, el.eval.wrap_el_function(handler));
								event_map.set(event, handler);
							});
							break;
						default:
							target.setAttribute(key, attr[key]);
						}
					});
			});
		registerDOMBindHandler(target, () => shadow.destroy());
	}
}

function bind_element_all_attributes(target, scope, context) {
	// iterate all attributes
	var shadows = [];
	function bind_template(attribute) {
		try {
			var shadow = el.shadow.template(
				context,
				scope,
				attribute.value,
				function (value) {
					attribute.value = value;
				});
			shadows.push(shadow);
		} catch (e) {
			// skip
		}
	}

	if (target instanceof Element && target.hasAttributes())
		for (var i = 0, end = target.attributes.length; i < end; ++i)
			if (!target.attributes[i].name.startsWith('vis-'))
				bind_template(target.attributes[i]);
	registerDOMBindHandler(
		target,
		() => shadows.forEach(shadow => shadow.destroy())
	);
}

function import_child_nodes(template) {
	var childNodes = template.childNodes;
	var fragment = document.createDocumentFragment();
	Array.prototype.forEach.call(childNodes,
		node => fragment.appendChild(document.importNode(node, true)));
	return fragment;
}

function inject(template, scope, context, position) {
	var importNode;
	if (template.content)
		importNode = document.importNode(template.content, true);
	else
		importNode = import_child_nodes(template);
	bind_element(importNode, scope, context);
	var elements = Array.prototype.slice.call(importNode.childNodes);
	var anchor = position || template;
	anchor.parentNode.insertBefore(importNode, position || template);
	return elements;
}

function animate_enter(elements, animation_config) {
	if (animation_config && util.traits.is_function(animation_config.enter))
		animation_config.enter(elements);
}
function animate_leave(elements, animation_config) {
	if (animation_config && util.traits.is_function(animation_config.leave))
		animation_config.leave(elements, function () {
			for (var element of elements) {
				element.remove();
			}
		});
	else
		for (var element of elements)
			element.remove();
}

function bind_condition_attribute(target, scope, context) {
	var animation_shadow = el.shadow.value(
		context,
		scope,
		target.getAttribute('vis-animate'));
	var elements = null;
	var condition;
	function get_consequent_template() {
		var root = target.content || target;
		var children = new Set(Array.prototype.slice.call(root.children));
		var consequent = Array.prototype.slice
			.call(root.querySelectorAll('consequent'))
			.filter(element => children.has(element));
		if (consequent.length)
			return consequent[0];
		else
			return target;
	}
	function get_alternative_template() {
		var root = target.content || target;
		var children = new Set(Array.prototype.slice.call(root.children));
		var alternative = Array.prototype.slice
			.call(root.querySelectorAll('alternative'))
			.filter(element => children.has(element));
		if (alternative.length)
			return alternative[0];
	}
	function switch_content(newCondition) {
		if (elements)
			animate_leave(elements.slice(), animation_shadow.value);
		if (newCondition) {
			elements = inject(get_consequent_template(), scope, context, target);
			animate_enter(elements.slice(), animation_shadow.value);
		} else {
			var alternative_template = get_alternative_template();
			if (alternative_template) {
				elements = inject(alternative_template, scope, context, target);
				animate_enter(elements.slice(), animation_shadow.value);
			} else
				elements = null;
		}
		condition = newCondition;
	}
	var shadow = el.shadow.value(
		context,
		scope,
		target.getAttribute('vis-condition'),
		function (value) {
			value = Boolean(value);
			if (elements) {
				if (condition ^ value)
					switch_content(value);
			} else
				switch_content(value);
			return value;
		});
	registerDOMBindHandler(target, function(){
		if (elements)
			animate_leave(elements.slice(), animation_shadow.value);
		shadow.destroy();
		animation_shadow.destroy();
	});
}

function bind_model_attribute(target, scope, context) {
	var animation_shadow = el.shadow.value(
		context,
		scope,
		target.getAttribute('vis-animate'));
	var elements = null;
	var sub_scope;
	var shadow = el.shadow.value(
		context,
		scope,
		target.getAttribute('vis-model'),
		function (model) {
			if (util.traits.is_object(model)) {
				if (elements) {
					Object.assign(_proxy(sub_scope.model), model);
					for (var key of Object.getOwnPropertyNames(sub_scope.model))
						if (!(key in model))
							delete _proxy(sub_scope.model)[key];
				} else {
					elements = inject(
						target,
						sub_scope = new el.scope.Scope(Object.assign({}, model), scope),
						context);
					animate_enter(elements.slice(), animation_shadow.value);
				}
			} else {
				if (elements)
					animate_leave(elements.slice(), animation_shadow.value);
				elements = null;
			}
		});
	registerDOMBindHandler(target, function(){
		if (elements)
			animate_leave(elements.slice(), animation_shadow.value);
		shadow.destroy();
		animation_shadow.destroy();
	});
}

function bind_iterate_attribute(target, scope, context) {
	var expression = el.parser.parse(target.getAttribute('vis-iterate'));

	if (expression.type !== 'iterate') {return ;}

	var item_scopes = new WeakMap;
	var item_scope_feedback_shadows = new WeakMap;
	var element_expression = el.parser.parse(expression.element);
	
	var animation_shadow = el.shadow.value(
		context,
		scope,
		target.getAttribute('vis-animate'));
	var list = [];

	function find_next_item_node(start) {
		while (start < list.length && !list[start].length) {
			++start;
		}
		return start < list.length ? list[start][0] : target;
	}

	function make_sub_scope(value, key, collection) {
		var model = {};
		Object.defineProperty(model, expression.element, {
			value: value,
			writable: true
		});
		util.traits.is_undefined(expression.index) ||
			Object.defineProperty(model, expression.index, {value: key});
		util.traits.is_undefined(expression.reference) ||
			Object.defineProperty(model, expression.reference, {value: collection});
		return new el.scope.Scope(model, scope);
	}

	function push_new_item(collection, key, value, update_feedback) {
		var scope = make_sub_scope(value, key, collection);
		var new_item = inject(target, scope, context);
		list.push(new_item);
		animate_enter(new_item.slice(), animation_shadow.value);
		item_scopes.set(new_item, scope);
		item_scope_feedback_shadows.set(
			new_item,
			el.shadow.value(
				context,
				scope,
				element_expression,
				update_feedback));
	}

	function update_collection(collection) {
		// total refresh
		if (util.traits.is_map(collection)) {
			for (var item of list) {
				animate_leave(item.slice(), animation_shadow.value);
				item_scope_feedback_shadows.get(item).destroy();
			}
			list = [];
			collection.forEach(
				(value, key) =>
					push_new_item(
						collection, key, value, value => collection.set(key, value))
			);
		} else if (util.traits.is_array(collection)) {
			var length = collection.length;
			collection.forEach(function (value, i) {
				if (i < list.length) {
					if (item_scopes.has(list[i]))
						_proxy(item_scopes.get(list[i])
							.model)[expression.element] = value;
				} else
					push_new_item(collection, i, value, value => _proxy(collection)[i] = value);
			});
			for (var i = length; i < list.length; ++i) {
				animate_leave(list[length].slice(), animation_shadow.value);
				if (item_scope_feedback_shadows.has(list[length]))
					item_scope_feedback_shadows.get(list[length]).destroy();
				list.splice(length, 1);
			}
		} else if (collection) {
			var count = 0;
			for (var element of collection) {
				// generic access to collection
				if (count < list.length) {
					if (item_scopes.has(list[i]))
						_proxy(item_scopes.get(list[i])
							.model)[expression.element] =
								element
				} else
					// immutable
					push_new_item(collection, count, element, () => {});
				++count;
			}
			for (var i = count; i < list.length; ++i) {
				animate_leave(list[count].slice(), animation_shadow.value);
				if (item_scope_feedback_shadows.has(list[count]))
					item_scope_feedback_shadows.get(list[count]).destory();
				list.splice(count, 1);
			}
		}
		return list.slice();	// return a shallow copy of list of elements
	}

	function *update_splice(collection) {
		while (true) {
			var change = yield true;
			if (change)
				switch (change.operation) {
				case 'create':
					var next_item_node = find_next_item_node(change.key);
					var scope = make_sub_scope(change.value, change.key, collection);
					var new_item = inject(target, scope, context, next_item_node);
					list.splice(change.key, 0, new_item);
					animate_enter(new_item.slice(), animation_shadow.value);
					item_scopes.set(new_item, scope);
					(index =>
						item_scope_feedback_shadows.set(
							new_item,
							el.shadow.value(
								context,
								scope,
								element_expression,
								value => _proxy(collection)[index] = value))
					)(change.key);
					yield new_item;
					break;
				case 'destroy':
					animate_leave(list[change.key].slice(), animation_shadow.value);
					if (item_scope_feedback_shadows.has(list[change.key]))
						item_scope_feedback_shadows.get(list[change.key]).destroy();
					list.splice(change.key, 1);
					yield true;
					break;
				case 'update':
					if (item_scopes.has(list[change.key]))
						_proxy(item_scopes.get(list[change.key])
							.model)[expression.element] = change.value;
					yield list[change.key];
				}
			else
				break;
		}
	}

	var shadow =
		el.shadow.array(
			context,
			scope,
			expression,
			{
				all_proxy: update_collection,
				splice_change: update_splice
			});
	registerDOMBindHandler(target, function () {
		list.forEach(function(item) {
			if (item_scope_feedback_shadows.has(item))
				item_scope_feedback_shadows.get(item).destroy();
			animate_leave(item.slice(), animation_shadow.value);
		});
		shadow.destroy();
		animation_shadow.destroy();
	});
}

function bind_inject_attribute(target, scope, context) {
	var elements = null;

	function update_injection(template, argument) {
		if (elements)
			animate_leave(elements.slice(), animation_shadow.value);
		if (template) {
			var sub_scope = new el.scope.Scope(argument || {}, template.scope || scope);
			elements = inject(template.element, sub_scope, context, target);
			animate_enter(elements.slice(), animation_shadow.value);
		} else
			elements = null;
	}

	var animation_shadow = el.shadow.value(
		context,
		scope,
		target.getAttribute('vis-animate'));
	var argument_shadow = el.shadow.value(
		context,
		scope,
		target.getAttribute('vis-argument'),
		function (value) {
			util.async.async(() => update_injection(shadow.value, argument_shadow.value));
			return value;
		});
	var shadow = el.shadow.value(
		context,
		scope,
		target.getAttribute('vis-inject'),
		function (value) {
			util.async.async(() => update_injection(shadow.value, argument_shadow.value));
			return value;
		});
	registerDOMBindHandler(target, function () {
		if (elements)
			animate_leave(elements.slice(), animation_shadow.value);
		shadow.destroy();
		animation_shadow.destroy();
		argument_shadow.destroy();
	});
}

function bind_control_attributes(target, scope, context) {
	if (target.hasAttribute('vis-condition')) {
		bind_condition_attribute(target, scope, context);
	} else if (target.hasAttribute('vis-iterate')) {
		bind_iterate_attribute(target, scope, context);
	} else if (target.hasAttribute('vis-model')) {
		bind_model_attribute(target, scope, context);
	} else if (target.hasAttribute('vis-inject')) {
		bind_inject_attribute(target, scope, context);
	}
}

function bind_painter_attribute(target, scope, context) {
	if (target.hasAttribute('vis-painter')) {
		var shadow = el.shadow.value(
			context,
			scope,
			target.getAttribute('vis-painter'),
			function (handler) {
				if (util.traits.is_function(handler)) {
					requestAnimationFrame(
						time => shadow.invoke(time, target));
				}
				return handler;
			});
		registerDOMBindHandler(target, () => shadow.destroy());
	}
}

function bind_text_template(target, scope, context) {
	var shadow = el.shadow.template(
		context,
		scope,
		target.textContent,
		function (text) {
			target.textContent = text;
			return text;
		});

	// text removal is only registered at parent nodes only
	registerDOMBindHandler(target.parentNode, () => shadow.destroy());
}

return Object.freeze({
	bind: bind,
	bind_element: bind_element
});

});
