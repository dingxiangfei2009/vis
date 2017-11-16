importScripts('/require.js');
require.config({
  baseUrl: '/src'
});
require(['el/el'], function (el_service) {
  el = el_service;
  onmessage = process_message;
  postMessage({type: 'ready'});
  scope = new el.scope.Scope(model);
  tick_handler = setInterval(tick, 10);
});
var scope, model = {};
var el, message_port, tick_handler;
var expression_cache = new Map;

function tick() {
  message_port.postMessage({
    type: 'changeset',
    content: [
      ['output', model.input * 2]
    ]
  });
}

function set_message_port(port) {
  message_port = port;
  message_port.addEventListener('message', process_channel);
  message_port.start();
}

function perform_changeset(change_set) {
  for (var change of change_set) {
    var el_str = change[0];
    var value = change[1];
    var expression;
    if (expression_cache.has(el_str))
      expression = expression_cache.get(el_str);
    else
      expression_cache.set(el_str, expression = el.parser.parse(el_str));
    var result = el.eval.evaluate_el(expression, scope);
    if (result.traits.bindable)
      el.eval.bind_value(result.traits.bind_path, value);
  }
}

function process_channel(e) {
  var message = e.data;
  switch (message.type) {
  case 'changeset':
    perform_changeset(message.content);
    break;
  }
}

function process_message(e) {
  var message = e.data;
  switch (message.type) {
  case 'set-message-port':
    set_message_port(message.content);
    break;
  }
}
