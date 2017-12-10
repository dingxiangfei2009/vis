define(['./runtime', 'util/util'], function(runtime, util) {

function non_blocking(instructions, scope, slot_length) {
  slot_length = slot_length || 10000;
  var env = new runtime.Environment(scope);
  env.instructions = instructions;
  var start;
  env.interrupt = function() {
    return start + slot_length < performance.now();
  };
  var resolve;
  function execute() {
    start = performance.now();
    var result = env.execute();
    if (env.paused) {
      util.async.async(execute, 'animate');
      if (!resolve) {
        var promise = new Promise($resolve => resolve = $resolve);
        return promise;
      }
    } else if (resolve)
      resolve(result);
    else
      return Promise.resolve(result);
  }
  return execute();
}

function parallel(expression, model, scripts) {
  var worker = util.worker(`
addEventListener('message', e => execute(e.data));
var model;
function execute(configuration) {
  // model is available at self.model
  // scripts can access this value and make changes
  model = configuration.model;
  importScripts(...configuration.scripts);
  require(['el/el'], function(el) {
    postMessage(el.runtime.evaluate(
      el.compile(el.parser.parse(configuration.expression)),
      new el.scope.Scope(configuration.model)
    ).value);
  });
}
    `);
  return new Promise(function (resolve) {
    worker.addEventListener('message', function(e) {
      worker.terminate();
      resolve(e.data);
    });
    worker.postMessage({
      scripts: scripts,
      expression: expression,
      model: model
    });
  });
}

function set_worker_script_path(path) {
  WORKER_SCRIPT_PATH = path;
}

return Object.freeze({
  set_worker_script_path: set_worker_script_path,
  non_blocking: non_blocking,
  parallel: parallel
});
});
