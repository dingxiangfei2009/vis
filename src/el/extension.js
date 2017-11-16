define(['./standard', './parser', './el_eval', './scope'],
function(standard, parser, $eval, scope) {
'use strict';

standard.extend(
	'to_object',
	$eval.evaluate_el(
		parser.parse(
			`
(\\ map => @(
	o = {},
	map.forEach((\\ v, k => @(
		o[k^] = v^
		))),
	o^
));
			`
		), new scope.Scope).value);

standard.extend(
	'new',
	function (CONSTRUCTOR, ...args) {
		return new CONSTRUCTOR(...args);
	});

standard.extend(
	'object_map',
	$eval.evaluate_el(
		parser.parse(`
(\\ map => @{
	{null}
	map >>= (\\ x => @!{x^})
})
		`), new scope.Scope).value);
	
standard.extend(
	'stateful_event',
	$eval.evaluate_el(
		parser.parse(`
(\\ f, state =>
	(\\ e => (
		state = f(e, state);
	))
)
		`), new scope.Scope).value);

});