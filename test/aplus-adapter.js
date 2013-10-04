var Promise = require('../Promise');

exports.deferred = function() {
	var deferred = {};

	deferred.promise = new Promise(function(resolve, reject) {
		deferred.resolve = resolve;
		deferred.reject = reject;
	});

	return deferred;
};

exports.resolved = Promise.resolve;
exports.rejected = Promise.reject;