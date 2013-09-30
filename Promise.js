var nextTick, handlerQueue, bind, uncurryThis, call, MutationObserver;

bind = Function.prototype.bind;
uncurryThis = bind.bind(bind.call);
call = uncurryThis(bind.call);

module.exports = Promise;

Promise.resolve = resolve;
Promise.cast    = cast;
Promise.reject  = reject;
Promise.all     = all;

// Return a pending promise whose fate is determined by resolver
function Promise(resolver) {
	var value, handlers = [];

	this.when = function(onFulfilled, onRejected, resolve) {
		handlers ? handlers.push(deliver) : enqueue(function() { deliver(value); });

		function deliver(p) {
			p.when(onFulfilled, onRejected, resolve);
		}
	};

	// Call the resolver to seal the promise's fate
	try {
		resolver(promiseResolve, promiseReject);
	} catch(e) {
		promiseReject(e);
	}

	// Reject with reason verbatim
	function promiseReject(reason) {
		promiseResolve(new RejectedPromise(reason));
	}

	// Resolve with a value, promise, or thenable
	function promiseResolve(x) {
		if(!handlers) {
			return;
		}

		var queue = handlers;
		handlers = void 0;
		value = coerce(x);

		enqueue(function () {
			queue.forEach(function (handler) {
				handler(value);
			});
		});
	}
}

Promise.prototype.then = function(onFulfilled, onRejected) {
	var when = this.when;
	return new Promise(function(resolve) {
		when(onFulfilled, onRejected, resolve);
	});
};

Promise.prototype.done = function(task) {
	this.when(task, function(e) {
		enqueue(function() { throw e; });
	}, function() {});
}

Promise.prototype['catch'] = function(onRejected) {
	return this.then(null, onRejected);
};

// Coerce x to a promise
function coerce(x) {
	if(x instanceof Promise) {
		return x;
	}

	if (!(x === Object(x) && 'then' in x)) {
		return new FulfilledPromise(x);
	}

	return new Promise(function(resolve, reject) {
		enqueue(function() {
			try {
				var untrustedThen = x.then;

				if(typeof untrustedThen === 'function') {
					call(untrustedThen, x, resolve, reject);
				} else {
					resolve(new FulfilledPromise(x));
				}
			} catch(e) {
				reject(e);
			}
		});
	});
}

function FulfilledPromise(value) {
	this.value = value;
}

FulfilledPromise.prototype = Object.create(Promise.prototype);
FulfilledPromise.prototype.when = function(onFulfilled, _, resolve) {
	try {
		resolve(typeof onFulfilled == 'function'
			? onFulfilled(this.value) : this);
	} catch (e) {
		resolve(new RejectedPromise(e));
	}
};

function RejectedPromise(reason) {
	this.value = reason;
}

RejectedPromise.prototype = Object.create(Promise.prototype);
RejectedPromise.prototype.when = function(_, onRejected, resolve) {
	try {
		resolve(typeof onRejected == 'function'
			? onRejected(this.value) : this);
	} catch (e) {
		resolve(new RejectedPromise(e));
	}
};

function cast(x) {
	return x instanceof Promise ? x : resolve(x);
}

function resolve(x) {
	return new Promise(function(resolve) {
		resolve(x);
	});
}

function reject(x) {
	return new Promise(function(_, reject) {
		reject(x);
	});
}

// Return a promise that will fulfill after all promises in array
// have fulfilled, or will reject after one promise in array rejects
function all(array) {
	return cast(array).then(function(array) {
		return new Promise(resolveAll);

		function resolveAll(resolve, reject) {
			var results, toResolve = array.length;

			if(!toResolve) {
				resolve(results);
				return;
			}

			results = [];
			array.forEach(function(item, i) {
				cast(item).then(function(mapped) {
					results[i] = mapped;

					if(!--toResolve) {
						resolve(results);
					}
				}, reject);
			});
		}
	});
}

handlerQueue = [];

function enqueue(task) {
	if(handlerQueue.push(task) === 1) {
		nextTick(drainQueue);
	}
}

function drainQueue() {
	var task, i, queue;

	i = 0;
	queue = handlerQueue;

	handlerQueue = [];

	while(task = queue[i++]) {
		task();
	}
}

// Sniff "best" async scheduling option
/*global process*/
if (typeof process === 'object' && process.nextTick) {
	nextTick = process.nextTick;
} else if(typeof window !== 'undefined' && (MutationObserver = this.MutationObserver || this.WebKitMutationObserver)) {
	nextTick = (function(document, MutationObserver, drainQueue) {
		var el = document.createElement('div');
		new MutationObserver(drainQueue).observe(el, { attributes: true });

		return function() {
			el.setAttribute('x', 'x');
		};
	}(document, MutationObserver, drainQueue));
} else {
	nextTick = function(t) { setTimeout(t, 0); };
}