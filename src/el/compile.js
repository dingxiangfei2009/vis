/**
 * INSTRUCTION SPECIFICATION
 *
 *
 */

define(['./inst', 'util/util'], function(instructions, util) {
'use strict';

function CompileResult(instructions, procs, symbols) {
  this.instructions = instructions;
  this.procs = procs;
  this.symbols = symbols;
}

function make_compile_result(instructions, procs, symbols) {
  return new CompileResult(instructions, procs, symbols);
}

function compile_primitive(expression) {
  return make_compile_result([instructions.LOAD(expression.value)]);
}

function compile_identifier(expression) {
  return make_compile_result([
    instructions.LOAD(expression.name),
    instructions.LOOKUP()
  ]);
}

function compile_iterate(expression) {
  var collection = compile(expression.collection);
  var inst_array = collection.instructions;
  inst_array.push(
    instructions.FORCE(),
    instructions.ITERATOR(
      expression.element,
      expression.index,
      expression.reference));
  return make_compile_result(inst_array, collection.procs, collection.symbols);
}

function compile_computed_identifier(expression) {
  var inst_array = compile(expression.value);
  inst_array.instructions.push(instructions.LOOKUP());
  return inst_array;
}

function compile_binary_op_factory(op) {
  return function (expression) {
    var left = compile(expression.left);
    var right = compile(expression.right);
    var inst_array = left.instructions;
    inst_array.push(instructions.FORCE());
    util.push_concat(inst_array, right.instructions);
    inst_array.push(instructions.FORCE(), op());
    return make_compile_result(
      inst_array,
      util.concat(left.procs, right.procs),
      util.concat(left.symbols, right.procs));
  };
}

var
  compile_add = compile_binary_op_factory(instructions.ADD),
  compile_sub = compile_binary_op_factory(instructions.SUB),
  compile_mul = compile_binary_op_factory(instructions.MUL),
  compile_div = compile_binary_op_factory(instructions.DIV),
  compile_mod = compile_binary_op_factory(instructions.MOD),
  compile_gt = compile_binary_op_factory(instructions.GT),
  compile_ge = compile_binary_op_factory(instructions.GE),
  compile_lt = compile_binary_op_factory(instructions.LT),
  compile_le = compile_binary_op_factory(instructions.LE),
  compile_eq = compile_binary_op_factory(instructions.EQ),
  compile_neq = compile_binary_op_factory(instructions.NEQ);

function compile_and(expression) {
  var left = compile(expression.left);
  var right = compile(expression.right);
  var failure = instructions.MARKER();
  var inst_array = left.instructions;
  inst_array.push(
    instructions.FORCE(),
    instructions.JNC(failure),
    instructions.TRAITS(),
    instructions.DATA_PUSH(),
    instructions.POP());
  util.push_concat(inst_array, right.instructions);
  inst_array.push(
    instructions.FORCE(),
    instructions.DATA_POP(),
    instructions.INJECT_TRAITS(),
    failure);
  return make_compile_result(
    inst_array,
    util.concat(left.procs, right.procs),
    util.concat(left.symbols, right.symbols)
  );
}

function compile_or(expression) {
  var left = compile(expression.left);
  var right = compile(expression.right);
  var success = instructions.MARKER();
  var inst_array = left.instructions;
  inst_array.push(
    instructions.FORCE(),
    instructions.JC(success),
    instructions.TRAITS(),
    instructions.DATA_PUSH(),
    instructions.POP());
  util.push_concat(inst_array, right.instructions);
  inst_array.push(
    instructions.FORCE(),
    instructions.DATA_POP(),
    instructions.INJECT_TRAITS(),
    success);
  return make_compile_result(
    inst_array,
    util.concat(left.procs, right.procs),
    util.concat(left.symbols, right.symbols)
  );
}

function compile_neg(expression) {
  var value = compile(expression.value);
  value.instructions.push(instructions.FORCE(), instructions.ANEG());
  return value;
}

function compile_bool_neg(expression) {
  var value = compile(expression.value);
  value.instructions.push(instructions.FORCE(), instructions.BNEG());
  return value;
}

function compile_conditional(expression) {
  var condition = compile(expression.condition);
  var consequent = compile(expression.consequent);
  var alternative = compile(expression.alternative);
  var alternative_marker = instructions.MARKER();
  var end_marker = instructions.MARKER();

  var inst_array = condition.instructions;
  inst_array.push(
    instructions.FORCE(),
    instructions.TRAITS(),
    instructions.DATA_PUSH(),
    instructions.JNC(alternative_marker, true));
  util.push_concat(inst_array, consequent.instructions);
  inst_array.push(
    instructions.JMP(end_marker),
    alternative_marker);
  util.push_concat(inst_array, alternative.instructions);
  inst_array.push(
    end_marker,
    instructions.DATA_POP(),
    instructions.INJECT_TRAITS());
  return make_compile_result(
    inst_array,
    util.concat(condition.procs, consequent.procs, alternative.procs),
    util.concat(condition.symbols, consequent.symbols, alternative.symbols)
  );
}

function compile_pipe(expression) {
  var left = compile(expression.left);
  var right = compile(expression.right);
  var inst_array = [instructions.LOAD_ARR()];
  util.push_concat(inst_array, left.instructions);
  inst_array.push(instructions.ARR_PUSH());
  util.push_concat(inst_array, right.instructions);
  inst_array.push(
    instructions.FORCE(),
    instructions.APPLY(),
    instructions.DATA_POP(),
    instructions.INJECT_TRAITS());
  return make_compile_result(
    inst_array,
    util.concat(left.procs, right.procs),
    util.concat(left.symbols, right.symbols));
}

function compile_list_pipe(expression) {
  var force = expression.force;
  var insts = [instructions.LOAD_ARR()], procs = [], symbols = [];
  expression.left.map(compile).forEach(function(sub_inst) {
    util.push_concat(insts, sub_inst.instructions);
    if (force)
      insts.push(instructions.FORCE());
    insts.push(instructions.ARR_PUSH());
    util.push_concat(procs, sub_inst.procs);
    util.push_concat(symbols, sub_inst.symbols);
  });

  var func = compile(expression.right);
  util.push_concat(insts, func.instructions);
  insts.push(
    instructions.FORCE(),
    instructions.APPLY(),
    instructions.DATA_POP(),
    instructions.INJECT_TRAITS());
  util.push_concat(procs, func.procs);
  util.push_concat(symbols, func.symbols);
  return make_compile_result(insts, procs, symbols);
}

function compile_global_access(expression) {
  if (util.traits.is_string(expression.name))
    return make_compile_result([
      instructions.LOAD_GLOBAL(),
      instructions.LOAD(expression.name),
      instructions.FORCE(),
      instructions.MEMBER()
    ]);
  else {
    var right = compile(expression.name);
    var inst_array = [instructions.LOAD_GLOBAL()];
    util.push_concat(inst_array, right.instructions);
    inst_array.push(instructions.FORCE(), instructions.MEMBER());
    return make_compile_result(inst_array, right.procs, right.symbols);
  }
}

function compile_access(expression) {
  var left = compile(expression.left);
  var inst_array = left.instructions;
  inst_array.push(instructions.FORCE());
  if (util.traits.is_string(expression.right)) {
    inst_array.push(
      instructions.LOAD(expression.right),
      instructions.MEMBER());
    return make_compile_result(inst_array, left.procs, left.symbols);
  } else {
    var right = compile(expression.right);
    util.push_concat(inst_array, right.instructions);
    inst_array.push(instructions.FORCE(), instructions.MEMBER());
    return make_compile_result(
      inst_array,
      util.concat(left.procs, right.procs),
      util.concat(left.symbols, right.symbols));
  }
}

function compile_object(expression) {
  var inst_array = [instructions.LOAD_ARR()];
  var procs = [];
  var symbols = [];
  expression.entries.forEach(function(entry) {
    var value = compile(entry[1]);
    inst_array.push(instructions.LOAD_ARR());
    if (util.traits.is_string(entry[0]))
      inst_array.push(instructions.LOAD(entry[0]));
    else {
      var key = compile(entry[0]);
      util.push_concat(inst_array, key.instructions);
      util.push_concat(procs, key.procs);
      util.push_concat(symbols, key.symbols);
    }
    inst_array.push(instructions.ARR_PUSH());
    util.push_concat(inst_array, value.instructions);
    inst_array.push(
      instructions.ARR_PUSH(),
      instructions.ARR_PUSH());
    util.push_concat(procs, value.procs);
    util.push_concat(symbols, value.symbols);
  });
  inst_array.push(instructions.OBJ());
  return make_compile_result(inst_array, procs, symbols);
}

function compile_array(expression) {
  var inst_array = [instructions.LOAD_ARR()];
  var procs = [], symbols = [];
  expression.array.forEach(function(entry) {
    var result = compile(entry);
    util.push_concat(inst_array, result.instructions);
    if (entry.type === 'spread')
      inst_array.push(instructions.FORCE(), instructions.ARR_PUSH_SPREAD());
    else
      inst_array.push(instructions.ARR_PUSH());
    util.push_concat(procs, result.procs);
    util.push_concat(symbols, result.symbols);
  });
  return make_compile_result(inst_array, procs, symbols);
}

function compile_stream(expression) {
  var {
    instructions: inst_array,
    procs: procs,
    symbols: symbols
  } = compile(expression.start);
  procs = procs || []; symbols = symbols || [];
  var result;
  if (expression.step) {
    result = compile(expression.step);
    util.push_concat(inst_array, result.instructions);
    util.push_concat(procs, result.procs);
    util.push_concat(symbols, result.symbols);
  } else
    inst_array.push(instructions.LOAD());

  if (expression.next) {
    result = compile(expression.next);
    util.push_concat(inst_array, result.instructions);
    util.push_concat(procs, result.procs);
    util.push_concat(symbols, result.symbols);
  } else
    inst_array.push(instructions.LOAD());

  if (expression.end) {
    result = compile(expression.end);
    util.push_concat(inst_array, result.instructions);
    util.push_concat(procs, result.procs);
    util.push_concat(symbols, result.symbols);
  } else
    inst_array.push(instructions.LOAD());

  if (expression.filter) {
    result = compile(expression.filter);
    util.push_concat(inst_array, result.instructions);
    util.push_concat(procs, result.procs);
    util.push_concat(symbols, result.symbols);
  } else
    inst_array.push(instructions.LOAD());

  inst_array.push(instructions.NUMBER_STREAM());
  return make_compile_result(inst_array, procs, symbols);
}

function compile_yield(expression) {
}

function compile_stream_map(expression) {
  var map_op = instructions.MARKER();
  var map = compile(expression.map);
  var itr = compile(expression.iterator);

  var inst_array = itr.instructions;
  inst_array.push(instructions.STREAM_MAP(map_op));

  var procs = [map_op];
  util.push_concat(procs, map.instructions);
  procs.push(instructions.RETURN());

  util.push_concat(procs, itr.procs);
  util.push_concat(procs, map.procs);

  return make_compile_result(
    inst_array,
    procs,
    util.concat(itr.symbols, map.symbols));
}

function compile_promise(expression) {
  var promise = compile(expression.promise), resolve = compile(expression.resolve);
  var promise_proc = instructions.MARKER(), resolve_proc = instructions.MARKER();

  var procs = [promise_proc];
  util.push_concat(procs, promise.instructions);
  procs.push(
    instructions.RETURN(),
    resolve_proc);
  util.push_concat(procs, resolve.instructions);
  procs.push(instructions.RETURN());

  var symbols = promise.symbols || [];
  util.push_concat(procs, promise.procs);
  util.push_concat(procs, resolve.procs);
  util.push_concat(symbols, resolve.symbols);
  if (expression.reject) {
    var reject_proc = instructions.MARKER();
    var reject = compile(expression.reject);
    util.push_concat(procs, reject.procs);
    util.push_concat(symbols, reject.symbols);
    return make_compile_result([
      instructions.PROMISE(promise_proc, resolve_proc, reject_proc)
    ], procs, symbols);
  } else
    return make_compile_result([
      instructions.PROMISE(promise_proc, resolve_proc)
    ], procs, symbols);
}

function compile_apply(expression) {
  var incomplete_parameter = false;
  var force = expression.force;
  var func = compile(expression.functor);
  var procs = func.procs || [], symbols = func.symbols || [];
  var inst_array = func.instructions;
  inst_array.push(
    instructions.FORCE(),
    instructions.DATA_PUSH(),
    instructions.LOAD_ARR());
  expression.parameters.forEach(function(parameter) {
    switch (parameter.type) {
    case 'placeholder':
      incomplete_parameter = true;
      inst_array.push(instructions.CURRY_PLACEHOLDER(), instructions.ARR_PUSH());
      break;
    case 'spread':
      var result = compile(parameter.value);
      util.push_concat(inst_array, result.instructions);
      inst_array.push(instructions.FORCE(), instructions.ARR_PUSH_SPREAD());
      util.push_concat(procs, result.procs);
      util.push_concat(symbols, result.symbols);
      break;
    default:
      var result = compile(parameter);
      util.push_concat(inst_array, result.instructions);
      if (force)
        inst_array.push(instructions.FORCE());
      inst_array.push(instructions.ARR_PUSH());
      util.push_concat(procs, result.procs);
      util.push_concat(symbols, result.symbols);
    }
  });
  inst_array.push(instructions.DATA_POP());
  if (incomplete_parameter)
    inst_array.push(instructions.BIND());
  else
    inst_array.push(
      instructions.APPLY(),
      instructions.DATA_POP(),
      instructions.INJECT_TRAITS());
  return make_compile_result(inst_array, procs, symbols);
}

function compile_void() {
  return make_compile_result([instructions.LOAD()]);
}

function compile_arrow_function(expression) {
  var body = compile(expression.value);
  var body_marker = instructions.MARKER();
  var procs = body.procs || [], symbols = body.symbols || [];

  procs.push(body_marker);
  util.push_concat(procs, body.instructions);
  procs.push(instructions.RETURN());

  if (expression.input) {
    var parameters = expression.input.parameters.slice();
    var bound_context = false;
    var inst_array = [];
    if (expression.input.context) {
      var context = compile(expression.input.context);
      util.push_concat(inst_array, context.instructions);
      util.push_concat(procs, context.procs);
      util.push_concat(symbols, context.symbols);
      bound_context = true;
    }
    inst_array.push(
      instructions.PROCEDURE(body_marker, {
        context: bound_context,
        parameters: parameters,
        spread: expression.input.spread
      })
    );
    return make_compile_result(inst_array, procs, symbols);
  } else
    return make_compile_result([
      instructions.PROCEDURE(body_marker, {
        context: false,
        parameters: [],
        spread: null
      })
    ], procs, symbols);
}

function compile_el_evaluator(expression) {
  var value = compile(expression.expression);
  var procs = value.procs || [];
  var eval_marker = instructions.MARKER();
  procs.push(eval_marker);
  util.push_concat(procs, value.instructions);
  procs.push(instructions.RETURN());
  return make_compile_result([
    instructions.EXPRESSION(eval_marker)
  ], procs, value.symbols);
}

function compile_el_substitute(expression) {
  var scope = compile(expression.scope);
  var value = compile(expression.value);
  var body_marker = instructions.MARKER();
  var precondition_marker = instructions.MARKER();
  var postcondition_marker = instructions.MARKER();
  var procs = value.procs || [], symbols = value.symbols || [];
  util.push_concat(procs, scope.procs);
  util.push_concat(symbols, scope.symbols);
  var result;
  if (expression.precondition) {
    result = compile(expression.precondition);
    procs.push(precondition_marker);
    util.push_concat(procs, result.instructions);
    procs.push(instructions.RETURN());
    util.push_concat(procs, result.procs);
    util.push_concat(symbols, result.symbols);
  } else
    procs.push(
      precondition_marker,
      instructions.LOAD(true),
      instructions.RETURN());

  if (expression.postcondition) {
    result = compile(expression.postcondition);
    procs.push(postcondition_marker);
    util.push_concat(procs, result.instructions);
    procs.push(instructions.RETURN());
    util.push_concat(procs, result.procs);
    util.push_concat(symbols, result.symbols);
  } else
    procs.push(
      postcondition_marker,
      instructions.LOAD(true),
      instructions.RETURN());

  procs.push(body_marker);
  util.push_concat(procs, value.instructions);
  procs.push(instructions.RETURN());
  var inst_array = scope.instructions;
  inst_array.push(
    instructions.SUBSTITUTE(precondition_marker, body_marker, postcondition_marker));
  return make_compile_result(inst_array, procs, symbols);
}

function compile_substitute_evaluator(expression) {
  var substitute = compile(expression.value);
  substitute.instructions.push(instructions.EXEC_SUBSTITUTE());
  return substitute;
}

function compile_scope() {
  return make_compile_result([instructions.LOAD_SCOPE()]);
}

function compile_scope_uplift(expression) {
  var value = compile(expression.value);
  return make_compile_result([
    instructions.LOAD_SCOPE(),
    instructions.DATA_PUSH(),
    instructions.LOAD_SCOPE(),
    instructions.SCOPE_UP(),
    instructions.USE_SCOPE(),
    ...value.instructions,
    instructions.DATA_POP(),
    instructions.USE_SCOPE()
  ], value.procs, value.symbols);
}

function compile_last_value(expression) {
  var values = expression.list.map(compile);
  var inst_array = [];
  var procs = [], symbols = [];
  values.forEach(function (value, index) {
    util.push_concat(inst_array, value.instructions);
    if (index)
      inst_array.push(
        instructions.DATA_POP(),
        instructions.INJECT_TRAITS()
      );
    if (index < values.length - 1)
      inst_array.push(
        instructions.TRAITS(),
        instructions.DATA_PUSH(),
        instructions.POP()
      );
    util.push_concat(procs, value.procs);
    util.push_concat(symbols, value.symbols);
  });
  return make_compile_result(inst_array, procs, symbols);
}

function compile_sequence(expression) {
  var values = expression.sequence.map(compile);
  var inst_array = [];
  var procs = [], symbols = [];
  values.forEach(function (value, index) {
    util.push_concat(inst_array, value.instructions);
    if (index < values.length - 1)
      inst_array.push(instructions.POP());
    util.push_concat(procs, value.procs);
    util.push_concat(symbols, value.symbols);
  });
  return make_compile_result(inst_array, procs, symbols);
}

function compile_object_assignment(expression) {
  var target = compile(expression.target);
  var inst_array = target.instructions;
  var procs = target.procs || [], symbols = target.symbols || [];
  var value;

  if (util.traits.is_string(expression.name))
    inst_array.push(instructions.LOAD(expression.name));
  else {
    value = compile(expression.name);
    util.push_concat(inst_array, value.instructions);
    util.push_concat(procs, value.procs);
    util.push_concat(symbols, value.symbols);
  }

  value = compile(expression.value);
  util.push_concat(inst_array, value.instructions);
  inst_array.push(instructions.OBJ_WRITE());
  util.push_concat(procs, value.procs);
  util.push_concat(symbols, value.symbols);

  return make_compile_result(inst_array, procs, symbols);
}

function compile_identifier_assignment(expression) {
  var value = compile(expression.value);
  var inst_array = [instructions.LOAD(expression.target)];
  util.push_concat(inst_array, value.instructions);
  inst_array.push(instructions.WRITE());
  return make_compile_result(inst_array, value.procs, value.symbols);
}

function compile_computed_identifier_assignment (expression) {
  var name = compile(expression.target);
  var procs = name.procs || [];
  var symbols = name.symbols || [];
  var value = compile(expression.value);

  var inst_array = name.instructions;
  util.push_concat(inst_array, value.instructions);
  inst_array.push(instructions.WRITE());

  util.push_concat(procs, value.procs);
  util.push_concat(symbols, value.symbols);
  return make_compile_result(inst_array, procs, symbols);
}

function compile_assignment(expression) {
  if (!util.traits.is_undefined(expression.name))
    return compile_object_assignment(expression);
  else if (util.traits.is_string(expression.target))
    return compile_identifier_assignment(expression);
  else
    return compile_computed_identifier_assignment(expression);
}

function compile_touch(expression) {
  var value = compile(expression.value);
  value.instructions.push(instructions.TOUCH());
  return value;
}

function compile_negative_touch() {}

function compile_force(expression) {
  var value = compile(expression.value);
  value.instructions.push(instructions.FORCE());
  return value;
}

function compile_force_primitive(expression) {
  var value = compile(expression.value);
  value.instructions.push(instructions.FORCE_PRIMITIVE());
  return value;
}

function compile_all_properties(expression) {
  var value = compile(expression.value);
  value.instructions.push(instructions.WATCH_ALL_PROP());
  return value;
}

function compile_bind(expression) {
  var monad = compile(expression.value);
  var functor = compile(expression.functor);
  var
    inst_array = monad.instructions,
    procs = monad.procs || [],
    symbols = monad.symbols || [];
  util.push_concat(inst_array, functor.instructions);
  util.push_concat(procs, functor.procs);
  util.push_concat(symbols, functor.symbols);
  inst_array.push(
    instructions.MONAD_BIND(),
    instructions.DATA_POP(),
    instructions.INJECT_TRAITS());
  return make_compile_result(inst_array, procs, symbols);
}

function compile_return(expression) {
  var value = compile(expression.value);
  value.instructions.push(instructions.MONAD_RETURN());
  return value;
}

function compile_self_reference() {
  return make_compile_result([
    instructions.LOAD_SELF_REFERENCE()
  ]);
}

function collate(result) {
  var inst_array = result.instructions;
  inst_array.push(instructions.RETURN());
  util.push_concat(inst_array, result.procs);
  var marker_locations = new Map;
  for (var i = 0, effective = 0; i < inst_array.length; ++i)
    if (inst_array[i].tag === 'MARKER')
      marker_locations.set(inst_array[i], effective);
    else
      ++effective;
  var actual_inst = [];
  for (var i = 0; i < inst_array.length; ++i) {
    switch (inst_array[i].tag) {
    case 'JMP':
      actual_inst.push(
        instructions.JMP(marker_locations.get(inst_array[i].target)));
      break;
    case 'JNC':
      actual_inst.push(
        instructions.JNC(marker_locations.get(inst_array[i].target),
        inst_array[i].popping));
      break;
    case 'JC':
      actual_inst.push(
        instructions.JC(marker_locations.get(inst_array[i].target),
        inst_array[i].popping));
      break;
    case 'PROMISE':
      if (inst_array[i].reject)
        actual_inst.push(
          instructions.PROMISE(
            marker_locations.get(inst_array[i].value),
            marker_locations.get(inst_array[i].resolve),
            marker_locations.get(inst_array[i].reject)));
      else
        actual_inst.push(
          instructions.PROMISE(
            marker_locations.get(inst_array[i].value),
            marker_locations.get(inst_array[i].resolve)));
      break;
    case 'PROCEDURE':
      actual_inst.push(
        instructions.PROCEDURE(
          marker_locations.get(inst_array[i].target),
          inst_array[i].configuration));
      break;
    case 'EXPRESSION':
      actual_inst.push(
        instructions.EXPRESSION(
          marker_locations.get(inst_array[i].value)));
      break;
    case 'SUBSTITUTE':
      actual_inst.push(
        instructions.SUBSTITUTE(
          marker_locations.get(inst_array[i].precondition),
          marker_locations.get(inst_array[i].body),
          marker_locations.get(inst_array[i].postcondition)));
      break;
    case 'STREAM_MAP':
      actual_inst.push(
        instructions.STREAM_MAP(
          marker_locations.get(inst_array[i].map)));
      break;
    case 'MARKER': continue;
    default:
      actual_inst.push(inst_array[i]);
    }
  }
  inst_array = actual_inst;
  // tailcall optimisation
  OUTER_TAILCALL_OPTIMIZATION_LOOP:
  for (var i = 0, end = inst_array.length; i < end; ++i)
    if ('APPLY' === inst_array[i].tag) {
      for (var j = i + 3; j < end;)
        switch (inst_array[j].tag) {
        case 'JMP':
          j = inst_array[j].target; //follow
          continue;
        case 'INJECT_TRAITS':
        case 'DATA_POP':
          ++j;  // follow
          continue;
        case 'RETURN':
          actual_inst[i] = instructions.TAILCALL();
          i += 2; // skip DATA_POP and INJECT_TRAITS
        default:
          continue OUTER_TAILCALL_OPTIMIZATION_LOOP;
        }
      if ('RETURN' === inst_array[j].tag) {
      }
    }
  return actual_inst;
}

var COMPILERS = new Map([
	['primitive',		compile_primitive],
	['identifier',		compile_identifier],
	['iterate',			compile_iterate],
	['add',				compile_add],
	['sub',				compile_sub],
	['mul',				compile_mul],
	['div',				compile_div],
	['mod',				compile_mod],
	['gt',				compile_gt],
	['ge',				compile_ge],
	['lt',				compile_lt],
	['le',				compile_le],
	['eq',				compile_eq],
	['neq',				compile_neq],
	['and',				compile_and],
	['or',				compile_or],
	['neg',				compile_neg],
	['bool_neg',		compile_bool_neg],
	['conditional',		compile_conditional],
	['object',			compile_object],
	['array',			compile_array],
	['stream',			compile_stream],
	['stream_map',		compile_stream_map],
	['pipe',			compile_pipe],
	['list_pipe',		compile_list_pipe],
	['bind',			compile_bind],
	['return',			compile_return],
	['promise',			compile_promise],
	['global_access',	compile_global_access],
	['access',			compile_access],
	['apply',			compile_apply],
	['void',			compile_void],
	['self_reference',	compile_self_reference],
	['computed_identifier',	compile_computed_identifier],
	['arrow',			compile_arrow_function],
	['el',				compile_el_evaluator],
	['el_substitute',	compile_el_substitute],
	['evaluate_substitute', compile_substitute_evaluator],
	['scope',			compile_scope],
	['scope_uplift',	compile_scope_uplift],
	['last_value',		compile_last_value],
	['sequence',		compile_sequence],
	['assignment',		compile_assignment],
	['force',			compile_force],
	['force_primitive',	compile_force_primitive],
	['all_properties',	compile_all_properties],
	['touch',			compile_touch],
	['negative_touch',	compile_negative_touch]
]);

function compile(expression) {
  return COMPILERS.get(expression.type)(expression);
}

return function (expression) {
  return Object.assign(collate(compile(expression)), {expression: expression});
};

});
