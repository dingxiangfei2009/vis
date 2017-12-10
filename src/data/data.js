define(['el/el', 'util/util', './interpolate'],
function(el, util) {
'use strict';

var _proxy = el.runtime.wrap_proxy;

function Aggregate(context, scope, collection, options) {
	options = Object.assign({
		compare: (x, y) => (x > y) - (x < y),
		equal: (x, y) => x === y,
		left_fold: (a,b) => a + b,
		right_fold: (a,b) => a + b,
		left_fold_initial: 0,
		right_fold_initial: 0
	}, options);
	var self = this;
	var sum = 0;
	var count = 0;
	var prefix_sum = [];
	var suffix_sum = [];

	this.model = {
		min: 0,
		max: 0,
		sum: 0,
		count: 0,
		average: 0,
		prefix_sum: prefix_sum,
		suffix_sum: suffix_sum
	};

	function calculateAggregates(shadowed) {
		var min = shadowed[0];
		var max = shadowed[0];
		var $suffix_sum = _proxy(suffix_sum);
		var $prefix_sum = _proxy(prefix_sum);
		var $model = _proxy(self.model);
		$suffix_sum.length = $prefix_sum.length = shadowed.length;
		var left_fold_initial =
			util.traits.is_function(options.left_fold_initial) ?
				options.left_fold_initial() : options.left_fold_initial;
		for (var i = 0, end = shadowed.length, s = left_fold_initial; i < end; ++i) {
			if (options.compare(min, shadowed[i]) > 0)
				min = shadowed[i];
			if (options.compare(shadowed[i], max) > 0)
				max = shadowed[i];
			$prefix_sum[i] = s = options.left_fold(s, shadowed[i]);
		}
		var right_fold_initial =
			util.traits.is_function(options.right_fold_initial) ?
				options.right_fold_initial() : options.right_fold_initial;
		for (var i = shadowed.length - 1, s = right_fold_initial; i >= 0; --i)
			$suffix_sum[i] = s = options.right_fold(s, shadowed[i]);
		var count = shadowed.length;
		var sum = prefix_sum[prefix_sum.length - 1];
		$model.min = min;
		$model.max = max;
		$model.count = count;
		$model.sum = sum;
		$model.average = sum / count;
	}

	this.shadow = new el.shadow.array(context, scope, collection, {
		*splice_change(collection, shadowed) {
			while (true) {
				var change = yield true;
				var n;
				if (change)
					switch (change.operation) {
					case 'update':
						yield change.value;
						break;
					case 'create':
						yield change.value;
						break;
					case 'destroy':
						yield true;
						break;
					default:
						return calculateAggregates(shadowed);
					}
				else
					return calculateAggregates(shadowed);
			}
		}
	});
}

Object.assign(Aggregate.prototype, {
	destroy() {
		this.shadow.destroy();
	}
});

Aggregate.COLLECTION_EXPRESSION = el.parser.parse('collection');

return Object.freeze({
	Aggregate: Aggregate
});

});
