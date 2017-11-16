define(['module_struct', './layout', 'util/util'],
function(module, layout, util) {
'use strict';

function SVGPresenterImpl() {
	this.model = {
		painter: timestamp => this.refresh(timestamp),
		event: {/* empty */}
	};
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
	this.dirty = false;
}

Object.assign(SVGPresenterImpl.prototype, {
	bind(target, template, model) {
		if (this.layout)
			this.layout.destroy();
		this.canvas = target;
        this.canvas.appendChild(this.defs);
		this.layout = layout.bind(this, template, model);
	},
	refresh(timestamp) {
		this.layout.refresh(timestamp);
	},
	resize() {
		this.layout.setSize(this.target.width, this.target.height);
	},
	requestRefresh() {
		util.async(timestamp => this.refresh(timestamp), 'animate');
	},
	destroy() {
		if (this.layout)
			this.layout.destroy();
	},
    register_def(element) {
        this.defs.appendChild(element);
    },
    remove_def(element) {
        this.element.remove();
    }
});

var SVGPresenter = module('SVGPresenter', {instance: SVGPresenterImpl});

return Object.freeze({
	SVGPresenter: SVGPresenter
});

});