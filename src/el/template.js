define(['./parser', './el_watch', 'util/util', './compile'],
function (parser, watch, util, compile) {
'use strict';

var START_DEFAULT = '{{', END_DEFAULT = '}}';

function slice_template(template, options) {
	var START = options && util.traits.is_string(options.start) ?
		options.start : START_DEFAULT;
	var END = options && util.traits.is_string(options.end) ?
		options.end : END_DEFAULT;
	var vec = [];
	var idx = 0, length = template.length;
	while (idx < length) {
		var next = template.indexOf(START, idx);
		if (next < 0) {
			vec.push({
				type: 'primitive',
				value: template.substring(idx, length)
			});
			break;
		} else {
			if (next > idx) {
				vec.push({
					type: 'primitive',
					value: template.substring(idx, next)
				});
			}
			var closing = template.indexOf(END, next + END.length);
			if (closing < 0) {
				vec.push({
					type: 'primitive',
					value: template.substring(next)
				});
				break;
			} else {
				vec.push(
					parser.parse(
						template.substring(next + START.length, closing)));
				idx = closing + END.length;
			}
		}
	}

	if (vec.length) {
		var compressed = [vec.shift()];
		vec.forEach(function (item) {
			if (item.type === 'primitive' && compressed[compressed.length - 1] === 'primitive') {
				compressed[compressed.length - 1].value += String(item.value);
			} else
				compressed.push(item);
		});
		return compressed;
	} else
		return vec;
}

function text_template(template_vec, scope, observe_scope, update_callback) {
	function update_content() {
		var text = '';
		for(var value of values) {
			text += value;
		}
		update_callback(text);
	}

	function unwatch() {
		for (var i = 0, end = watches.length; i < end; ++i)
			watches[i].unwatch();
	}

	if (template_vec.length === 0 ||
		template_vec.length === 1 && template_vec[0].type === 'primitive') {
		update_callback(template_vec.length === 0 ? '' : template_vec[0].value);
		// do not touch, as it is unnecessary
	} else {
		var values = Array(template_vec.length);
		var watches = Array(template_vec.length);

		template_vec.forEach(function (expression, index) {
			watches[index] = watch(compile(expression), {
				observe_scope: observe_scope,
				scope: scope,
				handler (value) {
					values[index] = value;
					update_content();
				}
			});
		});
		return unwatch;
	}
}

return {
	slice_template: slice_template,
	text_template: text_template
};

});
