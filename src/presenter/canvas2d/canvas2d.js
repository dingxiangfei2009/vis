define(['module_struct', 'util/util', './layout', './grapher/grapher'],
function (module, util, layout, grapher) {
'use strict';

var SAFE_CONTEXTS = new WeakMap;
var SAFE_CONTEXT_STACK = new WeakMap;

function SafeCanvasRendering2DContext(context) {
	SAFE_CONTEXTS.set(this, context);
	SAFE_CONTEXT_STACK.set(this, 0);
}

SafeCanvasRendering2DContext.prototype = {
	constructor: SafeCanvasRendering2DContext,
	/* All properties and methods */
	get fillStyle() {return SAFE_CONTEXTS.get(this).fillStyle;},
	set fillStyle(x) {return SAFE_CONTEXTS.get(this).fillStyle = x;},
	get font() {return SAFE_CONTEXTS.get(this).font;},
	set font(x) {return SAFE_CONTEXTS.get(this).font = x;},
	get globalAlpha() {return SAFE_CONTEXTS.get(this).globalAlpha;},
	set globalAlpha(x) {return SAFE_CONTEXTS.get(this).globalAlpha = x;},
	get globalCompositeOperation() {return SAFE_CONTEXTS.get(this).globalCompositeOperation;},
	set globalCompositeOperation(x) {return SAFE_CONTEXTS.get(this).globalCompositeOperation = x;},
	get lineCap() {return SAFE_CONTEXTS.get(this).lineCap;},
	set lineCap(x) {return SAFE_CONTEXTS.get(this).lineCap = x;},
	get lineDashOffset() {return SAFE_CONTEXTS.get(this).lineDashOffset;},
	set lineDashOffset(x) {return SAFE_CONTEXTS.get(this).lineDashOffset = x;},
	get lineJoin() {return SAFE_CONTEXTS.get(this).lineJoin;},
	set lineJoin(x) {return SAFE_CONTEXTS.get(this).lineJoin = x;},
	get lineWidth() {return SAFE_CONTEXTS.get(this).lineWidth;},
	set lineWidth(x) {return SAFE_CONTEXTS.get(this).lineWidth = x;},
	get miterLimit() {return SAFE_CONTEXTS.get(this).miterLimit;},
	set miterLimit(x) {return SAFE_CONTEXTS.get(this).miterLimit = x;},
	get shadowBlur() {return SAFE_CONTEXTS.get(this).shadowBlur;},
	set shadowBlur(x) {return SAFE_CONTEXTS.get(this).shadowBlur = x;},
	get strokeStyle() {return SAFE_CONTEXTS.get(this).strokeStyle;},
	set strokeStyle(x) {return SAFE_CONTEXTS.get(this).strokeStyle = x;},
	get textAlign() {return SAFE_CONTEXTS.get(this).textAlign;},
	set textAlign(x) {return SAFE_CONTEXTS.get(this).textAlign = x;},
	get textBaseline() {return SAFE_CONTEXTS.get(this).textBaseline;},
	set textBaseline(x) {return SAFE_CONTEXTS.get(this).textBaseline = x;},
	arc(x, y, radius, startAngle, endAngle, anticlockwise) {return SAFE_CONTEXTS.get(this).arc(x, y, radius, startAngle, endAngle, anticlockwise);},
	arcTo(x1, y1, x2, y2, radius) {return SAFE_CONTEXTS.get(this).arcTo(x1, y1, x2, y2, radius);},
	beginPath() {return SAFE_CONTEXTS.get(this).beginPath();},
	bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {return SAFE_CONTEXTS.get(this).bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);},
	clearRect() {return SAFE_CONTEXTS.get(this).clearRect();},
	clip(...args) {return SAFE_CONTEXTS.get(this).clip(...args);},
	closePath() {return SAFE_CONTEXTS.get(this).closePath();},
	createImageData(...args) {return SAFE_CONTEXTS.get(this).createImageData(...args);},
	createLinearGradient(x0, y0, x1, y1) {return SAFE_CONTEXTS.get(this).createLinearGradient(x0, y0, x1, y1);},
	createPattern(image, repetition) {return SAFE_CONTEXTS.get(this).createPattern(image, repetition);},
	createRadialGradient(x0, y0, r0, x1, y1, r1) {return SAFE_CONTEXTS.get(this).createRadialGradient(x0, y0, r0, x1, y1, r1);},
	drawFocusIfNeeded(...args) {return SAFE_CONTEXTS.get(this).drawFocusIfNeeded(...args);},
	drawImage(...args) {return SAFE_CONTEXTS.get(this).drawImage(...args);},
	drawImage(...args) {return SAFE_CONTEXTS.get(this).drawImage(...args);},
	fill(...args) {return SAFE_CONTEXTS.get(this).fill(...args);},
	fillRect(x, y, width, height) {return SAFE_CONTEXTS.get(this).fillRect(x, y, width, height);},
	fillText(...args) {return SAFE_CONTEXTS.get(this).fillText(...args);},
	getImageData(sx, sy, sw, sh) {return SAFE_CONTEXTS.get(this).getImageData(sx, sy, sw, sh);},
	getLineDash() {return SAFE_CONTEXTS.get(this).getLineDash();},
	isPointInPath(...args) {return SAFE_CONTEXTS.get(this).isPointInPath(...args);},
	isPointInStroke(...args) {return SAFE_CONTEXTS.get(this).isPointInStroke(...args);},
	lineTo(x, y) {return SAFE_CONTEXTS.get(this).lineTo(x, y);},
	measureText(text) {return SAFE_CONTEXTS.get(this).measureText(text);},
	moveTo(x, y) {return SAFE_CONTEXTS.get(this).moveTo(x, y);},
	putImageData(...args) {return SAFE_CONTEXTS.get(this).putImageData(...args);},
	quadraticCurveTo(cpx, cpy, x, y) {return SAFE_CONTEXTS.get(this).quadraticCurveTo(cpx, cpy, x, y);},
	rect(x, y, width, height) {return SAFE_CONTEXTS.get(this).rect(x, y, width, height);},
	restore() {
		var stack_height = SAFE_CONTEXT_STACK.get(this);
		if (stack_height) {
			SAFE_CONTEXT_STACK.set(this, stack_height - 1);
			SAFE_CONTEXTS.get(this).restore();
		}
	},
	resetTransform() {
		var stack_height = SAFE_CONTEXT_STACK.get(this);
		for (var i = 0; i < stack_height; ++i)
			this.restore();
	},
	rotate(angle) {return SAFE_CONTEXTS.get(this).rotate(angle);},
	save() {
		var stack_height = SAFE_CONTEXT_STACK.get(this);
		SAFE_CONTEXT_STACK.set(this, stack_height + 1);
		SAFE_CONTEXTS.get(this).save();
	},
	scale(x, y) {return SAFE_CONTEXTS.get(this).scale(x, y);},
	setLineDash(segments) {return SAFE_CONTEXTS.get(this).setLineDash(segments);},
	setTransform(a, b, c, d, e, f) {return SAFE_CONTEXTS.get(this).setTransform(a, b, c, d, e, f);},
	stroke(...args) {return SAFE_CONTEXTS.get(this).stroke(...args);},
	strokeRect(x, y, width, height) {return SAFE_CONTEXTS.get(this).strokeRect(x, y, width, height);},
	strokeText(...args) {return SAFE_CONTEXTS.get(this).strokeText(...args);},
	transform(a, b, c, d, e, f) {return SAFE_CONTEXTS.get(this).transform(a, b, c, d, e, f);},
	translate(x, y) {return SAFE_CONTEXTS.get(this).translate(x, y);}
};

function Canvas2DDrawingContext_Impl(context, canvas) {
	this.context = context;
	this.canvas = canvas;
}
Canvas2DDrawingContext_Impl.prototype.updateTimestamp =
function (timestamp) {
	this.timestamp = timestamp || performance.now();
};

Canvas2DDrawingContext_Impl.prototype.getSafeDelegate =
function () {
	// TODO we are still waiting from Proxy on chrome
	if (this.safe)
		return this;
	return Object.defineProperties(
		new Canvas2DDrawingContext_Impl(new SafeCanvasRendering2DContext(this.context), null),
		{
			safe: {value: true, enumerable: true},
			reset: {value: function() {this.context.resetTransform();}, enumerable: true}
		});
};

function Canvas2DPresenter_Impl() {
	var event_handler = event => this.layout.event(event);
	this.model = {
		painter: timestamp => this.painter(timestamp),
		event: {
			$event: {
				mousedown: event_handler,
				mousemove: event_handler,
				mouseup: event_handler
			}
		}
	};
	this.dirty = false;
}
Canvas2DPresenter_Impl.prototype = {
	constructor: Canvas2DPresenter_Impl,
	bind(target, template, data_model) {
		this.canvas = target;
		this.context = target.getContext('2d');
		this.template = template;
		this.drawing_context = new Canvas2DDrawingContext_Impl(this.context, target);
		this.layout = layout.bind(this, template, data_model);
	},

	painter(timestamp) {
		this.drawing_context.updateTimestamp(timestamp);
		if (this.layout)
			this.layout.refresh(this.drawing_context);
		this.dirty = false;
	},

	resize() {
		this.layout.setSize(this.canvas.width, this.canvas.height);
		this.requestRefresh();
	},

	requestRefresh() {
		if (!this.dirty) {
			util.async.async(()=>this.painter(), 'animate');
			this.dirty = true;
		}
	},

	destroy() {
		if (this.layout)
			this.layout.destroy();
	}
};

var Canvas2DPresenter = module('presenter.canvas2d.Canvas2DPresenter', {
	dependency: [],
	instance: Canvas2DPresenter_Impl,
	configure: function () {}
});

return {
	layout: layout,
	grapher: grapher,
	Canvas2DPresenter: Canvas2DPresenter
};

});
