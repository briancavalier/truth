var buster = require('buster');
var assert = buster.assert;
var refute = buster.refute;

var Promise = require('../Promise');

var sentinel = { value: 'sentinel' };
var other = { value: 'other' };

buster.testCase('Promise', {
	'done': {
		'should initiate resolver': function(done) {
			new Promise(function(resolve, reject) {
				assert.isFunction(resolve);
				assert.isFunction(reject);
				done()
			}).done();
		}
	},

	'then': {
		'should forward result when callback is null': function(done) {
			new Promise(function(resolve) {
				resolve(sentinel);
			}).then(null).then(function(x) {
				assert.same(x, sentinel);
			}).done(done, buster.fail);
		},

		'should forward callback result to next callback': function(done) {
			new Promise(function(resolve) {
				resolve(other);
			}).then(function() {
				return sentinel;
			}).then(function(x) {
				assert.same(x, sentinel);
			}).done(done, buster.fail);
		},

		'should forward undefined': function(done) {
			new Promise(function(resolve) {
				resolve(sentinel);
			}).then(function() {
				// intentionally return undefined
			}).then(function(x) {
				refute.defined(x);
			}).done(done, buster.fail);
		},

		'should forward undefined rejection value': function(done) {
			new Promise(function(_, reject) {
				reject(sentinel);
			}).then(buster.fail, function() {
				// intentionally return undefined
			}).then(function(x) {
				refute.defined(x);
			}).done(done, buster.fail);
		},

		'should forward promised callback result value to next callback': function(done) {
			new Promise(function(resolve) {
				resolve(other);
			}).then(function() {
				return new Promise(function(resolve) {
					resolve(sentinel);
				});
			}).then(function(x) {
				assert.same(x, sentinel);
			}).done(done, buster.fail);
		},

		'should switch from callbacks to errbacks when callback returns a rejection': function(done) {
			new Promise(function(resolve) {
				resolve(other);
			}).then(function() {
				return new Promise(function(_, reject) {
					reject(sentinel);
				});
			}).then(null, function(x) {
				assert.same(x, sentinel);
			}).done(done, buster.fail);
		}
	}
})