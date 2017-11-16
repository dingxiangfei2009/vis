define(['module_struct', 'el/el'], function (module, el) {
'use strict';

class NetworkChart {
	constructor() {
		this.model = {
			sprites: [],
			drawSprite (sprite) {},
			nodes: []
		};
		this.sprites = new Map([
			['movingStar', document.createElement('canvas')]
		]);
		this.watches = [];
	}
	load (data_model) {
		this.watches.forEach(watch => watch.unwatch());
		this.watches.length = 0;
		var scope = new el.scope.Scope(data_model);
		this.data_model = data_model;
		this.watches.push(el.watch(el.parser.parse('node in nodes'), scope,
			collection => this.update_nodes(collection)));
		this.watches.push(el.watch(el.parser.parse('edge in edges'), scope,
			collection => this.update_edges(collection)));
	}
	update_nodes(nodes) {
		this.model.nodes = nodes.map(node => {
			return {
				x: node.x,
				y: node.y,
				radius: node.radius,
				id: node.id
			};
		});
		update_edges(this.data_model.edges);
	}
	update_edges(edges) {
		this.model.edges = edges.map(edge => {});
	}
}

return {
	NetworkChart: module('presenter.canvas2d.grapher.network', {instance: NetworkChart})
};
});
