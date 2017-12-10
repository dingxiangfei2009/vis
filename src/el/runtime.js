define(['util/util', './scope', './el_const', './standard'],
function(util, el_scope, CONST, standard) {
'use strict';

const
  observe_registry = new WeakMap,
  reverse_observe_registry = new WeakMap;
var queue = [];

function watch(dependencies, callback) {
  var ptr;
  for (var [target, name] of dependencies)
    if (util.traits.is_object(target)) {
      if (observe_registry.has(target))
        ptr = observe_registry.get(target);
      else
        observe_registry.set(target, ptr = new Map);
      if (ptr.has(name)) {
        ptr = ptr.get(name);
        ptr.add(callback);
      } else {
        let t = new Set([callback]);
        ptr.set(name, t);
        ptr = t;
      }

      if (reverse_observe_registry.has(callback))
        reverse_observe_registry.get(callback).add(ptr);
      else
        reverse_observe_registry.set(callback, new Set([ptr]));
    }
}
function unwatch(dependencies, callback) {
  var ptr;
  for (var [target, name] of dependencies)
    if (observe_registry.has(target)) {
      ptr = observe_registry.get(target);
      if (ptr.has(name)) {
        ptr = ptr.get(name);
        ptr.delete(callback);
        if (reverse_observe_registry.has(callback))
          reverse_observe_registry.get(callback).delete(ptr);
      }
    }
}
function unwatch_all(callback) {
  if (reverse_observe_registry.has(callback)) {
    for (var set of reverse_observe_registry.get(callback))
      set.delete(callback);
    reverse_observe_registry.delete(callback);
  }
}

var observation_enabled = true;
function notify(record) {
  if (!observation_enabled)
    return;
  if (!queue.length)
    util.async.async(process_queue);
  queue.push(record);
}

function notify_splice(record, original_length) {
  if (record.added.length === record.removed.length)
    for (var i = record.index, end = record.index + record.added.length;
      i < end; ++i)
      notify({
        type: 'update',
        target: record.target,
        name: i,
        index: i,
        splice_emitted: true
      });
  else {
    var new_length =
      original_length + record.added.length - record.removed.length;
    notify({
      type: 'update',
      target: record.target,
      name: 'length',
      old_value: original_length,
      new_value: new_length,
      splice_emitted: true
    });
    for (
      var i = record.index,
        end = original_length + record.added.length - record.removed.length;
      i < end;
      ++i)
      notify({
        type: 'update',
        target: record.target,
        name: i,
        index: i,
        splice_emitted: true
      });
    for (var i = original_length; i < new_length; ++i)
      notify({
        type: 'add',
        target: record.target,
        name: i,
        index: i,
        splice_emitted: true
      });
    for (var i = new_length; i < original_length; ++i)
      notify({
        type: 'delete',
        target: record.target,
        name: i,
        index: i,
        splice_emitted: true
      });
  }
}

function is_valid_splice_property(name) {
  if (name === CONST.SPLICE)
    return true;
  var index = Number(name);
  return Number.isSafeInteger(index) &&
    index < MAX_ARRAY_LENGTH;
}

function process_queue() {
  var records = queue.slice();
  queue.length = 0;
  var handler_visited = new Set;
  for (var record of records) {
    var target = unwrap_proxy(record.target), name = unwrap_proxy(record.name);
    if (observe_registry.has(target)) {
      var target_observers = observe_registry.get(target);
      if (target_observers.has(CONST.ALL_PROP))
        for (var handler of target_observers.get(CONST.ALL_PROP))
          if (!handler_visited.has(handler) &&
              !handler(record))
            handler_visited.add(handler);

      if (target_observers.has(CONST.SPLICE) && is_valid_splice_property(name))
        target_observers.get(CONST.SPLICE).forEach(handler => handler(record));
      if (name !== CONST.SPLICE && target_observers.has(name))
        for (var handler of target_observers.get(name))
          if (!handler_visited.has(handler) &&
              !handler(record))
            handler_visited.add(handler);
    }
  }
}

function ObserveScope() {
  this.handlers = new Set;
}
Object.assign(ObserveScope.prototype, {
  add(handler) {
    this.handlers.add(handler);
  },
  remove(handler) {
    this.handlers.delete(handler);
    unwatch_all(handler);
  },
  destroy() {
    for (var handler of this.handlers)
      unwatch_all(handler);
  }
});

function bind_value(path, value) {
	var ptr = wrap_proxy(path[0]);
	var i = 1, length = path.length - 1;
	while (i < length)
		if (util.traits.is_object(ptr) || util.traits.is_function(ptr))
			ptr = ptr[path[i++]];
		else
			return ;
	ptr[path[length]] = value;
}

const MAX_ARRAY_LENGTH = Math.pow(2,32) - 1;
var PROXY_TARGET = Symbol('proxy target');

function is_runtime_object(v) {
  return v instanceof Environment ||
    v instanceof Expression ||
    v instanceof Substitute ||
    v instanceof Value ||
    v instanceof Iterator ||
    v instanceof el_scope.Scope;
}

function wrap_proxy(target, env) {
  if (is_runtime_object(target) ||
    !util.traits.is_object(target) ||
    Reflect.has(target, PROXY_TARGET))
    return target;
  else if (Reflect.has(target, CONST.ESCAPE_PROXY))
    return Reflect.get(target, CONST.ESCAPE_PROXY);
  return new Proxy(target, {
    get(target, name, receiver) {
      if (name === PROXY_TARGET)
        return target;
      else if (util.traits.is_array(target))
        switch (name) {
          case 'splice':
            return function(index, delete_count, ...new_items) {
              var record = {
                type: 'splice',
                target: target,
                name: CONST.SPLICE,
                index: index,
                removed: target.slice(index, delete_count),
                added: new_items
              };
              notify(record);
              notify_splice(record, target.length);
              return target.splice(index, delete_count, ...new_items);
            };
          case 'push':
            return function(...new_items) {
              var record = {
                type: 'splice',
                target: target,
                name: CONST.SPLICE,
                index: target.length,
                removed: [],
                added: new_items
              }
              notify(record);
              notify_splice(record, target.length);
              return target.push(...new_items);
            };
          case 'pop':
            return function() {
              if (target.length) {
                var end_pos = target.length - 1;
                var record = {
                  type: 'splice',
                  target: target,
                  name: CONST.SPLICE,
                  index: end_pos,
                  removed: [target[end_pos]],
                  added: []
                };
                notify(record);
                notify_splice(record, target.length);
                return target.pop();
              }
            };
          case 'shift':
            return function() {
              if (target.length) {
                var record = {
                  type: 'splice',
                  target: target,
                  name: CONST.SPLICE,
                  index: 0,
                  removed: [target[0]],
                  added: []
                };
                notify(record);
                notify_splice(record, target.length);
                return target.shift();
              }
            };
          case 'unshift':
            return function(...new_items) {
              var record = {
                type: 'splice',
                target: target,
                name: CONST.SPLICE,
                index: 0,
                removed: [],
                added: new_items
              };
              notify(record);
              notify_splice(record, target.length);
              return target.unshift(...new_items);
            };
          // involves side effects on `target` which are
          // to be captured by this proxy
          case 'fill':
          case 'reverse':
          case 'sort':
          case 'copyWithin':
            return Array.prototype[name];
          // no side effects on `target`
          case 'concat':
          case 'entries':
          case 'every':
          case 'filter':
          case 'find':
          case 'findIndex':
          case 'forEach':
          case 'includes':
          case 'indexOf':
          case 'join':
          case 'keys':
          case 'lastIndexOf':
          case 'map':
          case 'reduce':
          case 'reduceRight':
          case 'slice':
          case 'some':
          case 'toLocaleString':
          case 'toString':
          case 'values':
          case Symbol.iterator:
            return (...args) => target[name](...args);
        }
      var value = unwrap_proxy(Reflect.get(target, name));
      if (is_runtime_object(target) || is_runtime_object(value))
        return value;
      else if (util.traits.is_object(value))
        return wrap_proxy(value);
      else if (util.traits.is_function(value)) {
        if (Reflect.has(value, CONST.EL) && env instanceof Environment)
          value[CONST.EL].set_parent_environment(env);
        return wrap_proxy(value);
      } else
        return value;
    },
    has(target, name) {
      if (name === PROXY_TARGET)
        return true;
      else
        return Reflect.has(target, name);
    },
    delete(target, name, receiver) {
      var index = Number(name);
      if (Reflect.delete(target, name)) {
        notify({
          target: target,
          type: 'delete',
          name:
            util.traits.is_array(target) &&
            Number.isSafeInteger(index) &&
            index < MAX_ARRAY_LENGTH ?
              index : name,
          old_value: Reflect.get(target, name)
        });
        return true;
      } else
        return false;
    },
    set(target, name, value, receiver) {
      var old_value = Reflect.get(target, name);
      if (old_value === value)
        return true;
      // report to global observer
      var record = {
        target: target,
        type: Reflect.has(target, name) ? 'update' : 'add',
        name: name,
        old_value: old_value,
        new_value: value
      };
      var splice_operation = false;
      if (util.traits.is_array(target)) {
        let index = util.traits.is_number(name) ? name : Number(name);
        let length = target.length;
        if (Number.isSafeInteger(index) && index < MAX_ARRAY_LENGTH)
          if (index < length)
            record.name = index;
          else {
            let vector = Array(index - length + 1).fill();
            vector[index - length] = value;
            record = {
              target: target,
              type: 'splice',
              name: CONST.SPLICE,
              index: index,
              removed: [],
              added: vector
            };
            splice_operation = true;
          }
        else if (name === 'length') {
          if (length < value) {
            record = {
              target: target,
              type: 'splice',
              name: CONST.SPLICE,
              index: value,
              removed: [],
              added: Array(value - length).fill()
            };
            splice_operation = true;
          } else if (length > value) {
            record = {
              target: target,
              type: 'splice',
              name: CONST.SPLICE,
              index: length,
              removed: target.slice(value),
              added: []
            };
            splice_operation = true;
          }
        }
      } else if (util.traits.is_object(target))
        ;
      else
        // primitives: no effects
        return true;
      // normal object
      notify(record);
      if (splice_operation)
        notify_splice(record);
      return Reflect.set(target, name, value);
    }
  });
}

function unwrap_proxy(proxy) {
  return util.traits.is_object(proxy) && Reflect.has(proxy, PROXY_TARGET) ?
    Reflect.get(proxy, PROXY_TARGET) : proxy;
}

function Value(value, traits) {
  this.value = unwrap_proxy(value);
  this.traits = traits;
}

function Environment(scope) {
  this.scope = scope;
  this.data = [];
  this.operand = [new Value(undefined, [])];
  this.pointer = 0;
  this.stack = [];
  this.base_traits = [];
  this.interrupt = null;
}
Object.assign(Environment.prototype, {
  get_global() {
    return standard.library;
  },
  push_environment() {
    this.stack.push({
      scope: this.scope,
      operand: this.operand,
      data: this.data,
      instructions: this.instructions,
      pointer: this.pointer,
      base_traits: this.base_traits
    });
    this.data = [];
    this.operand = [new Value(undefined, [])];
    this.base_traits = [];
  },
  pop_environment() {
    if (this.stack.length) {
      var env = this.stack.pop();
      this.scope = env.scope;
      this.operand = env.operand;
      this.data = env.data;
      this.instructions = env.instructions;
      this.pointer = env.pointer;
      this.base_traits = env.base_traits;
    }
  },
  execute() {
    var interrupt = this.interrupt;
    while (true) {
      if (interrupt && interrupt()) {
        if (!this.paused)
          this.resume_promise = new Promise(
            resolve => {
              this.paused = true;
              var continuation = this.continuation;
              this.continuation = function(value) {
                this.resume_promise = null;
                this.paused = false;
                resolve(value);
                if (util.traits.is_function(continuation))
                  util.async.async(() => continuation(value));
              };
            });
        return new Value(this.resume_promise, []);
      }
      var exec_result = this.instructions[this.pointer].execute(this);
      if (exec_result > 0)
        ;
      else if (exec_result < 0) {
        var value = this.operand[this.operand.length - 1];
        if (util.traits.is_function(this.continuation))
          this.continuation(value);
        return value;
      } else
        ++this.pointer;
    }
  },
  set_scope(option) {
    if (option.inherit)
      this.scope = new el_scope.Scope(option.new_model, option.base_scope);
    else if (option.base_scope instanceof el_scope.Scope)
      this.scope = option.base_scope;
    else
      this.scope = new el_scope.Scope(option.base_scope);
  },
  destroy() {
    this.destroyed = true;
  }
});

function Expression(instructions, value, scope) {
  this.instructions = instructions;
  this.value = value;
  this.scope = scope;
}
Expression.prototype.evaluate = function() {
  var expr = this;
  var traits;
  while (true) {
    var env = new Environment(expr.scope);
    env.instructions = expr.instructions;
    env.pointer = expr.value;
    var value = env.execute();
    if (traits)
      util.push_concat(traits, value.traits);
    else
      traits = value.traits;
    value = value.value;
    env.destroy();
    if (value instanceof Expression)
      expr = value;
    else
      break;
  }
  return new Value(value, traits);
};

function Iterator(collection, element, index, reference) {
  this.iterate = true;
  this.collection = collection;
  this.element = element;
  this.index = index;
  this.reference = reference;
}
Iterator.prototype[Symbol.iterator] = function *() {
  yield* this.collection;
};

function Substitute(scope, instructions, precondition, body, postcondition) {
  this.scope = scope;
  this.instructions = instructions;
  this.precondition = precondition;
  this.body = body;
  this.postcondition = postcondition;
}
Substitute.prototype.execute = function() {
  // precondition
  var env, value = this;
  var traits = [];
  env = new Environment(this.scope);
  env.instructions = this.instructions;
  env.pointer = this.precondition;
  value = force(env.execute());
  util.push_concat(traits, value.traits);
  value = value.value;
  env.destroy();
  while (value instanceof Substitute) {
    value = value.execute();
    util.push_concat(traits, value.traits);
    value = value.value;
  }
  if (!value)
    return new Value(undefined, traits);

  env = new Environment(this.scope);
  env.instructions = this.instructions;
  env.pointer = this.body;
  var return_value = env.execute();
  env.destroy();
  util.push_concat(return_value.traits, traits);

  env = new Environment(this.scope);
  env.instructions = this.instructions;
  env.pointer = this.postcondition;
  var value = force(env.execute().value).value;
  env.destroy();
  while (value instanceof Substitute)
    value = force(value.evaluate()).value;

  return return_value;
};

function force(value) {
  if (value instanceof Value) {
    var traits = value.traits;
    value = value.value;
    if (value instanceof Expression) {
      value = value.evaluate();
      util.push_concat(traits, value.traits);
      value = value.value;
    }
    return new Value(value, traits);
  } else
    return new Value(value, []);
}

function evaluate(instructions, scope) {
  var env = new Environment(scope);
  env.instructions = instructions;
  var value = env.execute();
  env.destroy();
  return value;
}

function lookup(scope, name) {
  var deps = [];
  deps.bindable = true;
  deps.bind_path = [];
  deps.context = null;
  deps.context_property = name;
  var origin = scope;
  while (scope) {
    deps.push([scope.model, name]);
    if (Reflect.has(scope.model, name)) {
      deps.bind_path.push(scope.model, name);
      deps.context = scope.model;
      return new Value(
        Reflect.get(scope.model, name),
        deps);
    } else
      scope = scope[CONST.SUPER];
  }
  deps.bind_path.push(origin.model, name);
  deps.context = origin.model;
  return new Value(undefined, deps);
}

var MONADS = new Map([
	[
		Array,
		{
			'return': function(x) {return [x];},
			'bind': function (f, x) {
				return x.map(f);
			}
		}],
	[
		Object,
		{
			'return': function (x) {return {[x[0]]: x[1]}; },
			'bind': function (f, x) {
				var o = {};
				for (var key in x)
					o[key] = f(x[key]);
				return o;
			}
		}],
	[
		Set,
		{
			'return': function (x) {return new Set([x]);},
			'bind': function (f, x) {
				var s = new Set;
        x.forEach(e => s.add(f(e)));
				return s;
			}
		}],
	[
		Map,
		{
			'return': function (x) {return new Map([x]);},
			'bind': function (f, x) {
				var m = new Map;
				x.forEach((v, k) => m.set(k, f(v)));
				return m;
			}
	}]
]);

return Object.freeze({
  ObserveScope: ObserveScope,
  Environment: Environment,
  Expression: Expression,
  Iterator: Iterator,
  Value: Value,
  Substitute: Substitute,
  force: force,
  bind_value: bind_value,
  wrap_proxy: wrap_proxy,
  unwrap_proxy: unwrap_proxy,
  notify: notify,
  watch: watch,
  unwatch: unwatch,
  unwatch_all: unwatch_all,
  lookup: lookup,
  evaluate: evaluate,
  MONADS: MONADS
});

});
