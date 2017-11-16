define(['el/el', 'util/util', 'compat/observe'], function(el, util, _proxy) {
'use strict';
    
var COUNTER = new Uint32Array(1);
    
function get_token() {
    return COUNTER[0]++;
}

function parseTransformOrigin(string) {
	if (string) {
		var a = /\((.+),(.+)\)/
			.exec(string.trim());
		if (a && a.length > 2)
			return [Number(a[1]) || 0, Number(a[2]) || 0];
	} else
		return [0,0];
}
    
function degree_radian(degree) {
    return degree ? degree / 180 * Math.PI : 0;
}
    
function radian_degree(radian) {
    return radian ? radian / Math.PI * 180 : 0;
}

function create_element(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}
    
function Drawable() {}
Object.assign(Drawable.prototype, {
	destroy() {
		this.destroyed = true;
	},
	refresh() {},
	event() {},
    destroy_guard() {
        if (this.destroyed)
            throw new Error("resource is already destroyed");
    }
});

// root element
function Root(attributes, scope) {
	Drawable.call(this);
	this.settings = {
		x: 0,
		y: 0,
		width: attributes.presenter.canvas.width,
		height: attributes. presenter.canvas.height,
		element: attributes.presenter.canvas
	};
	this.context = new el.shadow.ShadowContext;
	this.children = [];
	this.root_scope = new el.scope.Scope({
		$canvas: {
			width: this.settings.width,
			height: this.settings.height
		}
	}, scope);
	for (var i = 0; i < attributes.children.length; ++i)
		this.children.push(
			make_layout(
				attributes.children[i],
				this.context,
				this.root_scope,
				this.settings));
}
util.inherit(Root, Drawable, {
	destroy() {
		for (var i = 0; i < this.children.length; ++i)
			this.children[i].destroy();
		Drawable.prototype.destroy.call(this);
	},
	refresh() {},
	event() {}
});
Root.interpret = function(presenter, template) {
	return {
		type: 'root',
		presenter: presenter,
		children: interpret_children(
			template.content ? template.content.children : template.children,
			presenter)
	};
};

// g element
function RelativeLayout (attributes, context, scope, parent_settings) {
	Drawable.call(this);
	this.presenter = attributes.presenter;
    this.element = create_element('g');
	this.attach_events();
	this.settings = {
		x: attributes.settings.x,
		y: attributes.settings.y,
		width: attributes.settings.width,
		height: attributes.settings.height,
        border: attributes.settings.border,
		rotation: attributes.settings.rotation,
		clip: attributes.settings.clip,
        clipPath: attributes.settings.clipPath,
        transform: attributes.settings.transform,
        element: this.element,
		parentSettings: parent_settings
	};
    parent_settings.element.appendChild(this.element);
    // apply settings now
    this.model = {
        $element: {
            settings: this.settings
        }
    };
    var layout_scope = new el.scope.Scope(this.model, scope);
    this.shadow = el.shadow.object(new Map([
        ['x', el.shadow.value(context, layout_scope, attributes.bindings.x, value => {
            this.destroy_guard();
            util.async.async(() => this.set_transform());
            return Number(value) || attributes.settings.x || 0;
        })],
        ['y', el.shadow.value(context, layout_scope, attributes.bindings.y, value => {
            this.destroy_guard();
            util.async.async(() => this.set_transform());
            return Number(value) || attributes.settings.y || 0;
        })],
        ['width', el.shadow.value(context, layout_scope, attributes.bindings.width, value => {
            this.destroy_guard();
            util.async.async(() => this.set_clip());
            return Number.isFinite(value) ? value : attributes.settings.width || Infinity;
        })],
        ['height', el.shadow.value(context, layout_scope, attributes.bindings.height, value => {
            this.destroy_guard();
            util.async.async(() => this.set_clip());
            return Number.isFinite(value) ? value : attributes.settings.height || Infinity;
        })],
        ['clip', el.shadow.value(context, layout_scope, attributes.bindings.clip, value => {
            this.destroy_guard();
            util.async.async(() => this.set_clip());
            return value;
        })],
        ['clipPath', el.shadow.value(context, layout_scope, attributes.bindings.clipPath, value => {
            this.destroy_guard();
            util.async.async(() => this.set_clip());
            return value;
        })],
        ['transform', el.shadow.value(context, layout_scope, attributes.bindings.transform, value => {
            this.destroy_guard();
            util.async.async(() => this.set_transform());
            return value || attributes.settings.transform || '';
        })],
        ['transformOrigin', el.shadow.value(context, layout_scope, attributes.bindings.transformOrigin, value => {
        	this.destroy_guard();
        	util.async.async(() => this.set_transform_origin());
        	return value || attributes.settings.transformOrigin;
        })],
        ['rotation', el.shadow.value(context, layout_scope, attributes.bindings.rotation, value => {
            this.destroy_guard();
            util.async.async(() => this.set_transform());
            return value || attributes.settings.rotation || 0;
        })],
		['event', el.shadow.value(context, layout_scope, attributes.bindings.event, event => {
			this.destroy_guard();
			return event;
		})],
		['init', el.shadow.value(context, layout_scope, attributes.bindings.init, init => {
			this.destroy_guard();
			util.async.async(() => this.init());
			return init;
		})]
    ]), this.settings);
    this.children = [];
    for (var i = 0; i < attributes.template.length; ++i)
        this.children.push(make_layout(attributes.template[i], context, layout_scope, this.settings));
}
util.inherit(RelativeLayout, Drawable, {
	init() {
		this.shadow.get_shadow('init').invoke(this.settings);
	},
	attach_events() {
		var listener =
			e => this.shadow.get_shadow('event').invoke(e);
		['mousedown', 'mouseup', 'mousemove', 'mousein', 'mouseout', 'click'].forEach(
			ev_name => this.element.addEventListener(ev_name, listener));
	},
	destroy() {
        if (this.clip_path)
            this.presenter.deregister_def(this.clip_path);
        this.shadow.destroy();
        this.element.remove();
        Drawable.prototype.destroy.call(this);
	},
    set_clip() {
        var path;
        if (this.settings.clipPath) {
            this.element.setAttribute('clip-path', 'url(#' + this.settings.clipPath + ')')
        } else if (this.settings.clip) {
            if (!this.clip_path) {
                this.clip_path = create_element('clipPath');
                this.clip_path.id = 'clip_path_' + get_token();
            }
            path = this.clip_path.querySelector('path')
            if (!path) {
                this.clip_path.innerHTML = '';
                path = create_element('path');
                this.clip_path.appendChild(path);
                this.element.setAttribute('clip-path', 'url(#' + this.clip_path.id + ')');
            }
            path.d = value;
        } else if (this.clip_path) {
            this.clip_path.innerHTML = '';
            if (Number.isFinite(this.settings.width) && Number.isFinite(this.settings.height)) {
                path = create_element('path');
                path.d =
                    `M0 0
                    v${this.settings.width}
                    h${this.settings.height}
                    v${-this.settings.width}
                    z`;
                this.clip_path.appendChild(path);
            } else {
                this.element.setAttribute('clip-path', '');
            }
        }
    },
	set_transform_origin() {
		this.element.style.transformOrigin = `${this.settings.transformOrigin[0] || 0}px ${this.settings.transformOrigin[1] || 0}px`;
	},
    set_transform() {
        this.element.setAttribute(
            'transform',
            (this.settings.transform || '') +
            ` rotate(${radian_degree(this.settings.rotation)})` +
            ` translate(${this.settings.x || 0} ${this.settings.y || 0})`);
    }
});
RelativeLayout.interpret = function (presenter, node) {
    return {
		type: 'relative-layout',
        settings: {
            x: node.getAttribute('x') || 0,
            y: node.getAttribute('y') || 0,
            width: node.getAttribute('width') || Infinity,
            height: node.getAttribute('height') || Infinity,
            border: node.getAttribute('border') || 0,
            clip: node.getAttribute('clip') || '',
            clipPath: node.getAttribute('clip-path') || '',
            transform: node.getAttribute('transform') || '',
            transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin')),
            rotation: node.getAttribute('rotation') || ''
        },
        bindings: {
            x: node.dataset['bindX'] && el.parser.parse(node.dataset['bindX']),
            y: node.dataset['bindY'] && el.parser.parse(node.dataset['bindY']),
            width: node.dataset['bindWidth'] && el.parser.parse(node.dataset['bindWidth']),
            height: node.dataset['bindHeight'] && el.parser.parse(node.dataset['bindHeight']),
            border: node.dataset['bindBorder'] && el.parser.parse(node.dataset['bindBorder']),
            clip: node.dataset['bindClip'] && el.parser.parse(node.dataset['bindClip']),
            clipPath: node.dataset['bindClipPath'] && el.parser.parse(node.dataset['bindClipPath']),
            transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
            rotation: node.dataset['bindRotation'] && el.parser.parse(node.dataset['bindRotation']),
			event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
			init: node.dataset['bindInit'] && el.parser.parse(node.dataset['bindInit']),
			transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin'])
        },
        template: interpret_children(node.children, presenter)
    };
};
    
function IterativeTemplate(attributes, context, scope, parent_settings) {
    Drawable.call(this);
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
util.inherit(IterativeTemplate, Drawable, {
    destroy() {
        for (var i = 0; i < this.children.length; ++i)
            for (var j = 0; i < this.children[i].length; ++j)
                this.children[i][j].destroy();
        Drawable.prototype.destroy.call(this);
    },
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
                attributes => make_layout(attributes, this.context, sub_scope, this.parent_settings))
        };
    },
    destroy_item(item) {
        for (var i = 0; i < item.children.length; ++i)
            item.children[i].destroy();
    },
    *update_splice(collection) {
        this.destroy_guard();
        var change;
        while (true) {
            change = yield true;
            if (change)
                switch (change.operation) {
                case 'create':
                    yield this.make_item(change.value, change.key, collection);
                    break;
                case 'destroy':
                    this.destroy_item(change.target);
                    yield;
                    break;
                case 'update':
					change.target.sub_scope.model[this.attributes.iterator.element] =
						change.value;
					if (this.attributes.iterator.index)
						change.target.sub_scope.model[this.attributes.iterator.index] =
							change.key;
					if (this.attributes.iterator.reference)
						change.target.sub_scope.model[this.attributes.iterator.reference] =
							collection;
					yield change.target;
                    break;
                default:
                    return;
                }
            else
                return;
        }
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
	Drawable.call(this);
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
util.inherit(ConditionalTemplate, Drawable, {
	destroy() {
		if (this.children)
			for (var i = 0, end = this.children.length; i < end; ++i)
				this.children[i].destroy();
		this.condition_shadow.destroy();
		Drawable.prototype.destroy.call(this);
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
	Drawable.call(this);
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
util.inherit(InjectiveTemplate, Drawable, {
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
	destroy_children() {
		if (this.children)
			for (var i = 0, end = this.children.length; i < end; ++i)
				this.children[i].destroy();
	},
	destroy() {
		this.destroy_children();
		this.inject_shadow.destroy();
		this.argument_shadow.destroy();
		Drawable.prototype.destroy.call(this);
	},
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
	Drawable.call(this);
	this.children = [];
	this.model = null;
	var sub_scope = null;
	var enabled = false;
	this.shadow = el.shadow.value(context, scope, attributes.model,
		model => {
			this.destroy_guard();
			if (util.traits.is_object(model)) {
				if (this.model) {
					Object.assign(this.model, model);
					for (var key of Object.getOwnPropertyNames(this.model))
						if (!(key in model))
							delete this.model[key];
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
util.inherit(ModelingTemplate, Drawable, {
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
		Drawable.prototype.destroy.call(this);
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
util.inherit(Template, Drawable, {
	destroy() {
		this.bind_shadow.destroy();
		Drawable.prototype.destroy.call(this);
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
    
function Shape() {}
util.inherit(Shape, Drawable, {});
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

function Line(attributes, context, scope, parent_settings) {
	Drawable.call(this, attributes, scope, parent_settings);
	this.attributes = attributes;
	this.settings = {};
	this.path = null;
    this.element = create_element('line');
	this.attach_events();
    parent_settings.element.appendChild(this.element);
	this.shadow = el.shadow.object(new Map([
		['style', el.shadow.value(context, scope, attributes.style, style => {
			this.destroy_guard();
            util.async.async(() => this.assign_style(), 'animate');
			if (style) {
				this.fill_defaults(style);
				this.dirty_path = true;
				return style;
			} else
				return this.make_default_style();
		})],
		['event', el.shadow.value(context, scope, attributes.event, event => {
			this.destroy_guard();
			return event;
		})],
		['transformOrigin', el.shadow.value(context, scope, attributes.transformOrigin, value => {
			this.destroy_guard();
			util.async.async(() => this.set_transform_origin());
			return value || attributes.settings.transformOrigin;
		})],
		['transform', el.shadow.value(context, scope, attributes.transform, value => {
			this.destroy_guard();
            util.async.async(() => this.set_transform(), 'animate');
			return value || this.attributes.settings.transform;
		})]
		]), this.settings);
}
util.inherit(Line, Drawable, {
	attach_events() {
		var listener =
			e => this.shadow.get_shadow('event').invoke(e);
		['mousedown', 'mouseup', 'mousemove', 'mousein', 'mouseout', 'click'].forEach(
			ev_name => this.element.addEventListener(ev_name, listener));
	},
    assign_style() {
        this.element.setAttribute('x1', this.settings.style.startX || 0);
        this.element.setAttribute('y1', this.settings.style.startY || 0);
        this.element.setAttribute('x2', this.settings.style.endX || 0);
        this.element.setAttribute('y2', this.settings.style.endY || 0);
        this.element.style.stroke = this.settings.style.color || '#000';
        this.element.style.strokeWidth = this.settings.style.width;
    },
	set_transform_origin() {
		this.element.style.transformOrigin = `${this.settings.transformOrigin[0] || 0}px ${this.settings.transformOrigin[1] || 0}px`;
	},
    set_transform() {
        this.element.setAttribute('transform', this.settings.transform || '');
    },
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
	destroy() {
		this.shadow.destroy();
        this.element.remove();
		Drawable.prototype.destroy.call(this);
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
            transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin')),
			transform: node.getAttribute('transform')
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
    this.element = create_element('rect');
	this.attach_events();
    parent_settings.element.appendChild(this.element);
	this.settings = {
		style: this.make_default_style()
	};
	this.shadow = el.shadow.object(new Map([
		['style', el.shadow.value(context, scope, attributes.style, style => {
			this.destroy_guard();
            util.async.async(() => this.assign_style(), 'animate');
			return style || this.make_default_style();
		})],
		['event', el.shadow.value(context, scope, attributes.event, event => {
			this.destroy_guard();
			return event;
		})],
		['transformOrigin', el.shadow.value(context, scope, attributes.transformOrigin, value => {
			this.destroy_guard();
			util.async.async(() => this.set_transform_origin());
			return value || attributes.settings.transformOrigin;
		})],
		['transform', el.shadow.value(context, scope, attributes.transform, value => {
			this.destroy_guard();
            util.async.async(() => this.set_transform(), 'animate');
			return value;
		})]
		]), this.settings);
}
util.inherit(Rect, Drawable, {
	attach_events() {
		var listener =
			e => this.shadow.get_shadow('event').invoke(e);
		['mousedown', 'mouseup', 'mousemove', 'mousein', 'mouseout', 'click'].forEach(
			ev_name => this.element.addEventListener(ev_name, listener));
	},
    assign_style() {
        this.element.setAttribute('width', this.settings.style.width);
        this.element.setAttribute('height', this.settings.style.height);
        this.element.setAttribute('x', this.settings.style.x);
        this.element.setAttribute('y', this.settings.style.y);
        this.element.style.fill = this.settings.style.fillColor || 'transparent';
        this.element.style.stroke = this.settings.style.color || 'transparent';
        this.element.style.strokeWidth = this.settings.style.border || 0;
    },
	set_transform_origin() {
		this.element.style.transformOrigin = `${this.settings.transformOrigin[0] || 0}px ${this.settings.transformOrigin[1] || 0}px`;
	},
    set_transform() {
        this.element.setAttribute('transform', this.settings.transform || '');
    },
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
	destroy() {
		this.shadow.destroy();
        this.element.remove();
		Drawable.prototype.destroy.call(this);
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
            transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin')),
			transform: node.getAttribute('transform')
		},
		style: node.dataset['bindStyle'] && el.parser.parse(node.dataset['bindStyle']),
		event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
		transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
		transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin'])
	};
};

function Circle(attributes, context, scope, parent_settings) {
	Drawable.call(this);
    this.element = create_element('circle');
	this.attach_events();
    parent_settings.element.appendChild(this.element);
	this.attributes = attributes;
	this.settings = {
		style: this.make_default_style()
	};
	this.shadow = el.shadow.object(new Map([
		['style', el.shadow.value(context, scope, attributes.style, style => {
			this.destroy_guard();
            util.async.async(() => this.assign_style(), 'animate');
			if (style) {
				this.fill_defaults(style);
				return style;
			} else
				return this.make_default_style();
		})],
		['event', el.shadow.value(context, scope, attributes.event, event => {
			this.destroy_guard();
			return event;
		})],
		['transformOrigin', el.shadow.value(context, scope, attributes.transformOrigin, value => {
			this.destroy_guard();
			util.async.async(() => this.set_transform_origin());
			return value || attributes.settings.transformOrigin;
		})],
		['transform', el.shadow.value(context, scope, attributes.transform, value => {
			this.destroy_guard();
            util.async.async(() => this.set_transform(), 'animate');
			return value || this.attributes.settings.transform;
		})]
		]), this.settings);
}
util.inherit(Circle, Drawable, {
	attach_events() {
		var listener =
			e => this.shadow.get_shadow('event').invoke(e);
		['mousedown', 'mouseup', 'mousemove', 'mousein', 'mouseout', 'click'].forEach(
			ev_name => this.element.addEventListener(ev_name, listener));
	},
    assign_style() {
        this.element.setAttribute('cx', this.settings.style.x);
        this.element.setAttribute('cy', this.settings.style.y);
        this.element.setAttribute('r', this.settings.style.radius);
        this.element.style.stroke = this.settings.style.color;
        this.element.style.strokeWidth = this.settings.style.border;
        this.element.style.fill = this.settings.style.fillColor;
    },
	set_transform_origin() {
		this.element.style.transformOrigin = `${this.settings.transformOrigin[0] || 0}px ${this.settings.transformOrigin[1] || 0}px`;
	},
    set_transform() {
        this.element.setAttribute('transform', this.settings.transform || '');
    },
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
	destroy() {
		this.shadow.destroy();
        this.element.remove();
		Drawable.prototype.destroy.call(this);
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
            transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin')),
			transform: node.getAttribute('transform')
		},
		style: node.dataset['bindStyle'] && el.parser.parse(node.dataset['bindStyle']),
		event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
		transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
		transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin'])
	};
};

function Curve(attributes, context, scope, parent_settings) {
	Drawable.call(this);
    this.element = create_element('path');
	this.attach_events();
    parent_settings.element.appendChild(this.element);
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
            this.element.setAttribute('d', path);
			return path;
		})],
		['color', el.shadow.value(context, scope, attributes.bindings.color, value => {
			this.destroy_guard();
			return this.element.style.stroke = value || attributes.settings.color;
		})],
		['fillColor', el.shadow.value(context, scope, attributes.bindings.fillColor, value => {
			this.destroy_guard();
			return this.element.style.fill = value || attributes.settings.fillColor;
		})],
		['width', el.shadow.value(context, scope, attributes.bindings.width, value => {
			this.destroy_guard();
			return this.element.style.strokeWidth = value || attributes.settings.width;
		})],
		['event', el.shadow.value(context, scope, attributes.bindings.event, event => {
			this.destroy_guard();
			return event;
		})],
		['transformOrigin', el.shadow.value(context, scope, attributes.transformOrigin, value => {
			this.destroy_guard();
			util.async.async(() => this.set_transform_origin());
			return value || attributes.settings.transformOrigin;
		})],
		['transform', el.shadow.value(context, scope, attributes.bindings.transform, value => {
			this.destroy_guard();
            util.async.async(() => this.set_transform(), 'animate');
			return value || attributes.settings.transform;
		})]
		]), this.settings);
}
util.inherit(Curve, Drawable, {
	attach_events() {
		var listener =
			e => this.shadow.get_shadow('event').invoke(e);
		['mousedown', 'mouseup', 'mousemove', 'mousein', 'mouseout', 'click'].forEach(
			ev_name => this.element.addEventListener(ev_name, listener));
	},
	set_transform_origin() {
		this.element.style.transformOrigin = `${this.settings.transformOrigin[0] || 0}px ${this.settings.transformOrigin[1] || 0}px`;
	},
    set_transform() {
		this.element.setAttribute('transform', this.settings.transform || '');
    },
	destroy() {
		this.shadow.destroy();
        this.element.remove();
		Drawable.prototype.destroy.call(this);
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
            transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin')),
			transform: node.getAttribute('transform')
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
	Drawable.call(this);
    this.element = create_element('text');
	this.attach_events();
    parent_settings.element.appendChild(this.element);
	this.attributes = attributes;
	this.settings = {
		x: attributes.settings.x,
		y: attributes.settings.y,
		size: attributes.settings.size,
		font: attributes.settings.font,
		anchor: attributes.settings.anchor,
        color: attributes.settings.color
	};
	var get_font_style = this.get_font_style =
		() => `${this.settings.size}px ${this.settings.font}`;
	var get_text_size = () => this.settings.size;
	var get_text_width = () => {
        var transform = this.element.getAttribute('transform');
        this.element.setAttribute('transform', '');
        var width = this.element.getBBox().width;
        this.element.setAttribute('transform', transform);
		return width;
	};
	this.model = {
		$element: {
			textSize: 0,
			textWidth: 0,
			parentSettings: parent_settings
		}
	};
	Object.defineProperty(this.model.$element, 'textSize', {get: get_text_size});
	Object.defineProperty(this.model.$element, 'textWidth', {get: get_text_width});
	var sub_scope = new el.scope.Scope(this.model, scope);
	this.shadow = el.shadow.object(new Map([
		['size', el.shadow.value(context, scope, attributes.bindings.size, value => {
			this.destroy_guard();
			this.update_model();
			return value || attributes.settings.size;
		})],
		['font', el.shadow.value(context, scope, attributes.bindings.font, value => {
			this.destroy_guard();
            this.set_font();
			return value || attributes.settings.font;
		})],
        ['color', el.shadow.value(context, scope, attributes.bindings.color, value => {
            this.destroy_guard();
            return this.element.style.color = value || attributes.settings.color;
        })],
		['x', el.shadow.value(context, sub_scope, attributes.bindings.x, value => {
			this.destroy_guard();
            util.async.async(() => this.set_position(), 'animate');
			return value || attributes.settings.x;
		})],
		['y', el.shadow.value(context, sub_scope, attributes.bindings.y, value => {
			this.destroy_guard();
            util.async.async(() => this.set_position(), 'animate');
			return value || attributes.settings.y;
		})],
		['event', el.shadow.value(context, sub_scope, attributes.bindings.event, event => {
			this.destroy_guard();
			return event;
		})],
		['text', el.shadow.template(context, sub_scope, attributes.settings.text, value => {
			this.destroy_guard();
			util.async.async(() => this.set_text(), 'animate');
			return value;
		})],
		['transformOrigin', el.shadow.value(context, sub_scope, attributes.bindings.transformOrigin, value => {
			this.destroy_guard();
			util.async.async(() => this.set_transform_origin());
			return value || attributes.settings.transformOrigin;
		})],
		['transform', el.shadow.value(context, sub_scope, attributes.bindings.transform, value => {
			this.destroy_guard();
            util.async.async(() => this.set_transform());
			return value || attributes.settings.transform;
		})],
		['anchor', el.shadow.value(context, sub_scope, attributes.bindings.anchor, value => {
			this.destroy_guard();
			util.async.async(() => this.set_anchor(), 'animate');
			return value || attributes.settings.anchor;
		})]
		]), this.settings);
}
util.inherit(Text, Drawable, {
	attach_events() {
		var listener =
			e => this.shadow.get_shadow('event').invoke(e);
		['mousedown', 'mousemove', 'mouseup', 'mousein', 'mouseout', 'click'].forEach(
			ev_name => this.element.addEventListener(ev_name, listener));
	},
	set_anchor() {
		Array.prototype.forEach.call(this.element.children, tspan => {
			tspan.style.textAnchor = this.settings.anchor;
		});
	},
	set_text() {
		while (this.element.lastChild)
			this.element.lastChild.remove();
		// split text
		if (this.settings.text)
			this.settings.text.split('\n').map((text, index) => {
				var tspan = create_element('tspan');
				tspan.style.textAnchor = this.settings.anchor;
				tspan.textContent = text;
				tspan.setAttribute('x', 0);
				tspan.setAttribute('dy', index * this.settings.size);
				this.element.appendChild(tspan);
			});
		this.update_model();
	},
	set_position() {
		this.element.setAttribute('x', this.settings.x);
		this.element.setAttribute('y', this.settings.y);
		Array.prototype.forEach.call(this.element.children, tspan => {
			tspan.setAttribute('x', this.settings.x);
			tspan.setAttribute('y', this.settings.y);
		});
	},
    set_font() {
        this.element.style.font = this.get_font_style();
        this.update_model();
    },
	set_transform_origin() {
		this.element.style.transformOrigin = `${this.settings.transformOrigin[0] || 0}px ${this.settings.transformOrigin[1] || 0}px`;
	},
    set_transform() {
        this.element.setAttribute('transform', this.settings.transform || '');
    },
	update_model() {
		var notifier = Object.getNotifier(this.model.$element);
		notifier.notify({
			type: 'update',
			name: 'textSize'
		});
		notifier.notify({
			type: 'update',
			name: 'textWidth'
		});
	},
	destroy() {
		this.shadow.destroy();
        this.element.remove();
		Drawable.prototype.destroy.call(this);
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
            transformOrigin: parseTransformOrigin(node.getAttribute('transform-origin')),
			transform: node.getAttribute('transform'),
			anchor: node.getAttribute('anchor') || 'start',
            color: node.getAttribute('color') || 'black'
		},
		bindings: {
			x: node.dataset['bindX'] && el.parser.parse(node.dataset['bindX']),
			y: node.dataset['bindY'] && el.parser.parse(node.dataset['bindY']),
			size: node.dataset['bindSize'] && el.parser.parse(node.dataset['bindSize']),
			font: node.dataset['bindFont'] && el.parser.parse(node.dataset['bindFont']),
			event: node.dataset['bindEvent'] && el.parser.parse(node.dataset['bindEvent']),
			transform: node.dataset['bindTransform'] && el.parser.parse(node.dataset['bindTransform']),
			transformOrigin: node.dataset['bindTransformOrigin'] && el.parser.parse(node.dataset['bindTransformOrigin']),
			anchor: node.dataset['bindAnchor'] && el.parser.parse(node.dataset['bindAnchor']),
            color: node.dataset['bindColor'] && el.parser.parse(node.dataset['bindColor'])
		}
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
		return Shape.new_instance(attributes, context, scope, parent_settings);
	case 'text':
		return new Text(attributes, context, scope, parent_settings);
	}
}

function interpret_template (presenter, node) {
	switch(node.nodeName.toLowerCase()) {
	case 'relative-layout':
		return RelativeLayout.interpret(presenter, node);
	case 'template':
		return Template.interpret(presenter, node);
	case 'draw-box':
		return DrawBox.interpret(presenter, node);
	case 'shape':
		return Shape.interpret(presenter, node);
	case 'text':
		return Text.interpret(presenter, node);
	}
}

function interpret_root(presenter, template) {
	return Root.interpret(presenter, template);
}

function interpret_children(children, presenter) {
	return Array.from(children).map(node => interpret_template(presenter, node));
}

function bind(presenter, template, model) {
	return new Root(interpret_root(presenter, template), new el.scope.Scope(model));
}

return Object.freeze({
	Root: Root,
	bind: bind
});

});