define(['chart'], function(Chart){
var helpers = Chart.helpers;
function rand_color() {
	return (Math.random()*256)|0;
}
var Ribbon = Chart.Element.extend({
	draw: function() {
		var
			ctx = this.ctx,
			leftX = this.leftX,
			rightX = this.rightX,
			leftTopY = this.leftTopY,
			leftBottomY = this.leftBottomY,
			rightTopY = this.rightTopY,
			rightBottomY = this.rightBottomY;

		//
		ctx.beginPath();
		ctx.fillStyle = this.fillColor;
		ctx.strokeStyle = this.strokeColor;
		ctx.lineWidth = this.strokeWidth;
		// begin path
		ctx.moveTo(leftX, leftTopY);
		ctx.bezierCurveTo((leftX + rightX) / 2, leftTopY, (leftX + rightX) / 2, rightTopY, rightX, rightTopY);
		ctx.lineTo(rightX, rightBottomY);
		ctx.bezierCurveTo((leftX + rightX) / 2, rightBottomY, (leftX + rightX) / 2, leftBottomY, leftX, leftBottomY);
		// end path
		ctx.fill();
	},
	height: function() {

	}
});

Chart.Type.extend({
	name: 'RibbonCompare',
	defaults: {
		spacing: 50,
		iterationSpacing: 20,
		barDatasetSpacing: 10,
		bar: {
			strokeWidth: 1,
			showStroke: true
		},
		ribbon: {
			fillColor: 'rgba('+rand_color()+','+rand_color()+','+rand_color()+',0.5)'
		}
	},
	initialize: function(data) {
		var options = this.options;

		// verticle bar scales
		this.ScaleClass = Chart.Scale.extend({
			offsetGridLines: true,
			calculateBarX : function(datasetCount, datasetIndex, barIndex){
				var xWidth = this.calculateBaseWidth(),
					xAbsolute = this.calculateX(barIndex) - (xWidth/2),
					barWidth = this.calculateBarWidth(datasetCount);

				return xAbsolute + (barWidth * datasetIndex) + (datasetIndex * options.barDatasetSpacing) + barWidth/2;
			},
			calculateBaseWidth: function() {
				return (this.calculateX(1) - this.calculateX(0)) - (2*options.spacing);
			},
			calculateBarWidth: function(datasetCount) {
				var baseWidth = this.calculateBaseWidth() - ((datasetCount - 1) * options.iterationSpacing);
				return (baseWidth / datasetCount);
			}
		});
		this.BarClass = Chart.Rectangle.extend({
			strokeWidth: this.options.bar.strokeWidth,
			showStroke: this.options.bar.showStroke,
			ctx: this.chart.ctx
		});
		this.RibbonClass = Ribbon.extend({
			fillColor: this.options.ribbon.fillColor,
			ctx: this.chart.ctx
		});

		function Entry() {
			this.inflow = new Map;
			this.outflow = new Map;
			this.value = 0;
		}

		var labels = new Map;
		var label_names = {};
		function add_label(name) {
			if (labels.has(name)) return labels.get(name);
			var ret = Symbol(name);
			labels.set(name, ret);
			label_names[ret] = name;
			return ret;
		}
		var iterations = [];
		data.values.forEach(function(value) {
			var iter = new Map;
			value.forEach(function(item){
				var entry = new Entry;
				entry.value = item[1];
				iter.set(add_label(item[0]), entry);
			});
			iterations.push(iter);
		});
		data.change.forEach(function(entry, index){
			entry.forEach(function(item) {
				var source = labels.get(item[0]);
				for(var i = 1, end = item.length; i < end; ++i) {
					var dest = labels.get(item[i][0]);
					iterations[index].get(source).outflow.set(dest, item[i][1]);
					iterations[index + 1].get(dest).inflow.set(source, item[i][1]);
				}
			});
		});

		this.labels = labels;
		this.label_names = label_names;
		this.iterations = iterations;
		this.iterationNames = iterations.map(function(dummy,index){return index;});

		var datasetObject = this.datasetObject = {
			labels: [],
			iterationObjects: [],
			ribbons: [],
			strokeColor: 'rgba(0,0,0,1)'
		};

		var self = this;
		this.iterations.forEach(function (iter, index) {
			var sum = 0;
			var pair;
			var childBars = [];
			for (pair of iter) {
				sum += pair[1].value;
				childBars.push(new self.BarClass({
					value: pair[1].value,
					label: label_names[pair[0]],	// actual
					fillColor: 'rgba('+rand_color()+','+rand_color()+','+rand_color()+',0.5)',
					strokeColor: datasetObject.strokeColor
				}));
			}
			datasetObject.iterationObjects.push({
				containerBar: new self.BarClass({
					value: sum,
					label: index,
					fillColor: 'rgba(0,54,223,0.8)',
					strokeColor: datasetObject.strokeColor
				}),
				childBars: childBars
			});
		});
		this.buildScale();
		this.BarClass.prototype.base = this.scale.endPoint;	// default endPoint

		// calculate bar X
		datasetObject.iterationObjects.forEach(function(iterObject, iterIndex) {
			var baseX = self.scale.calculateBarX(1,0,iterIndex), baseWidth = self.scale.calculateBaseWidth(1);
			helpers.extend(iterObject.containerBar, {
				width: baseWidth,
				x: baseX,
				y: self.scale.endPoint
			});
			iterObject.containerBar.save();
			// child bars
			iterObject.childBars.forEach(function(childBar, barIndex) {
				helpers.extend(childBar, {
					width: baseWidth,
					x: baseX,
					y: self.scale.endPoint,
					base: self.scale.endPoint
				});
				childBar.save();
			});
		});

		// calculate ribbon positions
		var ribbonDesc = [];
		for (var iterIndex = 0; iterIndex < iterations.length - 1; ++iterIndex) {
			var pair, innerPair;
			var beforeOffsetMap = new Map, afterOffsetMap = new Map;
			var sum = 0, innerSum = 0, desc;
			for (pair of iterations[iterIndex]) {
				desc = {offset: sum, innerOffsets: new Map};
				innerSum = sum;
				for (innerPair of pair[1].outflow) {
					desc.innerOffsets.set(innerPair[0], [innerSum, innerSum + innerPair[1]]);
					innerSum += innerPair[1];
				}
				beforeOffsetMap.set(pair[0], desc);
				sum += pair[1].value;
			}
			sum = 0;
			for (pair of iterations[iterIndex + 1]) {
				desc = {offset: sum, innerOffsets: new Map};
				innerSum = sum;
				for (innerPair of pair[1].inflow) {
					desc.innerOffsets.set(innerPair[0], [innerSum, innerSum + innerPair[1]]);
					innerSum += innerPair[1];
				}
				afterOffsetMap.set(pair[0], desc);
				sum += pair[1].value;
			}
			ribbonDesc.push({before:beforeOffsetMap, after:afterOffsetMap});
		}
		ribbonDesc.forEach(function(desc, index) {
			var barWidth = self.scale.calculateBaseWidth(1),
				leftX = self.scale.calculateBarX(1,0,index) + barWidth/2,
				rightX = self.scale.calculateBarX(1,0,index + 1) - barWidth/2;
			var pair, innerPair;
			for (pair of desc.before)
				for (innerPair of pair[1].innerOffsets) {
					var leftOffsets = innerPair[1],
						rightOffsets = desc.after.get(innerPair[0]).innerOffsets.get(pair[0]);
					var ribbon = new self.RibbonClass({
								leftX: leftX,
								rightX: rightX,
								leftTopY: self.scale.endPoint,
								leftBottomY: self.scale.endPoint,
								rightTopY: self.scale.endPoint,
								rightBottomY: self.scale.endPoint
							});
					ribbon.save();
					datasetObject.ribbons.push({
						leftTopY: self.scale.calculateY(leftOffsets[1]),
						leftBottomY: self.scale.calculateY(leftOffsets[0]),
						rightTopY: self.scale.calculateY(rightOffsets[1]),
						rightBottomY: self.scale.calculateY(rightOffsets[0]),
						ribbon: ribbon
					});
				}

		});

		this.render();
	},
	buildScale: function() {
		var self = this;

		var scaleOptions = {
			templateString : this.options.scaleLabel,	// required
			height: this.chart.height,
			width: this.chart.width,
			ctx: this.chart.ctx,
			textColor: '#000000',
			fontSize: 10,
			fontStyle : this.options.scaleFontStyle,
			fontFamily : this.options.scaleFontFamily,
			valuesCount: this.iterations.length,
			beginAtZero: true,
			integersOnly: true,
			calculateYRange: function(currentHeight) {
				var bar_total_values = self.iterations.map(function(iter) {
					var value_sum = 0;
					for(var iter_pair of iter) {
						value_sum += iter_pair[1].value;
					}
					return value_sum;
				});
				var updatedRanges = helpers.calculateScaleRange(
					bar_total_values,
					currentHeight,
					this.fontSize,
					this.beginAtZero,
					this.integersOnly
				);
				helpers.extend(this, updatedRanges);
			},
			// I don't know what happens here, so just referred to Bar's configuration
			xLabels: this.iterationNames,
			font : helpers.fontString(this.options.scaleFontSize, this.options.scaleFontStyle, this.options.scaleFontFamily),
			lineWidth : this.options.scaleLineWidth,
			lineColor : this.options.scaleLineColor,
			showHorizontalLines : true,
			showVerticalLines : true,
			gridLineWidth : 1,
			gridLineColor : "rgba(0,0,0,0.5)",
			padding : 0,
			showLabels : true,
			display : this.options.showScale
		};

		if (this.options.scaleOverride){
			helpers.extend(scaleOptions, {
				calculateYRange: helpers.noop,
				steps: this.options.scaleSteps,
				stepValue: this.options.scaleStepWidth,
				min: this.options.scaleStartValue,
				max: this.options.scaleStartValue + (this.options.scaleSteps * this.options.scaleStepWidth)
			});
		}

		this.scale = new this.ScaleClass(scaleOptions);
	},
	draw: function(ease) {
		var easingDecimal = ease || 1;
		this.clear();
		var ctx = this.chart.ctx;
		this.scale.draw(easingDecimal);
		var self = this;
		// walk through datasetObject for drawing
		this.datasetObject.iterationObjects.forEach(function(iterObject, iterIndex) {
			var baseX = self.scale.calculateBarX(1,0,iterIndex);
			var baseWidth = self.scale.calculateBaseWidth(1);
			iterObject.containerBar.base = self.scale.endPoint;
			iterObject.containerBar.transition({
				x: baseX,
				y: self.scale.calculateY(iterObject.containerBar.value),
				width: baseWidth
			}, easingDecimal).draw();
			var offset = self.scale.endPoint, sum = 0;
			iterObject.childBars.forEach(function(childBar, barIndex) {
				sum += childBar.value;
				var nextOffset = self.scale.calculateY(sum);
				childBar.transition({
					x: baseX,
					y: nextOffset,
					width: baseWidth,
					base: offset
				},easingDecimal).draw();
				offset = nextOffset;
			});
		});
		this.datasetObject.ribbons.forEach(function (desc) {
			desc.ribbon.transition({
				leftTopY: desc.leftTopY,
				leftBottomY: desc.leftBottomY,
				rightTopY: desc.rightTopY,
				rightBottomY: desc.rightBottomY
			}, easingDecimal).draw();
		});
	}
});



});