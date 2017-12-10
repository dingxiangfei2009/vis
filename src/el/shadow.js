define(
['./parser', './compile', './el_watch', './template', './runtime',
'util/util'],
function (parser, compile, el_watch, el_template, runtime, util) {
'use strict';

var _proxy = runtime.wrap_proxy;
var VOID_EXPRESSION = compile(parser.parse('void(0)'));

var GLOBAL_EXPRESSION_CACHE = new Map;
var GLOBAL_EXPRESSION_CACHE_QUEUE = new util.adt.AVLTree({
    compareKeys(x, y) {
      return (x > y) - (x < y);
    },
    checkValueEquality(x, y) {
      return x === y;
    }
  });
var GLOBAL_EXPRESSION_CACHE_LIMIT = 1000;

function query_cache(string) {
  if (GLOBAL_EXPRESSION_CACHE.has(string)) {
    var now = util.time.getMillisecond();
    var cache = GLOBAL_EXPRESSION_CACHE.get(string);
    GLOBAL_EXPRESSION_CACHE_QUEUE.delete(cache[0], string);
    GLOBAL_EXPRESSION_CACHE_QUEUE.insert(now, string);
    return cache;
  }
}

function put_cache(string, expression) {
  var now = util.time.getMillisecond();
  GLOBAL_EXPRESSION_CACHE.set(string, expression);
  GLOBAL_EXPRESSION_CACHE_QUEUE.insert(now, string);
  while (GLOBAL_EXPRESSION_CACHE_LIMIT < GLOBAL_EXPRESSION_CACHE.size) {
    var oldest_time = GLOBAL_EXPRESSION_CACHE_QUEUE.getMinKey();
    string = GLOBAL_EXPRESSION_CACHE_QUEUE.search(oldest_time)[0];
    GLOBAL_EXPRESSION_CACHE_QUEUE.delete(oldest_time, string);
    GLOBAL_EXPRESSION_CACHE.delete(string);
  }
}

function parse(string) {
  var expression = query_cache(string);
  if (expression)
    return expression;
  try {
    if (util.traits.is_string(string)) {
      expression = compile(parser.parse(string));
      put_cache(string, expression);
      return expression;
    } else if (util.traits.is_object(string))
      return compile(string);
    else
      return VOID_EXPRESSION;
  } catch (e) {
    console.log("parser/compiler error", string, e);
    return VOID_EXPRESSION;
  }
}

function ShadowContext() {
  this.observe_scope = new runtime.ObserveScope();
  this.unwatch_set = new Set;
}
ShadowContext.prototype = {
  constructor: ShadowContext,
  register(handler) {
    this.unwatch_set.add(handler);
  },
  unregister(handler) {
    this.unwatch_set.delete(handler);
  },
  destroy() {
    for (var handler of this.unwatch_set)
      handler();
    this.unwatch_set.clear();
    this.observe_scope.destroy();
  }
};

function Shadow () {
}

function ShadowValue (context, scope, expression_string, handler) {
  this.handler = handler || util.traits.IDENTITY_FUNCTION;
  this.context = context;
  this.expression = parse(expression_string);
  this.update_handlers = new Set;
  this.watch =
    el_watch(this.expression, {
      observe_scope: context.observe_scope,
      scope: scope,
      handler: value => {
        this.value = this.handler(value);
        this.update();
      }
    });
  this.unwatch_handler = this.watch.unwatch;
  this.bind_handler = this.watch.bind_handler;
  context.register(this.unwatch_handler);
}
util.inherit(ShadowValue, Shadow, {
  update() {
    for (var handler of this.update_handlers)
      handler(this.value);
  },
  register_update(handler) {
    this.update_handlers.add(handler);
    handler(this.value);
  },
  destroy() {
    this.context.unregister(this.unwatch_handler);
    this.unwatch_handler();
  },
  invoke(...args) {
    if (util.traits.is_function(this.value))
      return runtime.force(
        this.value.apply(this.watch.get_context(), args)).value;
  },
  context_invoke(context, ...args) {
    if (util.traits.is_function(this.value))
      return runtime.force(
        this.value.apply(context, args)).value;
  }
});

function FAIL(message) {
  throw new Exception(message);
}

function ShadowObject(map, object) {
  this.shadows = new Map;
  this.value = object || {};
  map.forEach((value, key) => {
    if (value instanceof Shadow) {
      if (this.shadows.has(key))
        FAIL('Duplicate key in shadow object');
      this.shadows.set(key, value);
      value.register_update(value => _proxy(this.value)[key] = value);
    } else
      this.value[key] = value;
  });
}
util.inherit(ShadowObject, Shadow, {
  register_update(handler) {
    handler(this.value);
  },
  get_shadow(property) {
    return this.shadows.get(property);
  },
  destroy() {
    this.shadows.forEach(shadow => shadow.destroy());
  }
});

/**
 * delegate handlers:
 * all_proxy [optional] handling 'update collection', return a collection to be presented
 * splice_proxy [optional] handling 'splice collection'
 * splice_change [optional] handling creation and destruction
 */
function ShadowArray(context, scope, expression_string, delegates, array) {
  this.context = context;
  this.delegates = delegates || {};
  this.value = array || [];
  this.update_handlers = new Set;
  this.expression = parse(expression_string);
  this.unwatch_iterate = el_watch(
    this.expression,
    {
      observe_scope: context.observe_scope,
      scope: scope,
      handler: collection => this.array_update(collection),
      splice_handler: (type, collection, index, added, removed_list) =>
        this.array_splice(type, collection, index, added, removed_list)
    }).unwatch;
  context.register(this.unwatch_iterate);
}
util.inherit(ShadowArray, Shadow, {
  *splice_change() {
    while (true) {
      var change = yield true;
      if (change)
        switch (change.operation) {
        case 'update':
        case 'create':
          yield change.value;
          break;
        case 'destroy':
          yield true;
          break;
        default:
          return;
        }
      else
        break;
    }
  },
  array_update(collection) {
    if (util.traits.is_function(this.delegates.all_proxy)) {
      var ret_array =
        this.delegates
        .all_proxy(collection, this.value);
      this.value.length = 0;
      util.push_concat(this.value, ret_array);
      return this.update();
    }
    var pipe = this.delegates.splice_change ?
      this.delegates.splice_change(collection, this.value) :
      this.splice_change(collection);
    pipe.next();  // start
    if (util.traits.is_array(collection)) {
      for (var i = 0, end = collection.length; i < end; ++i)
        if (i < this.value.length) {
          _proxy(this.value)[i] = pipe.next({
            operation: 'update',
            key: i,
            value: collection[i],
            target: this.value[i]
          }).value;
          pipe.next();
        } else {
          this.value.push(pipe.next({
              operation: 'create',
              key: i,
              value: collection[i]
            }).value);
          pipe.next();
        }
      for (var i = this.value.length - 1, end = collection.length - 1; i > end; --i) {
        pipe.next({
          operation: 'destroy',
          key: i,
          target: this.value[i]
        });
        pipe.next();
        this.value.pop();
      }
    } else {
      for (var i = 0, end = this.value.length; i < end; ++i) {
        pipe.next({
          operation: 'destroy',
          key: 0,
          target: this.value[i]
        });
        pipe.next();
      }
      this.value.length = 0;
      if (collection instanceof Map)
        collection.forEach((value, key) => {
          this.value.push(pipe.next({
              operation: 'create',
              key: key,
              value: value
            }).value);
          pipe.next();
        });
      else if (collection && collection[Symbol.iterator]) {
        var count = 0;
        for (var value of collection) {
          this.value.push(pipe.next({
              operation: 'create',
              key: count,
              value: value
            }).value);
          pipe.next();
          ++count;
        }
      }
    }
    pipe.next();
    this.update();
  },
  array_splice(type, collection, index, added_list, removed_list) {
    if (util.traits.is_function(this.delegates.splice_proxy)) {
      var ret_array =
        this.delegates
        .splice_proxy(type, collection, index, added_list, removed_list, this.value);
      this.value.length = 0;
      util.push_concat(this.value, ret_array);
      return this.update();
    } else if (type === 'splice') {
      var pipe = this.delegates.splice_change ?
        this.delegates.splice_change(collection, this.value) :
        this.splice_change(collection);
      pipe.next();  // start
      var new_values = [];
      for (var i = index + removed_list.length - 1, end = index; i >= end; --i) {
        pipe.next({
          operation: 'destroy',
          key: i,
          target: this.value[i]
        });
        pipe.next();
      }
      for (var i = index, end = index + added_list.length; i < end; ++i) {
        new_values.push(pipe.next({
            operation: 'create',
            key: i,
            value: collection[i]
          }).value);
        pipe.next();
      }
      this.value.splice(index, removed_list.length, ...new_values);
      pipe.next();
      this.update();
    } else if (Number.isSafeInteger(Number(index))) {
      index = Number(index);
      var pipe = this.delegates.splice_change ?
        this.delegates.splice_change(collection, this.value) :
        this.splice_change(collection);
      pipe.next();
      if (index < this.value.length) {
        this.value[index] = pipe.next({
            operation: 'update',
            key: index,
            value: collection[index],
            target: this.value[index]
          }).value;
        pipe.next();
      } else {
        this.value[index] = pipe.next({
          operation: 'create',
          key: index,
          value: collection[index]
        }).value;
        pipe.next();
      }
      pipe.next();  // terminating
      this.update();
    }
  },
  update() {
    for (var handler of this.update_handlers)
      handler(this.value);
  },
  register_update(handler) {
    this.update_handlers.add(handler);
    handler(this.value);
  },
  destroy() {
    this.array_update([]);  // purge all elements
    this.context.unregister(this.unwatch_iterate);
    this.unwatch_iterate();
  }
});

function ShadowTemplate (context, scope, raw_string, handler, options) {
  this.handler = handler || util.traits.IDENTITY_FUNCTION;
  this.context = context;
  this.update_handlers = new Set;
  this.template = el_template.slice_template(raw_string, options);
  var unwatch = this.unwatch_handler =
    el_template.text_template(
      this.template,
      scope,
      context.observe_scope,
      value => {
        this.value = this.handler(value);
        this.update();
      });
  if (unwatch)
    context.register(unwatch);
  else
    context.register(this.unwatch_handler = ()=>{});
}
util.inherit(ShadowTemplate, Shadow, {
  update() {
    for (var handler of this.update_handlers)
      handler(this.value);
  },
  register_update(handler) {
    this.update_handlers.add(handler);
    handler(this.value);
  },
  destroy() {
    this.context.unregister(this.unwatch_handler);
    this.unwatch_handler();
  }
});

function object(map, object) {
  return new ShadowObject(map, object);
}

function array(context, scope, expression_string, create, destroy) {
  return new ShadowArray(context, scope, expression_string, create, destroy);
}

function value(context, scope, expression_string, handler) {
  return new ShadowValue(context, scope, expression_string, handler);
}

function template(context, scope, raw_string, handler, options) {
  return new ShadowTemplate(context, scope, raw_string, handler, options);
}

function parse_expression(expression_string, expression_cache) {
  if (expression_cache.has(expression_string))
    return expression_cache.get(expression_string);
  else {
    var expression = parse(expression_string);
    expression_cache.set(expression_string, expression);
    return expression;
  }
}

function perform_changes(change_set, scope, expression_cache) {
  expression_cache = expression_cache || new Map;
  for (var change of change_set) {
    var value = change[1];
    if (util.traits.is_string(change[0])) {
      var result = runtime.evaluate(parse(change[0]), scope);
      if (result.traits.bindable)
        runtime.bind_value(result.traits.bind_path, value);
    } else if (util.traits.is_array(change[0])) {
      var chain = change[0].slice();
      var first_property = chain[0];
      // in agreement with evaluater behaviour
      chain.unshift(runtime.lookup(scope, first_property).traits.context);
      runtime.bind_value(chain, value);
    } else if (change[0]) {
      var record = change[0];
      var target;
      if (util.traits.is_string(record.object))
        target =
          runtime.evaluate(
            parse(record.object),
            scope);
      else if (util.traits.is_array(record.object)) {
        var chain = record.object;
        var first_property = chain[0];
        target = runtime.wrap_proxy(
          runtime.lookup(scope, first_property)
            .traits
            .context);
        for (var i = 0, end = chain.length; i < end; ++i)
          if (target)
            target = ptr[chain[i]];
        if (target)
          if (target.splice && record.type === 'splice')
            target.splice(record.index, record.removed, ...record.added);
          else
            target[record.name] = record.value;
      }
    }
  }
}

return {
  object: object,
  array: array,
  value: value,
  template: template,
  perform_changes: perform_changes,
  ShadowContext: ShadowContext
};

});
