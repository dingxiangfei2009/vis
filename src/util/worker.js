define([],function(){

return function(script) {
	var url =
		URL.createObjectURL(
			new Blob([script], {type: 'application/javascript'}));
	var worker = new Worker(url);
	URL.revokeObjectURL(url);
	return worker;
};

});
