define(['module_struct','el/runtime'], function (module, runtime) {
'use strict';
var _proxy = runtime.wrap_proxy;
class SlideShow {
  constructor() {
    this.event = {};
    this.model = {
      value: 100,
      prev() {
        if (this.current) {
            _proxy(this).progress = 0;
            --_proxy(this).current;
        }
      },
      next() {
        if (this.current < this.count - 1) {
            _proxy(this).progress = 0;
            ++_proxy(this).current;
        }
      },
      prev_progress() {
        if (this.progress)
            --_proxy(this).progress;
      },
      next_progress() {
          ++_proxy(this).progress;
      },
      switch(id) {
          _proxy(this).current = id;
          _proxy(this).progress = 0;
      },
      current: 0,
      count: 0,
      progress: 0,
      animate: {
        rotate_fly_in: (elements, time) => {
          var
            animation = [
              {
                'transform-origin': '0% 100%',
                transform: 'rotateZ(90deg) translateY(1000%)',
                opacity: 0
              },
              {
                'transform-origin': '0% 100%',
                transform: 'rotateZ(0) translateY(0)',
                opacity: 1
              }
            ];
          return this.start_animation(elements, animation, time || 800);
        },
        fade_in: (elements, dx, dy, time) => {
          var
            animation = [
              {
                transform: `translate(${dx}, ${dy})`,
                opacity: 0
              },
              {
                transform: 'translate(0,0)',
                opacity: 1
              }
            ];
          return this.start_animation(elements, animation, time || 800);
        },
        fade_out: (elements, dx, dy, time) => {
          var
            animation = [
              {
                transform: 'translate(0,0)',
                opacity: 1
              },
              {
                transform: `translate(${dx}, ${dy})`,
                opacity: 0
              }
            ];
          return this.start_animation(elements, animation, time || 800);
        }
      }
    };
    var handler = e => this.processEvent(e);
    for (var event of ['mousedown', 'mouseup', 'touchstart', 'touchend'])
      document.addEventListener(event, handler);
  }
  start_animation(elements, animation, time) {
    var promises = [];
    for (var element of elements)
      if (element.animate)
        promises.push(new Promise(function (resolve) {
          element.animate(animation, time)
            .onfinish = resolve;
        }));
    return Promise.all(promises);
  }
  set_slide_count(count) {
      _proxy(this.model).count = count;
  }
  start_event_tracker(startX) {
      _proxy(this.event).in_progress = true;
      _proxy(this.event).x = startX;
  }
  switch_slide_on_event(endX) {
    if (this.event.in_progress)
      if (endX - this.event.x > 50)
        this.model.prev();
      else if (this.event.x - endX > 50)
        this.model.next();
      _proxy(this.event).in_progress = false;
  }
  processEvent(event) {
    if (event.target.parentElement !== this.model.container)
      return false;
    switch (event.type) {
    case 'mousedown':
      this.start_event_tracker(event.clientX);
      break;
    case 'mouseup':
      this.switch_slide_on_event(event.clientX);
      break;
    case 'touchstart':
      this.start_event_tracker(event.changedTouches[0].clientX);
      break;
    case 'touchend':
      this.switch_slide_on_event(event.changedTouches[0].clientX);
      break;
    }
  }
}
return module('SlideShow', {instance: SlideShow});

});
