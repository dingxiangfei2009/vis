define(['el/el', 'util/util'],
function (el, util) {
'use strict';

var TRANSFORM_REGEX = /(\w+)\((((\+|-)?((\.\d+)|(\d+(\.\d+)?)))|\s)+\)/g;

function parseTransformOrigin(string) {
	if (string) {
		var a = /\((.+),(.+)\)/
			.exec(string.trim());
		if (a && a.length > 2)
			return [Number(a[1]) || 0, Number(a[2]) || 0];
	} else
		return [0,0];
}

function performTransform(context, transform) {
	if (util.traits.is_string(transform))
		(transform.match(TRANSFORM_REGEX) || [])
		.reverse()
		.forEach(
			function(transform) {
				var a = /(\w+)\((.*)\)/.exec(transform);
				var transform_type = a[1];
				a = a[2].split(/\s*,\s*/).map(Number);
				switch (transform_type) {
				case 'matrix':
					context.transform(...a);
					break;
				case 'translate':
					if (a.length < 2) a.push(a[0]);
					context.translate(...a);
					break;
				case 'scale':
					context.scale(...a);
					break;
				case 'rotate':
					if (a.length < 2)
						context.rotate(a[0]);
					else if (a.length > 2) {
						context.translate(a[1], a[2]);
						context.rotate(a[0]);
						context.translate(-a[1], -a[2]);
					}
					break;
				case 'skewX':
					context.transform(1,Math.tan(a[0]),0,1,0);
					break;
				case 'skewY':
					context.transform(1,0,0,Math.tan(a[0]),1,0);
					break;
				}
			});
}


function Drawable(attributes, context, scope, parent_settings) {
}
Drawable.prototype = {
	constructor: Drawable,
	event (event) {},
	destroy_guard() {
		if (this.destroyed)
			throw new Error;
	},
	destroy () {
		this.destroyed = true;
	},
	refresh (context) {}
};

function Line(attributes, context, scope, parent_settings) {
	Drawable.call(this, attributes, scope, parent_settings);
	this.attributes = attributes;
	this.settings = {};
	this.path = null;
	this.shadow = el.shadow.object(new Map([
		['style', el.shadow.value(context, scope, attributes.style, style => {
			this.destroy_guard();
			if (style) {
				this.fill_defaults(style);
				this.dirty_path = true;
				attributes.presenter.requestRefresh();
				return style;
			} else
				return this.make_default_style();
		})],
		['event', el.shadow.value(context, scope, attributes.event, event => {
			this.destroy_guard();
			return event;
		})],
		['transform', el.shadow.value(context, scope, attributes.transform, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || this.attributes.settings.transform;
		})],
		['transformOrigin', el.shadow.value(context, scope, attributes.transformOrigin, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || this.attributes.settings.transformOrigin;
		})]
		]), this.settings);
}
util.inherit(Line, Drawable, {
	make_default_style() {
		return {
			startX: this.attributes.settings.startX,
			startY: this.attributes.settings.startY,
			endX: this.attributes.settings.endX,
			endY: this.attributes.settings.endY,
			color: this.attributes.settings.color,
			width: this.attributes.settings.width
		};
	},
	fill_defaults(style) {
		style.startX = style.startX || this.attributes.settings.startX;
		style.startY = style.startY || this.attributes.settings.startY;
		style.endX = style.endX || this.attributes.settings.endX;
		style.endY = style.endY || this.attributes.settings.endY;
		style.color = style.color || this.attributes.settings.color;
		style.width = style.width || this.attributes.settings.width;
	},
	update_path() {
		this.path = new Path2D();
		this.path.moveTo((this.settings.style.startX || 0) + 0.5, (this.settings.style.startY || 0) + 0.5);
		this.path.lineTo((this.settings.style.endX || 0) + 0.5, (this.settings.style.endY || 0) + 0.5);
	},
	refresh(context) {
		if (this.dirty_path) {
			this.update_path();
			this.dirty_path = false;
		}
		var drawing_context = context.context;
		this.performTransform(drawing_context);
		drawing_context.strokeStyle = this.settings.style.color || '#000';
		drawing_context.lineWidth = this.settings.style.width || 1;
		drawing_context.stroke(this.path);
	},
	performTransform(context) {
		context.translate(-this.settings.transformOrigin[0] || 0, -this.settings.transformOrigin[1] || 0);
		performTransform(context, this.settings.transform);
		context.translate(this.settings.transformOrigin[0] || 0, this.settings.transformOrigin[1] || 0);
	},
	destroy() {
		Drawable.prototype.destroy.call(this);
		this.shadow.destroy();
	},
	is_in_path(x, y) {
		this.performTransform(this.attributes.presenter.context);
		return this.attributes.presenter.context.isPointInPath(this.path, x, y);
	},
	event (event) {
		if (this.is_in_path(event.offsetX, event.offsetY)) {
			return this.shadow.get_shadow('event').invoke(event);
		} else
			this.shadow.get_shadow('event').invoke(new event.constructor('mouseout',event));
	}
});
Line.interpret = function(presenter, node) {
	return {
		type: 'shape',
		presenter: presenter,
		shape: 'line',
		settings: {
			startX: Number(node.getAttribute('start-x')) || 0,
			endX: Number(node.getAttribute('end-x')) || 0,
			startY: Number(node.getAttribute('start-y')) || 0,
			endY: Number(node.getAttribute('end-y')) || 0,
			color: node.getAttribute('color') || '#000000',
			width: node.getAttribute('width') || 1,
			transform: node.getAttribute('transform'),
			transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin'))
		},
		style: node.dataset['bindStyle'] && el.parser.parse(node.dataset['bindStyle']),
		event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
		transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
		transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin'])
	};
};

