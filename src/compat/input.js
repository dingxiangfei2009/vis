define(['util/util'], function (util) {
var BIND_HANDLERS = new Map;

function delegate_property_setter(constructor, property, event_name) {
	if (!BIND_HANDLERS.has(constructor))
		BIND_HANDLERS.set(constructor, {});
	var o = Object.getOwnPropertyDescriptor(constructor.prototype, property);
	var getter = o.get;
	var setter = o.set;
	Object.defineProperty(constructor.prototype, property, {
		configurable: true,
		enumerable: true,
		get: o.get,
		set (x) {
			var before = getter.call(this);
			setter.call(this, x);
			var after = getter.call(this);
			if (before !== after)
				if (util.traits.is_function(event_name))
					util.async.async(() => event_name(this));
				else if (util.traits.is_array(event_name))
					util.async.async(() =>
						event_name.forEach(ev =>
							this.dispatchEvent(new Event(ev))));
				else
					util.async.async(() => this.dispatchEvent(new Event(event_name)));
			return x;
		}
	});
	BIND_HANDLERS.get(constructor)[property] = setter;
}

delegate_property_setter(HTMLInputElement, 'value', ['input', 'change']);
delegate_property_setter(HTMLInputElement, 'checked', ['click', 'input', 'change']);
delegate_property_setter(HTMLOptionElement, 'selected', function (element) {
	element.parentElement.dispatchEvent(new Event('change'));
});
delegate_property_setter(HTMLTextAreaElement, 'value', ['input', 'change']);

return {
	invoke_setter(element, property, value) {
		if (BIND_HANDLERS.has(element.constructor))
			if (property in BIND_HANDLERS.get(element.constructor))
				BIND_HANDLERS
					.get(element.constructor)
					[property]
					.call(element, value);
	}
};

});