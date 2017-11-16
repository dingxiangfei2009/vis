define([], function () {
'use strict';

function getMillisecond() {
	return (new Date).getTime();
}

return {
	getMillisecond: getMillisecond
}
});