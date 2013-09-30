var Promise = require('../Promise');

exports.pending = function() {
	var pending = {};

	pending.promise = new Promise(function(resolve, reject) {
		pending.fulfill = resolve;
		pending.reject = reject;
	});

	return pending;
};

exports.fulfill = Promise.resolve;
exports.reject = Promise.reject;