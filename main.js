define(['domReady', 'data	source', 'app'], function(domReady, data) {
	domReady(function(){
		var ctx = document.getElementById("chart-area").getContext("2d");
		var chart = new Chart(ctx).RibbonCompare(data);
	});
});