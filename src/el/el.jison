/* lex grammar for expression language */
/* this grammar must be parsed with jison, in amd.js format */

%lex
%%

\s+								/* skip spaces */
\/\*([^*]+|(\*[^/])+)*\*\/		/* skip comments */
\"(\\.|[^"])*\"					return 'STR'
\'(\\.|[^'])*\'					return 'STR'
[0-9]*"."[0-9]+\b				return 'NUM'
[0-9]+("."[0-9]+)?((e|E)(\+|-)?[0-9]+)?\b			return 'NUM'
"Infinity"						return 'INF'
"NaN"							return 'NAN'
"true"							return 'T'
"false"							return 'F'
"<=>"							return '<=>'
">>="							return '>>='
"->"							return '->'
"=>"							return '=>'
"*"								return '*'
"/"								return '/'
"+"								return '+'
"-"								return '-'
"!#"							return '!#'
"!"								return '!'
"#"								return '#'
"and"							return '&&'
"&&"							return '&&'
"or"							return '||'
"||"							return '||'
"gt"							return '>'
">"								return '>'
"lt"							return '<'
"<"								return '<'
"ge"							return '>='
">="							return '>='
"le"							return '<='
"<="							return '<='
"eq"							return '==='
"==="							return '==='
"neq"							return '!=='
"!=="							return '!=='
"?"								return '?'
":"								return ':'
"mod"							return '%'
"%"								return '%'
"("								return '('
")"								return ')'
"|"								return '|'
"["								return '['
"]"								return ']'
"..."							return '...'
".."							return '..'
"."								return '.'
","								return ','
"delete"						return 'DELETE'
"void"							return 'VOID'
"undefined"						return 'UNDEF'
"return"						return 'RET'
"in"							return 'IN'
"@@@"							return '@@@'
"@{"							return '@{'
"@@"							return '@@'
"@"								return '@'
"{"								return '{'
"${"							return '${'
"}"								return '}'
"\\"							return '\'
";"								return ';'
"="								return '='
"^^"							return '^^'
"^"								return '^'
[_$A-Za-z\xA0-\uFFFF][_$A-Za-z0-9\xA0-\uFFFF]*		return 'IDENT'
<<EOF>>							return 'EOF'

/lex
%left '=>'
%left '|' '>>='
%left 'RET'
%left '->'
%left '?' ':'
%left '||'
%left '&&'
%left '>' '<' '>=' '<=' '===' '!==' '<=>'
%left '+' '-'
%right '%'
%left '*' '/'
%left '!#' '#' '!' UNARY_OP
%left '.' '[' ']'
%left '(' ')'
%left '^' 'DELETE'
%left '^^'
%left UMINUS

%start top_expression

%%

top_expression
	: expression EOF
		{return $1;}
	| iteration_expression EOF
		{return $1;}
	| sequence_expression EOF
		{return $1;}
	;

expression
	: pipe_expression
		{$$ = $1;}

	| expression '>>=' expression
		{$$ = {
			type: 'bind',
			value: $1,
			functor: $3
		};}

	| 'RET' '(' expression ',' expression ')'
		{$$ = {
			type: 'return',
			container: $3,
			value: $5
		};}

	| promise_expression
		{$$ = $1;}

	| arithmetic_expression
		{$$ = $1;}

	| expression '?' expression ':' expression
		{$$ = {
			type: 'conditional',
			condition: $1,
			consequent: $3,
			alternative: $5
		};}

	| access_expression
		{$$ = $1;}

	| '(' expression ')'
		{$$ = $2;}

	| expression '!'
		{$$ = {
			type: 'force',
			value: $1
		};}

	| '@' '!' '{' expression '}'
		{$$ = {
			type: 'evaluate_substitue',
			value: $4
		};}

	| expression '^'
		{$$ = {
			type: 'force_primitive',
			value: $1
		};}

	| application_expression
		{$$ = $1;}

	| primary_expression
		{$$ = $1;}

	| boolean_expression
		{$$ = $1;}

	| literal_expression
		{$$ = $1;}

	| object_expression
		{$$ = $1;}

	| arrow_function_expression
		{$$ = $1;}

	| select_last_value_expression
		{$$ = $1;}

	| el_expression
		{$$ = $1;}

	| '(' sequence_expression ')'
		{$$ = $2;}

	| '`' embedded_string_expression '`'
		{$$ = $2;}

	| 'DELETE' expression
		{$$ = {
			type: 'delete',
			value: $2
		};}

	| '#' expression
		{$$ = {
			type: 'touch',
			value: $2
		};}

	| '!#' expression
		{$$ = {
			type: 'negative_touch',
			value: $2
		};}
	;

