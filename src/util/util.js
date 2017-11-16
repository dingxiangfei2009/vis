define(['./traits', './data', './async', './xhr', './math', './inherit', './adt', './time'],
function (traits, data, async, xhr, math, inherit, adt, time) {

function List(list) {
	this.list = list;
}

List.prototype[Symbol.iterator] = function *iterator() {
	var list = this.list;
	while (list.length) {
		yield list[0];
		list = list[1];
	}
};

List.prototype.map = function(functor) {
	var return_list = [];
	var pointer = return_list;
	for (var element of this) {
		pointer.push(functor(element));
		pointer.push([]);
		pointer = pointer[1];
	}
	return return_list;
};

List.prototype.flat_map = function(functor) {
	var return_list = [];
	var iterator = this[Symbol.iterator]();
	var element;
	while (!(element = iterator.next()).done) {
		return_list.push(functor(element.value));
	}
	return return_list;
};

List.prototype.for_each = function (functor, context) {
	var count = 0;
	var iterator = this[Symbol.iterator]();
	var element;
	while (!(element = iterator.next()).done) {
		functor.call(context, element.value, count, this);
		++count;
	}
};

function stream_animate(stream) {
	var gen;
	function animate(time) {
		if (!gen.next(time).done)
			requestAnimationFrame(animate);
	}
	requestAnimationFrame(time => {
		gen = stream(time);
		requestAnimationFrame(animate);
	});
}

function BiMap() {
	this.counter = new Uint32Array(1);
	this.object_id = new Map;
	this.id_object = new Map;
}
BiMap.prototype = {
	constructor: BiMap,
	has_object (object) {
		return this.object_id.has(object);
	},
	has_id (id) {
		return this.id_object.has(id);
	},
	add (object) {
		if (!this.has_object(object)) {
			this.object_id.set(object, this.counter[0]);
			this.id_object.set(this.counter[0], object);
			++this.counter[0];
		}
		return this.object_id.get(object);
	},
	delete_object (object) {
		if (this.has_object(object)) {
			var id = this.object_id.get(object);
			this.object_id.delete(object);
			this.id_object.delete(id);
		}
	},
	delete_id (id) {
		if (this.has_id(id)) {
			var object = this.id_object.get(id);
			this.object_id.delete(object);
			this.id_object.delete(id);
		}
	},
	object (id) {
		return this.has_id(id) ? this.id_object.get(id) : null;
	},
	id (object) {
		return this.has_object(object) ? this.object_id.get(object) : -1;
	}
};

return Object.freeze({
	async: async,
	data: data,
	List: List,
	stream_animate: stream_animate,
	traits: traits,
	xhr: xhr,
	math: math,
	inherit: inherit,
	adt: adt,
	BiMap: BiMap,
	time: time
});

});
