define(['module_struct', 'presenter/presenter', 'util/util', 'el/el'],
function(module, presenter, util, el){
'use strict';

var _proxy = el.runtime.wrap_proxy;
function init() {
	var canvas;
	var vis_tpl;
	var presenter_control;

	var data = window.my_data = {
		objects: ['A', 'B', 'C'],
		values: [
			// year 0
			{
				'A': 30,
				'B': 25,
				'C': 10
			},
			// year 1
			{
				'A': 40,
				'B': 22,
				'C': 13
			}
		],
		values_labels: [
			'2008',
			'2011'
		],
		changes: [
			// diff between year 0 and 1
			{
				'A': {'B': 5, 'C': 2},	// outflows only
				'B': {'A': 3, 'C': 10},
				'C': {'A': 4, 'B': 5}
			}
		]
	};

	var graph = presenter.canvas2d.grapher.bar.RibbonBarGraph.instance();
	graph.load(my_data);
	var my_model = window.my_model = {
		value: 0,
		canvas_control: null,
		set canvas (target) {
			canvas = target;
		},
		get canvas () {return canvas;},
		set vis (tpl) {
			vis_tpl = tpl;
		},
		presenter: null,
		list: [
			{name: "10"}
		],
		getValue: function () {
			return this.value;
		},
		graph: graph.model,
		update_data () {
			el.runtime.notify({type:'update', target: data, name:'values'});
		},
		effects: {
			fadeOut (elements) {
				for (var element of elements)
					if (element.classList) {
						element.classList.add('fadeOut');
						element.addEventListener('transitionend', function(){this.remove()});
					} else
						element.remove();
			}
		}
	};

	this.model = my_model;
	this.initialize = function () {
		util.async.async(function () {
			presenter_control = presenter.canvas2d.Canvas2DPresenter.instance();
			presenter_control.bind(canvas.element, vis_tpl.element, my_model);
			_proxy(my_model).presenter = presenter_control.model;
		}, null, 'timeout');
		util.xhr({
			url: 'src/presenter/canvas2d/grapher/ribbon_bar.xml',
			method: 'get'
		}).then(template_string => {
			var tpl = document.createElement('template');
			_proxy(my_model).graph_template = {
				element: tpl
			};
			my_model.graph_template.element.innerHTML = template_string;
		});
	};
}

return module('mainApp', {
	dependency: [],
	instance: init
});

});