arithmetic_expression
	: expression '+' expression
		{$$ = attempt_compress({
			type: 'add',
			left: $1,
			right: $3
		});}

	| expression '-' expression
		{$$ = attempt_compress({
			type: 'sub',
			left: $1,
			right: $3
		});}

	| expression '*' expression
		{$$ = attempt_compress({
			type: 'mul',
			left: $1,
			right: $3
		});}

	| expression '/' expression
		{$$ = attempt_compress({
			type: 'div',
			left: $1,
			right: $3
		});}

	| expression '%' expression
		{$$ = attempt_compress({
			type: 'mod',
			left: $1,
			right: $3
		});}

	| expression '<=>' expression
		{$$ = attempt_compress({
			type: 'cmp',
			left: $1,
			right: $3
		});}

	| '-' expression %prec UNARY_OP
		{$$ = attempt_compress({
			type: 'neg',
			value: $2
		});}
	;

iteration_expression
	: 'IDENT' 'IN' expression
		{$$ = {
			type: 'iterate',
			element: $1,
			collection: $3
		};}
	| 'IDENT' ',' 'IDENT' 'IN' expression
		{$$ = {
			type: 'iterate',
			element: $1,
			index: $3,
			collection: $5
		};}
	| 'IDENT' ',' 'IDENT' ',' 'IDENT' 'IN' expression
		{$$ = {
			type: 'iterate',
			element: $1,
			index: $3,
			reference: $5,
			collection: $7
		};}
	;

access_expression
	: expression '[' expression ']'
		{$$ = {
			type: 'access',
			left: $1,
			right: $3
		};}

	| expression '.' 'IDENT'
		{$$ = {
			type: 'access',
			left: $1,
			right: $3
		};}

	| expression '.' '*'
		{$$ = {
			type: 'all_properties',
			value: $1
		};}

	| expression '[' '*' ']'
		{$$ = {
			type: 'all_properties',
			value: $1
		};}

	| '*' '.' 'IDENT'
		{$$ = {
			type: 'global_access',
			name: $3
		};}

	| '*' '[' expression ']'
		{$$ = {
			type: 'global_access',
			value: $3
		};}

	| '@' '[' expression ']'
		{$$ = {
			type: 'computed_identifier',
			value: $3
		};}
	;

pipe_expression
	: expression '|' expression
		{$$ = {
			type: 'pipe',
			left: $1,
			right: $3
		};}
	| expression '!' '|' expression
		{$$ = {
			type: 'pipe',
			left: $1,
			right: $4,
			force: true
		};}
	| '(' expression ',' expression_list ')' '|' expression %prec '|'
		{$$ = {
			type: 'list_pipe',
			left: flatten([$2, $4]),
			right: $7
		};}
	| '(' expression ',' expression_list ')' '!' '|' expression %prec '|'
		{$$ = {
			type: 'list_pipe',
			left: flatten([$2, $4]),
			right: $8,
			force: true
		};}
	;

promise_expression
	: expression '->' expression ':' expression
		{$$ = {
			type: 'promise',
			promise: $1,
			resolve: $3,
			reject: $5
		};}

	| expression '->' expression
		{$$ = {
			type: 'promise',
			promise: $1,
			resolve: $3
		};}
	;

