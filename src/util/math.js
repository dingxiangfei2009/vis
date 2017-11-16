define([], function () {
'use strict';

function sqr(x) {
  return x * x;
}

return Object.assign(Object.create(Math), {
  bit_and(x, y) {
    return x & y;
  },
  bit_or(x, y) {
    return x | y;
  },
  bit_xor(x, y) {
    return x ^ y;
  },
  bit_sll(x, y) {},
  cubic_bezier(x1, y1, x2, y2, epsilon) {
    epsilon = epsilon || 1e-5;
    function cubic(t, a, b) {
      var t2 = sqr(t), t3 = t2 * t;
      return 3 * a * (t3 - 2 * t2 + t) + 3 * b * (t2 - t3) + t3;
    }
    function cubic_deriv(t, a, b) {
      return 3 * sqr(1 - t) * a + 6 * (1 - t) * t * (b - a) + 3 * sqr(t) * (1 - b);
    }
    function solve_t(x) {
      var t = 0.5, abs = Infinity;
      for (var i = 0; i < 10 && abs > epsilon; ++i) {
        var new_x = cubic(t, x1, x2);
        var d = cubic_deriv(t, x1, x2);
        if (d < epsilon)  // divide by zero
          return solve_t_bisect(t, x);
        abs = Math.abs(new_x - x);
        t -= (new_x - x) / d;
      }
      return solve_t_bisect(t, x);
    }
    function solve_t_bisect(t, x) {
      var low_t = 0, high_t = 1, mid = t;
      while(high_t - low_t > epsilon) {
        if (cubic(mid, x1, x2) > x)
          high_t = mid;
        else
          low_t = mid;
        mid = (low_t + high_t) / 2;
      }
      return mid;
    }
    return x => cubic(solve_t(x), y1, y2);
  }
});

});