function Rect(attributes, context, scope, parent_settings) {
	Drawable.call(this, attributes, scope, parent_settings);
	this.attributes = attributes;
	this.settings = {
		style: this.make_default_style()
	};
	this.update_path();
	this.shadow = el.shadow.object(new Map([
		['style', el.shadow.value(context, scope, attributes.style, style => {
			this.destroy_guard();
			this.dirty_path = true;
			attributes.presenter.requestRefresh();
			return style || this.make_default_style();
		})],
		['event', el.shadow.value(context, scope, attributes.style, event => {
			this.destroy_guard();
			return event;
		})],
		['transform', el.shadow.value(context, scope, attributes.transform, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value;
		})],
		['transformOrigin', el.shadow.value(context, scope, attributes.transformOrigin, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || this.attributes.settings.transformOrigin;
		})]
		]), this.settings);
}
util.inherit(Rect, Drawable, {
	make_default_style() {
		return {
			x: this.attributes.settings.x,
			y: this.attributes.settings.y,
			width: this.attributes.settings.width,
			height: this.attributes.settings.height,
			color: this.attributes.settings.color,
			fillColor: this.attributes.settings.fillColor,
			border: this.attributes.settings.border
		};
	},
	update_path() {
		var x = (this.settings.style.x || this.attributes.settings.x) + 0.5,
			y = (this.settings.style.y || this.attributes.settings.y) + 0.5,
			width = this.settings.style.width || this.attributes.settings.width,
			height = this.settings.style.height || this.attributes.settings.height;
		this.path = new Path2D();
		this.path.rect(x, y, width, height);
	},
	refresh(context) {
		if (this.dirty_path) {
			this.update_path();
			this.dirty_path = false;
		}
		var drawing_context = context.context;
		this.performTransform(drawing_context);
		if (this.settings.style.color) {
			drawing_context.strokeStyle = this.settings.style.color;
			drawing_context.lineWidth = this.settings.style.width || 1;
			drawing_context.stroke(this.path);
		}
		if (this.settings.style.fillColor) {
			drawing_context.fillStyle = this.settings.style.fillColor;
			drawing_context.fill(this.path);
		}
	},
	performTransform(context) {
		context.translate(-this.settings.transformOrigin[0] || 0, -this.settings.transformOrigin[1] || 0);
		performTransform(context, this.settings.transform);
		context.translate(this.settings.transformOrigin[0] || 0, this.settings.transformOrigin[1] || 0);
	},
	is_in_path(x, y) {
		this.performTransform(this.attributes.presenter.context);
		return this.attributes.presenter.context.isPointInPath(this.path, x, y);
	},
	event (event) {
		if (this.is_in_path(event.offsetX, event.offsetY))
			return this.shadow.get_shadow('event').invoke(event);
		else
			this.shadow.get_shadow('event').invoke(new event.constructor('mouseout', event));
	},
	destroy() {
		Drawable.prototype.destroy.call(this);
		this.shadow.destroy();
	}
});
Rect.interpret = function (presenter, node) {
	return {
		type: 'shape',
		presenter: presenter,
		shape: 'rect',
		settings: {
			x: Number(node.getAttribute('x')) || 0,
			y: Number(node.getAttribute('y')) || 0,
			width: Number(node.getAttribute('width')) || 0,
			height: Number(node.getAttribute('height')) || 0,
			color: node.getAttribute('color'),
			fillColor: node.getAttribute('fillColor'),
			border: Number(node.getAttribute('border')) || 0,
			transform: node.getAttribute('transform'),
			transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin'))
		},
		style: node.dataset['bindStyle'] && el.parser.parse(node.dataset['bindStyle']),
		event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
		transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
		transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin'])
	};
};

