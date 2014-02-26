var Promise = require('../Promise');
//var Promise = require('when');
var dummy = { dummy: 'dummy'};

Promise.resolve(tx_y_x());

//var promise = Promise.resolve(dummy).then(function() {
//	return tx_y_x();
//}).done(function(x) {
//	console.log(x);
//});
console.log('hi');

function tx_y_x() {
	var t = {
		then: function (resolveOuter) {
			console.log('thenable', 123);
			resolveOuter(123);
//			{
//				then: function (resolveInner) {
//					resolveOuter(123);
////					resolveInner(123);
//				}
//			});
		}
	};
	return t;
}