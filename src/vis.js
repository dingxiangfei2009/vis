require(['el/el', 'presenter/presenter', 'bind', 'module_struct', 'worker', 'data/data'],
function(el, presenter, bind, module, worker, data) {

return Object.freeze({
  el: el,
  bind: bind,
  module: module,
  worker: worker,
  data: data
});

});
