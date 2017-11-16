define(['./element', 'el/el', 'util/util', 'compat/observe'],
function (element, el, util, _proxy) {
'use strict';

function interpret_children(children, presenter) {
	return Array.from(children)
		.map(function (node) {
			return interpret_template(presenter, node);
		});
}

function Root(attributes, scope) {
	element.Drawable.call(this, attributes, scope);
	this.presenter = attributes.presenter;
	this.settings = {
		x: 0,
		y: 0,
		width: attributes.presenter.canvas.width,
		height: attributes.presenter.canvas.height
	};
	this.children = [];
	this.context = new el.shadow.ShadowContext;
	this.root_scope = new el.scope.Scope({
		$canvas: {
			width: this.settings.width,
			height: this.settings.height
		}
	}, scope);
	for (var i = 0, end = attributes.children.length; i < end; ++i)
		this.children.push(
			make_layout(
				attributes.children[i],
				this.context,
				this.root_scope,
				this.settings));
}
util.inherit(Root, element.Drawable, {
	setSize(width, height) {
		_proxy(this.settings).width = _proxy(this.root_scope.model.$canvas).width = width;
		_proxy(this.settings).height = _proxy(this.root_scope.model.$canvas).height = height;
	},
	refresh(context) {
		var drawing_context = context.context;
		drawing_context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		for (var i = 0, end = this.children.length; i < end; ++i) {
			drawing_context.save();
			this.children[i].refresh(context);
			drawing_context.restore();
		}
	},
	destroy() {
		for (var i = 0, end = this.children.length; i < end; ++i)
			this.children[i].destroy();
		this.context.destroy();
		element.Drawable.prototype.destroy.call(this);
	},
	test_event(layout, event) {
		this.presenter.context.save();
		var result = layout.event(event);
		this.presenter.context.restore();
		return result;
	},
	event(event) {
		var result = this.children.some(layout => this.test_event(layout, event));
	}
});
Root.interpret = function (presenter, node) {
	return {
		type: 'root',
		presenter: presenter,
		children: interpret_children(node.content.children, presenter)
	};
};

function RelativeLayout(attributes, context, scope, parent_settings) {
	element.Drawable.call(this, attributes, scope, parent_settings);
	this.presenter = attributes.presenter;
	this.settings = {
		x: attributes.settings.x,
		y: attributes.settings.y,
		width: attributes.settings.width,
		height: attributes.settings.height,
		border: attributes.settings.border,
		rotation: attributes.settings.rotation,
		clip: attributes.settings.clip,
        transform: attributes.settings.transform,
		parentSettings: parent_settings
	};
	this.model = {
		$element: {
			settings: this.settings
		}
	};
	var layout_scope = new el.scope.Scope(this.model, scope);
	this.settings_shadow = el.shadow.object(new Map([
		['x', el.shadow.value(context, layout_scope, attributes.bindings.x, value => {
			this.destroy_guard();
			this.clip_dirty = true;
			attributes.presenter.requestRefresh();
			return Number(value) || attributes.settings.x || 0;
		})],
		['y', el.shadow.value(context, layout_scope, attributes.bindings.y, value => {
			this.destroy_guard();
			this.clip_dirty = true;
			attributes.presenter.requestRefresh();
			return Number(value) || attributes.settings.y || 0;
		})],
		['width', el.shadow.value(context, layout_scope, attributes.bindings.width, value => {
			this.destroy_guard();
			this.clip_dirty = true;
			attributes.presenter.requestRefresh();
			return Number(value) || attributes.settings.width || 0;
		})],
		['height', el.shadow.value(context, layout_scope, attributes.bindings.height, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return Number(value) || attributes.settings.height || 0;
		})],
		['rotation', el.shadow.value(context, layout_scope, attributes.bindings.rotation, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return Number(value) || attributes.settings.rotation || 0;
		})],
		['clip', el.shadow.value(context, layout_scope, attributes.bindings.clip, value => {
			this.destroy_guard();
			this.clip_dirty = true;
			this.path = new Path2D(value);
			attributes.presenter.requestRefresh();
			return !!value;
		})],
		['event', el.shadow.value(context, layout_scope, attributes.bindings.event, value => {
			this.destroy_guard();
			return value;
		})],
		['init', el.shadow.value(context, layout_scope, attributes.bindings.init, value => {
			this.destroy_guard();
			return util.traits.is_function(value) ? value : util.traits.EMPTY_FUNCTION;
		})],
		['transform', el.shadow.value(context, layout_scope, attributes.bindings.transform, value => {
			this.destroy_guard();
			return value || attributes.settings.transform;
		})],
		['transformOrigin', el.shadow.value(context, layout_scope, attributes.bindings.transformOrigin, value => {
			return value || attributes.settings.transformOrigin;
		})]
	]), this.settings);
	// invoke init function only once
	this.settings_shadow.get_shadow('init').invoke(this.settings);
	this.children = [];
	for (var i = 0, end = attributes.template.length; i < end; ++i)
		this.children.push(
			make_layout(
				attributes.template[i], context, layout_scope, this.settings));
}
util.inherit(RelativeLayout, element.Drawable, {
	update_clip() {
		if (this.settings.clip) {return ;}
		this.path = new Path2D;
		this.path.rect(
			this.settings.x,
			this.settings.y,
			this.settings.width,
			this.settings.height);
	},
	refresh(context) {
		if (this.clip_dirty) {
			this.update_clip();
			this.clip_dirty = false;
		}
		var drawing_context = context.context;
		drawing_context.translate(this.settings.x, this.settings.y);
		drawing_context.rotate(this.settings.rotation);
		this.performTransform(drawing_context);
		this.settings.clip &&
			drawing_context.clip(this.path);
		for (var i = 0, end = this.children.length; i < end; ++i) {
			drawing_context.save();
			this.children[i].refresh(context);
			drawing_context.restore();
		}
	},
	performTransform(context) {
		context.translate(-this.settings.transformOrigin[0] || 0, -this.settings.transformOrigin[1] || 0);
		element.performTransform(context, this.settings.transform);
		context.translate(this.settings.transformOrigin[0] || 0, this.settings.transformOrigin[1] || 0);
	},
	is_in_clip_path(x, y) {
		if (this.settings.clip) {
			this.presenter.context.clip(this.path);
			return this.presenter.context.isPointInPath(this.path, x, y);
		} else {
			return true;	// allow overflow
		}
	},
	test_event(layout, event) {
		var drawing_context = this.presenter.context;
		drawing_context.save();
		var result = layout.event(event);
		drawing_context.restore();
		return result;
	},
	event(event) {
		var result;
		var drawing_context = this.presenter.context;
		drawing_context.save();
		drawing_context.translate(this.settings.x, this.settings.y);
		drawing_context.rotate(this.settings.rotation);
		this.performTransform(drawing_context);
		if (this.is_in_clip_path(event.offsetX, event.offsetY)) {
			this.children.forEach(layout => this.test_event(layout, event));
			result = this.settings_shadow.get_shadow('event').invoke(event);
		}
		drawing_context.restore();
		return result;
	},
	destroy() {
		for (var i = 0, end = this.children.length; i < end; ++i)
			this.children[i].destroy();
		this.settings_shadow.destroy();
		element.Drawable.prototype.destroy.call(this);
	}
});
RelativeLayout.interpret = function (presenter, node) {
	return {
		type: 'relative-layout',
		presenter: presenter,
		settings: {
			x: Number(node.getAttribute('x')) || 0,
			y: Number(node.getAttribute('y')) || 0,
			width: Number(node.getAttribute('width'))|| Infinity,
			height: Number(node.getAttribute('height')) || Infinity,
			rotation: Number(node.getAttribute('rotation')) || 0,
			border: Number(node.getAttribute('border')) || 0,
			clip: node.hasAttribute('clip'),
			transform: node.getAttribute('transform'),
			transformOrigin: element.parseTransformOrigin(node.getAttribute('transform-origin'))
		},
		bindings: {
			x: node.dataset['bindX'] && el.parser.parse(node.dataset['bindX']),
			y: node.dataset['bindY'] && el.parser.parse(node.dataset['bindY']),
			width: node.dataset['bindWidth'] && el.parser.parse(node.dataset['bindWidth']),
			height: node.dataset['bindHeight'] && el.parser.parse(node.dataset['bindHeight']),
			rotation: node.dataset['bindRotation'] && el.parser.parse(node.dataset['bindRotation']),
			init: node.dataset['bindInit'] && el.parser.parse(node.dataset['bindInit']),
			clip: node.dataset['bindClip'] && el.parser.parse(node.dataset['bindClip']),
			event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
			transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
			transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin'])
		},
		template: interpret_children(node.children, presenter)
	};
};

