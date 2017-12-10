define([
	'./compile', './runtime', './el_watch', './parser', './el_const',
	'./scope', './shadow', './template', './standard', './future',
	'./extension'],
function(compile, runtime, watch, parser, CONST, scope, shadow, template,
	standard, future) {

return {
	watch: watch,
	parser: parser,
	template: template,
	CONST: CONST,
	scope: scope,
	shadow: shadow,
	standard: standard,
	runtime: runtime,
	compile: compile,
	future: future
};

});
