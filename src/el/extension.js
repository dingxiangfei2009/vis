define(['./standard', './parser', './compile', './runtime', './scope'],
function(standard, parser, compile, runtime, scope) {
'use strict';

function compile_and_execute(expression_string) {
	return runtime.evaluate(
		compile(
			parser.parse(expression_string)),
			new scope.Scope)
	.value;
}

standard.extend(
	'to_object',
	compile_and_execute(
			String.raw `
(\ map => @(
	o = {},
	map.forEach((\ v, k => @(
		o[k^] = v^
		))),
	o^
));
			`
		));

standard.extend(
	'new',
	function (CONSTRUCTOR, ...args) {
		return new CONSTRUCTOR(...args);
	});

standard.extend(
	'object_map',
	compile_and_execute(
		String.raw `
(\ map => @{
	{null}
	map >>= (\ x => @!{x^})
})
		`
	));

standard.extend(
	'stateful_event',
	compile_and_execute(
		String.raw `
(\ f, state =>
	(\ e => (
		state = f(e, state);
	))
)
		`
	));

});