function IterativeTemplate(attributes, context, scope, parent_settings) {
	element.Drawable.call(this, attributes, scope, parent_settings);
	var self = this;
	this.attributes = attributes;
	this.scope = scope;
	this.context = context;
	this.parent_settings = parent_settings;
	this.children = [];
	this.shadow = el.shadow.array(
		context, scope, attributes.iterator,
		{
			*splice_change(collection) {
				yield* self.update_splice(collection);
			}
		}, this.children);
}
util.inherit(IterativeTemplate, element.Drawable, {
	make_item(element, index, collection) {
		var model = {};
		model[this.attributes.iterator.element] = element;
		if (this.attributes.iterator.index)
			model[this.attributes.iterator.index] = index;
		if (this.attributes.iterator.reference)
			model[this.attributes.iterator.reference] = collection;
		var sub_scope = new el.scope.Scope(model, this.scope);
		return {
			sub_scope: sub_scope,
			children: this.attributes.template.map(
				attributes =>
					make_layout(attributes, this.context, sub_scope, this.parent_settings))
		};
	},
	*update_splice(collection) {
		this.destroy_guard();
		while (true) {
			var change = yield true;
			if (change)
				switch (change.operation) {
				case 'create':
					yield this.make_item(change.value, change.key, collection);
					break;
				case 'destroy':
					this.destroy_item(change.target);
					yield true;
					break;
				case 'update':
					_proxy(change.target.sub_scope.model)
						[this.attributes.iterator.element] =
							change.value;
					if (this.attributes.iterator.index)
						_proxy(change.target.sub_scope.model)
							[this.attributes.iterator.index] =
								change.key;
					if (this.attributes.iterator.reference)
						_proxy(change.target.sub_scope.model)
							[this.attributes.iterator.reference] =
								collection;
					yield change.target;
					break;
				}
			else
				break;
		}
		this.attributes.presenter.requestRefresh();
	},
	refresh(context) {
		var drawing_context = context.context;
		for (var i = 0, endi = this.children.length; i < endi; ++i)
			for (var j = 0, endj = this.children[i].children.length; j < endj; ++j) {
				drawing_context.save();
				this.children[i].children[j].refresh(context);
				drawing_context.restore();
			}
	},
	event (event) {
		return this.children.some(
			item =>
				item.children.some(layout => layout.event(event)));
	},
	destroy_item (item) {
		item.children.forEach(child => child.destroy());
	},
	destroy() {
		this.shadow.destroy();
        this.children.forEach(item => this.destroy_item(item));
		element.Drawable.prototype.destroy.call(this);
	}
});
IterativeTemplate.interpret = function (presenter, node) {
	return {
		type: 'iterate',
		presenter: presenter,
		iterator: el.parser.parse(node.dataset['iterate']),
		template: interpret_children(node.content.children, presenter)
	};
};