boolean_expression
	: expression '&&' expression
		{$$ = attempt_compress({
			type: 'and',
			left: $1,
			right: $3
		});}

	| expression '||' expression
		{$$ = attempt_compress({
			type: 'or',
			left: $1,
			right: $3
		});}

	| expression '>' expression
		{$$ = attempt_compress({
			type: 'gt',
			left: $1,
			right: $3
		});}

	| expression '>=' expression
		{$$ = attempt_compress({
			type: 'ge',
			left: $1,
			right: $3
		});}

	| expression '<' expression
		{$$ = attempt_compress({
			type: 'lt',
			left: $1,
			right: $3
		});}

	| expression '<=' expression
		{$$ = attempt_compress({
			type: 'le',
			left: $1,
			right: $3
		});}

	| expression '===' expression
		{$$ = attempt_compress({
			type: 'eq',
			left: $1,
			right: $3
		});}

	| expression '!==' expression
		{$$ = attempt_compress({
			type: 'neq',
			left: $1,
			right: $3
		});}

	| '!' expression
		{$$ = attempt_compress({
			type: 'bool_neg',
			value: $2
		});}
	;

application_expression
	: expression '(' curry_parameter_list ')'
		{$$ = {
			type: 'apply',
			functor: $1,
			parameters: flatten($3)
		};}
	| expression '!' '(' curry_parameter_list ')'
		{$$ = {
			type: 'apply',
			functor: $1,
			parameters: flatten($4),
			force: true
		};}
	| expression '(' ')'
		{$$ = {
			type: 'apply',
			functor: $1,
			parameters: []
		};}
	;

curry_parameter_list
	: curry_parameter ',' curry_parameter_list
		{$$ = [$1, $3];}
	| curry_parameter
		{$$ = [$1, []];}
	;

curry_parameter
	: '?'
		{$$ = {
			type: 'placeholder'
		};}
	| expression
		{$$ = $1;}
	| '...' expression
		{$$ = {
			type: 'spread',
			value: $2
		};}
	;

arrow_function_expression
	: '(' '\' '=>' arrow_function_output_expression ')'
		{$$ = {
			type: 'arrow',
			value: $4
		};}
	| '(' '\' arrow_function_input_expression '=>' arrow_function_output_expression ')'
		{$$ = {
			type: 'arrow',
			input: $3,
			value: $5
		};}
	;

arrow_function_input_expression
	: identifier_list
		{$$ = find_spread({
			parameters: check_duplicates(flatten($1))
		});}
	| '{' expression '}'
		{$$ = {
			context: $2,
			parameters: []
		};}
	| '{' expression '}' identifier_list
		{$$ = find_spread({
			context: $2,
			parameters: check_duplicates(flatten($4))
		});}
	;

arrow_function_output_expression
	: expression
		{$$ = $1;}
	| '{' '{' sequence_expression '}' '}'
		{$$ = $3;}
	;

identifier_list
	: 'IDENT'
		{$$ = [$1, []];}
	| '...' 'IDENT'
		{$$ = [{spread: $2}, []];}
	| 'IDENT' ',' identifier_list
		{$$ = [$1, $3];}
	;

el_expression
	: '${' expression '}'
		{$$ = {
			type: 'el',
			expression: $2
		};}
	| '@{' '{' expression '}' expression '}'
		{$$ = {
			type: 'el_substitute',
			scope: $3,
			value: $5
		};}
	| '@{' '[' expression ']' '{' expression '}' expression '}'
		{$$ = {
			type: 'el_substitute',
			precondition: $3,
			scope: $6,
			value: $8
		};}
	| '@{' '[' expression ',' expression ']' '{' expression '}' expression '}'
		{$$ = {
			type: 'el_substitute',
			precondition: $3,
			postcondition: $5,
			scope: $8,
			value: $10
		};}
	| '^^' '(' expression ')'
		{$$ = {
			type: 'scope_uplift',
			value: $3
		};}
	| '@@@'
		{$$ = {
			type: 'scope'
		};}
	;