function Circle(attributes, context, scope, parent_settings) {
	Drawable.call(this, attributes, scope, parent_settings);
	this.attributes = attributes;
	this.settings = {
		style: this.make_default_style()
	};
	this.update_path();
	this.shadow = el.shadow.object(new Map([
		['style', el.shadow.value(context, scope, attributes.style, style => {
			this.destroy_guard();
			if (style) {
				this.fill_defaults(style);
				this.dirty_path = true;
				attributes.presenter.requestRefresh();
				return style;
			} else {
				attributes.presenter.requestRefresh();
				return this.make_default_style();
			}
		})],
		['event', el.shadow.value(context, scope, attributes.event, event => {
			this.destroy_guard();
			if (util.traits.is_function(event))
				this.event_handler = event;
			return event;
		})],
		['transform', el.shadow.value(context, scope, attributes.transform, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || this.attributes.settings.transform;
		})],
		['transformOrigin', el.shadow.value(context, scope, attributes.transformOrigin, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || this.attributes.settings.transformOrigin;
		})]
		]), this.settings);
}
util.inherit(Circle, Drawable, {
	fill_defaults(style) {
		style.x = style.x || this.attributes.settings.x;
		style.y = style.y || this.attributes.settings.y;
		style.radius = style.radius || this.attributes.settings.radius;
		style.color = style.color || this.attributes.settings.color;
		style.fillColor = style.fillColor || this.attributes.settings.fillColor;
		style.border = style.border || this.attributes.settings.border;
	},
	make_default_style() {
		return {
			x: this.attributes.settings.x,
			y: this.attributes.settings.y,
			radius: this.attributes.settings.radius,
			color: this.attributes.settings.color,
			fillColor: this.attributes.settings.fillColor,
			border: this.attributes.settings.border
		};
	},
	update_path() {
		var radius = this.settings.style.radius;
		var startX = this.settings.style.x + radius;
		this.path = new Path2D(
			'M' + startX + ' ' + this.settings.style.y +
			'a' + this.settings.style.radius + ' ' + this.settings.style.radius +
				' 0 0 0 ' + -2 * radius + ' 0' +
			/* 0 x rotation, 0 large arc, 0 clockwise sweep, dx=-radius, dy=0 */
			'a' + this.settings.style.radius + ' ' + this.settings.style.radius +
				' 0 0 0 ' + 2 * radius + ' 0' +
			'Z'
		);
		this.attributes.presenter.requestRefresh();
	},
	refresh(context) {
		if (this.dirty_path) {
			this.update_path();
			this.dirty_path = false;
		}
		var drawing_context = context.context;
		this.performTransform(drawing_context);
		if (this.settings.style.color) {
			drawing_context.strokeStyle = this.settings.style.color;
			drawing_context.lineWidth = this.settings.style.width || 1;
			drawing_context.stroke(this.path);
		}
		if (this.settings.style.fillColor) {
			drawing_context.fillStyle = this.settings.style.fillColor;
			drawing_context.fill(this.path);
		}
	},
	performTransform(context) {
		context.translate(-this.settings.transformOrigin[0] || 0, -this.settings.transformOrigin[1] || 0);
		performTransform(context, this.settings.transform);
		context.translate(this.settings.transformOrigin[0] || 0, this.settings.transformOrigin[1] || 0);
	},
	is_in_path(x, y) {
		this.performTransform(this.attributes.presenter.context);
		return this.attributes.presenter.context.isPointInPath(this.path, x, y);
	},
	event (event) {
		if (this.is_in_path(event.offsetX, event.offsetY))
			return this.shadow.get_shadow('event').invoke(event);
		else
			this.shadow.get_shadow('event').invoke(new event.constructor('mouseout', event));
	},
	destroy() {
		Drawable.prototype.destroy.call(this);
		this.shadow.destroy();
	}
});
Circle.interpret = function (presenter, node) {
	return {
		type: 'shape',
		presenter: presenter,
		shape: 'circle',
		settings: {
			x: Number(node.getAttribute('x')) || 0,
			y: Number(node.getAttribute('y')) || 0,
			radius: Number(node.getAttribute('radius')) || 0,
			color: node.getAttribute('color') || '#000',
			fillColor: node.getAttribute('fill-color'),
			border: Number(node.getAttribute('border')),
			transform: node.getAttribute('transform'),
			transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin'))
		},
		style: node.dataset['bindStyle'] && el.parser.parse(node.dataset['bindStyle']),
		event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
		transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
		transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin'])
	};
};

