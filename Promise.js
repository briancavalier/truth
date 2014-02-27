module.exports = Promise;

Promise.resolve = resolve;
Promise.reject  = reject;
Promise.all     = all;
Promise.race    = race;

var pending   = 0;
var fulfilled = 2;
var rejected  = 3;

// If x is a trusted promise, return it, otherwise
// return a new promise that follows x
function resolve(x) {
	return x instanceof Promise ? x : follow(x);
}

// Return a promise that is rejected with reason x
function reject(x) {
	var p = new InternalPromise();
	p._reject(x);
	return p;
}

// Create a pending promise whose fate is determined by resolver
function Promise(resolver) {
	var p = this;
	InternalPromise.call(this);
	runResolver(resolver, promiseResolve, promiseReject);

	function promiseResolve(x) {
		p._resolve(x);
	}

	function promiseReject(e) {
		p._reject(e);
	}
}

function runResolver(resolver, promiseResolve, promiseReject) {
	try {
		resolver(promiseResolve, promiseReject);
	} catch(e) {
		promiseReject(e);
	}
}

Promise.prototype.done = function(f, r) {
	this._when(this._maybeFatal, this, f, r);
};

Promise.prototype.then = function(f, r) {
	var p = new InternalPromise();
	this._when(p._resolve, p, f, r);
	return p;
};

Promise.prototype['catch'] = function(onRejected) {
	return this.then(null, onRejected);
};


// Return a promise that will fulfill after all promises in array
// have fulfilled, or will reject after one promise in array rejects
function all(promises) {
	var p = new InternalPromise();
	promises = Object(promises);
	var pending = promises.length >>> 0;

	if (pending === 0) {
		p._fulfill([]);
		return p;
	}

	var results = new Array(pending);

	promises.forEach(function(x, i) {
		resolve(x).then(function (x) {
			add(x, i);
		}, _reject);
	});

	function _reject(e) {
		p._reject(e);
	}

	function add(x, i) {
		results[i] = x;
		if (--pending === 0) {
			p._fulfill(results);
		}
	}

	return p;
}

// Return a promise that will settle to the same state as the first
// input promise that settles.
function race(promises) {
	return new Promise(function(resolve, reject) {
		promises.forEach(function(x) {
			resolve(x).then(resolve, reject);
		});
	});
}

// Private

function InternalPromise() {
	this._state = pending;
	this._value = void 0;
	this._handlers = [];
}

InternalPromise.prototype = Object.create(Promise.prototype);

function follow(x) {
	var p = new InternalPromise();
	p._resolve(x);
	return p;
}

Promise.prototype._when = function(resolve, p, f, r, t) {
	this._handlers.push(resolve, p, f, r, t);
	if (this._state !== pending) {
		enqueue(this._runHandlers, this);
	}
};

Promise.prototype._resolve = function(x) {
	if(this._state !== pending) return;

	if(Object(x) !== x) {
		this._fulfill(x);
	} else if(x instanceof Promise) {
		this._follow(x);
	} else {
		this._assimilate(x);
	}
};

Promise.prototype._follow = function(x) {
	if(x === this) {
		this._reject(new TypeError());
	} else if(x._state === fulfilled) {
		this._fulfill(x._value);
	} else if(x._state === rejected) {
		this._reject(x._value);
	} else {
		x._when(noop, void 0, this._fulfill, this._reject, this);
	}
};

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
	var handlerOffset = this._state;
	var q = this._handlers;
	this._handlers = [];
	for(var i=0; i< q.length; i+=5) {
		this._callHandler(q[i], q[i+1], q[i+handlerOffset], q[i+4], this._value);
	}
};

Promise.prototype._callHandler = function(resolve, p, f, t, x) {
	x = typeof f === 'function' ? tryCatch(f, t, x) : this;
	resolve.call(p, x);
};

Promise.prototype._assimilate = function(x) {
	try {
		var then = x.then;

		if(typeof then === 'function') {
			enqueue(this._runAssimilate, this, then, x);
		} else {
			this._fulfill(x);
		}
	} catch(e) {
		this._reject(e);
	}
};

Promise.prototype._runAssimilate = function(then, x) {
	var done = false;
	var reject = once(this._reject, this);
	try {
		then.call(x, once(this._resolve, this), reject);
	}
	catch(e) {
		reject(e);
	}

	function once(f, t) {
		return function(x) {
			if(done) return;
			done = true;
			f.call(t, x);
		};
	}
};


Promise.prototype._maybeFatal = function(x) {
	if(x != null && Object(x) === x) {
		resolve(x)['catch'](this._fatal);
	}
};

Promise.prototype._fatal = function(e) {
	setTimeout(function() {
		throw e;
	}, 0);
};

function tryCatch(f, t, x) {
	try {
		return f.call(t, x);
	} catch(e) {
		return reject(e);
	}
}

function noop() {}

// Internal Task queue
var nextTick;
var MutationObserver;
var queue = [];

function enqueue(task, a, b, c) {
	if(queue.push(task, a, b, c) === 4) {
		nextTick(drainQueue);
	}
}

function drainQueue() {
	var q = queue;
	queue = [];
	for(var i=0; i<q.length; i+=4) {
		q[i].call(q[i+1], q[i+2], q[i+3]);
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
