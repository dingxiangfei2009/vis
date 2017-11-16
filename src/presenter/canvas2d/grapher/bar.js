define(['module_struct', 'el/el', 'compat/observe'],
function (module, el, _proxy) {
'use strict';

function RibbonBarGraph() {
	this.animation = {
		start_time: 0,
		handler: undefined,
		post_animation: undefined,
		animating: false
	};
	this.model = {
		settings: {
			global: {
				yAxisWidth: 20,
				xAxisHeight: 20,
				iterationProportion: 0.2,
				globalAlpha: 1,
				fadeInterval: 1000
			},
			xAxis: {
				widthProportion: 0.1
			},
			yAxis: {
				value_step: 50
			}
		},
		scale: {
			max: 100,
			calculateXAxis (iteration, iterationWidth) {
				return iterationWidth * (iteration + 0.5);
			},
			make_horizontal_lines (step) {
				var max = this.max;
				function *gen() {
					var value = 0;
					while (value < max) {
						yield value;
						value += step;
					}
				}
				return gen();
			}
		},
		setGraphAreaSetting (setting) {
			this.settings.graphArea = setting;
		},
		setHint (ribbon, event) {
			if (event.type !== 'mousemove')
				return ;
			clearTimeout(this.hint_erase_handler);
			_proxy(this.hint).showing = true;
			_proxy(this.hint).x = event.offsetX;
			_proxy(this.hint).y = event.offsetY;
			_proxy(this.hint).from = ribbon.left;
			_proxy(this.hint).to = ribbon.right;
			_proxy(this.hint).amount = ribbon.change;
			this.hint_erase_handler = setTimeout(() => {
				_proxy(this.hint).showing = false;
			}, 1800);
		},
		xAxis: {
			labels: []
		},
		yAxis: {
			labels: []
		},
		bars: null,
		hint: {
			showing: false,
			x: 0,
			y: 0,
			from: null,
			to: null,
			amount: null
		}
	};
	this.loaded = false;
};
RibbonBarGraph.prototype = {
	constructor: RibbonBarGraph,
	load(data_model) {
		if (this.data_scope_shadow_context)
			this.data_scope_shadow_context.destroy();
		this.data_scope_shadow_context = new el.shadow.ShadowContext;
		this.data_model = data_model;
		var data_scope = new el.scope.Scope(data_model);
		el.shadow.array(this.data_scope_shadow_context, data_scope, 'value in values',
			{
				all_proxy: values => this.animate_update_values(values),
				splice_proxy:
				(type, values, index, added, removed) =>
					this.animate_update_values_splice(type, values, index, added, removed)
			});
		this.loaded = true;
	},
	update_max() {
		_proxy(this.model.scale).max = 0;
		_proxy(this.model.scale).iteration = this.data_model.values.length;
		for (var value of this.data_model.values) {
			var sum = 0;
			for (var object of this.data_model.objects) {
				sum += value[object];
			}
			if (this.model.scale.max < sum) {
				_proxy(this.model.scale).max = sum;
			}
		}
		_proxy(this.model.scale).max *= 1 + 0.1;
	},
	update_values() {
		this.update_max();

		var bars = _proxy(this.model).bars = [];
		var iteration = 0;
		var base_values = [];
		for (var value of this.data_model.values) {
			var prefix_sum = 0;
			var suffix_sum = 0;
			var base = {};
			for (var object of this.data_model.objects) {
				suffix_sum += value[object];
				bars.push({
					iteration: iteration,
					topValue: suffix_sum,
					bottomValue: prefix_sum,
					color: [Math.random(),Math.random(),Math.random()]
				});
				base[object] = prefix_sum;

				prefix_sum = suffix_sum;
			}
			base_values.push(base);
			++iteration;
		}
		_proxy(this.model.xAxis).labels = this.data_model.values_labels;
		this.update_ribbons(base_values);
	},
	update_ribbons(base_values) {
		var iteration = 0;
		var ribbons = _proxy(this.model).ribbons = [];
		var inflow_sum = {};	//right
		var outflow_sum = {};	//left
		for (var change of this.data_model.changes) {
			for (var object of this.data_model.objects) {
				inflow_sum[object] = outflow_sum[object] = 0;
			}
			for (var object of this.data_model.objects)
				for (var otherObject of this.data_model.objects)
					if (object !== otherObject &&
						change[object] &&
						change[object][otherObject]) {
						ribbons.push({
							left: object,
							right: otherObject,
							change: change[object][otherObject],
							color: [Math.random(),Math.random(),Math.random()],
							iterationLeft: iteration,
							topValueLeft: outflow_sum[object] + change[object][otherObject]
							+ base_values[iteration][object],
							bottomValueLeft: outflow_sum[object]
							+ base_values[iteration][object],
							iterationRight: iteration + 1,
							topValueRight: inflow_sum[otherObject] + change[object][otherObject]
							+ base_values[iteration + 1][otherObject],
							bottomValueRight: inflow_sum[otherObject]
							+ base_values[iteration + 1][otherObject]
						});
						inflow_sum[otherObject] += change[object][otherObject];
						outflow_sum[object] += change[object][otherObject];
					}
			++iteration;
		}
	},
	fade_out(start_time, time) {
		var fade_time = this.model.settings.global.fadeInterval;
		if (time < start_time + fade_time) {
			_proxy(this.model.settings.global).globalAlpha =
				1 - (time - start_time) / fade_time;
			return true;
		}
	},
	start_animation() {
		this.stop_animation();
		this.start_animation_loop(
			(start_time, time) =>
				this.fade_out(start_time, time)
			,
			() => this.end_animation());
	},
	end_animation() {
		this.update_values();
		_proxy(this.model.settings.global).globalAlpha = 1;
	},
	animate_update_values() {
		if (this.loaded)
			this.start_animation();
		else
			this.end_animation();
	},
	animate_update_values_splice(type, values, index, added, removed) {
		if (type === 'splice') {
			if (this.loaded)
				this.start_animation();
			else
				this.end_animation();
		} else if (index && Number.isFinite(index)) {
			if (this.loaded)
				this.start_animation();
			else
				this.end_animation();
		}
	},
	stop_animation() {
		if (this.animation.animating) {
			cancelAnimationFrame(this.animation.handler);
			this.animation.animating = false;
			this.animation.handler = undefined;
			this.animation.post_animation();
		}
	},
	start_animation_loop(animation_effect, post_animation) {
		// fade out effect
		this.animation.animating = true;
		this.animation.start_time = performance.now();
		this.animation.post_animation = post_animation;
		var handler = time => {
			// animation settings
			if (animation_effect(this.animation.start_time, time)) {
				this.animation.handler = requestAnimationFrame(handler);
			} else {
				this.stop_animation();
			}
		};
		handler(this.animation.start_time);
	}
};

return Object.freeze({
	RibbonBarGraph:
		module('presenter.canvas2d.grapher.RibbonBarGraph', {instance: RibbonBarGraph})
});

});
