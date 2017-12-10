define(['util/util', './el_const'], function (util, CONST) {
'use strict';

var $$$ = Object.freeze;

var STANDARD = {
	instance(type, ...args) {
		return new type(...args);
	},
	type: $$$({
		Array: Array,
		Object: Object,
		Symbol: Symbol,
		Number: Number,
		Boolean: Boolean,
		String: String,
		Map: Map,
		Set: Set
	}),
	escape(o) {
		return {
			[CONST.ESCAPE_PROXY]: o
		};
	},
	math: $$$(util.math),
	util: $$$({
		rgba (r,g,b,a) {
			return `rgba(${0|r * 255},${0|g * 255},${0|b * 255},${a})`;
		},
		rgb (r,g,b) {
			return `rgb(${0|r * 255},${0|g * 255},${0|b * 255})`;
		},
		hsl (h,s,l) {
			return `hsl(${h},${s}%,${l}%)`;
		},
		hsla (h,s,l,a) {
			return `hsl(${h},${s}%,${l}%,${a})`;
		},
		string_template() {
			var value = '';
			for (var i = 0, end = arguments.length; i < end; ++i)
				value += arguments[i];
			return value;
		},
		log: console.log.bind(console),
		now () {
			return performance.now();
		},
		debug: function() {debugger;}
	}),
	tee(functor, value) {
		functor(value);
		return value;
	},
	stream: $$$({
		iterate (container) {
			return function *() {
				yield *container;
			};
		},
		evaluate (limit, stream, ...args) {
			var result = [];
			var count = 0;
			if (!util.traits.is_number(limit)) {
				stream = limit;
				limit = Infinity;
			}
			for (var value of stream(...args)) {
				if (count > limit) break;
				result.push(value);
				++count;
			}
			return result;
		},
		map (functor, stream) {
			return function *(...args) {
				var gen = stream(...args);
				for (var value of gen)
					yield functor(value);
			};
		},
		fold_left (functor, zero, stream, ...args) {
			var result = zero;
			for (var value of stream(args))
				result = functor(result, value);
			return result;
		},
		filter (functor, stream) {
			return function *(...args) {
				var gen = stream(...args);
				for (var value of gen)
					if (functor(value))
						yield value;
			};
		},
		some (functor, stream, ...args) {
			for (var value of stream(...args)) {
				var result = functor(value);
				if (result)
					return result;
			}
		},
		slice (begin, length, stream) {
			if (!util.traits.is_number(length)) {
				stream = length;
				length = Infinity;
			}
			return function *(...args) {
				var gen = stream(...args);
				var count;
				var value;
				for (count = 0; count < begin; ++count) {
					value = gen.next();
					if (value.done) return;
				}
				for (count = 0; !(count >= length); ++count) {
					value = gen.next();
					if (value.done)
						return;
					else
						yield value.value;
				}
			};
		},
		zip (functor, ...streams) {
			return function *(...args) {
				var gens = [];
				for (var i = 0, end = streams.length; i < end; ++i) {
					var stream = streams[i];
					if (args[i])
						gens.push(stream());
					else
						gens.push(stream(...args[i]));
				}
				while (true) {
					var parameters = [];
					var done = true;
					for (var i = 0, end = gens.length; i < end; ++i) {
						var value = gens[i].next();
						done &= value.done;
						parameters.push(value.value);
					}
					if (done)
						return;
					else
						yield functor(...parameters);
				}
			};
		},
		truncate(functor, stream) {
			return function *(...args) {
				var gen = stream(...args);
				for (var value of gen)
					if (functor(value))
						yield value;
					else
						return;
			};
		},
		concat(...streams) {
			return function *(...args) {
				var argc = 0;
				for (var stream of streams) {
					if (args[argc])
						yield *stream();
					else
						yield *stream(...args[argc]);
					++argc;
				}
			};
		}
	}),
	animate: util.stream_animate,
	traits: util.traits,
	async: util.async.async
};

for (var key in STANDARD)
	Object.defineProperty(STANDARD, key, {
		enumerable: true,
		value: STANDARD[key]
	});

return $$$({
	extend(name, lib) {
		return STANDARD[name] = lib;
	},
	library: STANDARD
});

});
