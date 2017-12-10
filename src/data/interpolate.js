define(['util/util', 'el/el'],
function(util, el) {
'use strict';

var interpolate =
	el.runtime.evaluate(el.compile(
		el.parser.parse(
`(\\...expr => (
	force_expr = \${expr >>= (\\x => x^ || 0)};
	initial = force_expr!;
	mode = *.traits.IDENTITY_FUNCTION;
	functor = (\\ x, y => y);
	start = end = *.traits.EMPTY_FUNCTION;
	delay = 0;
	duration = 1000;
	transition = @{ {{
		current: \${initial},
		update: void(),
		last: \${initial},
		start_time: *.util.now()
		}} (
			@(functor_call = \${
				functor((current_time^ - start_time^ - delay) / duration,
					...[0..expr.length^] | *.stream.evaluate^
					>>= (\\ index =>
						mix^(
							last[index]^,
							current[index]^,
							mode((current_time^ - start_time^ - delay) / duration)
				)))
			}, void());
			current_time = *.util.now();
			current.some((\\ value, index => value neq (expr[index] || 0))) && (
				last = last.map(
					(\\ value, index =>
						(start_time + delay + duration < current_time)^ ?
							current[index]^
						: (start_time + delay < current_time)^ ?
							mix(
								value,
								current[index],
								mode((current_time - start_time - delay) / duration))^
						: value^)
				);
				current = force_expr!;
				start_time = current_time;
				start(...force_expr);
			);
			(start_time + delay + duration < current_time)^ ? (
				last = force_expr!;
				end(...force_expr);
				functor(1, ...force_expr);
			) : (
				*.async((\\=>#update), 'animate');
				(start_time + delay < current_time)^ ?
					@(
						update,
						force_expr!,
						functor_call^
					)
				: @(
					update,
					force_expr!,
					functor(0, ...last));
			);
		)
	};
	control = {
		with: (\\ x =>( mode = x; control; )),
		functor: (\\ x =>( functor = x; control; )),
		start: (\\ x =>( start = x; control; )),
		end: (\\ x =>( end = x; control; )),
		delay: (\\ x =>( delay = x; control; )),
		duration: (\\ x =>( duration = x; control; )),
		initial: (\\ ...x =>( initial = x; control; )),
		transition: transition
	};
	control;
))`)),
		new el.scope.Scope({
			mix(a,b,t) {
				return (1-t)*a + t*b;
			}})).value;

Object.assign(interpolate, {
	linear: util.traits.IDENTITY_FUNCTION,
	cubic_bezier: util.math.cubic_bezier
});

el.standard.extend('interpolate', interpolate);

return interpolate;

});
