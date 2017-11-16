define([], function(){

return {
	labels: ['A', 'B', 'C', 'D'],
	values: [
		[	// year 0
			['A', 30],
			['B', 25],
			['C', 10]
		],
		[	// year 1
			['A', 40],
			['B', 22],
			['C', 13]
		]
	],
	change: [
		[	// diff between year 0 and 1
			['A', ['B', 5], ['C', 2]],	// outflows only
			['B', ['A', 3], ['C', 10]],
			['C', ['A', 4], ['B', 5]]
		]
	]
};

});