select_last_value_expression
	: '@' '(' expression_list ')'
		{$$ = {
			type: 'last_value',
			list: flatten($3)
		};}
	;

literal_expression
	: '[' ']'
		{$$ = {
			type: 'array',
			array: []
		};}
	| '[' array_expression_list ']'
		{$$ = {
			type: 'array',
			array: flatten($2)
		};}
	| '[' expression '..' ']'
		{$$ = {
			type: 'stream',
			start: $2
		};}
	| '[' expression '..' expression '..' ']'
		{$$ = {
			type: 'stream',
			start: $2,
			step: $4
		};}
	| '[' expression ',' expression '..' ']'
		{$$ = {
			type: 'stream',
			start: $2,
			next: $4
		};}
	| '[' expression ',' expression '..' expression ']'
		{$$ = {
			type: 'stream',
			start: $2,
			next: $4,
			end: $6
		};}
	| '[' expression '..' expression ']'
		{$$ = {
			type: 'stream',
			start: $2,
			end: $4
		};}
	| '[' expression '..' '|' expression ']'
		{$$ = {
			type: 'stream',
			start: $2,
			filter: $5
		};}
	| '[' expression '..' expression '|' expression ']'
		{$$ = {
			type: 'stream',
			start: $2,
			end: $4,
			filter: $6
		};}
	| '[' expression '..' expression '..' '|' expression ']'
		{$$ = {
			type: 'stream',
			start: $2,
			step: $4,
			filter: $7
		};}
	| '[' expression ',' expression '..' '|' expression ']'
		{$$ = {
			type: 'stream',
			start: $2,
			next: $4,
			filter: $7
		};}
	| '[' expression ',' expression '..' expression '|' expression ']'
		{$$ = {
			type: 'stream',
			start: $2,
			next: $4,
			end: $6,
			filter: $8
		};}
	| '[' expression '...' '|' iteration_expression ']'
		{$$ = {
			type: 'stream_map',
			map: $2,
			iterator: $5
		};}
	;

array_expression_list
	: expression ',' array_expression_list
		{$$ = [$1, $3];}
	| '...' expression ',' array_expression_list
		{$$ = [{type: 'spread', value: $2}, $4];}
	| expression
		{$$ = [$1, []];}
	| '...' expression
		{$$ = [{type: 'spread', value: $2}, []];}
	;

object_expression
	: '{' '}'
		{$$ = {
			type: 'object',
			entries: []
		};}
	| '{' object_expression_list '}'
		{$$ = {
			type: 'object',
			entries: flatten($2)
		};}
	;

object_expression_list
	: object_expression_entry ',' object_expression_list
		{$$ = [$1, $3];}
	| object_expression_entry
		{$$ = [$1, []];}
	;

object_expression_entry
	: 'IDENT' ':' expression
		{$$ = [$1, $3];}
	| '[' expression ']' ':' expression
		{$$ = [$2, $5];}
	| 'STR' ':' expression
		{$$ = [replace_escapes($1), $3];}
	;

expression_list
	: expression
		{$$ = [$1,[]];}
	| assignment_instruction
		{$$ = [$1,[]];}
	| expression ',' expression_list
		{$$ = [$1, $3];}
	| assignment_instruction ',' expression_list
		{$$ = [$1, $3];}
	;

primary_expression
	: primitive_constant
		{$$ = $1;}

	| 'IDENT'
		{$$ = {
			type: 'identifier',
			name: $1
		};}

	| '@@'
		{$$ = {
			type: 'self_reference'
		};}
	;

primitive_constant
	: 'NUM'
		{$$ = make_primitive_value_expression(Number($1));}
	| 'INF'
		{$$ = make_primitive_value_expression(Infinity);}
	| 'NAN'
		{$$ = make_primitive_value_expression(NaN);}
	| 'UNDEF'
		{$$ = make_primitive_value_expression();}
	| 'T'
		{$$ = make_primitive_value_expression(true);}
	| 'F'
		{$$ = make_primitive_value_expression(false);}
	| 'STR'
		{$$ = make_primitive_value_expression(replace_escapes($1));}
	| 'VOID'
		{$$ = {
			type: 'void'
		};}
	;