function ConditionalTemplate(attributes, context, scope, parent_settings) {
	element.Drawable.call(this, attributes, scope, parent_settings);
	this.children = null;
	this.condition_shadow = el.shadow.value(
		context, scope, attributes.condition, 
		condition => {
			this.destroy_guard();
			if (condition && !this.children) {
				this.children = [];
				for (var i = 0, end = attributes.template.length; i < end; ++i)
					this.children.push(
						make_layout(
							attributes.template[i], context, scope, parent_settings));
			} else if (!condition && this.children) {
				for (var i = 0, end = this.children.length; i < end; ++i)
					this.children[i].destroy();
				this.children = null;
			}
		});
}
util.inherit(ConditionalTemplate, element.Drawable, {
	refresh(context) {
		if (this.children) {
			for (var i = 0, end = this.children.length; i < end; ++i)
				this.children[i].refresh(context);
		}
	},
	event (event) {
		return this.children && this.children.some(layout => layout.event(event));
	},
	destroy() {
		if (this.children)
			for (var i = 0, end = this.children.length; i < end; ++i)
				this.children[i].destroy();
		this.condition_shadow.destroy();
		element.Drawable.prototype.destroy.call(this);
	}
});
ConditionalTemplate.interpret = function(presenter, node) {
	return {
		type: 'condition',
		presenter: presenter,
		condition: el.parser.parse(node.dataset['condition']),
		template: interpret_children(node.content.children, presenter)
	}
};

