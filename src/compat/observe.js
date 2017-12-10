define(['util/util'], function (util) {
'use strict';

var
  shim_enabled = false;

function notify_queue(change) {
  if (object_handler_map.has(change.object)) {
    if (!global_queue.size)
      util.async.async(() => process_queue(), 'animate');

    var control = global_object_handler.get(change.object);
    for (var handler of control)
      if (global_queue.has(handler))
        global_queue.get(handler).push(change);
      else
        global_queue.set(handler, [change]);
  }
}

function process_queue(immediate) {
  var set = new Map(global_queue);
  global_queue.clear();
  if (immediate)
    set.forEach(function(change_set, handler) {
      handler(change_set);
    });
  else
    set.forEach(function(change_set, handler) {
      // Promise as microtask does not work in Firefox
      util.async.async(() => handler(change_set), 'animate');
    });
}

var MAX_ARRAY_LENGTH = Math.pow(2,32)-1;

function make_observation(object, control) {
  control.queue = [];
  control.proxy = Proxy.revocable(object, {
    get (target, name, receiver) {
      if (util.traits.is_array(target))
        switch (name) {
        case 'push':
          return (...args) => {
            notify_queue({
              type: 'splice',
              object: target,
            });
            return target.push(...args);
          };
        case 'pop':
        case 'splice':
        case 'shift':
        case 'unshift':
        }
      else
        return target[name];
    },
    set (target, name, new_value) {
      if (object[name] === new_value)
        return true;
      var index = Number(name);
      var record = {
          type: name in object ? 'update' : 'add',
          object: object,
          name: name,
          oldValue: object[name],
          newValue: new_value
      };
      if (util.traits.is_array(object) && name)
        if (name === 'length') {
          var length = Number(new_value);
          if (!Number.isSafeInteger(length) ||
              length < 0 ||
              length >= MAX_ARRAY_LENGTH)
            throw new RangeError('Invalid array length');
          if (length < object.length)
            record = {
              type: 'splice',
              object: object,
              index: length,
              removed: object.slice(length),
              addedCount: 0
            };
          else if (length > object.length)
            record = {
              type: 'splice',
              object: object,
              index: object.length,
              removed: [],
              addedCount: length - object.length
            };
          else
            return true;
        } else if (Number.isSafeInteger(index) && object.length <= index)
          record = {
              type: 'splice',
              object: object,
              index: object.length,
              removed: [],
              addedCount: index - object.length + 1
          };
      notify_queue(record);
      object[name] = new_value;
      return true;
    },
    deleteProperty (target, name) {
      if (name in object) {
        notify_queue({
          type: 'delete',
          object: object,
          name: name,
          oldValue: object[name]
        });
      }
      return delete object[name];
    }
  });
  global_object_proxy.set(object, control.proxy.proxy);
}

function destroy_observation(object, control) {
  control.proxy.revoke();
  global_object_proxy.delete(object);
}

var object_handler_map = new WeakMap;
var handler_object_map = new WeakMap;
var global_object_handler = new WeakMap;
var global_queue = new Map;
var global_object_proxy = new WeakMap;

if (!util.traits.is_function(Object.observe)) {
	Array.observe = Object.observe = function (object, handler, list) {
    if (!util.traits.is_object(object))
      throw new Error('Object.observe cannot observe non-object');
    var control;
    if (global_object_handler.has(object))
        control = global_object_handler.get(object);
    else {
        global_object_handler.set(object, control = new Set);
        make_observation(object, control);
    }

    if (object_handler_map.has(object))
      object_handler_map.get(object).add(handler);
    else
      object_handler_map.set(object, new Set([handler]));
    if (handler_object_map.has(handler))
      handler_object_map.get(handler).add(object);
    else
      handler_object_map.set(handler, new Set([object]));
    control.add(handler);
	};
	Array.unobserve = Object.unobserve = function (object, handler) {
    if (global_object_handler.has(object)) {
      var control = global_object_handler.get(object);
      control.delete(handler);
      if (!control.size) {
        destroy_observation(object, control);
        global_object_handler.delete(object);
      }
      if (object_handler_map.has(object))
        object_handler_map.get(object).delete(handler);
      if (handler_object_map.has(handler))
        handler_object_map.get(handler).delete(object);
    }
	};
  Object.deliverChangeRecords = function (callback) {
    if (handler_object_map.has(callback) && global_queue.has(callback)) {
      var back_store = global_queue;
      global_queue = new Map([[callback, back_store.get(callback)]]);
      back_store.delete(callback);
      process_queue(true);
      global_queue = back_store;
    }
  };
  Object.getNotifier = function (object) {
    return {
      notify(change) {
        if (global_object_handler.has(object))
          notify_queue(
            Object.assign({
              object: object
            }, change));
      },
      performChange(type, process) {
        var change = process();
        if (util.traits.is_object(change) && global_object_handler.has(change.object))
          notify_queue(Object.assign(change, {type: type}));
      }
    };
  };
  var
    array_push = Array.prototype.push, array_pop = Array.prototype.pop,
    array_splice = Array.prototype.splice, array_shift = Array.prototype.shift,
    array_unshift = Array.prototype.unshift;

  Array.prototype.push = function(...args) {
    if (global_object_handler.has(this))
      notify_queue({
        type: 'splice',
        object: this,
        index: this.length,
        removed: [],
        addedCount: args.length
      });
    return array_push.apply(this, args);
  };
  Array.prototype.pop = function () {
    if (this.length && global_object_handler.has(this))
      notify_queue({
        type: 'splice',
        object: this,
        index: this.length - 1,
        removed: [this[this.length - 1]],
        addedCount: 0
      });
    return array_pop.call(this);
  };
  Array.prototype.splice = function (index, removed, ...added) {
    if (Number.isSafeInteger(index) && global_object_handler.has(this)) {
      index = Math.min(this.length, index);
      if (index < 0)
        index = Math.max(0, index + this.length);
      if (removed || added.length)
        notify_queue({
          type: 'splice',
          object: this,
          index: index,
          removed: this.slice(index, removed),
          addedCount: added.length
        });
    }
    return array_splice.call(this, index, removed, ...added);
  };
  Array.prototype.shift = function () {
    if (this.length && global_object_handler.has(this))
      notify_queue({
        type: 'splice',
        object: this,
        index: 0,
        removed: [this[0]],
        addedCount: 0
      });
    return array_shift.call(this);
  };
  Array.prototype.unshift = function (...args) {
    if (args.length && global_object_handler.has(this))
      notify_queue({
        type: 'splice',
        object: this,
        index: 0,
        removed: [],
        addedCount: args.length
      });
    return array_unshift.apply(this, args);
  };
  shim_enabled = true;
}

function get_proxy(object) {
  if (shim_enabled)
    return global_object_proxy.get(object) || object;
  else
    return object;
}

Object.defineProperty(get_proxy, 'shim_enabled', {
  get() {
    return shim_enabled;
  }
});

return get_proxy;

});
