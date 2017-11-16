define(['presenter/presenter'], function (presenter) {
'use strict';

function extend(type_name, module, template) {
  Chart.Type.extend({
    name: type_name,
    initialize (data) {
      this.presenter = presenter.canvas2d.Canvas2DPresenter.instance();
      this.chart_controller = module.instance();
      this.chart_controller.globalConfiguration = Chart.defaults.global;
      this.chart_controller.load(data);
      this.presenter.bind(
        this.chart.canvas,
        template,
        this.chart_controller.model);
      // support for custom tool tip
      this.chart_controller.model.showTooltip = tooltip => {
        // call chart_controller for setting tool tip presentation
        this.chart_controller.setTooltip(tooltip)
      };
    },
    draw () {
      requestAnimationFrame(time => this.presenter.model.painter(time));
    },
    clear() {
      return this;
    },
    stop() {
      return this;
    },
    resize() {
      this.presenter.resize();
      return this;
    },
    reflow() {
      return this;
    },
    render() {
      return this;
    },
    generateLegend() {
      return this;
    },
    destroy() {
      this.presenter.destroy();
    },
    showTooltip () {},
    toBase64Image() {
      return this.chart.canvas.toDataURL();
    }
  });
}

return extend;
});
