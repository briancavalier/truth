var Promise = require('../Promise');

exports.deferred = function() {
	var deferred = {}, r, j;

	deferred.promise = new Promise(function(resolve, reject) {
		r = resolve;
		j = reject;
	});
	deferred.promise.done();
	deferred.resolve = function(x) {
		setTimeout(function() {
			r(x);
		}, 0);
	};
	deferred.reject = function(e) {
		setTimeout(function() {
			j(e);
		}, 0)
	};

	return deferred;
};

exports.resolved = Promise.resolve;
exports.rejected = Promise.reject;