function Curve(attributes, context, scope, parent_settings) {
	Drawable.call(this, attributes, scope, parent_settings);
	this.settings = {
		path: attributes.settings.path,
		color: attributes.settings.color,
		fillColor: attributes.settings.fillColor,
		width: attributes.settings.width
	};
	this.presenter = attributes.presenter;
	this.path = null;
	this.shadow = el.shadow.object(new Map([
		['path', el.shadow.value(context, scope, attributes.bindings.path, path => {
			path = path || attributes.settings.path || '';
			this.destroy_guard();
			this.path = new Path2D(path);
			attributes.presenter.requestRefresh();
			return path;
		})],
		['color', el.shadow.value(context, scope, attributes.bindings.color, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || attributes.settings.color;
		})],
		['fillColor', el.shadow.value(context, scope, attributes.bindings.fillColor, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || attributes.settings.fillColor;
		})],
		['width', el.shadow.value(context, scope, attributes.bindings.width, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || attributes.settings.width;
		})],
		['event', el.shadow.value(context, scope, attributes.bindings.event, event => {
			this.destroy_guard();
			if (util.traits.is_function(event))
				this.event_handler = event;
			return event;
		})],
		['transform', el.shadow.value(context, scope, attributes.bindings.transform, value => {
			this.destroy_guard();
			return value || attributes.settings.transform;
		})],
		['transformOrigin', el.shadow.value(context, scope, attributes.bindings.transformOrigin, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || attributes.settings.transformOrigin;
		})]
		]), this.settings);
}
util.inherit(Curve, Drawable, {
	refresh(context) {
		var drawing_context = context.context;
		if (this.path) {
			this.performTransform(drawing_context);
			if (this.settings.color) {
				drawing_context.strokeStyle = this.settings.color;
				drawing_context.lineWidth = this.settings.width;
				drawing_context.stroke(this.path);
			}
			if (this.settings.fillColor) {
				drawing_context.fillStyle = this.settings.fillColor;
				drawing_context.fill(this.path);
			}
		}
	},
	performTransform(context) {
		context.translate(-this.settings.transformOrigin[0] || 0, -this.settings.transformOrigin[1] || 0);
		performTransform(context, this.settings.transform);
		context.translate(this.settings.transformOrigin[0] || 0, this.settings.transformOrigin[1] || 0);
	},
	is_in_path(x, y) {
		this.performTransform(this.presenter.context);
		return this.presenter.context.isPointInPath(this.path, x, y);
	},
	event (event) {
		if (this.is_in_path(event.offsetX, event.offsetY))
			return this.shadow.get_shadow('event').invoke(event);
		else
			this.shadow.get_shadow('event').invoke(new event.constructor('mouseout', event));
	},
	destroy() {
		Drawable.prototype.destroy.call(this);
		this.shadow.destroy();
	}
});
Curve.interpret = function (presenter, node) {
	return {
		type: 'shape',
		presenter: presenter,
		shape: 'curve',
		settings: {
			path: node.getAttribute('path'),
			color: node.getAttribute('color'),
			fillColor: node.getAttribute('fill-color'),
			width: Number(node.getAttribute('width')) || 1,
			transform: node.getAttribute('transform'),
			transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin'))
		},
		bindings: {
			path: node.dataset['bindPath'] && el.parser.parse(node.dataset['bindPath']),
			color: node.dataset['bindColor'] && el.parser.parse(node.dataset['bindColor']),
			fillColor: node.dataset['bindFillColor'] && el.parser.parse(node.dataset['bindFillColor']),
			event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
			transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
			transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin'])
		}
	};
};

