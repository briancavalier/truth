var nextTick, handlerQueue, bind, uncurryThis, call, MutationObserver, undef;

bind = Function.prototype.bind;
uncurryThis = bind.bind(bind.call);
call = uncurryThis(bind.call);

module.exports = Promise;

Promise.resolve = resolve;
Promise.cast    = cast;
Promise.reject  = reject;
Promise.all     = all;
Promise.race    = race;

// Return a pending promise whose fate is determined by resolver
function Promise(resolver) {
	var value, handlers = [], self = this;

	// Internal API to transform the value inside a promise,
	// and then pass to a continuation
	this.when = function(onFulfilled, onRejected, resolve) {
		handlers ? handlers.push(deliver) : enqueue(deliver);

		function deliver() {
			value.when(onFulfilled, onRejected, resolve);
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
		promiseResolve(new Rejected(reason));
	}

	// Resolve with a value, promise, or thenable
	function promiseResolve(x) {
		if(!handlers) {
			return;
		}

		var queue = handlers;
		handlers = undef;

		enqueue(function () {
			// coerce/assimilate just
			value = coerce(self, x);
			for(var i=0; i<queue.length; ++i) {
				queue[i]();
			}
		});
	}
}

// ES6 + Promises/A+ then()
Promise.prototype.then = function(onFulfilled, onRejected) {
	var self = this;
	return new Promise(function(resolve) {
		self.when(onFulfilled, onRejected, resolve);
	});
};

// ES6 proposed catch()
Promise.prototype['catch'] = function(onRejected) {
	return this.then(null, onRejected);
};

// Coerce x to a promise
function coerce(self, x) {
	if(x === self) {
		return new Rejected(new TypeError());
	}

	if(x instanceof Promise) {
		return x;
	}

	try {
		var untrustedThen = x === Object(x) && x.then;

		return typeof untrustedThen === 'function'
			? assimilate(x, untrustedThen)
			: new Fulfilled(x);
	} catch(e) {
		return new Rejected(e);
	}
}

// Assimilate a foreign thenable
function assimilate(x, untrustedThen) {
	return new Promise(function (resolve, reject) {
		call(untrustedThen, x, resolve, reject);
	});
}

// A fulfilled promise
// NOTE: Must not be exposed
function Fulfilled(value) {
	this.value = value;
}

Fulfilled.prototype = Object.create(Promise.prototype);
Fulfilled.prototype.when = function(onFulfilled, _, resolve) {
	try {
		resolve(typeof onFulfilled == 'function'
			? onFulfilled(this.value) : this);
	} catch (e) {
		resolve(new Rejected(e));
	}
};

// A rejected promise
// NOTE: Must not be exposed
function Rejected(reason) {
	this.value = reason;
}

Rejected.prototype = Object.create(Promise.prototype);
Rejected.prototype.when = function(_, onRejected, resolve) {
	try {
		resolve(typeof onRejected == 'function'
			? onRejected(this.value) : this);
	} catch (e) {
		resolve(new Rejected(e));
	}
};

// If x is a trusted promise, return it, otherwise
// return a new promise that follows x
function cast(x) {
	return x instanceof Promise ? x : resolve(x);
}

// Return a promise that follows x
function resolve(x) {
	return new Promise(function(resolve) {
		resolve(x);
	});
}

// Return a promise that is rejected with reason x
function reject(x) {
	return new Promise(function(_, reject) {
		reject(x);
	});
}

// Return a promise that will fulfill after all promises in array
// have fulfilled, or will reject after one promise in array rejects
function all(array) {
	return new Promise(resolveAll);

	function resolveAll(resolve, reject) {
		var results, toResolve = array.length;

		if(!toResolve) {
			resolve(results);
			return;
		}

		results = [];
		array.forEach(function(item, i) {
			cast(item).then(function(value) {
				results[i] = value;

				if(!--toResolve) {
					resolve(results);
				}
			}, reject);
		});
	}
}

// Return a promise that will settle to the same state as the first
// input promise that settles.
function race(array) {
	return new Promise(resolveRace);

	function resolveRace(resolve, reject) {
		array.forEach(function(item) {
			cast(item).then(resolve, reject);
		});
	}
}

function noop() {}

// Internal Task queue

handlerQueue = [];
function enqueue(task) {
	if(handlerQueue.push(task) === 1) {
		nextTick(drainQueue);
	}
}

function drainQueue() {
	var task, i = 0, queue = handlerQueue;

	handlerQueue = [];
	while(task = queue[i++]) {
		task();
	}
}

// Sniff "best" async scheduling option
/*global process,window,document*/
if (typeof process === 'object' && process.nextTick) {
	nextTick = typeof setImmediate === 'function' ? setImmediate : process.nextTick;
} else if(typeof window !== 'undefined' && (MutationObserver = window.MutationObserver || window.WebKitMutationObserver)) {
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