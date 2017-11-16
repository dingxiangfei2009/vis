define([], function () {
'use strict';

function xhr(options) {
	var xhr_object = new XMLHttpRequest;
	xhr_object.open(options.method || 'get', options.url);
	if (options.mime)
		xhr_object.overrideMimeType(options.mime);
	if (options.headers)
		for (var header of options.headers)
			xhr_object.setRequestHeader(header[0], header[1]);
	if (options.response_type)
		xhr_object.responseType = options.response_type;
	xhr_object.send(null);
	return new Promise(function (resolve, reject) {
		xhr_object.addEventListener('load', function (e) {
			if (xhr_object.readyState === 4) {
				if (xhr_object.status === 200) {
					resolve(xhr_object.response);
				} else {
					reject(xhr_object.status);
				}
			}
		});
	});
}

return xhr;
});
