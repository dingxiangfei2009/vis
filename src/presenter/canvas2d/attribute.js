define(['el/el', 'util/util'], function (el, util) {
'use strict';

function bind_radius_attribute (template, data_scope, bind_setting, defaultValue, refresh) {
	if (template.dataset['bindRadius']) {
		var expression = el.parser.parse(template.dataset['bindRadius']);
		return el.watch(expression, data_scope, function (radius) {
			bind_setting.radius = Number.parseInt(radius) || defaultValue;
			util.traits.is_function(refresh) && refresh();
		});
	}
}

function bind_color_attribute (template, data_scope, bind_setting, defaultValue, refresh) {
	if (template.dataset['bindColor']) {
		var expression = el.parser.parse(template.dataset['bindColor']);
		return el.watch(expression, data_scope, function (color) {
			bind_setting.color = color || defaultValue;
			util.traits.is_function(refresh) && refresh();
		});
	}
}

function bind_x_attribute(template, data_scope, bind_setting, defaultValue, refresh) {
	if (template.dataset['bindX']) {
		var expression = el.parser.parse(template.dataset['bindX']);
		return el.watch(expression, data_scope, function (x) {
			bind_setting.x = Number.parseInt(x) || defaultValue;
			util.traits.is_function(refresh) && refresh();
		});
	}
}

function bind_y_attribute(template, data_scope, bind_setting, defaultValue, refresh) {
	if (template.dataset['bindY']) {
		var expression = el.parser.parse(template.dataset['bindY']);
		return el.watch(expression, data_scope, function (y) {
			bind_setting.y = Number.parseInt(y) || defaultValue;
			util.traits.is_function(refresh) && refresh();
		});
	}
}

function bind_size_attribute(template, data_scope, bind_setting, defaultValue, refresh) {
	if (template.dataset['bindSize']) {
		var expression = el.parser.parse(template.dataset['bindSize']);
		return el.watch(expression, data_scope, function (size) {
			bind_setting.size = Number.parseInt(size) || defaultValue;
			util.traits.is_function(refresh) && refresh();
		});
	}
}

function bind_font_attribute(template, data_scope, bind_setting, defaultValue, refresh) {
	if (template.dataset['bindFont']) {
		var expression = el.parser.parse(template.dataset['bindFont']);
		return el.watch(expression, data_scope, function (font) {
			bind_setting.font = font || defaultValue;
			util.traits.is_function(refresh) && refresh();
		})
	}
}

function bind_style_attribute(template, data_scope, bind_setting, defaultValue, refresh) {
	if (template.dataset['bindStyle']) {
		var expression = el.parser.parse(template.dataset['bindStyle']);
		return el.watch(expression, data_scope, function (style) {
			bind_setting.style = style || defaultValue;
			util.traits.is_function(refresh) && refresh();
		});
	}
}

function get_metric_attribute(template, attribute) {
	var attr_value = template.getAttribute(attribute);
	if (attr_value.match(/^\d+\.?\d*%$/)) {
		return Number.parseInt(attr_value) / 100;
	} else if (!isNaN(attr_value)) {
		return Number.parseInt(attr_value);
	} else {
		return 0;
	}
}

function bind_integer_attribute(bind_string, data_scope, handler) {
	if (bind_string) {
		var expression = el.parser.parse(bind_string);
		return el.watch(expression, data_scope, function (value) {
			handler(Number.parseInt(value));
		});
	}
}

function bind_number_attribute(bind_string, data_scope, handler) {
	if (bind_string) {
		var expression = el.parser.parse(bind_string);
		return el.watch(expression, data_scope, function (value) {
			handler(Number(value));
		});
	}
}

function bind_attribute(bind_string, data_scope, handler) {
	if (bind_string) {
		var expression = el.parser.parse(bind_string);
		return el.watch(expression, data_scope, function (value) {
			handler(value);
		});
	}
}

function bind_init_attribute(template, data_scope, setting) {
	if (template.dataset['bindInit']) {
		var expression = el.parser.parse(template.dataset['bindInit']);
		var watch = el.watch(expression, data_scope, function (functor) {
			if (util.traits.is_function(functor)) {
				functor(setting);
			}
		});
		return watch;
	}
}

return Object.defineProperties({}, {
	bind_radius_attribute: {
		value: bind_radius_attribute,
		enumerable: true
	},
	bind_color_attribute: {
		value: bind_color_attribute,
		enumerable: true
	},
	bind_x_attribute: {
		value: bind_x_attribute,
		enumerable: true
	},
	bind_y_attribute: {
		value: bind_y_attribute,
		enumerable: true
	},
	bind_size_attribute: {
		value: bind_size_attribute,
		enumerable: true
	},
	bind_font_attribute: {
		value: bind_font_attribute,
		enumerable: true
	},
	bind_style_attribute: {
		value: bind_style_attribute,
		enumerable: true
	},
	bind_integer_attribute: {
		value: bind_integer_attribute,
		enumerable: true
	},
	bind_number_attribute: {
		value: bind_number_attribute,
		enumerable: true
	},
	bind_attribute: {
		value: bind_attribute,
		enumerable: true
	},
	bind_init_attribute: {
		value: bind_init_attribute,
		enumerable: true
	},
	get_metric_attribute: {
		value: get_metric_attribute,
		enumerable: true
	}
});
});