function InjectiveTemplate(attributes, context, scope, parent_settings) {
	element.Drawable.call(this, attributes, scope, parent_settings);
    this.presenter = attributes.presenter;
	this.children = [];
    this.dirty = true;
	this.argument_shadow = el.shadow.value(context, scope, attributes.argument,
		argument => {
        this.dirty = true;
			util.async.async(() => this.inject(attributes, context, scope, parent_settings));
			return argument;
		});
	this.inject_shadow = el.shadow.value(context, scope, attributes.injection,
		template => {
        this.dirty = true;
			util.async.async(() => this.inject(attributes, context, scope, parent_settings));
			return template;
		});
}
util.inherit(InjectiveTemplate, element.Drawable, {
	inject(attributes, context, scope, parent_settings) {
		if (this.destroyed || !this.dirty)
			return;
        this.dirty = false;
		var template = this.inject_shadow.value;
		var argument = this.argument_shadow.value;
		this.destroy_guard();
		this.destroy_children();
		this.children.length = 0;
		if (template && template.element) {
			var sub_scope = new el.scope.Scope(
				argument || {},
				template.scope || scope);
			var sub_attributes = template.template ||
				interpret_children(
					template.element.content.children,
					attributes.presenter);
			for (var i = 0, end = sub_attributes.length; i < end; ++i)
				this.children.push(
					make_layout(
						sub_attributes[i], context, sub_scope, parent_settings));
		}
	},
	event (event) {
		return this.children.some(layout => layout.event(event));
	},
	destroy_children() {
		if (this.children)
			for (var i = 0, end = this.children.length; i < end; ++i)
				this.children[i].destroy();
	},
	destroy() {
		this.destroy_children();
		this.inject_shadow.destroy();
		this.argument_shadow.destroy();
		element.Drawable.prototype.destroy.call(this);
	},
	refresh(context) {
		var drawing_context = context.context;
		if (this.children)
			for (var i = 0, end = this.children.length; i < end; ++i) {
				drawing_context.save();
				this.children[i].refresh(context);
				drawing_context.restore();
			}
	}
});
InjectiveTemplate.interpret = function (presenter, node) {
	return {
		type: 'inject',
		presenter: presenter,
		injection: el.parser.parse(node.dataset['inject']),
		argument: node.dataset['argument'] && el.parser.parse(node.dataset['argument'])
	}
};

