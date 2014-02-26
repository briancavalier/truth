var nextTick, queue, bind, uncurryThis, call, MutationObserver, undef;

bind = Function.prototype.bind;
uncurryThis = bind.bind(bind.call);
call = uncurryThis(bind.call);

module.exports = Promise;

Promise.resolve = resolve;
Promise.reject  = reject;
Promise.all     = all;
Promise.race    = race;

var pending = 0;
var fulfilled = 2;
var rejected = 3;

// If x is a trusted promise, return it, otherwise
// return a new promise that follows x
function resolve(x) {
	return x instanceof Promise ? x : follow(x);
}

function follow(x) {
	var p = new InternalPromise();
	p._resolve(x);
	return p;
}

// Return a promise that is rejected with reason x
function reject(x) {
	var p = new InternalPromise();
	p._reject(x);
	return p;
}

// Return a pending promise whose fate is determined by resolver
function Promise(resolver) {
	this._state = pending;
	this._value = void 0;
	this._handlers = [];

	var self = this;
	runResolver(resolver, promiseResolve, promiseReject);

	function promiseResolve(x) {
		self._resolve(x);
	}

	function promiseReject(reason) {
		self._reject(reason);
	}
}

function runResolver(resolver, promiseResolve, promiseReject) {
	try {
		resolver(promiseResolve, promiseReject);
	} catch(e) {
		promiseReject(e);
	}
}

function InternalPromise() {
	this._state = pending;
	this._value = void 0;
	this._handlers = [];
}

InternalPromise.prototype = Object.create(Promise.prototype);

Promise.prototype.done = function(f, r) {
	this._when(this._maybeFatal, this, f, r);
};

Promise.prototype.then = function(f, r) {
	var p = new InternalPromise();
	this._when(p._resolve, p, f, r);
	return p;
};

Promise.prototype.catch = function(onRejected) {
	return this.then(null, onRejected);
};

Promise.prototype._when = function(resolve, p, f, r) {
	this._handlers.push(resolve, p, f, r);
	if (this._state !== pending) {
		enqueue(this._runHandlers, this);
	}
};

Promise.prototype._resolve = function(x) {
	if(this._state !== pending) return;

	if(Object(x) !== x) {
		this._fulfill(x);
	} else if(x instanceof Promise) {
		if(x === this) {
			this._reject(new TypeError());
		} else {
			this._follow(x);
		}
	} else {
		this._assimilate(x);
	}
};

Promise.prototype._follow = function(x) {
	if(x._state === fulfilled) {
		this._fulfill(x._value);
	} else if(x._state === rejected) {
		this._reject(x._value);
	} else {
		var p = this;
		x._when(noop, void 0,
			function(x) { p._fulfill(x) },
			function(x) { p._reject(x) }
		);
	}
};

Promise.prototype._assimilate = function(x) {
	try {
		var then = x.then;

		if(typeof then === 'function') {
			enqueue(function() {
				var p = this;
				try {
					then.call(x,
						function(x) {
							p._resolve(x);
						},
						function(x) {
							p._reject(x);
						}
					);
				}
				catch(e) {
					this._reject(e);
				}
			}, this);
		} else {
			this._fulfill(x);
		}
	} catch(e) {
		this._reject(e);
	}
}

Promise.prototype._fulfill = function(x) {
	if(this._state !== pending) return;

	this._state = fulfilled;
	this._value = x;

	enqueue(this._runHandlers, this);
};

Promise.prototype._reject = function(x) {
	if(this._state !== pending) return;

	this._state = rejected;
	this._value = x;

	enqueue(this._runHandlers, this);
};

Promise.prototype._runHandlers = function() {
	var q = this._handlers;
	this._handlers = [];
	var o = this._state;
	for(var i=0; i< q.length; i+=4) {
		this._callHandler(q[i], q[i+1], q[i+o], this._value);
	}
};

Promise.prototype._callHandler = function(resolve, p, f, x) {
	x = typeof f === 'function' ? tryCatch(f, x) : this;
	resolve.call(p, x);
};

Promise.prototype._maybeFatal = function(x) {
	if(x != null && Object(x) === x) {
		resolve(x).catch(this._fatal);
	}
};

Promise.prototype._fatal = function(e) {
	setTimeout(function() {
		throw e;
	}, 0);
}

function tryCatch(f, x) {
	try {
		return f(x);
	} catch(e) {
		return reject(e);
	}
}

// Return a promise that will fulfill after all promises in array
// have fulfilled, or will reject after one promise in array rejects
function all(promises) {
	return new Promise(function(resolveAll, reject, notify) {
		var pending = 0;
		var results = [];

		for(var i=0; i<promises.length; ++i) {
			++pending;
			resolve(promises[i]).then(function(x) {
				results[i] = x;

				if(--pending === 0) {
					resolveAll(results);
				}
			}, reject, notify);
		}

		if(pending === 0) {
			resolveAll(results);
		}
	});
}

// Return a promise that will settle to the same state as the first
// input promise that settles.
function race(promises) {
	return new Promise(function(resolve, reject) {
		for(var i=0; i<promises.length; ++i) {
			resolve(promises[i]).then(resolve, reject);
		}
	});
}

function noop() {}

// Internal Task queue

queue = [];
function enqueue(task, x) {
	if(queue.push(task, x) === 2) {
		nextTick(drainQueue);
	}
}

function drainQueue() {
	for(var i=0; i<queue.length; i+=2) {
		queue[i].call(queue[i+1]);
	}
	queue = [];
}

// Sniff "best" async scheduling option
/*global process,window,document*/
if (typeof process === 'object' && process.nextTick) {
	nextTick = process.nextTick;
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