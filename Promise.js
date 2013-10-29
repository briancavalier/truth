var nextTick, handlerQueue, bind, uncurryThis, call, MO;

bind = Function.prototype.bind;
uncurryThis = bind.bind(bind.call);
call = uncurryThis(bind.call);

module.exports = Promise;

Promise.of      = of;
Promise.resolve = of;
Promise.cast    = cast;
Promise.reject  = reject;
Promise.all     = all;
Promise.race    = race;

function Promise(resolver) {
	this._resolver = function(resolve, reject) {
		try {
			resolver(resolve, reject);
		} catch(e) {
			reject(e);
		}
	};
}

Promise.prototype.map = function(f) {
	var resolver = this._resolver;
	return new Promise(function(resolve, reject) {
		resolver(function(x) {
			resolve(f(x));
		}, reject);
	});
};

Promise.prototype.ap = function(valuePromise) {
	var resolver = this._resolver;
	return new Promise(function(resolve, reject) {
		resolver(function(f) {
			valuePromise.done(function(x) {
				resolve(f(x));
			}, reject);
		});
	});
};

Promise.prototype.flatMap = function(f) {
	var resolver = this._resolver;
	return new Promise(function(resolve, reject) {
		resolver(function(x) {
			f(x).done(resolve, reject);
		}, reject);
	});
};

Promise.prototype.flatten = function() {
	return this.flatMap(identity);
};

Promise.prototype.catch = function(f) {
	var resolver = this._resolver;
	return new Promise(function(resolve) {
		resolver(resolve, function(e) {
			resolve(f(e));
		});
	});
};

Promise.prototype.finally = function(f) {
	var resolver = this._resolver;
	return new Promise(function(resolve, reject) {
		resolver(function(x) {
			f();
			resolve(x);
		}, function(e) {
			f();
			reject(e);
		});
	});
};

Promise.prototype.then = function(f, r) {
	var self = this;
	return new Promise(function(resolve, reject) {
		self._resolver(function(x) {
			coerce(self, x).done(onFulfill, onReject);
		}, onReject);

		function onFulfill(x) {
			try {
				resolve(typeof f === 'function' ? f(x) : x);
			} catch(e) {
				reject(e);
			}
		}
		function onReject(reason) {
			try {
				typeof r === 'function' ? resolve(r(reason)) : reject(reason);
			} catch(e) {
				reject(e);
			}
		}
	});
};

Promise.prototype.done = function(f, r) {
	addQueue(this, f, r);

	var self = this;
	enqueue(function() {
		self._resolver(function(x) {
			self._resolver = memoized;
			memoized();

			function memoized() {
				runQueue(self, 0, x);
			}
		}, function(e) {
			self._resolver = memoized;
			memoized();

			function memoized() {
				runQueue(self, 1, e, true);
			}
		});

	});
};

function addQueue(promise, f, r) {
	promise._queue ? (promise._queue.push(f, r)) : (promise._queue = [f, r]);
}

function runQueue(promise, start, value, rethrow) {
	var queue = promise._queue;
	promise._queue = void 0;

	if(queue) {
		for(var f, i=start, len = queue.length; i < len; i += 2) {
			f = queue[i];
			if(typeof f === 'function') {
				f(value);
			} else if(rethrow) {
				throw value;
			}
		}
	}
}

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
			? new Assimilated(x, untrustedThen)
			: new Fulfilled(x);
	} catch(e) {
		return new Rejected(e);
	}
}

// Assimilate a foreign thenable
function Assimilated(thenable, untrustedThen) {
	var self = this;
	this._resolver = function(resolve, reject) {
		call(untrustedThen, thenable, function(x) {
			coerce(self, x).done(resolve, reject);
		}, reject);
	};
}

Assimilated.prototype = Object.create(Promise.prototype);

// A fulfilled promise
// NOTE: Must not be exposed
function Fulfilled(value) {
	this._resolver = function(resolve) {
		resolve(value);
	};
}

Fulfilled.prototype = Object.create(Promise.prototype);

// A rejected promise
// NOTE: Must not be exposed
function Rejected(reason) {
	this._resolver = function(_, reject) {
		reject(reason);
	};
}

Rejected.prototype = Object.create(Promise.prototype);

function of(x) {
	return new Fulfilled(x);
}

// If x is a trusted promise, return it, otherwise
// return a new promise that follows x
function cast(x) {
	return x instanceof Promise ? x : of(x);
}

// Return a promise that is rejected with reason x
function reject(x) {
	return new Rejected(x);
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
			cast(item).done(function(value) {
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

function identity(x) { return x; }

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
} else if(typeof window !== 'undefined' && (MO = window.MutationObserver || window.WebKitMutationObserver)) {
	nextTick = (function(document, MutationObserver, drainQueue) {
		var el = document.createElement('div');
		new MutationObserver(drainQueue).observe(el, { attributes: true });

		return function() {
			el.setAttribute('x', 'x');
		};
	}(document, MO, drainQueue));
} else {
	nextTick = function(t) { setTimeout(t, 0); };
}