function ModelingTemplate(attributes, context, scope, parent_settings) {
	element.Drawable.call(this, attributes, scope, parent_settings);
	this.children = [];
	this.model = null;
	var sub_scope = null;
	var enabled = false;
	this.shadow = el.shadow.value(context, scope, attributes.model,
		model => {
			this.destroy_guard();
			if (util.traits.is_object(model)) {
				if (this.model) {
					Object.assign(_proxy(this.model), model);
					for (var key of Object.getOwnPropertyNames(this.model))
						if (!(key in model))
							delete _proxy(this.model)[key];
				} else {
					this.model = Object.assign({}, model);
					sub_scope = new el.scope.Scope(this.model, scope);
					this.children.length = 0;
					for (var i = 0, end = attributes.template.length; i < end; ++i)
						this.children.push(
							make_layout(
								attributes.template[i], context, sub_scope, parent_settings));
				}
			} else {
				if (this.model)
					this.destroy_all_children();
				this.model = null;
			}
		});
}
util.inherit(ModelingTemplate, element.Drawable, {
	refresh(context) {
		var drawing_context = context.context;
		if (this.children)
			for (var i = 0, end = this.children.length; i < end; ++i) {
				drawing_context.save();
				this.children[i].refresh(context);
				drawing_context.restore();
			}
	},
	event (event) {
		return this.children.some(layout => layout.event(event));
	},
	destroy_all_children() {
		if (this.children) {
			for (var i = 0, end = this.children.length; i < end; ++i)
				this.children[i].destroy();
		}
		this.children.length = 0;
	},
	destroy() {
		this.destroy_all_children();
		this.shadow.destroy();
		element.Drawable.prototype.destroy.call(this);
	}
});
ModelingTemplate.interpret = function (presenter, node) {
	return {
		type: 'model',
		presenter: presenter,
		model: el.parser.parse(node.dataset['model']),
		template: interpret_children(node.content.children, presenter)
	}
};

function Template (attributes, context, scope, parent_settings) {
	this.bind_shadow = el.shadow.value(context, scope, attributes.bind);
	this.bind_shadow.bind_handler({
		element: attributes.element,
		template: attributes.template,
		scope: scope
	});
}
util.inherit(Template, element.Drawable, {
	destroy() {
		this.bind_shadow.destroy();
		element.Drawable.prototype.destroy.call(this);
	}
});

Template.interpret = function (presenter, node) {
	if (node.dataset['condition']) {
		return ConditionalTemplate.interpret(presenter, node);
	} else if (node.dataset['model']) {
		return ModelingTemplate.interpret(presenter, node);
	} else if (node.dataset['iterate']) {
		return IterativeTemplate.interpret(presenter, node);
	} else if (node.dataset['inject']) {
		return InjectiveTemplate.interpret(presenter, node);
	} else
		// generic template
		return {
			type: 'template',
			presenter: presenter,
			element: node,
			bind: node.dataset['bind'] && el.parser.parse(node.dataset['bind']),
			template: interpret_children(node.content.children, presenter)
		};
};

