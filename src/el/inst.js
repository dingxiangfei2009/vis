define(['util/util', './runtime', './scope', './el_const'],
function(util, runtime, el_scope, CONST) {
'use strict';

var TRAITS_SYMBOL = Symbol('Traits container');
var PLACEHOLDER_SYMBOL = Symbol('Placeholder');

function Instruction() {}
Object.assign(Instruction.prototype, {execute() {}});

function Marker() {}
util.inherit(Marker, Instruction, {
  tag: 'MARKER'
});
function MARKER() {
  return new Marker;
}

function LoadInstruction(value) {
  this.value = value;
}
util.inherit(LoadInstruction, Instruction, {
  tag: 'LOAD',
  execute(env) {
    env.operand.push(new runtime.Value(this.value, []));
  }
});
function LOAD(value) {
  return new LoadInstruction(value);
}

function LookupInstruction() {}
util.inherit(LookupInstruction, Instruction, {
  tag: 'LOOKUP',
  execute(env) {
    var name = env.operand.pop();
    var value = runtime.lookup(env.scope, name.value);
    if (util.traits.is_function(value.value) &&
      Reflect.has(value.value, CONST.EL))
      value.value[CONST.EL].set_parent_environment(env);
    env.operand.push(value);
  }
});
function LOOKUP(name) {
  return new LookupInstruction;
}

function IteratorInstruction(element, index, reference) {
  this.element = element;
  this.index = index;
  this.reference = reference;
}
util.inherit(IteratorInstruction, Instruction, {
  tag: 'ITERATOR',
  execute(env) {
    var collection = env.operand[env.operand.length - 1];
    collection.traits.push([collection.value, CONST.SPLICE]);
    env.operand[env.operand.length - 1] = new runtime.Value(
      new runtime.Iterator(
        collection.value,
        this.element,
        this.index,
        this.reference),
      collection.traits);
  }
});
function ITERATOR(element, index, reference) {
  return new IteratorInstruction(element, index, reference);
}

function AddInstruction() {}
util.inherit(AddInstruction, Instruction, {
  tag: 'ADD',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value + right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function ADD() {
  return new AddInstruction;
}

function SubInstruction() {}
util.inherit(SubInstruction, Instruction, {
  tag: 'SUB',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value - right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function SUB() {
  return new SubInstruction;
}

function MulInstruction() {}
util.inherit(MulInstruction, Instruction, {
  tag: 'Mul',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value * right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function MUL() {
  return new MulInstruction;
}

function DivInstruction() {}
util.inherit(DivInstruction, Instruction, {
  tag: 'DIV',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value / right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function DIV() {
  return new DivInstruction;
}

function ModInstruction() {}
util.inherit(ModInstruction, Instruction, {
  tag: 'MOD',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value % right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function MOD() {
  return new ModInstruction;
}

function GtInstruction() {}
util.inherit(GtInstruction, Instruction, {
  tag: 'GT',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value > right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function GT() {
  return new GtInstruction;
}

function LtInstruction() {}
util.inherit(LtInstruction, Instruction, {
  tag: 'LT',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value < right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function LT() {
  return new LtInstruction;
}

function GeInstruction() {}
util.inherit(GeInstruction, Instruction, {
  tag: 'GE',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value >= right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function GE() {
  return new GeInstruction;
}

function LeInstruction() {}
util.inherit(LeInstruction, Instruction, {
  tag: 'LE',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value <= right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function LE() {
  return new LeInstruction;
}

function EqInstruction() {
}
util.inherit(EqInstruction, Instruction, {
  tag: 'EQ',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value === right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] = new runtime.Value(result_value, result_traits);
  }
});
function EQ() {
  return new EqInstruction;
}

function AnegInstruction() {}
util.inherit(AnegInstruction, Instruction, {
  tag: 'ANEG',
  execute(env) {
    var value = env.operand[env.operand.length - 1];
    value.value = -value.value;
    value.traits.bindable = false;
    value.traits.context = null;
  }
});
function ANEG() {
  return new AnegInstruction;
}

function BnegInstruction() {}
util.inherit(BnegInstruction, Instruction, {
  tag: 'BNEG',
  execute(env) {
    var value = env.operand[env.operand.length - 1];
    value.value = !value.value;
    value.traits.bindable = false;
    value.traits.context = null;
  }
});
function BNEG() {
  return new BnegInstruction;
}

function NeqInstruction() {}
util.inherit(NeqInstruction, Instruction, {
  tag: 'NEQ',
  execute(env) {
    var right = env.operand.pop();
    var left = env.operand[env.operand.length - 1];
    var result_value = left.value !== right.value;
    var result_traits = util.concat(left.traits, right.traits);
    env.operand[env.operand.length - 1] =
      new runtime.Value(result_value, result_traits);
  }
});
function NEQ() {
  return new NeqInstruction;
}

function MarkerInstruction() {}
util.inherit(MarkerInstruction, Instruction, {
  tag: 'MARKER'
});
function MARKER() {
  return new MarkerInstruction;
}

function JncInstruction(target, popping) {
  this.target = target;
  this.popping = popping;
}
util.inherit(JncInstruction, Instruction, {
  tag: 'JNC',
  execute(env) {
    var value = this.popping ?
      env.operand.pop() : env.operand[env.operand.length - 1];
    if (!value.value) {
      env.pointer = this.target;
      return true;
    }
  }
});
function JNC(target, popping) {
  return new JncInstruction(target, popping);
}

function JcInstruction(target, popping) {
  this.target = target;
  this.popping = popping;
}
util.inherit(JcInstruction, Instruction, {
  tag: 'JC',
  execute(env) {
    var value = this.popping ?
      env.operand.pop() : env.operand[env.operand.length - 1];
    if (value.value) {
      env.pointer = this.target;
      return true;
    }
  }
});
function JC(target, popping) {
  return new JcInstruction(target, popping);
}

function JmpInstruction(target) {
  this.target = target;
}
util.inherit(JmpInstruction, Instruction, {
  tag: 'JMP',
  execute(env) {
    env.pointer = this.target;
    return true;
  }
});
function JMP(target) {
  return new JmpInstruction(target);
}

function LoadArrayInstruction() {}
util.inherit(LoadArrayInstruction, Instruction, {
  tag: 'LOAD_ARR',
  execute(env) {
    env.operand.push(new runtime.Value([], []));
  }
});
function LOAD_ARR() {
  return new LoadArrayInstruction;
}

function ArrayPushInstruction() {}
util.inherit(ArrayPushInstruction, Instruction, {
  tag: 'ARR_PUSH',
  execute(env) {
    var value = env.operand.pop();
    var arr = env.operand[env.operand.length - 1];
    arr.value.push(runtime.unwrap_proxy(value.value));
    util.push_concat(arr.traits, value.traits);
  }
});
function ARR_PUSH() {
  return new ArrayPushInstruction;
}

function ArrayPushSpreadInstruction() {}
util.inherit(ArrayPushSpreadInstruction, Instruction, {
  tag: 'ARR_PUSH_SPREAD',
  execute(env) {
    var value = env.operand.pop();
    var arr = env.operand[env.operand.length - 1];
    util.push_concat(arr.value, value.value);
    util.push_concat(arr.traits, value.traits);
  }
});
function ARR_PUSH_SPREAD() {
  return new ArrayPushSpreadInstruction;
}

function setup_call_parameters(model, parameters, args, spread) {
  for (var i = 0, p_end = parameters.length, a_end = args.length;
    i < p_end && i < a_end;
    ++i)
    model[parameters[i]] = args[i];
  if (spread)
    model[spread] = args.slice(p_end);
}

function ProcedureInstruction(target, configuration) {
  this.target = target;
  this.configuration = configuration;
}
util.inherit(ProcedureInstruction, Instruction, {
  tag: 'PROCEDURE',
  execute(env) {
    function invoke(...args) {
      var new_model = {
        self: invoke,
        'this': new.target ? this : runtime.unwrap_proxy(configuration.context),
        'arguments': args.slice()
      };
      setup_call_parameters(
        new_model,
        configuration.parameters,
        args,
        configuration.spread);

      var self_env = new runtime.Environment;
      self_env.instructions = configuration.instructions;
      self_env.pointer = configuration.pointer;
      self_env.set_scope({
        inherit: true,
        base_scope: configuration.scope,
        new_model: new_model
      });

      var value = self_env.execute();
      var env = parent_environment;
      if (!env.destroyed &&
          env.data.length &&
          env.data[env.data.length - 1][TRAITS_SYMBOL])
          util.push_concat(env.data[env.data.length - 1], value.traits); // collapse if exists

      self_env.destroy();
      return value.value;
    }

    var context_value, context_traits, parent_environment = env;
    if (this.configuration.context) {
      var context = env.pop();
      context_value = context.value;
      context_traits = context.traits;
    } else {
      context_value = null;
      context_traits = [];
    }
    var configuration = Object.freeze({
      instructions: env.instructions,
      pointer: this.target,
      parameters: this.configuration.parameters,
      spread: this.configuration.spread,
      scope: env.scope,
      context: context_value,
      set_parent_environment(env) {
        parent_environment = env;
      }
    });
    Object.defineProperty(invoke, CONST.EL, {
      value: configuration
    });
    env.operand.push(new runtime.Value(invoke, context_traits));
  }
});
function PROCEDURE(target, configuration) {
  return new ProcedureInstruction(target, configuration);
}

function execute_el_function(env, fun, args, tailcall) {
  var
    f_val = fun.value,
    a_val = args.value.map(_ => runtime.wrap_proxy(_, env));
  var configuration = f_val[CONST.EL];
  var new_model = {
    self: f_val,
    'this': runtime.unwrap_proxy(fun.traits.context),
    'arguments': a_val.slice()
  };
  setup_call_parameters(
    new_model,
    configuration.parameters,
    a_val,
    configuration.spread);

  // dummy traits container
  var traits = util.concat(fun.traits, args.traits);
  if (tailcall) {
    // collect all rest traits
    while (env.data.length) {
      let rest = env.data.pop();
      if (util.traits.is_array(rest) && rest[TRAITS_SYMBOL])
        util.push_concat(traits, rest);
    }

    // collapse stack frame
    if (env.stack.length) {
      env.pop_environment();
      env.push_environment();
    }
    util.push_concat(env.base_traits, traits);
  } else {
    env.data.push(Object.defineProperty(traits, TRAITS_SYMBOL, {value: true}));
    env.push_environment();
  }
  env.set_scope({
    inherit: true,
    base_scope: configuration.scope,
    new_model: new_model
  });
  env.instructions = configuration.instructions;
  env.pointer = configuration.pointer;
  return true;  // jump according to instruction's specification
}

function execute_extern_function(env, fun, args) {
  env.data.push(Object.defineProperty([], TRAITS_SYMBOL, {value: true}));
  var value = Reflect.apply(
    fun.value,
    runtime.wrap_proxy(fun.traits.context) || null,
    args.value.map(_ => runtime.wrap_proxy(_, env)));
  env.operand.push(new runtime.Value(
    value,
    util.concat(fun.traits, args.traits)));
}

function ApplyInstruction() {}
util.inherit(ApplyInstruction, Instruction, {
  tag: 'APPLY',
  execute(env) {
    var fun = env.operand.pop();
    var args = env.operand.pop();
    if (!util.traits.is_function(fun.value)) {
      env.data.push(Object.defineProperty([], TRAITS_SYMBOL, {value: true}));
      env.operand.push(
        new runtime.Value(undefined, util.concat(fun.traits, args.traits)));
    } else if (fun.value[CONST.EL])
      return execute_el_function(env, fun, args);
    else
      return execute_extern_function(env, fun, args);
  }
});
function APPLY() {
  return new ApplyInstruction;
}

function ReturnInstruction() {}
util.inherit(ReturnInstruction, Instruction, {
  tag: 'RETURN',
  execute(env) {
    if (env.stack.length) {
      var value = env.operand.pop();
      env.pop_environment();
      env.operand.push(value);
      if (env.data.length && env.data[env.data.length - 1][TRAITS_SYMBOL])
        util.push_concat(env.data[env.data.length - 1], env.base_traits);
      else
        env.data.push(
          Object.defineProperty(env.base_traits, TRAITS_SYMBOL, {value: true}));
    } else {
      util.push_concat(
        env.operand[env.operand.length - 1].traits,
        env.base_traits);
      return -1;
    }
  }
});
function RETURN() {
  return new ReturnInstruction;
}

function TailcallInstruction() {}
util.inherit(TailcallInstruction, Instruction, {
  tag: 'TAILCALL',
  execute(env) {
    var fun = env.operand.pop();
    var args = env.operand.pop();
    if (!util.traits.is_function(fun.value)) {
      env.pop_environment();
      env.data.push(Object.defineProperty([], TRAITS_SYMBOL, {value: true}));
      env.operand.push(
        new runtime.Value(undefined, util.concat(fun.traits, args.traits)));
      return;
    }
    if (fun.value[CONST.EL])
      return execute_el_function(env, fun, args, true);
    else
      return execute_extern_function(env, fun, args);
  }
});
function TAILCALL() {
  return new TailcallInstruction;
}

function PopInstruction() {}
util.inherit(PopInstruction, Instruction, {
  tag: 'POP',
  execute(env) {
    env.operand.pop();
  }
});
function POP() {
  return new PopInstruction;
}

function ForcePrimitiveInstruction() {}
util.inherit(ForcePrimitiveInstruction, Instruction, {
  tag: 'FORCE_PRIMITIVE',
  execute(env) {
    env.operand[env.operand.length - 1].traits = [];
  }
});
function FORCE_PRIMITIVE() {
  return new ForcePrimitiveInstruction;
}

function MemberInstruction() {}
util.inherit(MemberInstruction, Instruction, {
  tag: 'MEMBER',
  execute(env) {
    var name = env.operand.pop();
    var target = env.operand.pop();
    var traits = util.concat(target.traits, name.traits);
    if (util.traits.is_undefined(target.value) ||
        util.traits.is_null(target.value) ||
        util.traits.is_symbol(target.value))
      env.operand.push(new runtime.Value(undefined, traits));
    else {
      traits.push([target.value, name.value]);
      var bind_path;
      if (target.traits.bindable) {
        bind_path = target.traits.bind_path;
        bind_path.push(name.value);
      } else
        bind_path = [target.value, name.value];
      traits.bindable = true;
      traits.context = target.value;
      traits.context_property = name.value;
      traits.bind_path = bind_path;
      env.operand.push(
        new runtime.Value(
          Reflect.get(target.value, name.value),
          traits));
    }
  }
});
function MEMBER() {
  return new MemberInstruction;
}

function PopDataInstruction() {}
util.inherit(PopDataInstruction, Instruction, {
  tag: 'DATA_POP',
  execute(env) {
    env.operand.push(env.data.pop());
  }
});
function DATA_POP() {
  return new PopDataInstruction;
}

function PushDataInstruction() {}
util.inherit(PushDataInstruction, Instruction, {
  tag: 'DATA_PUSH',
  execute(env) {
    env.data.push(env.operand.pop());
  }
});
function DATA_PUSH() {
  return new PushDataInstruction;
}

function InjectTraitsInstruction() {}
util.inherit(InjectTraitsInstruction, Instruction, {
  tag: 'INJECT_TRAITS',
  execute(env) {
    var traits = env.operand.pop();
    if (env.operand.length)
      util.push_concat(env.operand[env.operand.length - 1].traits, traits);
  }
});
function INJECT_TRAITS() {
  return new InjectTraitsInstruction;
}

function ExtractTraitsInstruction() {}
util.inherit(ExtractTraitsInstruction, Instruction, {
  tag: 'TRAITS',
  execute(env) {
    var traits = Object.assign(
      [],
      env.operand[env.operand.length - 1].traits);
    Object.defineProperty(traits, TRAITS_SYMBOL, {value: true});
    env.operand.push(traits);
  }
});
function TRAITS() {
  return new ExtractTraitsInstruction;
}

function LoadGlobalInstruction() {}
util.inherit(LoadGlobalInstruction, Instruction, {
  tag: 'LOAD_GLOBAL',
  execute(env) {
    env.operand.push(new runtime.Value(env.get_global(), []));
  }
});
function LOAD_GLOBAL() {
  return new LoadGlobalInstruction;
}

function ObjectInstruction() {}
util.inherit(ObjectInstruction, Instruction, {
  tag: 'OBJ',
  execute(env) {
    var pairs = env.operand[env.operand.length - 1];
    var value = {};
    for (var pair of pairs.value)
      value[pair[0]] = pair[1];
    env.operand[env.operand.length - 1] = new runtime.Value(value, pairs.traits);
  }
});
function OBJ() {
  return new ObjectInstruction;
}

function NumberStreamInstruction() {}
util.inherit(NumberStreamInstruction, Instruction, {
  tag: 'NUMBER_STREAM',
  execute(env) {
    var filter = env.operand.pop();
    var end = env.operand.pop();
    var next = env.operand.pop();
    var step = env.operand.pop();
    var start = env.operand.pop();
    var traits = util.concat(
      filter.traits, end.traits, next.traits, step.traits, start.traits
    );

    filter = filter.value;
    end = end.value;
    next = next.value;
    step = step.value;
    start = start.value;

    if (!util.traits.is_function(filter))
      filter = () => true;

    if (util.traits.is_number(step))
      next = start + step;
    else if (util.traits.is_number(next))
      step = next - start;
    else {
      next = start + 1;
      step = 1;
    }

    function *number_stream() {
      if (start >= end)
        return ;
      else if (filter(start))
        yield start;
      while (!(next >= end)) {
        if (filter(next))
          yield next;
        next += step;
      }
    }

    env.operand.push(new runtime.Value(number_stream, traits));
  }
});
function NUMBER_STREAM() {
  return new NumberStreamInstruction;
}

function PromiseInstruction(value, resolve, reject) {
  this.value = value;
  this.resolve = resolve;
  this.reject = reject;
}
util.inherit(PromiseInstruction, Instruction, {
  tag: 'PROMISE',
  resolver(value, state) {
    var traits;
    if (value instanceof runtime.Value) {
      traits = value.traits;
      value = value.value;
    } else
      traits = [];
    if (value instanceof Promise)
      return this.unwrap_promise(value, traits, state);
    else
      return this.execute_vm({value: value}, traits, state, this.resolve);
  },
  rejecter(error, state) {
    var traits;
    if (value instanceof runtime.Value) {
      traits = value.traits;
      value = value.value;
    } else
      traits = [];
    if (value instanceof Promise)
      return this.unwrap_promise(value, traits, state);
    else
      return this.execute_vm({error: error}, traits, state, this.reject);
  },
  unwrap_promise(promise, traits, state) {
    promise.then(
      value => {
        var resolved_traits;
        if (value instanceof runtime.Value) {
          resolved_traits = util.concat(value.traits, traits);
          value = value.value;
        } else
          resolved_traits = traits;
        return this.resolver(
          new runtime.Value(value, resolved_traits),
          state);
      },
      error => {
        var rejected_traits;
        if (error instanceof runtime.Value) {
          rejected_traits = util.concat(error.traits, traits);
          error = error.value;
        } else
          rejected_traits = traits;
        return this.rejecter(
          new runtime.Value(error, rejected_traits),
          state);
      });
  },
  execute_vm(new_model, traits, state, pointer) {
    var env = new runtime.Environment;
    env.instructions = state.instructions;
    env.pointer = pointer;
    env.set_scope({
      inherit: true,
      base_scope: state.scope,
      new_model: new_model
    });
    var value = env.execute();
    util.push_concat(value.traits, traits);
    return value;
  },
  execute(env) {
    var instructions = env.instructions;
    var scope = env.scope;
    var state = {
      instructions: instructions,
      scope: scope
    };
    var promise = new Promise((resolve, reject) => {
      // evaluate `value` with sub scope containing resolve and reject
      var env = new runtime.Environment;
      env.instructions = instructions;
      env.pointer = this.value;
      env.set_scope({
        inherit: true,
        base_scope: scope,
        new_model: {
          resolve: resolve,
          reject: reject
        }
      });
      try {
        resolve(env.execute());
      } catch (e) {
        reject(new runtime.Value(e, []));
      } finally {
        env.destroy();
      }
    });
    if (this.reject) {
      promise = promise.then(
        value => this.resolver(value, state),
        error => this.rejecter(error, state));
    } else
      promise = promise.then(value => this.resolver(value, state));
    env.operand.push(new runtime.Value(promise, []));
  }
});
function PROMISE(value, resolve, reject) {
  return new PromiseInstruction(value, resolve, reject);
}

function StreamMapInstruction(map) {
  this.map = map;
}
util.inherit(StreamMapInstruction, Instruction, {
  tag: 'STREAM_MAP',
  make_model(iterator, key, value) {
    var model = {
      [iterator.element]: value
    };
    if (!util.traits.is_undefined(iterator.index))
      model[iterator.index] = key;
    if (!util.traits.is_undefined(iterator.reference))
      model[iterator.reference] = iterator.collection;
    return model;
  },
  execute_vm(env, iterator, key, value, vector, traits) {
    var new_model = {
      [iterator.value]: value
    };
    if ('key' in iterator)
      new_model[iterator.key] = key;
    var sub_env = new runtime.Environment;
    sub_env.instructions = env.instructions;
    sub_env.pointer = this.map;
    sub_env.set_scope({
      inherit: true,
      base_scope: env.scope,
      new_model: this.make_model(iterator, key, value)
    });
    var value = sub_env.execute();
    sub_env.destroy();

    util.push_concat(traits, value.traits);
    vector.push(value.value);
  },
  execute(env) {
    var iterator = env.operand.pop();
    var traits = iterator.traits;
    iterator = iterator.value;
    var collection = iterator.collection;
    var vector = [];
    if (collection instanceof Map)
      for (var [key, value] of collection)
        this.execute_vm(env, iterator, key, value, vector, traits);
    else if (util.traits.is_array(collection))
      collection.forEach((value, key) =>
        this.execute_vm(env, iterator, key, value, vector, traits));
    else if (collection && collection[Symbol.iterator]) {
      var count = 0;
      for (var value of collection) {
        this.execute_vm(env, iterator, count, value, vector, traits);
        ++count;
      }
    } else if (util.traits.is_object(collection))
      for (var key in collection)
        this.execute_vm(env, iterator, key, value, vector, traits);
    env.operand.push(new runtime.Value(vector, traits));
  }
});
function STREAM_MAP(map) {
  return new StreamMapInstruction(map);
}

function CurryPlaceholderInstruction() {}
util.inherit(CurryPlaceholderInstruction, Instruction, {
  tag: 'CURRY_PLACEHOLDER',
  execute(env) {
    env.operand.push(new runtime.Value(PLACEHOLDER_SYMBOL, []));
  }
});
function CURRY_PLACEHOLDER() {
  return new CurryPlaceholderInstruction;
}

function BindProcedureInstruction() {}
util.inherit(BindProcedureInstruction, Instruction, {
  tag: 'BIND',
  execute(env) {
    var functor = env.operand.pop();
    var parameters = env.operand.pop();
    var context = functor.traits.context;
    var traits = util.concat(functor.traits, parameters.traits);
    functor = functor.value;
    if (util.traits.is_function(functor) && functor[CONST.EL])
      functor[CONST.EL].set_parent_environment(env);
    parameters = parameters.value;
    env.operand.push(new runtime.Value(function bound(...args) {
      var fill_args = [];
      var arg_length = args.length;
      var curry_ptr = 0, arg_ptr = 0;
      while (curry_ptr < arg_length) {
        if (parameters[curry_ptr] === PLACEHOLDER_SYMBOL)
          fill_args.push(args[arg_ptr++]);
        else
          fill_args.push(parameters[curry_ptr]);
        ++curry_ptr;
      }
      while (arg_ptr < arg_length)
        fill_args.push(args[arg_ptr++]);
      return Reflect.apply(functor, context || this, fill_args);
    }, traits));
  }
});
function BIND() {
  return new BindProcedureInstruction;
}

function ExpressionInstruction(value) {
  this.value = value;
}
util.inherit(ExpressionInstruction, Instruction, {
  tag: 'EXPRESSION',
  execute(env) {
    env.operand.push(
      new runtime.Value(
        new runtime.Expression(
          env.instructions,
          this.value,
          env.scope
        ), []));
  }
});
function EXPRESSION(value) {
  return new ExpressionInstruction(value);
}

function SubstituteInstruction(precondition, body, postcondition) {
  this.precondition = precondition;
  this.body = body;
  this.postcondition = postcondition;
}
util.inherit(SubstituteInstruction, Instruction, {
  tag: 'SUBSTITUTE',
  execute(env) {
    var scope = env.operand.pop();
    var traits = scope.traits;
    scope = scope.value;
    if (scope instanceof el_scope.Scope)
      ;
    else if (util.traits.is_object(scope))
      scope = new el_scope.Scope(scope, env.scope);
    else
      scope = new el_scope.Scope({}, env.scope);
    env.operand.push(
      new runtime.Value(
        new runtime.Substitute(
          scope,
          env.instructions,
          this.precondition,
          this.body,
          this.postcondition
        ), traits
      ));
  }
});
function SUBSTITUTE(precondition, body, postcondition) {
  return new SubstituteInstruction(precondition, body, postcondition);
}

function ExecuteSubstituteInstruction() {}
util.inherit(ExecuteSubstituteInstruction, Instruction, {
  tag: 'EXEC_SUBSTITUTE',
  execute(env) {
    var substitute = env.operand[env.operand.length - 1];
    if (substitute.value instanceof runtime.Substitute) {
      var value = substitute.execute();
      util.push_concat(substitute.traits, value.traits);
      substitute.value = value.value;
    }
  }
});
function EXEC_SUBSTITUTE() {
  return new ExecuteSubstituteInstruction;
}

function LoadScopeInstruction() {}
util.inherit(LoadScopeInstruction, Instruction, {
  tag: 'LOAD_SCOPE',
  execute(env) {
    env.operand.push(new runtime.Value(env.scope, []));
  }
});
function LOAD_SCOPE() {
  return new LoadScopeInstruction;
}

function UseScopeInstruction() {}
util.inherit(UseScopeInstruction, Instruction, {
  tag: 'USE_SCOPE',
  execute(env) {
    env.set_scope({
      base_scope: env.operand.pop().value
    });
  }
});
function USE_SCOPE() {
  return new UseScopeInstruction;
}

function WriteObjectInstruction() {}
util.inherit(WriteObjectInstruction, Instruction, {
  tag: 'OBJ_WRITE',
  execute(env) {
    var value = env.operand.pop();
    var name = env.operand.pop();
    var target = env.operand.pop();
    // value = value.value;
    name = name.value;
    target = target.value;
    if (util.traits.is_undefined(target) || util.traits.is_null(target))
      ;
    else
      Reflect.set(runtime.wrap_proxy(target), name, value.value);
    env.operand.push(value);
  }
});
function OBJ_WRITE() {
  return new WriteObjectInstruction;
}

function assign(scope, name, value) {
  var top = scope;
  while (scope) {
    if (name in scope.model)
      return Reflect.set(
        runtime.wrap_proxy(scope.model),
        name,
        runtime.unwrap_proxy(value));
    else
      scope = scope[CONST.SUPER];
  }
  return Reflect.set(
    runtime.wrap_proxy(top.model),
    name,
    runtime.unwrap_proxy(value));
}

function WriteInstruction() {}
util.inherit(WriteInstruction, Instruction, {
  tag: 'WRITE',
  execute(env) {
    var value = env.operand.pop();
    var name = env.operand.pop();
    assign(env.scope, name.value, value.value);
    util.push_concat(value.traits, name.traits);
    env.operand.push(value);
  }
});
function WRITE() {
  return new WriteInstruction;
}

function TouchInstruction() {}
util.inherit(TouchInstruction, Instruction, {
  tag: 'TOUCH',
  execute(env) {
    var value = env.operand[env.operand.length - 1];
    var traits = value.traits;
    if (traits.bindable)
      if ('context_property' in traits)
        runtime.notify({
          target: traits.context,
          name: traits.context_property,
          type: 'update'
        });
      else
        ;
    else
      runtime.notify({
        target: value.value,
        type: 'update'
      });
  }
});
function TOUCH() {
  return new TouchInstruction;
}

function ForceInstruction() {}
util.inherit(ForceInstruction, Instruction, {
  tag: 'FORCE',
  execute(env) {
    var value = env.operand.pop();
    if (value.value instanceof runtime.Expression) {
      var traits = value.traits;
      value = value.value.evaluate();
      util.push_concat(traits, value.traits);
      value.traits = traits;
    }
    env.operand.push(value);
  }
});
function FORCE() {
  return new ForceInstruction;
}

function LoadSelfReferenceInstruction() {}
util.inherit(LoadSelfReferenceInstruction, Instruction, {
  tag: 'LOAD_SELF_REFERENCE',
  execute(env) {
    env.operand.push(new runtime.Value(env.scope.model, []));
  }
});
function LOAD_SELF_REFERENCE() {
  return new LoadSelfReferenceInstruction;
}

function WatchAllPropertiesInstruction() {}
util.inherit(WatchAllPropertiesInstruction, Instruction, {
  tag: 'WATCH_ALL_PROP',
  execute(env) {
    var value = env.operand[env.operand.length - 1];
    value.traits.push([value.value, CONST.ALL_PROP]);
  }
});
function WATCH_ALL_PROP() {
  return new WatchAllPropertiesInstruction;
}

function MonadBindInstruction() {}
util.inherit(MonadBindInstruction, Instruction, {
  tag: 'MONAD_BIND',
  execute(env) {
    var functor = env.operand.pop();
    if (Reflect.has(functor.value, CONST.EL))
      functor.value[CONST.EL].set_parent_environment(env);
    var monad = env.operand.pop();
    if (monad.value) {
      env.data.push(
        Object.defineProperty(
          [],
          TRAITS_SYMBOL,
          {value: true}));
      env.operand.push(
        new runtime.Value(
          runtime.MONADS
          .get(runtime.unwrap_proxy(monad.value).constructor)
          .bind(functor.value, monad.value),
        util.concat(functor.traits, monad.traits)));
    } else
      env.operand.push(
        new runtime.Value(
          undefined,
          util.concat(functor.traits, monad.traits)));
  }
});
function MONAD_BIND() {
  return new MonadBindInstruction;
}

function MonadReturnInstruction() {}
util.inherit(MonadReturnInstruction, Instruction, {
  tag: 'MONAD_RETURN',
  execute(env) {
    var value = env.operand[env.operand.length - 1];
    value.value =
      runtime.MONADS
        .get(runtime.unwrap_proxy(monad.value))
        ['return'](value.value);
  }
});
function MONAD_RETURN() {
  return new MonadReturnInstruction;
}

return {
  LOAD: LOAD,
  LOOKUP: LOOKUP,
  ITERATOR: ITERATOR,
  ADD: ADD,
  SUB: SUB,
  MUL: MUL,
  DIV: DIV,
  MOD: MOD,
  GT: GT,
  LT: LT,
  GE: GE,
  LE: LE,
  EQ: EQ,
  ANEG: ANEG,
  BNEG: BNEG,
  NEQ: NEQ,
  MARKER: MARKER,
  JNC: JNC,
  JC: JC,
  JMP: JMP,
  LOAD_ARR: LOAD_ARR,
  ARR_PUSH: ARR_PUSH,
  ARR_PUSH_SPREAD: ARR_PUSH_SPREAD,
  PROCEDURE: PROCEDURE,
  APPLY: APPLY,
  RETURN: RETURN,
  TAILCALL: TAILCALL,
  POP: POP,
  FORCE_PRIMITIVE: FORCE_PRIMITIVE,
  MEMBER: MEMBER,
  DATA_POP: DATA_POP,
  DATA_PUSH: DATA_PUSH,
  INJECT_TRAITS: INJECT_TRAITS,
  TRAITS: TRAITS,
  LOAD_GLOBAL: LOAD_GLOBAL,
  OBJ: OBJ,
  NUMBER_STREAM: NUMBER_STREAM,
  PROMISE: PROMISE,
  STREAM_MAP: STREAM_MAP,
  CURRY_PLACEHOLDER: CURRY_PLACEHOLDER,
  BIND: BIND,
  EXPRESSION: EXPRESSION,
  SUBSTITUTE: SUBSTITUTE,
  LOAD_SCOPE: LOAD_SCOPE,
  USE_SCOPE: USE_SCOPE,
  OBJ_WRITE: OBJ_WRITE,
  WRITE: WRITE,
  TOUCH: TOUCH,
  FORCE: FORCE,
  LOAD_SELF_REFERENCE: LOAD_SELF_REFERENCE,
  WATCH_ALL_PROP: WATCH_ALL_PROP,
  MONAD_BIND: MONAD_BIND,
  MONAD_RETURN: MONAD_RETURN,
  EXEC_SUBSTITUTE: EXEC_SUBSTITUTE
};


});