function Text(attributes, context, scope, parent_settings) {
	Drawable.call(this, attributes, scope, parent_settings);
	this.attributes = attributes;
	this.settings = {
		x: attributes.settings.x,
		y: attributes.settings.y,
		size: attributes.settings.size,
		font: attributes.settings.font,
		anchor: attributes.settings.anchor
	};
	var getFontStyle = this.getFontStyle =
		() => `${this.settings.size}px ${this.settings.font}`;
	var getTextSize = () => this.settings.size;
	var getTextWidth = () => {
		var context = attributes.presenter.context;
		context.save();
		context.font = getFontStyle();
		var width = context.measureText(this.text).width;
		context.restore();
		return width;
	};
	this.model = {
		$element: {
			textSize: 0,
			textWidth: 0,
			parentSettings: parent_settings
		}
	};
	Object.defineProperty(this.model.$element, 'textSize', {get: getTextSize});
	Object.defineProperty(this.model.$element, 'textWidth', {get: getTextWidth});
	var sub_scope = new el.scope.Scope(this.model, scope);
	this.shadow = el.shadow.object(new Map([
		['size', el.shadow.value(context, scope, attributes.bindings.size, value => {
			this.destroy_guard();
			this.update_model();
			return value || attributes.settings.size;
		})],
		['font', el.shadow.value(context, scope, attributes.bindings.font, value => {
			this.destroy_guard();
			this.update_model();
			return value || attributes.settings.font;
		})],
		['x', el.shadow.value(context, sub_scope, attributes.bindings.x, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || attributes.settings.x;
		})],
		['y', el.shadow.value(context, sub_scope, attributes.bindings.y, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || attributes.settings.y;
		})],
		['event', el.shadow.value(context, sub_scope, attributes.bindings.event, event => {
			this.destroy_guard();
			if (util.traits.is_function(event))
				this.event_handler = event;
			return event;
		})],
		['text', el.shadow.template(context, sub_scope, attributes.settings.text, value => {
			this.destroy_guard();
			this.text = value;
			this.update_model();
			return value;
		}, attributes.presenter.text_template_options)],
		['transform', el.shadow.value(context, sub_scope, attributes.bindings.transform, value => {
			this.destroy_guard();
			return value || attributes.settings.transform;
		})],
		['anchor', el.shadow.value(context, sub_scope, attributes.bindings.anchor, value => {
			this.destroy_guard();
			return value || attributes.settings.anchor;
		})],
		['transformOrigin', el.shadow.value(context, sub_scope, attributes.bindings.transformOrigin, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || attributes.settings.transformOrigin;
		})]
		]), this.settings);
}
var TRANSLATE_TEXT_ALIGN = new Map([
	['middle', 'center'],
	['start', 'start'],
	['end', 'end']
]);
util.inherit(Text, Drawable, {
	update_model() {
		el.runtime.notify({
			target: this.model.$element,
			type: 'update',
			name: 'textSize'
		});
		el.runtime.notify({
			target: this.model.$element,
			type: 'update',
			name: 'textWidth'
		});
		this.attributes.presenter.requestRefresh();
	},
	refresh(context) {
		var drawing_context = context.context;
		drawing_context.font = this.getFontStyle();
		drawing_context.textAlign = TRANSLATE_TEXT_ALIGN.get(this.settings.anchor);
		this.performTransform(drawing_context);
		drawing_context.fillText(this.text, this.settings.x, this.settings.y);
	},
	performTransform(context) {
		context.translate(-this.settings.transformOrigin[0] || 0, -this.settings.transformOrigin[1] || 0);
		performTransform(context, this.settings.transform);
		context.translate(this.settings.transformOrigin[0] || 0, this.settings.transformOrigin[1] || 0);
	},
	is_in_path(x, y) {
		var path = new Path2D;
		this.performTransform(this.attributes.presenter.context);
		path.rect(this.settings.x, this.settings.y,
			this.model.$element.textWidth, this.model.$element.textSize);
		return this.attributes.presenter.context.isPointInPath(path, x, y);
	},
	event (event) {
		if (this.is_in_path(event.offsetX, event.offsetY))
			return this.shadow.get_shadow('event').invoke(event);
		else
			this.shadow.get_shadow('event').invoke(new event.constructor('mouseout', event));
	},
	destroy() {
		Drawable.prototype.destroy.call(this);
		this.shadow.destroy();
	}
});
Text.interpret = function (presenter, node) {
	return {
		type: 'text',
		presenter: presenter,
		settings: {
			x: Number(node.getAttribute('x')) || 0,
			y: Number(node.getAttribute('y')) || 0,
			size: Number(node.getAttribute('size')) || 10,
			font: node.getAttribute('font') || 'sans-serif',
			text: node.textContent.trim(),
			transform: node.getAttribute('transform'),
			transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin')),
			anchor: node.getAttribute('anchor') || 'start'
		},
		bindings: {
			x: node.dataset['bindX'] && el.parser.parse(node.dataset['bindX']),
			y: node.dataset['bindY'] && el.parser.parse(node.dataset['bindY']),
			size: node.dataset['bindSize'] && el.parser.parse(node.dataset['bindSize']),
			font: node.dataset['bindFont'] && el.parser.parse(node.dataset['bindFont']),
			event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
			transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
			transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin']),
			anchor: node.dataset['bindAnchor'] && el.parser.parse(node.dataset['bindAnchor'])
		}
	};
};

function Shape() {}
Shape.interpret = function (presenter, node) {
	switch (node.getAttribute('type')) {
	case 'line':
		return Line.interpret(presenter, node);
	case 'rect':
		return Rect.interpret(presenter, node);
	case 'circle':
		return Circle.interpret(presenter, node);
	case 'curve':
		return Curve.interpret(presenter, node);
	}
};
Shape.new_instance = function (attributes, context, scope, parent_settings) {
	switch (attributes.shape) {
	case 'line':
		return new Line(attributes, context, scope, parent_settings);
	case 'rect':
		return new Rect(attributes, context, scope, parent_settings);
	case 'circle':
		return new Circle(attributes, context, scope, parent_settings);
	case 'curve':
		return new Curve(attributes, context, scope, parent_settings);
	}
};

return Object.freeze({
	Drawable: Drawable,
	Shape: Shape,
	Text: Text,
	performTransform: performTransform,
	parseTransformOrigin: parseTransformOrigin
});
});