function DrawBox(attributes, context, scope, parent_settings) {
	element.Drawable.call(this, attributes, scope, parent_settings);
	this.attributes = attributes;
	this.settings = {
		x: attributes.settings.x,
		y: attributes.settings.y,
		parentSettings: parent_settings
	};
	this.model = {
		$element: {
			settings: this.settings
		}
	};
	var layout_scope = new el.scope.Scope(this.model, scope);
	this.shadow = el.shadow.object(new Map([
		['x', el.shadow.value(context, scope, attributes.bindings.x, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || attributes.settings.x;
		})],
		['y', el.shadow.value(context, scope, attributes.bindings.y, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			return value || attributes.settings.y;
		})],
		['painter', el.shadow.value(context, scope, attributes.bindings.painter, value => {
			this.destroy_guard();
			attributes.presenter.requestRefresh();
			this.painter = value;
			return value;
		})],
		['event', el.shadow.value(context, scope, attributes.bindings.painter, value => {
			this.destroy_guard();
			return value;
		})],
		['transform', el.shadow.value(context, scope, attributes.bindings.transform, value => {
			this.destroy_guard();
			return value;
		})]
		]), this.settings);
	this.children = attributes.template.map(template =>
		make_layout(template, context, ayout_scope, this.settings));
}
util.inherit(DrawBox, element.Drawable, {
	refresh(context) {
		context.context.translate(this.settings.x, this.settings.y);
		this.performTransform(context.context);
		if (util.traits.is_function(this.painter)) {
			var safe_delegate = context.getSafeDelegate();
			this.painter(safe_delegate, () => this.refresh_elements(context));
			safe_delegate.reset();
		} else
			this.refresh_elements(context);
	},
	performTransform(context) {
		context.translate(-this.settings.transformOrigin[0] || 0, -this.settings.transformOrigin[1] || 0);
		element.performTransform(context, this.settings.transform);
		context.translate(this.settings.transformOrigin[0] || 0, this.settings.transformOrigin[1] || 0);
	},
	refresh_elements(context) {
		this.children.forEach(layout => layout.refresh(context));
	},
	event(event) {
		var drawing_context = this.attributes.presenter.context;
		drawing_context.save();
		drawing_context.translate(this.settings.x, this.settings.y);
		this.performTransform(drawing_context);
		var result = this.shadow.get_shadow('event').invoke(event);
		drawing_context.restore();
		return result;
	},
	destroy() {
		this.children.forEach(layout => layout.destroy());
		this.shadow.destroy();
		element.Drawable.prototype.destroy.call(this);
	}
});
DrawBox.interpret = function (presenter, node) {
	return {
		presenter: presenter,
		settings: {
			x: Number(node.getAttribute('x')) || 0,
			y: Number(node.getAttribute('y')) || 0,
			transform: node.getAttribute('transform'),
			transformOrigin: element.parseTransformOrigin(node.getAttribute('transform-origin'))
		},
		bindings: {
			x: node.dataset['bindX'] && el.parser.parse(node.dataset['bindX']),
			y: node.dataset['bindY'] && el.parser.parse(node.dataset['bindY']),
			painter: node.dataset['bindPainter'] && el.parser.parse(node.dataset['bindPainter']),
			event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
			transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
			transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin'])
		},
		template: interpret_children(node.children, presenter)
	};
};

function make_layout(attributes, context, scope, parent_settings) {
	switch (attributes.type) {
	case 'relative-layout':
		return new RelativeLayout(attributes, context, scope, parent_settings);
	case 'iterate':
		return new IterativeTemplate(attributes, context, scope, parent_settings);
	case 'condition':
		return new ConditionalTemplate(attributes, context, scope, parent_settings);
	case 'inject':
		return new InjectiveTemplate(attributes, context, scope, parent_settings);
	case 'model':
		return new ModelingTemplate(attributes, context, scope, parent_settings);
	case 'template':
		return new Template(attributes, context, scope, parent_settings);
	case 'shape':
		return element.Shape.new_instance(attributes, context, scope, parent_settings);
	case 'text':
		return new element.Text(attributes, context, scope, parent_settings);
	}
}

function interpret_template (presenter, node) {
	switch (node.nodeName.toLowerCase()) {
	case 'relative-layout':
		return RelativeLayout.interpret(presenter, node);
	case 'template':
		return Template.interpret(presenter, node);
	case 'draw-box':
		return DrawBox.interpret(presenter, node);
	case 'shape':
		return element.Shape.interpret(presenter, node);
	case 'text':
		return element.Text.interpret(presenter, node);
	}
}

function interpret_root (presenter, node) {
	return Root.interpret(presenter, node);
}

function bind(presenter, node, model) {
	var attributes = interpret_root(presenter, node);
	return new Root(attributes, new el.scope.Scope(model, null));
}

return {
	interpret_root: interpret_root,
	interpret_template: interpret_template,
	make_layout: make_layout,
	bind: bind
};

});
