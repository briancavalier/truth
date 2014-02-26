var buster = require('buster');
var assert = buster.assert;
var refute = buster.refute;

var Promise = require('../Promise');
var sentinel = { value: 'sentinel' };
var other = { value: 'other' };

function f() {}

buster.testCase('promise', {
	'done': {

		'should return undefined': function() {
			refute.defined(Promise.resolve().done());
			refute.defined(Promise.reject().done(f, f));
		},

		'when fulfilled': {
			'should invoke handleValue': function(done) {
				Promise.resolve(sentinel).done(function(x) {
					assert.same(x, sentinel);
					done();
				});
			},

			'should be fatal': {
				'when handleValue throws': function(done) {
					var p = Promise.resolve();
					p._fatal = function testFatal(e) {
						assert.same(e, sentinel);
						done();
					};

					p.done(function() {
						throw sentinel;
					});
				},

				'when handleValue rejects': function(done) {
					var p = Promise.resolve();
					p._fatal = function testFatal(e) {
						assert.same(e, sentinel);
						done();
					};

					p.done(function() {
						return Promise.reject(sentinel);
					});
				}
			}
		},

		'when rejected': {
			'should invoke handleFatalError': function(done) {
				Promise.reject(sentinel).done(null, function(e) {
					assert.same(e, sentinel);
					done();
				});
			},

			'should be fatal': {
				'when no handleFatalError provided': function(done) {
					var p = Promise.reject(sentinel);
					p._fatal = function testFatal(e) {
						assert.same(e, sentinel);
						done();
					};

					p.done();
				},

				'when handleFatalError throws': function(done) {
					var p = Promise.reject(other);
					p._fatal = function testFatal(e) {
						assert.same(e, sentinel);
						done();
					};

					p.done(void 0, function() {
						throw sentinel;
					});
				},

				'when handleFatalError rejects': function(done) {
					var p = Promise.reject();
					p._fatal = function testFatal(e) {
						assert.same(e, sentinel);
						done();
					};

					p.done(void 0, function() {
						return Promise.reject(sentinel);
					});
				}
			}
		}
	},

	'when an exception is thrown': {

		'a resolved promise': {

			'should reject if the exception is a value': function() {
				return Promise.resolve().then(
					function() {
						throw sentinel;
					}
				).then(
					void 0,
					function(x) {
						assert.same(x, sentinel);
					}
				);
			},

			'should reject if the exception is a resolved promise': function() {
				var expected = Promise.resolve();

				return Promise.resolve().then(
					function() {
						throw expected;
					}
				).then(
					void 0,
					function(val) {
						assert.same(val, expected);
					}
				);
			},

			'should reject if the exception is a rejected promise': function() {
				var expected = Promise.reject();

				return Promise.resolve().then(
					function() {
						throw expected;
					}
				).then(
					void 0,
					function(val) {
						assert.same(val, expected);
					}
				);
			}

		},

		'a rejected promise': {

			'should reject if the exception is a value': function() {
				return Promise.reject().then(
					void 0,
					function() {
						throw sentinel;
					}
				).then(
					void 0,
					function(val) {
						assert.same(val, sentinel);
					}
				);
			},

			'should reject if the exception is a resolved promise': function() {
				var expected = Promise.resolve();

				return Promise.reject().then(
					void 0,
					function() {
						throw expected;
					}
				).then(
					void 0,
					function(val) {
						assert.same(val, expected);
					}
				);
			},

			'should reject if the exception is a rejected promise': function() {
				var expected = Promise.reject();

				return Promise.reject().then(
					void 0,
					function() {
						throw expected;
					}
				).then(
					void 0,
					function(val) {
						assert.same(val, expected);
					}
				);
			}

		}
	},
});

