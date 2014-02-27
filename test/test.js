var Promise = require('../Promise');
//var Promise = require('when');

new Promise(function(r) {
	r(delay(100, 123));
	r(456);
}).done(console.log);

function delay(ms, x) {
	return new Promise(function(r) {
		setTimeout(function() {
			r(x);
		}, ms);
	});
}