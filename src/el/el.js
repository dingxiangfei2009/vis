define([
	'./el_eval', './el_watch', './parser', './el_const',
	'./scope', './shadow', './template', './standard', './extension'],
function(eval, watch, parser, CONST, scope, shadow, template, standard) {

return {
	watch: watch,
	eval: eval,
	parser: parser,
	template: template,
	CONST: CONST,
	scope: scope,
	shadow: shadow,
	standard: standard
};

});