sequence_expression
	: sequence
		{$$ = {
			type: 'sequence',
			sequence: flatten($1)
		};}
	;

sequence
	: sequence_element ';' sequence
		{$$ = [$1, $3];}
	| sequence_element ';'
		{$$ = [$1, []];}
	;

sequence_element
	: assignment_instruction
		{$$ = $1;}
	| expression
		{$$ = $1;}
	;

assignment_instruction
	: expression '.' 'IDENT' '=' assignment_value
		{$$ = {
			type: 'assignment',
			target: $1,
			name: $3,
			value: $5
		};}
	| expression '[' expression ']' '=' assignment_value
		{$$ = {
			type: 'assignment',
			target: $1,
			name: $3,
			value: $6
		};}
	| 'IDENT' '=' assignment_value
		{$$ = {
			type: 'assignment',
			target: $1,
			value: $3
		};}
	| '@' '[' expression ']' '=' assignment_value
		{$$ = {
			type: 'assignment',
			target: $3,
			value: $6
		};}
	;

assignment_value
	: assignment_instruction
	| expression
	;


%%

// additional functions

function is_binary_compressible(left, right) {
	return left.type === 'primitive' && right.type === 'primitive';
}

function is_unary_compressible(value) {
	return value.type === 'primitive';
}

function make_primitive_value_expression(value) {
	return {
		type: 'primitive',
		value: value
	};
}

function compare(a, b) {
	return (a > b) - (a < b);
}

function attempt_compress(expression) {
	switch (expression.type) {
	case 'add':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value + expression.right.value) :
			expression;
	case 'sub':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value - expression.right.value) :
			expression;
	case 'mul':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value * expression.right.value) :
			expression;
	case 'div':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value / expression.right.value) :
			expression;
	case 'mod':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value % expression.right.value) :
			expression;
	case 'cmp':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(
				compare(expression.left.value, expression.right.value)) :
			expression;
	case 'eq':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value === expression.right.value) :
			expression;
	case 'gt':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value > expression.right.value) :
			expression;
	case 'ge':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value >= expression.right.value) :
			expression;
	case 'lt':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value < expression.right.value) :
			expression;
	case 'le':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value <= expression.right.value) :
			expression;
	case 'neg':
		return is_unary_compressible(expression.value) ?
			make_primitive_value_expression(-expression.value.value) :
			expression;
	case 'and':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value && expression.right.value) :
			expression;
	case 'or':
		return is_binary_compressible(expression.left, expression.right) ?
			make_primitive_value_expression(expression.left.value || expression.right.value) :
			expression;
	case 'bool_neg':
		return is_binary_compressible(expression.value) ?
			make_primitive_value_expression(!expression.value.value) :
			expression;
	case 'conditional':
		return is_unary_compressible(expression.condition) ?
			expression.condition.value ? expression.consequent : expression.alternative :
			expression;
	default:
		return expression;
	}
}

function flatten(list) {
	var vec = [];
	var first = list;
	while (first.length) {
		vec.push(first[0]);
		first = first[1];
	}
	return vec;
}

function check_duplicates(parameters) {
	var set = new Set(parameters);
	if (set.size === parameters.length) {
		return parameters;
	} else {
		throw new Error('Duplicate parameter names');
	}
}

function find_spread(input) {
	if ('object' === typeof input.parameters[input.parameters.length - 1]) {
		var spread = input.parameters.pop();
		input.spread = spread.spread;
	}
	return input;
}

function replace_escapes(string) {
	return string.replace(/\\'/g, '\'')
		.replace(/\\"/g, '"')
		.replace(/\\n/g, '\n')
		.replace(/\\r/g, '\r')
		.replace(/\\t/g, '\t')
		.replace(/\\b/g, '\b')
		.replace(/\\f/g, '\f')
		.slice(1, -1);
}
