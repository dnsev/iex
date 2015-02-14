// ==UserScript==
// @name        Image Extensions
// @description Expand images nicely
// @namespace   dnsev
// @version     2.8
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_listValues
// @run-at      document-start
// @icon        data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAr0lEQVRo3u2ZQQ6AIAwEW+Nj9UX623pVQ2NRDIIzZyHdMGkhqhwxSaNSh8t6Bmmc5gPo6Zi0kboNhQhAgE4CABQYZOlJsbj3kDqFzula6UK1GV1tpp1Bq2PaFLBsvzayp7O/iVpKJxT6lEIhnqgV0SlTMxRqT6FcVd7oTijUjUKrltGPLvQrhbzjLtVtMr9HIV5kvMgA/g0/OOhCBCAAAQjQ1XXabqx5bUhFakCh2mytCzMhi1UZlAAAAABJRU5ErkJggg==
// @include     http://boards.4chan.org/*
// @include     https://boards.4chan.org/*
// @include     http://i.4cdn.org/*
// @include     https://i.4cdn.org/*
// @updateURL   https://raw.githubusercontent.com/dnsev/iex/master/builds/iex.meta.js
// @downloadURL https://raw.githubusercontent.com/dnsev/iex/master/builds/iex.user.js
// ==/UserScript==



(function () {
	"use strict";



	// Browser version
	var is_firefox = (navigator.userAgent.toString().indexOf("Firefox") >= 0);
	var is_chrome = (navigator.userAgent.toString().indexOf(" Chrome/") >= 0);
	var is_opera = !is_firefox && !is_chrome && (navigator.userAgent.toString().indexOf("MSIE") < 0);
	var userscript = {"include":["http://boards.4chan.org/*","https://boards.4chan.org/*","http://i.4cdn.org/*","https://i.4cdn.org/*"],"name":"Image Extensions","grant":["GM_getValue","GM_setValue","GM_deleteValue","GM_listValues"],"run-at":"document-start","namespace":"dnsev","updateURL":"https://raw.githubusercontent.com/dnsev/iex/master/builds/iex.meta.js","downloadURL":"https://raw.githubusercontent.com/dnsev/iex/master/builds/iex.user.js","version":"2.8","icon":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAr0lEQVRo3u2ZQQ6AIAwEW+Nj9UX623pVQ2NRDIIzZyHdMGkhqhwxSaNSh8t6Bmmc5gPo6Zi0kboNhQhAgE4CABQYZOlJsbj3kDqFzula6UK1GV1tpp1Bq2PaFLBsvzayp7O/iVpKJxT6lEIhnqgV0SlTMxRqT6FcVd7oTijUjUKrltGPLvQrhbzjLtVtMr9HIV5kvMgA/g0/OOhCBCAAAQjQ1XXabqx5bUhFakCh2mytCzMhi1UZlAAAAABJRU5ErkJggg==","description":"Expand images nicely"};

	// Error logging
	var log_error = function (error_string) {
		console.log(error_string);
		for (var i = 1; i < arguments.length; ++i) {
			console.log(arguments[i]);
		}
		try {
			null.null = null;
		}
		catch (e) {
			console.log(e.stack.toString());
		}
		alert(error_string);
	};



	// Function wrapping
	/**
		wrap_generic_event = function (self, callback, ...)

		Wrap a simple event callback to maintain the original "this" object

		@param self
			The "this" object the callback should be called with
		@param callback
			The event callback to be used
			The format is:
			callback.call(self, event, node, ...)
				self: the same object given from the self parameter
				event: the mouseover/mouseout event
				node: the node triggering the event
				...: any extra argument specified in the original ...
	*/
	var wrap_generic_event = function (self, callback) {
		// Get any extra arguments
		var extra_args = Array.prototype.slice.call(arguments, 2);

		// Return the function wrapped
		return function (event) {
			// Setup arguments
			var new_args = [ event , this ],
				i = 0,
				im = extra_args.length;

			for (; i < im; ++i) new_args.push(extra_args[i]);

			// Run callback
			return callback.apply(self, new_args);
		};
	};

	/**
		wrap_mouseenterleave_event = function (self, callback, ...)

		Wrap a mouseover/mouseout event to make it only execute on the correct node (not on child nodes)

		@param self
			The "this" object the callback should be called with
		@param callback
			The event callback to be used
			The format is:
			callback.call(self, event, node, ...)
				self: the same object given from the self parameter
				event: the mouseover/mouseout event
				node: the node triggering the event
				...: any extra argument specified in the original ...
	*/
	var wrap_mouseenterleave_event = (function () {

		// Handle mouseover/mouseout events to make sure the target is correct
		var on_mouseenterleave_prehandle = function (event, callback, self, extra_args) {
			// Must check for same parent element
			var parent = event.relatedTarget;

			// Error handling
			try {
				// Find parents
				while (parent) {
					if (parent === this) return;
					parent = parent.parentNode;
				}

				// Setup event arguments
				var new_args = [ event , this ],
					i = 0,
					im = extra_args.length;

				for (; i < im; ++i) new_args.push(extra_args[i]);

				// Okay, trigger event
				return callback.apply(self, new_args);
			}
			catch (e) {
			}
		};



		// Return a wrapping function
		return function (self, callback) {
			// Get any extra arguments
			var args = Array.prototype.slice.call(arguments, 2);

			// Return the function wrapped
			return function (event) {
				return on_mouseenterleave_prehandle.call(this, event, callback, self, args);
			};
		};

	})();



	// Instances
	var api = null,
		settings = null,
		sync = null,
		style = null,
		hotkey_manager = null,
		hover = null,
		image_hover = null,
		file_link = null,
		file_view = null;



	// Module to debug other classes
	var Debugger = (function () {

		var functions = {
			wrap_class: function (cls) {
				// Wrap the class
				var wrapped_class = functions.wrap_function(cls);

				// Static properties
				for (var static_prop in cls) {
					if (cls[static_prop] === cls) {
						// Reference the class
						wrapped_class[static_prop] = wrapped_class;
					}
					else if (cls[static_prop] instanceof Function) {
						// Wrap function
						wrapped_class[static_prop] = functions.wrap_function(cls[static_prop]);
					}
					else {
						// Data
						wrapped_class[static_prop] = cls[static_prop];
					}
				}

				// Prototype properties
				wrapped_class.prototype = {};
				for (var prop in cls.prototype) {
					if (cls.prototype[prop] === cls) {
						// Reference the class
						wrapped_class.prototype[prop] = wrapped_class;
					}
					else if (cls.prototype[prop] instanceof Function) {
						// Wrap function
						wrapped_class.prototype[prop] = functions.wrap_function(cls.prototype[prop]);
					}
					else {
						// Data
						wrapped_class.prototype[prop] = cls.prototype[prop];
					}
				}

				// Return
				return wrapped_class;
			},
			wrap_function: function (fcn) {
				return function () {
					try {
						return fcn.apply(this, arguments);
					}
					catch (e) {
						try {
							var s = "Exception caught:\n" + e.toString() + "\n\nStack trace:\n" + e.stack.toString();
							console.log(s);
							alert(s);
						}
						catch (e2) {
							// Do nothing
						}
					}
				};
			},
			wrap_function_io: function (fcn, f_name) {
				return function () {
					console.log("Function in: " + f_name);

					try {
						var ret = fcn.apply(this, arguments);
						console.log("Function out: " + f_name);
						return ret;
					}
					catch (e) {
						try {
							var s = "Exception caught:\n" + e.toString() + "\n\nStack trace:\n" + e.stack.toString();
							console.log(s);
							alert(s);
						}
						catch (e2) {
							// Do nothing
						}
					}

					console.log("Function out: " + f_name);
				};
			},
			error: function () {
				// Force an error; useful for testing
				return null.null;
			},
		};

		// Add a fast .wrap method for Function objects
		// Useful only for debugging
		try {
			Function.prototype.wrap = function () {
				return functions.wrap_function(this);
			};
		}
		catch (e) {}

		// Add a fast .io method for Function objects
		// Useful only for debugging
		try {
			Function.prototype.io = function (name) {
				return functions.wrap_function_io(this, name || "anonymous");
			};
		}
		catch (e) {}

		// Return the function list
		return functions;

	})();

	// Module for performing actions as soon as possible
	var ASAP = (function () {

		// Variables
		var state = 0;
		var callbacks_asap = [];
		var callbacks_ready = [];
		var callbacks_check = [];
		var callback_check_interval = null;
		var callback_check_interval_time = 20;
		var on_document_readystatechange_interval = null;



		// Events
		var on_document_readystatechange = function () {
			var c;

			// State check
			if (document.readyState == "interactive") {
				if (state === 0) {
					// Mostly loaded
					state = 1;

					// Callbacks
					c = callbacks_asap;
					callbacks_asap = null;
					trigger_callbacks(c);
				}
			}
			else if (document.readyState == "complete") {
				// Loaded
				state = 2;

				// Callbacks
				if (callbacks_asap !== null) {
					c = callbacks_asap;
					callbacks_asap = null;
					trigger_callbacks(c);
				}

				c = callbacks_ready;
				callbacks_ready = null;
				trigger_callbacks(c);

				// Complete
				clear_events();
			}
		};
		var on_callbacks_check = function () {
			// Test all
			for (var i = 0; i < callbacks_check.length; ++i) {
				if (callback_test.call(null, callbacks_check[i])) {
					// Remove
					callbacks_check.splice(i, 1);
					--i;
				}
			}

			// Stop timer?
			if (callbacks_check.length === 0) {
				clearInterval(callback_check_interval);
				callback_check_interval = null;
			}
		};
		var on_callback_timeout = function (data) {
			// Remove
			for (var i = 0; i < callbacks_check.length; ++i) {
				if (callbacks_check[i] === data) {
					// Update
					data.timeout_timer = null;

					// Callback
					if (data.timeout_callback) data.timeout_callback.call(null);

					// Remove
					callbacks_check.splice(i, 1);
					return;
				}
			}
		};

		// Clear events
		var clear_events = function () {
			if (on_document_readystatechange_interval !== null) {
				// Remove timer
				clearInterval(on_document_readystatechange_interval);
				on_document_readystatechange_interval = null;

				// Remove events
				document.removeEventListener("readystatechange", on_document_readystatechange, false);
				document.removeEventListener("load", on_document_load, false);

				// Clear callbacks
				callbacks_asap = null;
				callbacks_ready = null;
			}
		};

		// Test callback
		var callback_test = function (data) {
			if (!data.condition || data.condition.call(null)) {
				// Call
				data.callback.call(null);

				// Stop timeout
				if (data.timeout_timer !== null) {
					clearTimeout(data.timeout_timer);
					data.timeout_timer = null;
				}

				// Okay
				return true;
			}

			// Not called
			return false;
		};
		var callback_wait = function (data) {
			// Add to list
			callbacks_check.push(data);
			if (callback_check_interval === null) {
				callback_check_interval = setInterval(on_callbacks_check, callback_check_interval_time);
			}

			// Timeout
			if (data.timeout > 0) {
				data.timeout_timer = setTimeout(on_callback_timeout.bind(null, data), data.timeout * 1000);
			}
		};

		// Trigger callback list
		var trigger_callbacks = function (callback_list) {
			for (var i = 0, j = callback_list.length; i < j; ++i) {
				// Test
				if (!callback_test.call(null, callback_list[i])) {
					// Queue
					callback_wait.call(null, callback_list[i]);
				}
			}
		};

		// Add callback
		var add_callback = function (callback, condition, timeout, timeout_callback, target) {
			var cb_data = {
				callback: callback,
				condition: condition || null,
				timeout: timeout || 0,
				timeout_callback: timeout_callback || null,
				timeout_timer: null
			};

			if (target === null) {
				// Test
				if (!callback_test.call(null, cb_data)) {
					// Queue
					callback_wait.call(null, cb_data);
				}
			}
			else {
				// Add
				target.push(cb_data);
			}
		};

		// Setup events
		on_document_readystatechange();
		if (state < 2) {
			document.addEventListener("readystatechange", on_document_readystatechange, false);
			document.addEventListener("load", on_document_readystatechange, false);
			on_document_readystatechange_interval = setInterval(on_document_readystatechange, 250);
		}



		// Return functions
		return {

			/**
				Call a function as soon as possible when the DOM is fully loaded
				(document.readyState == "interactive")

				@param callback
					The callback to be called
					The call format is:
						callback.call(null)
				@param condition
					An additional condition to test for.
					If this condition is falsy, a timeout interval is
					used to continuously test it until it is true (or timed out)
					The call format is:
						condition.call(null)
				@param timeout
					If specified, a maximum time limit is given for the condition to be met
					Must be greater than 0, units are seconds
				@param timeout_callback
					If specified, this is a callback which is called when the condition check
					has timed out
					The call format is:
						timeout_callback.call(null)
			*/
			asap: function (callback, condition, timeout, timeout_callback) {
				// Add to asap
				add_callback.call(null, callback, condition, timeout, timeout_callback, callbacks_asap);
			},
			/**
				Call a function as soon as possible when the DOM is fully loaded
				(document.readyState == "complete")

				@param callback
					The callback to be called
					The call format is:
						callback.call(null)
				@param condition
					An additional condition to test for.
					If this condition is falsy, a timeout interval is
					used to continuously test it until it is true (or timed out)
					The call format is:
						condition.call(null)
				@param timeout
					If specified, a maximum time limit is given for the condition to be met
					Must be greater than 0, units are seconds
				@param timeout_callback
					If specified, this is a callback which is called when the condition check
					has timed out
					The call format is:
						timeout_callback.call(null)
			*/
			ready: function (callback, condition, timeout, timeout_callback) {
				// Add to ready
				add_callback.call(null, callback, condition, timeout, timeout_callback, callbacks_ready);
			},

		};

	})();

	// Module to manage data saving with an asynchronous paradigm
	var SaveAsync = (function () {

		// Storage type
		var using_localstorage = true,
			chrome_storage = null;

		// Check for chrome storage
		try {
			chrome_storage = chrome.storage.local || null;
		}
		catch (e) {
			chrome_storage = null;
		}

		// Check for GM storage
		try {
			if (GM_setValue && GM_getValue && GM_deleteValue && GM_listValues) {
				using_localstorage = false;
			}
		}
		catch (e) {
			using_localstorage = true;
		}



		// HTML5 storage
		var decode_value = function (value) {
				if (value) {
					try {
						return JSON.parse(value);
					}
					catch (e) {}
				}
				return value;
			},
			object_byte_size = function (obj) {
				// Calculate byte length
				obj = JSON.stringify(obj);
				try {
					// Encode in utf-8
					return unescape(encodeURIComponent(obj)).length;
				}
				catch (e) {
					return obj.length;
				}
			},

			generic_get_value = function (key, callback) {
				var val = this.getItem(key, null);
				callback.call(null, decode_value(val));
			},
			generic_set_value = function (key, value, callback) {
				this.setItem(key, JSON.stringify(value));
				if (callback) callback.call(null);
			},
			generic_del_value = function (key, callback) {
				this.removeItem(key);
				if (callback) callback.call(null);
			},
			generic_get_keys = function (callback) {
				var keys = [],
					key;

				for (key in this) {
					keys.push(key);
				}

				callback.call(null, keys);
			},
			generic_get_space_used = function (callback) {
				var size = 0,
					key;

				// Create representation
				for (key in this) {
					size += object_byte_size(key) + object_byte_size(decode_value(this.getItem(key, null)));
				}

				// Return
				callback.call(null, size);
			},

			w_get_value = generic_get_value.bind(window.localStorage),
			w_set_value = generic_set_value.bind(window.localStorage),
			w_del_value = generic_del_value.bind(window.localStorage),
			w_get_keys = generic_get_keys.bind(window.localStorage),
			w_get_space_used = generic_get_space_used.bind(window.localStorage),

			s_get_value = generic_get_value.bind(window.sessionStorage),
			s_set_value = generic_set_value.bind(window.sessionStorage),
			s_del_value = generic_del_value.bind(window.sessionStorage),
			s_get_keys = generic_get_keys.bind(window.sessionStorage),
			s_get_space_used = generic_get_space_used.bind(window.sessionStorage),

			get_value, set_value, del_value, get_keys, get_space_used;



		// Userscript storage
		if (chrome_storage) {
			// Chrome storage
			var get_keys_callback = function (next_callback, obj) {
				var keys = [],
					key;

				for (key in obj) {
					keys.push(key);
				}

				next_callback.call(null, keys);
			};

			var on_get = function (key, callback, value) {
				callback.call(null, value[key]);
			};

			get_value = function (key, callback) {
				this.get(key, on_get.bind(null, key, callback));
			}.bind(chrome_storage);

			set_value = function (key, value, callback) {
				var obj = {};
				obj[key] = value;

				this.set(obj, callback);
			}.bind(chrome_storage);

			del_value = function (key, callback) {
				this.remove(key, callback);
			}.bind(chrome_storage);

			get_keys = function (callback) {
				this.get(null, get_keys_callback.bind(null, callback));
			}.bind(chrome_storage);

			get_space_used = function (callback) {
				this.getBytesInUse(null, callback);
			}.bind(chrome_storage);
		}
		else if (using_localstorage) {
			// Local storage
			get_value = w_get_value;
			set_value = w_set_value;
			del_value = w_del_value;
			get_keys = w_get_keys;
			get_space_used = w_get_space_used;
		}
		else {
			// GM storage
			get_value = function (key, callback) {
				var val = GM_getValue(key, null);
				callback.call(null, decode_value(val));
			};
			set_value = function (key, value, callback) {
				GM_setValue(key, JSON.stringify(value));
				if (callback) callback.call(null);
			};
			del_value = function (key, callback) {
				GM_deleteValue(key);
				if (callback) callback.call(null);
			};
			get_keys = function (callback) {
				var keys = GM_listValues();
				callback.call(null, keys);
			};
			get_space_used = function (callback) {
				var keys = GM_listValues(),
					size = 0,
					i;

				// Create representation
				for (i = 0; i < keys.length; ++i) {
					size += object_byte_size(keys[i]) + object_byte_size(decode_value(GM_getValue(keys[i], null)));
				}

				// Return
				callback.call(null, size);
			};
		}



		// Return function list
		return {

			set: set_value, // key, value, callback()
			get: get_value, // key, callback(value)
			del: del_value, // key, callback()
			keys: get_keys, // callback([...])
			space_used: get_space_used, // callback(bytes)

			w_set: w_set_value,
			w_get: w_get_value,
			w_del: w_del_value,
			w_keys: w_get_keys,
			w_space_used: w_get_space_used,

			s_set: s_set_value,
			s_get: s_get_value,
			s_del: s_del_value,
			s_keys: s_get_keys,
			s_space_used: s_get_space_used,

			mode: chrome_storage ? "chrome" : (using_localstorage ? "localstorage" : "gm"),

		};

	})();

	// Module to have "delayed" loops
	var Delay = (function () {

		var DelayEach = (function () {

			var DelayEach = function (i, array, callback, max_count, delay, remove) {
				this.i = i;
				this.array = array;
				this.callback = callback;
				this.max_count = max_count;
				this.delay = delay;
				this.timeout = null;
				this.timeout_fcn = remove ? run_loop_with_remove.bind(this) : run_loop.bind(this);

				// Run
				this.timeout_fcn.call(this);
			};



			var run_loop = function (remove) {
				// Reset
				this.timeout = null;

				// Find max i
				var i = this.i;
				var array = this.array;
				var callback = this.callback;

				var i_max = i + this.max_count;
				var continue_loop = (array.length > i_max);
				if (!continue_loop) i_max = array.length;

				// Loop
				for (; i < i_max; ++i) {
					callback.call(this, array[i], i, this);
				}

				// Continue
				if (continue_loop) {
					this.timeout = setTimeout(this.timeout_fcn, this.delay);
				}
			};
			var run_loop_with_remove = function (remove) {
				// Reset
				this.timeout = null;

				// Find max i
				var i = 0;
				var array = this.array;
				var callback = this.callback;

				var i_max = i + this.max_count;
				var continue_loop = (array.length > i_max);
				if (!continue_loop) i_max = array.length;

				// Loop
				for (; i < i_max; ++i) {
					callback.call(this, array[i], i, this);
				}
				this.array.splice(0, i);
				this.i += i;

				// Continue
				if (continue_loop) {
					this.timeout = setTimeout(this.timeout_fcn, this.delay);
				}
			};



			DelayEach.prototype = {
				constructor: DelayEach,

				push: function (item) {
					this.array.push(item);
					if (this.timeout === null) this.timeout_fcn.call(this);
				},
				concat: function (other) {
					this.array = this.array.concat(other);
					if (this.timeout === null) this.timeout_fcn.call(this);
				},
			};



			return DelayEach;

		})();



		return {

			each: function (array, callback, max_count, delay) {
				// Start
				if (arguments.length < 3 || max_count <= 0) max_count = 1;
				if (arguments.length < 4 || delay <= 0) delay = 1;

				return new DelayEach(0, array, callback, max_count, delay * 1000, false);
			},
			queue: function (array, callback, max_count, delay) {
				// Start
				if (arguments.length < 3 || max_count <= 0) max_count = 1;
				if (arguments.length < 4 || delay <= 0) delay = 1;

				return new DelayEach(0, array, callback, max_count, delay * 1000, true);
			},

		};

	})();

	// Timing function
	var timing = (function () {

		var perf = window.performance,
			now;

		if (perf) {
			now = performance.now ||
				performance.mozNow ||
				performance.msNow ||
				performance.oNow ||
				performance.webkitNow;

			if (now) {
				return function () {
					return now.call(perf);
				};
			}
		}



		perf = null;
		now = null;
		return function () {
			return new Date().getTime();
		};

	})();



	// Class to manage tab synchronization events
	var Sync = (function () {
		var Sync = function () {
			this.key_name = "iex_sync";

			this.listeners = {};

			window.addEventListener("storage", (this.on_storage_change_bind = on_storage_change.bind(this)), false);
		};

		var on_storage_change = function (event) {
			// Make sure it's an "addition" trigger
			if (event.key == this.key_name && event.newValue !== null) {
				var key = event.newValue, data = null;
				try {
					data = JSON.parse(key);
					key = data[0];
					data = data[1];
				}
				catch (e) {
					key = event.newValue;
					data = null;
				}
				if (key in this.listeners) {
					// Signal all
					var list = this.listeners[key];
					for (var i = 0; i < list.length; ++i) {
						// Signal
						list[i].call(this, key, data);
					}
				}
			}
		};

		Sync.instance = null;

		Sync.prototype = {
			constructor: Sync,

			/**
				Remove any bound events or leftover data used by an instance
			*/
			destroy: function () {
				// Remove events
				window.removeEventListener("storage", this.on_storage_change_bind, false);
			},

			/**
				Add a synchronization event listener

				@param key
					They sync key to listen for
				@param callback
					The function to be called
					Callback format is as follows:
						callback.call(Sync.instance, key, data)
			*/
			on: function (key, callback) {
				// Add to listener list
				if (key in this.listeners) {
					this.listeners[key].push(callback);
				}
				else {
					this.listeners[key] = [ callback ];
				}
			},
			/**
				Remove a synchronization event listener

				@param key
					They sync key used in the .on function
				@param callback
					The callback function used in the .on function
				@return
					true if it was removed successfully,
					false if it did not exist
			*/
			off: function (key, callback) {
				// Check if it exists
				if (key in this.listeners) {
					var list = this.listeners[key];
					for (var i = 0; i < list.length; ++i) {
						if (list[i] === callback) {
							// Remove from list
							list.splice(i, 1);
							// Remove key if empty
							if (list.length === 0) {
								delete this.listeners[key];
							}
							// Success
							return true;
						}
					}
				}

				// Not found
				return false;
			},
			/**
				Trigger a synchronization event

				@param key
					They sync key
				@return
					true if no errors occur,
					false otherwise
			*/
			trigger: function (key, data) {
				// Set the value
				try {
					// Trigger
					var value = JSON.stringify([ key , data ]);
					window.localStorage.setItem(this.key_name, value);
					window.localStorage.removeItem(this.key_name);
					// Okay
					return true;
				}
				catch (e) {
					// Failure
					return false;
				}
			},

		};

		return Sync;

	})();

	// 4chan site and script interface
	var API = (function () {

		var MutationObserver = (window.MutationObserver || window.WebKitMutationObserver);



		var API = function () {
			// Custom events
			this.events = {
				"page_type_detected": [],
				"script_detected": [],
				"thread_update": [],
				"settings_4chanx_open": [],
				"settings_4chanx_close": [],
				"settings_4chanx_section_change": [],
				"settings_vanilla_open": [],
				"settings_vanilla_close": [],
				"menu_4chanx_open": [],
				"menu_4chanx_close": [],
				"image_hover_open": [],
				"image_hover_close": [],
				"post_add": [],
				"post_remove": [],
			};
			this.getters = {
				"posts": get_all_posts.bind(this),
			};

			// Nodes
			this.settings_4chanx_container = null;
			this.settings_vanilla_container = null;
			this.menu_4chanx_container = null;

			// Script
			this.is_4chanx = false;
			this.is_appchanx = false;
			this.page_type = "";

			// Document listening
			this.doc_observer = null;
			this.body_observer = null;
			this.delform_observer = null;
			this.settings_observer = null;
			this.hover_ui_observer = null;
			this.header_settings_menu_observer = null;
			this.linkify_observer = null;
		};



		var on_asap = function () {
			// Hook
			hook_body_observers.call(this);
			hook_hover_observers.call(this, null);
			hook_delform_observers.call(this, null);
			hook_header_observers.call(this, null);

			// Detect scripts
			var el = document.documentElement;
			if (el) {
				detect_page_type.call(this, el);
				detect_scripts.call(this, el);
			}
		};

		var on_4chanx_post_callback = function (self, callback) {
			callback.call(self, this);
		};
		var on_4chanx_thread_callback = function (self, callback) {
			callback.call(self, this);
		};

		var on_document_observe = function (records) {
			var i, r;

			for (i = 0; i < records.length; ++i) {
				r = records[i];

				if (r.attributeName == "class") {
					// Detect
					detect_scripts.call(this, r.target);
				}
			}
		};

		var on_body_observe = function (records) {
			var i, j, nodes;

			for (i = 0; i < records.length; ++i) {
				if ((nodes = records[i].addedNodes)) {
					for (j = 0; j < nodes.length; ++j) {
						// Check
						on_body_element_add.call(this, nodes[j]);
					}
				}
				if ((nodes = records[i].removedNodes)) {
					for (j = 0; j < nodes.length; ++j) {
						// Check
						on_body_element_remove.call(this, nodes[j]);
					}
				}
			}
		};
		var on_body_element_add = function (element) {
			var id = element.getAttribute("id");
			if (id == "fourchanx-settings") {
				// 4chan-x / ccd0
				trigger_settings_4chanx_open.call(this, element);
			}
			else if (id == "appchanx-settings") {
				// appchan-x / zixaphir
				trigger_settings_4chanx_open.call(this, element);
			}
			else if (id == "overlay") {
				// 4chan-x / MayhemYDG / ihavenoface
				var e2 = element.querySelector("#fourchanx-settings");
				if (e2) {
					trigger_settings_4chanx_open.call(this, e2);
				}
			}
			else if (id == "settingsMenu") {
				// 4chan vanilla
				trigger_settings_vanilla_open.call(this, element);
			}
			else if (id == "hoverUI") {
				hook_hover_observers.call(this, element);
			}
			else if (id == "delform") {
				hook_delform_observers.call(this, element);
			}
			else if (id == "image-hover") {
				// Vanilla 4chan image hover
				trigger.call(this, "image_hover_open", {
					container: element
				});
			}
			else if (id == "qp") {
				// 4chan-x / MayhemYDG
				var pc = element.querySelector(".postContainer");
				if (pc) {
					trigger.call(this, "post_add", pc);
				}
				// else, post might not be loaded yet
			}
			else if (id == "header-bar" || id == "header") {
				hook_header_observers.call(this, element);
			}
			/*else if (id == "quote-preview") {
				// Vanilla 4chan
				// Only a .post; no .postContainer
				trigger.call(this, "post_add", element);
			}*/
		};
		var on_body_element_remove = function (element) {
			var id = element.getAttribute("id");
			if (id == "fourchanx-settings") {
				trigger_settings_4chanx_close.call(this, element);
			}
			else if (id == "appchanx-settings") {
				trigger_settings_4chanx_close.call(this, element);
			}
			else if (id == "overlay") {
				var e2 = element.querySelector("#fourchanx-settings");
				if (e2) {
					trigger_settings_4chanx_close.call(this, e2);
				}
			}
			else if (id == "settingsMenu") {
				// 4chan vanilla
				trigger_settings_vanilla_close.call(this, element);
			}
			else if (id == "image-hover") {
				trigger.call(this, "image_hover_close", {
					container: element
				});
			}
			else if (id == "qp") {
				// 4chan-x / MayhemYDG
				var pc = element.querySelector(".postContainer");
				if (pc) {
					trigger.call(this, "post_remove", pc);
				}
			}
			/*else if (id == "quote-preview") {
				// Vanilla 4chan
				// Only a .post; no .postContainer
				trigger.call(this, "post_remove", element);
			}*/
		};

		var on_delform_post_observe = function (records) {
			var nodes, n, i, j, k, im, jm, km, pc;
			i = 0;
			im = records.length;
			for (; i < im; ++i) {
				if ((nodes = records[i].addedNodes)) {
					j = 0;
					jm = nodes.length;
					for (; j < jm; ++j) {
						// Check
						n = nodes[j];
						if (style.has_class(n, "postContainer")) {
							trigger.call(this, "post_add", n);
						}
						else if (style.has_class(n, "thread") || style.has_class(n, "board")) {
							pc = n.querySelectorAll(".postContainer");
							k = 0;
							km = pc.length;
							for (; k < km; ++k) {
								trigger.call(this, "post_add", pc[k]);
							}
						}
						/*else if (n.tagName == "A" && style.has_class(n, "linkify")) {
							trigger.call(this, "linkify", n);
						}*/
					}
				}
				if ((nodes = records[i].removedNodes)) {
					j = 0;
					jm = nodes.length;
					for (; j < jm; ++j) {
						// Check
						n = nodes[j];
						if (style.has_class(n, "inline")) {
							pc = n.querySelector(".postContainer");
							if (pc) {
								trigger.call(this, "post_remove", pc);
							}
						}
						else if (style.has_class(n, "thread") || style.has_class(n, "board")) {
							pc = n.querySelectorAll(".postContainer");
							k = 0;
							km = pc.length;
							for (; k < km; ++k) {
								trigger.call(this, "post_remove", pc[k]);
							}
						}
					}
				}
			}
		};

		var on_settings_observe = function (records) {
			for (var i = 0; i < records.length; ++i) {
				if (records[i].attributeName == "class") {
					// Section change
					trigger.call(this, "settings_4chanx_section_change", {
						container: this.settings_4chanx_container,
						section: records[i].target
					});
				}
			}
		};

		var on_hover_ui_observe = function (records) {
			var i, j, nodes, r;

			for (i = 0; i < records.length; ++i) {
				r = records[i];

				if ((nodes = r.addedNodes)) {
					for (j = 0; j < nodes.length; ++j) {
						// Check
						on_hover_ui_element_add.call(this, nodes[j]);
					}
				}
				if ((nodes = r.removedNodes)) {
					for (j = 0; j < nodes.length; ++j) {
						// Check
						on_hover_ui_element_remove.call(this, nodes[j]);
					}
				}
			}
		};
		var on_hover_ui_element_add = function (element) {
			var id = element.getAttribute("id");
			if (id == "ihover") {
				trigger.call(this, "image_hover_open", {
					container: element
				});
			}
			else if (id == "qp") {
				var pc = element.querySelector(".postContainer");
				if (pc) {
					trigger.call(this, "post_add", pc);
				}
				// else, post might not be loaded yet
			}
			else if (id == "menu") {
				// 4chan-x / ccd0, appchan-x
				trigger_menu_4chanx_open.call(this, element, null);
			}
		};
		var on_hover_ui_element_remove = function (element) {
			var id = element.getAttribute("id");
			if (id == "ihover") {
				trigger.call(this, "image_hover_close", {
					container: element
				});
			}
			else if (id == "qp") {
				var pc = element.querySelector(".postContainer");
				if (pc) {
					trigger.call(this, "post_remove", pc);
				}
			}
			else if (id == "menu") {
				// 4chan-x / ccd0, appchan-x
				trigger_menu_4chanx_close.call(this, element);
			}
		};

		var on_4chanx_menu_observe = function (type, records) {
			var i, j, nodes, r;

			for (i = 0; i < records.length; ++i) {
				r = records[i];

				if ((nodes = r.addedNodes)) {
					for (j = 0; j < nodes.length; ++j) {
						// Check
						on_4chanx_menu_element_add.call(this, nodes[j], type);
					}
				}
				if ((nodes = r.removedNodes)) {
					for (j = 0; j < nodes.length; ++j) {
						// Check
						on_4chanx_menu_element_remove.call(this, nodes[j], type);
					}
				}
			}
		};
		var on_4chanx_menu_element_add = function (element, type) {
			var id = element.getAttribute("id");
			if (id == "menu") {
				// 4chan-x / MayhemYDG
				trigger_menu_4chanx_open.call(this, element, type);
			}
		};
		var on_4chanx_menu_element_remove = function (element, type) {
			var id = element.getAttribute("id");
			if (id == "menu") {
				// 4chan-x / MayhemYDG
				trigger_menu_4chanx_close.call(this, element);
			}
		};

		var on_menu_4chanx_entry_mouseenter = function (event, node) {
			if (this.menu_4chanx_container) {
				var focused = this.menu_4chanx_container.querySelectorAll(".focused"),
					i;

				for (i = 0; i < focused.length; ++i) {
					style.remove_class(focused[i], "focused");
				}
			}

			style.add_class(node, "focused");
		};
		var on_menu_4chanx_entry_mouseleave = function (event, node) {
			// This is removed even for versions which menu items keep it (4chan-x / ccd0, etc.)
			style.remove_class(node, "focused");
		};

		var hook_document_observer = function () {
			var el = document.documentElement;
			if (!el) return;

			if (this.doc_observer === null) {
				// Create new observer
				this.doc_observer = new MutationObserver(on_document_observe.bind(this));

				// Observe
				this.doc_observer.observe(
					el,
					{
						attributes: true
					}
				);
			}
		};
		var hook_body_observers = function () {
			// Observe the body
			var body = document.querySelector("body");
			if (!body) return;

			if (this.body_observer === null) {
				// Create new observer
				this.body_observer = new MutationObserver(on_body_observe.bind(this));

				// Observe
				this.body_observer.observe(
					body,
					{
						childList: true,
					}
				);
			}
		};
		var hook_hover_observers = function (hover_ui) {
			if (hover_ui === null) {
				hover_ui = document.getElementById("hoverUI");
				if (!hover_ui) return;
			}

			if (this.hover_ui_observer === null) {
				// Create new observer
				this.hover_ui_observer = new MutationObserver(on_hover_ui_observe.bind(this));

				// Observe
				this.hover_ui_observer.observe(
					hover_ui,
					{
						childList: true,
					}
				);
			}
		};
		var hook_delform_observers = function (delform) {
			if (delform === null) {
				delform = document.getElementById("delform");
				if (!delform) return;
			}

			if (this.delform_observer === null) {
				// Create new observer
				this.delform_observer = new MutationObserver(on_delform_post_observe.bind(this));

				// Observe
				this.delform_observer.observe(
					delform,
					{
						childList: true,
						subtree: true,
					}
				);
			}
		};
		var hook_header_observers = function (header) {
			if (header === null) {
				header = document.getElementById("header-bar");
				if (!header) {
					header = document.getElementById("header");
					if (!header) return;
				}
			}

			var button;

			if (this.header_settings_menu_observer === null && (button = header.querySelector(".menu-button"))) {
				// Create new observer
				this.header_settings_menu_observer = new MutationObserver(on_4chanx_menu_observe.bind(this, "main"));

				// Observe
				this.header_settings_menu_observer.observe(
					button,
					{
						childList: true,
					}
				);
			}
		};

		var detect_page_type = function (doc_el) {
			// Detect page type
			var delform = doc_el.querySelector("#delform");
			if (delform) {
				var flash_table = delform.querySelector(".flashListing");
				if (flash_table) {
					// Flash board
					this.page_type = "board_flash";
				}
				else {
					// Thread or board or catalog
					if (delform.querySelector(".board.catalog-small")) {
						// 4chan-x
						this.page_type = "catalog";
					}
					else if (doc_el.querySelector("#search-box")) {
						this.page_type = "board";
					}
					else {
						this.page_type = "thread";
					}
				}
			}
			else {
				// Index
				if (doc_el.querySelector("#content>#threads")) {
					this.page_type = "catalog";
				}
				else if (doc_el.querySelector("#doc")) {
					this.page_type = "error";
				}
				else {
					// Image or video
					var n = doc_el.querySelector("body"),
						s = doc_el.querySelectorAll("script");

					if (s.length === 0 && n !== null && n.children.length === 1 && (n = n.firstChild)) {
						n = n.tagName.toLowerCase();
						if (n == "img") {
							this.page_type = "image";
						}
						else if (n == "video") {
							this.page_type = "video";
						}
					}
				}
			}

			// Trigger event
			trigger.call(this, "page_type_detected", {
				page_type: this.page_type
			});
		};
		var detect_scripts = function (doc_el) {
			// Detect 4chan-x / appchan-x
			if (!this.is_4chanx) {
				this.is_4chanx = style.has_class(doc_el, "fourchan-x");
				if (this.is_4chanx) {
					this.is_appchanx = style.has_class(doc_el, "appchan-x");

					// Detected
					trigger.call(this, "script_detected", {
						name: "4chan-x"
					});
				}
			}
		};

		var trigger = function (event, data) {
			// Trigger
			if (event in this.events) {
				var e_list = this.events[event];
				for (var i = 0; i < e_list.length; ++i) {
					e_list[i].call(this, data);
				}
			}
		};
		var trigger_menu_4chanx_open = function (element, type) {
			// Find type
			var type_checks = {
					"main": {
						classes: [ "settings-link" , "image-expansion-link" , "gallery-link" ],
						count: 0,
					},
					"post": {
						classes: [ "report-link" , "hide-reply-link" , "delete-link" ],
						count: 0,
					},
				},
				c = element.firstChild,
				t, tc, i;

			if (type === null) {
				type = "other";

				while (c) {
					// Class
					if (style.has_class(c, "entry")) {
						// Check for class types
						for (t in type_checks) {
							tc = type_checks[t];
							for (i = 0; i < tc.classes.length; ++i) {
								if (style.has_class(c, tc.classes[i])) {
									++tc.count;
									tc = null;
									break;
								}
							}
							// Done
							if (!tc) break;
						}
					}

					// Next
					c = c.nextSibling;
				}

				// Check type
				i = 0;
				for (t in type_checks) {
					if (type_checks[t].count > i) {
						i = type_checks[t].count;
						type = t;
					}
				}
			}

			// Event
			this.menu_4chanx_container = element;
			trigger.call(this, "menu_4chanx_open", {
				container: element,
				type: type
			});
		};
		var trigger_menu_4chanx_close = function (element) {
			// Event
			this.menu_4chanx_container = null;
			trigger.call(this, "menu_4chanx_close", {
				container: element,
			});
		};
		var trigger_settings_4chanx_open = function (element) {
			// Open
			this.settings_4chanx_container = element;

			// Event
			trigger.call(this, "settings_4chanx_open", {
				container: element
			});

			// Settings observer
			if (this.settings_observer !== null) {
				this.settings_observer.disconnect();
				this.settings_observer = null;
			}
			var section = element.querySelector("section");
			if (section) {
				this.settings_observer = new MutationObserver(on_settings_observe.bind(this));

				// Observe
				this.settings_observer.observe(
					section,
					{
						attributes: true,
					}
				);

				// Section change
				trigger.call(this, "settings_4chanx_section_change", {
					container: element,
					section: section
				});
			}
		};
		var trigger_settings_4chanx_close = function (element) {
			// Close
			this.settings_4chanx_container = null;
			if (this.settings_observer !== null) {
				this.settings_observer.disconnect();
				this.settings_observer = null;
			}

			// Event
			trigger.call(this, "settings_4chanx_close", {
				container: element
			});
		};
		var trigger_settings_vanilla_open = function (element) {
			// Open
			this.settings_vanilla_container = element;

			// Event
			trigger.call(this, "settings_vanilla_open", {
				container: element
			});
		};
		var trigger_settings_vanilla_close = function (element) {
			// Close
			this.settings_vanilla_container = null;

			// Event
			trigger.call(this, "settings_vanilla_close", {
				container: element
			});
		};

		var get_all_posts = function () {
			// Acquire all .postContainer's
			var elements = null, e;
			var container = document.getElementById("delform");
			if (container) {
				elements = Array.prototype.slice.call(container.querySelectorAll(".postContainer"), 0);
			}

			container = document.getElementById("hoverUI");
			if (container) {
				e = Array.prototype.slice.call(container.querySelectorAll(".postContainer"), 0);
				if (elements) elements = elements.concat(e);
				else elements = e;
			}

			// Return
			return (elements === null ? [] : elements);
		};

		var container_get_nodes = function (container, filter_callback, data) {
			var node = container.firstChild;

			for (; node; node = node.nextSibling) {
				if (node.nodeType == 1) { // ELEMENT_NODE
					// Skip inlined posts
					if (node.tagName == "DIV" && (style.has_class(node, "inline") || style.has_class(node, "inlined"))) continue;

					if (filter_callback.call(this, node, data)) {
						// Go into
						container_get_nodes.call(this, node, filter_callback, data);
					}
				}
			}
		};



		API.prototype = {
			constructor: API,

			destroy: function () {
				// Remove event listeners
				if (this.doc_observer !== null) {
					this.doc_observer.disconnect();
					this.doc_observer = null;
				}
				if (this.body_observer !== null) {
					this.body_observer.disconnect();
					this.body_observer = null;
				}
				if (this.settings_observer !== null) {
					this.settings_observer.disconnect();
					this.settings_observer = null;
				}
				if (this.hover_ui_observer !== null) {
					this.hover_ui_observer.disconnect();
					this.hover_ui_observer = null;
				}
				if (this.delform_observer !== null) {
					this.delform_observer.disconnect();
					this.delform_observer = null;
				}
			},

			setup: function () {
				// Check for other addons
				hook_document_observer.call(this);
				ASAP.asap(on_asap.bind(this));
			},

			on: function (event, callback) {
				// Add callback
				if (event in this.events) {
					this.events[event].push(callback);
				}
			},
			off: function (event, callback) {
				// Add callback
				if (event in this.events) {
					var e_list = this.events[event];
					for (var i = 0; i < e_list.length; ++i) {
						if (e_list[i] === callback) {
							// Remove
							e_list.splice(i, 1);
							return true;
						}
					}
				}

				return false;
			},
			get: function (getter) {
				if (getter in this.getters) {
					return this.getters[getter].call(this);
				}

				return null;
			},

			settings_4chanx_open: function (tab) {
				// Signal 4chan-x to open settings
				document.dispatchEvent(new CustomEvent("OpenSettings", {
					detail: tab || "Main"
				}));
			},
			settings_4chanx_close: function () {
				if (!this.settings_4chanx_container) return;

				// Click the overlay
				var overlay = document.getElementById("overlay");
				if (overlay) {
					overlay.click();
				}
			},
			settings_4chanx_change_section: function (section) {
				if (!this.settings_4chanx_container) return;

				section = section.replace(/\s+/g, "-").toLowerCase();
				var target_tab = this.settings_4chanx_container.querySelector(".tab-" + section);
				if (target_tab) {
					target_tab.click();
				}
			},
			settings_4chanx_is_open: function () {
				return (this.settings_4chanx_container !== null);
			},
			settings_vanilla_open: function () {
				var settings_link = document.getElementById("settingsWindowLink");
				if (settings_link) {
					settings_link.click();
				}
			},
			settings_vanilla_close: function () {
				if (!this.settings_vanilla_container) return;

				var button = this.settings_vanilla_container.querySelector(".panelHeader>span>.pointer");
				if (button) {
					button.click();
				}
			},
			settings_vanilla_save: function () {
				if (!this.settings_vanilla_container) return;

				var button = this.settings_vanilla_container.querySelector("button[data-cmd='settings-save']");
				if (button) {
					button.click();
				}
			},
			settings_vanilla_is_open: function () {
				return (this.settings_vanilla_container !== null);
			},

			menu_4chanx_close: function () {
				if (!this.menu_4chanx_container) return;

				var par = this.menu_4chanx_container.parentNode;
				if (par) par.click();
			},
			menu_4chanx_is_open: function () {
				return (this.menu_4chanx_container !== null);
			},
			menu_4chanx_add_entry: function (menu_container, element, order) {
				// Styling
				style.add_class(element, "entry");
				element.style.order = (order || 0);

				// Events
				var e_enter = wrap_mouseenterleave_event(this, on_menu_4chanx_entry_mouseenter),
					e_leave = wrap_mouseenterleave_event(this, on_menu_4chanx_entry_mouseleave);

				element.addEventListener("mouseover", e_enter, false);
				element.addEventListener("mouseout", e_leave, false);

				// Add
				menu_container.appendChild(element);
			},

			notification: function (type, content, lifetime, callback) {
				// Setup
				var detail = {
					type: type,
					content: content,
				};
				if (arguments.length >= 3) {
					detail.lifetime = lifetime;
				}
				if (arguments.length >= 4) {
					detail.cb = callback;
				}

				// Display
				document.dispatchEvent(new CustomEvent("CreateNotification", {
					detail: detail
				}));
			},

			post_is_image_expanded_or_expanding: function (post_container) {
				var n_file, n_img;

				// Expanded
				if (this.is_4chanx) {
					if (style.has_class(post_container, "expanded-image")) return true;

					// Get the .file container
					n_file = this.post_get_file_info_container(post_container);

					// Find image
					n_img = n_file.querySelector("img");
					return (n_img && style.has_class(n_img, "expanding"));
				}
				else {
					// Get the .file container
					n_file = this.post_get_file_info_container(post_container);

					// Return
					return (style.has_class(n_file, "image-expanded") || n_file.querySelector("video.expandedWebm") !== null);
				}
			},
			post_get_file_info: function (post_container) {
				// Setup info
				var info = {
					url: "",
					thumb: null,
					spoiler: null,
					name: "",
					resolution: {
						width: 0,
						height: 0
					},
					resolution_thumb: {
						width: 0,
						height: 0
					},
					size: 0,
					size_label: "",
				};

				// Nodes
				var n, m, n_p, n_file, style_str;

				n_file = this.post_get_file_info_container(post_container);

				if (n_file) {
					// Get info
					if ((n_p = n_file.querySelector(".file-info"))) {
						// 4chan-x
						if ((n = n_p.querySelector("a"))) {
							info.url = n.getAttribute("href") || "";
							info.name = n.textContent.trim();
						}
						if ((n = n_p.lastChild)) {
							m = /([0-9\.]+)\s*(\w?b),(?:\s*([0-9]+)x([0-9]+))?/i.exec((n.textContent || ""));
							if (m) {
								info.size = parseFloat(m[1]);
								info.size_label = m[2].toLowerCase();
								if (m[3] !== undefined) {
									info.resolution.width = parseInt(m[3], 10);
									info.resolution.height = parseInt(m[4], 10);
								}
							}
						}
					}
					else if ((n_p = n_file.querySelector(".fileText"))) {
						// Vanilla
						if ((n = n_p.querySelector("a"))) {
							info.url = n.getAttribute("href") || "";

							// File name
							info.name = n_p.getAttribute("title") || n.getAttribute("title") || n.textContent || "";

							// Attributes
							if ((n = n.nextSibling)) {
								m = /([0-9\.]+)\s*(\w?b),(?:\s*([0-9]+)x([0-9]+))?/i.exec((n.textContent || ""));
								if (m) {
									info.size = parseFloat(m[1]);
									info.size_label = m[2].toLowerCase();
									if (m[3] !== undefined) {
										info.resolution.width = parseInt(m[3], 10);
										info.resolution.height = parseInt(m[4], 10);
									}
								}
							}
						}
					}

					// Thumbnail and spoiler status
					if ((n_p = n_file.querySelector(".fileThumb"))) {
						if ((n = n_p.querySelector("img:not(.full-image):not(.expanded-thumb)"))) {
							m = n.getAttribute("src");
							if (style.has_class(n_p, "imgspoiler")) {
								info.spoiler = m;
								// Assume thumbnail
								if (info.url) {
									info.thumb = info.url.replace(/\/\/(.*)i\.4cdn\.org/g, "//t.4cdn.org").replace(/\.([^\.]*)$/, "s.jpg");
								}
							}
							else {
								info.thumb = m;
							}

							// Resolution
							style_str = n.getAttribute("style");
							m = /width\s*\:\s*([0-9\.]+)px/i.exec(style_str);
							if (m) {
								info.resolution_thumb.width = parseFloat(m[1]) || 0;
							}
							m = /height\s*\:\s*([0-9\.]+)px/i.exec(style_str);
							if (m) {
								info.resolution_thumb.height = parseFloat(m[1]) || 0;
							}
						}
					}
				}

				// Info
				return info;
			},

			post_get_file_info_container: function (post_container) {
				// Post body
				var node = post_container.querySelector(".post");
				if (node && (node = node.firstChild)) {
					while (true) {
						// File container
						if (style.has_class(node, "file")) return node;

						// Next
						if (!(node = node.nextSibling)) return null;
					}
				}

				return null;
			},
			post_get_image_container: function (post_container) {
				// Post body
				var node = post_container.querySelector(".post");
				if (node && (node = node.firstChild)) {
					while (true) {
						// File container
						if (style.has_class(node, "file")) {
							// Get thumbnail container
							return node.querySelector(".fileThumb");
						}

						// Next
						if (!(node = node.nextSibling)) return null;
					}
				}

				return null;
			},
			post_get_post_container_from_image_container: function (image_container) {
				var n;

				try {
					// 3 nodes up should be the container
					n = image_container.parentNode.parentNode.parentNode;
					if (n && style.has_class(n, "postContainer")) return n;
				}
				catch (e) {
				}

				// Parent check
				n = image_container;
				while ((n = n.parentNode) && !style.has_class(n, "postContainer"));
				return n;
			},
			post_get_image_expanded_from_image_container: function (image_container) {
				if (this.is_4chanx) {
					return image_container.querySelector(".full-image");
				}
				else {
					var n = image_container.querySelector("img.expanded-thumb");
					if (n !== null) return n;

					if (image_container.parentNode === null) return null;

					return image_container.parentNode.querySelector("video.expandedWebm");
				}
			},
			post_get_file_nodes: function (post_container) {
				var post = post_container.querySelector(".post"),
					nodes, node;

				if (post !== null) {
					// File info container
					if ((node = post.firstChild)) {
						while (true) {
							// File container
							if (style.has_class(node, "file")) {
								nodes = {
									container: node,
									info_container: node.querySelector(".fileText,.file-info"),
									link_thumbnail: node.querySelector(".fileThumb"),
									link: null,
								};

								if (nodes.info_container !== null) {
									nodes.link = node.querySelector("a");
								}

								return nodes;
							}

							// Next
							if (!(node = node.nextSibling)) break;
						}
					}
				}

				return null;
			},
			post_get_nodes: function (post_container) {
				var post = post_container.querySelector(".post"),
					nodes, node, node2;

				if (post === null) return null;

				nodes = {
					subject: null,
					name: null,
					tripcode: null,
					date: null,
					no: null,
					number: null,
					comment: null,
				};

				// Post info
				if ((node = post.querySelector(".postInfo"))) {
					nodes.subject = node.querySelector(".subject");
					nodes.name = node.querySelector(".name");
					nodes.tripcode = node.querySelector(".posterTrip");
					nodes.date = node.querySelector(".dateTime");
					if ((node2 = node.querySelectorAll(".postNum>a")).length >= 2) {
						nodes.no = node2[0];
						nodes.number = node2[1];
					}
				}

				// Comment
				for (node = post.lastChild; node; node = node.previousSibling) {
					if (style.has_class(node, "postMessage")) {
						nodes.comment = node;
						break;
					}
				}

				return nodes;
			},
			/**
				Get nodes from within a comment which are not contained within any inline containers.

				@param comment
					The container node of the comment
				@param filter_callback
					A callback used to filter nodes into the return array
					The function is called as:
						filter_callback.call(this, node, data)
						node: the ELEMENT_NODE
						data: the data parameter passed from the initial call
					The function should return true if the node's contents should be parsed, and false otherwise
					The function can modify the return value by doing something like:
						result_nodes = api.post_get_comment_nodes(node, function (node, data) {
							if (some-tests-go-here) {
								data.push(node);
								return false;
							}

							return true;
						}, []) // Call format

				@return
					data
			*/
			post_get_comment_nodes: function (comment, filter_callback, data) {
				container_get_nodes.call(this, comment, filter_callback, data);
				return data;
			},

			get_header_rect: function () {
				var header = document.getElementById(this.is_4chanx ? "header-bar" : "boardNavMobile");
				if (header) {
					return style.get_object_rect(header);
				}
				else {
					return {
						left: 0,
						top: 0,
						right: 0,
						bottom: 0,
					};
				}
			},

			observe_children: function (parent_node, cb) {
				// Create new observer
				var o = new MutationObserver(function (records) {
					var i, j, nodes;

					for (i = 0; i < records.length; ++i) {
						if ((nodes = records[i].addedNodes)) {
							for (j = 0; j < nodes.length; ++j) {
								// Check
								cb.call(null, true, nodes[j]);
							}
						}
						if ((nodes = records[i].removedNodes)) {
							for (j = 0; j < nodes.length; ++j) {
								// Check
								cb.call(null, false, nodes[j]);
							}
						}
					}
				});

				// Observe
				o.observe(
					parent_node,
					{
						childList: true,
					}
				);

				// Done
				return function () {
					o.disconnect();
				};
			},
		};



		return API;

	})();

	// Notification
	var Notification = (function () {

		var Notification = function (data) {
			this.nodes = null;
			this.overlay_can_close_on_click = ("overlay_close" in data && data.overlay_close);

			this.on_overlay_click_bind = null;
			this.on_body_click_bind = null;
			this.on_close_click_bind = null;

			this.events = {
				"close": []
			};

			var body = document.querySelector("body");
			if (body) {
				this.nodes = {
					container: null,
					body: null,
					close: null
				};

				// Create notification container
				var container, n_body_outer, n_aligner, n_body_inner, n_body, n_content_outer, n_content, n_close, n_style, nc_title, nc_body;
				container = document.createElement("div");
				container.className = "iex_notification " + style.theme;
				container.addEventListener("click", this.on_overlay_click_bind = on_overlay_click.bind(this), false);
				this.nodes.container = container;

				n_body_outer = document.createElement("div");
				n_body_outer.className = "iex_notification_body_outer" + style.theme;
				container.appendChild(n_body_outer);

				n_aligner = document.createElement("div");
				n_aligner.className = "iex_notification_body_aligner" + style.theme;
				n_body_outer.appendChild(n_aligner);

				n_body_inner = document.createElement("div");
				n_body_inner.className = "iex_notification_body_inner" + style.theme;
				n_body_outer.appendChild(n_body_inner);

				if ("style" in data && [ "info" , "error" , "success" , "warning" ].indexOf(data.style) >= 0) {
					n_style = "iex_notification_" + data.style;
				}
				else {
					n_style = "iex_notification_info";
				}

				n_body = document.createElement("div");
				n_body.className = "iex_notification_body " + (n_style) + style.theme;
				n_body.addEventListener("click", this.on_body_click_bind = on_body_click.bind(this), false);
				n_body_inner.appendChild(n_body);
				this.nodes.body = n_body;

				n_content_outer = document.createElement("div");
				n_content_outer.className = "iex_notification_content_outer" + style.theme;
				n_body.appendChild(n_content_outer);

				n_close = document.createElement("a");
				n_close.className = "iex_notification_close" + (data.close === false ? " iex_notification_close_hidden" : "") + style.theme;
				n_close.textContent = "\u00D7";
				n_close.addEventListener("click", this.on_close_click_bind = on_close_click.bind(this), false);
				this.nodes.close = n_close;
				n_content_outer.appendChild(n_close);

				n_content = document.createElement("div");
				n_content.className = "iex_notification_content" + style.theme;
				n_content_outer.appendChild(n_content);

				// Title
				if ("title" in data) {
					nc_title = document.createElement("div");
					nc_title.className = "iex_notification_content_title" + style.theme;
					if (typeof(data.title) == typeof("")) {
						nc_title.textContent = data.title;
					}
					else {
						try {
							nc_title.appendChild(data.title);
						}
						catch (e) {}
					}
					n_content.appendChild(nc_title);
				}

				// Content
				if ("content" in data) {
					nc_body = document.createElement("div");
					nc_body.className = "iex_notification_content_body" + style.theme;
					if (typeof(data.content) == typeof("")) {
						nc_body.textContent = data.content;
					}
					else {
						try {
							nc_body.appendChild(data.content);
						}
						catch (e) {}
					}
					n_content.appendChild(nc_body);
				}

				// Insert
				body.appendChild(container);

				// Events
				if ("on" in data) {
					for (var event in data.on) {
						this.on(event, data.on[event]);
					}
				}
			}
		};



		var on_overlay_click = function (event) {
			// Close
			if (this.overlay_can_close_on_click) {
				destroy.call(this, "overlay");
			}

			// Stop
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_body_click = function (event) {
			// Stop
			event.stopPropagation();
			return false;
		};
		var on_close_click = function (event) {
			// Remove
			destroy.call(this, "x");

			// Stop
			event.preventDefault();
			event.stopPropagation();
			return false;
		};

		var destroy = function (reason) {
			if (this.nodes) {
				// Close
				trigger.call(this, "close", {
					reason: reason
				});

				// Remove events
				if (this.on_close_click_bind !== null) {
					this.nodes.close.removeEventListener("click", this.on_close_click_bind, false);
					this.on_close_click_bind = null;
				}

				if (this.on_overlay_click_bind !== null) {
					this.nodes.container.removeEventListener("click", this.on_overlay_click_bind, false);
					this.on_overlay_click_bind = null;
				}

				if (this.on_body_click_bind !== null) {
					this.nodes.body.removeEventListener("click", this.on_body_click_bind, false);
					this.on_body_click_bind = null;
				}

				// Remove
				var par = this.nodes.container.parentNode;
				if (par) {
					par.removeChild(this.nodes.container);
				}

				// Null
				this.nodes = null;
				this.events = {};
			}
		};

		var trigger = function (event, data) {
			// Trigger
			if (event in this.events) {
				var e_list = this.events[event];
				for (var i = 0; i < e_list.length; ++i) {
					e_list[i].call(this, data);
				}
			}
		};



		Notification.prototype = {
			constructor: Notification,

			close: function () {
				// Close
				destroy.call(this, "manual");
			},

			on: function (event, callback) {
				// Add callback
				if (event in this.events) {
					this.events[event].push(callback);
				}
			},
			off: function (event, callback) {
				// Add callback
				if (event in this.events) {
					var e_list = this.events[event];
					for (var i = 0; i < e_list.length; ++i) {
						if (e_list[i] === callback) {
							// Remove
							e_list.splice(i, 1);
							return true;
						}
					}
				}

				return false;
			},

		};



		return Notification;

	})();

	// Settings control
	var Settings = (function () {

		var Settings = function () {
			// Settings values
			this.values = {
				"first_run": true,
				"image_expansion": {
					"enabled": false,
					"normal": {
						"enabled": true,
						"timeout": 0.0,
						"to_fit": true
					},
					"spoiler": {
						"enabled": true,
						"timeout": 0.0,
						"to_fit": true
					},
					"hover": {
						"zoom_invert": false,
						"zoom_borders_show": true,
						"zoom_borders_hide_time": 0.5,
						"zoom_buttons": true,
						"mouse_hide": true,
						"mouse_hide_time": 1.0,
						"header_overlap": false,
						"fit_large_allowed": true,
						"display_stats": 0
					},
					"extensions": {
						"jpg": {
							"background": 1, // 0 = never show, 1 = show before load (transparent), 2 = show before load (opaque)
							"mouse_wheel": 0 // 0 = zoom, 1 = volume control
						},
						"png": {
							"background": 1,
							"mouse_wheel": 0
						},
						"gif": {
							"background": 1,
							"mouse_wheel": 0
						},
						"webm": {
							"background": 2,
							"mouse_wheel": 0
						},
					},
					"video": {
						"autoplay": 1, // 0 = not at all, 1 = asap, 2 = when it can play "through", 3 = fully loaded
						"loop": true,
						"mute_initially": false,
						"volume": 0.5,
						"mini_controls": 1, // 0 = never, 1 = when mouse is over the video, 2 = when mouse is NOT over the video, 3 = always
						"expand_state_save": true
					},
					"style": {
						"animations_background": true,
						"controls_rounded_border": true
					}
				},
				"file_linkification": {
					"enabled": true,
				},
			};
			this.save_key = "iex_settings";

			// Value changing events
			this.change_events = {};

			// Events
			this.events = {
			};
			this.ready_callbacks = [];

			// Notification instances
			this.notification_first_run = null;
			this.notification_install_fail = null;
			this.notification_image_hover = null;

			// Modifying other settings
			this.modifying_settings_4chanx_timer = null;
			this.modifying_settings_4chanx_callback = null;
			this.modifying_settings_vanilla_timer = null;
			this.modifying_settings_vanilla_callback = null;
			this.can_disable_image_hover = true; // If another image hover is detected

			// Data
			this.settings_container = null;
			this.settings_container_outer = null;
			this.settings_difficulty_container = null;
			this.settings_removal_data = null;
			this.settings_update_other_after_close = false;
		};



		var on_settings_4chanx_section_change = function (data) {
			// Get section id
			var id = /section-([a-zA-Z0-9_\-]+)/.exec(data.section.className);
			id = id ? id[1].toLowerCase() : "";

			// Hover settings
			var modify_image_hover = (id == (api.is_appchanx ? "script" : "main"));
			if (modify_image_hover) {

				// Forcibly modify 4chan-x settings
				if (this.modifying_settings_4chanx_timer !== null) {
					// Clear timer
					clearTimeout(this.modifying_settings_4chanx_timer);
					this.modifying_settings_4chanx_timer = null;

					// Get the hover setting
					var image_hover_setting = data.container.querySelector('input[name="Image Hover"]');
					if (image_hover_setting) {
						setTimeout(on_settings_4chanx_section_change_modify.bind(this, image_hover_setting), 10);
					}
					else {
						// Callback
						trigger_modifying_settings_4chanx_cb.call(this, false, false, "not found");
					}
				}

				// Modify display
				modify_settings_4chanx_display.call(this, data.container);

			}
		};
		var on_settings_4chanx_section_change_modify = function (setting) {
			// If it's checked, click it to uncheck it
			var is_checked = setting.checked;
			if (is_checked) {
				setting.click();
			}

			// Callback
			trigger_modifying_settings_4chanx_cb.call(this, true, is_checked, "okay");
			sync.trigger("image_expansion_enable");
		};
		var on_settings_vanilla_open = function (data) {
			// Forcibly modify 4chan-x settings
			if (this.modifying_settings_vanilla_timer !== null) {
				// Clear timer
				clearTimeout(this.modifying_settings_vanilla_timer);
				this.modifying_settings_vanilla_timer = null;

				// Get the hover setting
				var image_hover_setting = data.container.querySelector("input[data-option='imageHover']");
				if (image_hover_setting) {
					setTimeout(on_settings_vanilla_open_modify.bind(this, image_hover_setting), 10);
				}
				else {
					// Callback
					trigger_modifying_settings_vanilla_cb.call(this, false, false, "not found");
				}
			}

			// Modify display
			modify_settings_vanilla_display.call(this, data.container);
		};
		var on_settings_vanilla_open_modify = function (setting) {
			// If it's checked, click it to uncheck it
			var is_checked = setting.checked;
			if (is_checked) {
				setting.click();
			}

			// Callback
			trigger_modifying_settings_vanilla_cb.call(this, true, is_checked, "okay");
			sync.trigger("image_expansion_enable");
		};
		var on_modifying_settings_4chanx_timout = function () {
			// Callback
			trigger_modifying_settings_4chanx_cb.call(this, false, false, "timeout");

			// Didn't happen
			this.modifying_settings_4chanx_timer = null;
		};
		var on_modifying_settings_vanilla_timout = function () {
			// Callback
			trigger_modifying_settings_vanilla_cb.call(this, false, false, "timeout");

			// Didn't happen
			this.modifying_settings_vanilla_timer = null;
		};

		var on_menu_4chanx_open = function (data) {
			if (data.type != "main") return;

			var e = document.createElement("a");
			e.className = "iex_4chanx_menu_link" + style.theme;
			e.textContent = "iex settings";
			e.addEventListener("click", on_menu_4chanx_entry_click.bind(this), false);

			api.menu_4chanx_add_entry(data.container, e, 135);
		};
		var on_menu_4chanx_entry_click = function (event) {
			// Close
			api.menu_4chanx_close();

			// Open settings
			this.settings_open();
		};

		var on_edit_iex_settings_click = function (event) {
			// Open settings
			if (api.is_4chanx) {
				api.settings_4chanx_close();
			}
			else {
				api.settings_vanilla_close();
			}
			this.settings_open();

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_main_page_iex_link_click = function (event) {
			// Open settings
			this.settings_open();

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};

		var on_first_run_link_click = function (install, event) {
			// Selected
			this.change_value(["first_run"], false);
			this.save_values();

			// Install or not?
			if (install) {
				// Perform install
				var cb = on_first_run_install_callback.bind(this);
				if (api.is_4chanx) {
					this.modify_4chanx_settings(cb);
				}
				else {
					this.modify_vanilla_settings(cb);
				}
			}

			// Close
			if (this.notification_first_run !== null) {
				this.notification_first_run.close();
				this.notification_first_run = null;
			}

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_first_run_install_callback = function (okay, settings_were_changed, status) {
			// Update settings
			if (okay) {
				this.change_value(["first_run"], false);
				this.change_value(["image_expansion", "enabled"], true);
				this.save_values(on_first_run_install_callback_complete.bind(this, okay, settings_were_changed, status));
			}
			else {
				// Instant
				on_first_run_install_callback_complete.call(this, okay, settings_were_changed, status);
			}
		};
		var on_first_run_install_callback_complete = function (okay, settings_were_changed, status) {
			// Event
			if (okay) {
				sync.trigger("install_complete");
			}

			// Close settings
			if (api.is_4chanx) {
				// Close
				api.settings_4chanx_close();
			}
			else {
				// Close or save
				if (settings_were_changed) {
					api.settings_vanilla_save();
				}
				else {
					api.settings_vanilla_close();
				}
			}

			if (okay) {
				// Reload
				window.location.reload(false);
			}
			else {
				// Error
				this.display_install_fail_notification(status);
			}
		};
		var on_settings_update_other_complete = function (okay, settings_were_changed, status) {
			// Close settings
			if (api.is_4chanx) {
				// Close
				api.settings_4chanx_close();
			}
			else {
				// Close or save
				if (settings_were_changed) {
					api.settings_vanilla_save();
				}
				else {
					api.settings_vanilla_close();
				}
			}

			if (!okay) {
				// Error
				this.display_install_fail_notification(status);
			}
		};

		var on_initial_load = function () {
			ASAP.asap(on_first_run_check.bind(this));
		};
		var on_first_run_check = function () {
			// First run check
			if (api.page_type == "board" || api.page_type == "thread" || api.page_type == "catalog") {
				if (this.values.first_run) {
					// Show message
					this.display_first_run_notification();
				}
			}

			// Trigger ready
			trigger_ready.call(this);
		};
		var on_insert_links = function () {
			var nav_nodes = [],
				nav, par, i, c, n, separate;

			if ((nav = document.getElementById("navtopright"))) {
				nav_nodes.push({
					node: nav,
					is_parent: true,
					add_separators: true,
					before: true,
				});
			}
			if ((nav = document.getElementById("navbotright"))) {
				nav_nodes.push({
					node: nav,
					is_parent: true,
					add_separators: true,
					before: true,
				});
			}
			if ((nav = document.getElementById("settingsWindowLinkMobile"))) {
				nav_nodes.push({
					node: nav,
					is_parent: false,
					add_separators: false,
					before: true,
				});
			}

			// Insert
			for (i = 0; i < nav_nodes.length; ++i) {
				par = nav_nodes[i].node;
				separate = nav_nodes[i].add_separators;

				if (nav_nodes[i].is_parent) {
					c = par.firstChild;
				}
				else {
					c = par;
					par = par.parentNode;
					if (!par) continue;
				}

				if (separate) {
					if (c && c.nodeType == 3) { // TEXT_NODE
						c.nodeValue = "] [";
					}
					else {
						n = document.createTextNode("]");
						if (c) par.insertBefore(n, c);
						else par.appendChild(n);

						c = n;
					}
				}

				n = document.createElement("a");
				n.textContent = "iex";
				n.setAttribute("target", "_blank");
				n.setAttribute("href", "//dnsev.github.io/iex/");
				n.addEventListener("click", on_main_page_iex_link_click.bind(this), false);
				par.insertBefore(n, c);
				c = n;

				if (separate) {
					n = document.createTextNode("[");
					par.insertBefore(n, c);
				}
			}
		};
		var on_insert_links_condition = function () {
			return document.getElementById("navtopright") || document.getElementById("navbotright") || document.getElementById("settingsWindowLinkMobile");
		};

		var on_install_complete_sync = function () {
			// Close notifications
			if (this.notification_first_run !== null) {
				this.notification_first_run.close();
				this.notification_first_run = null;
			}
		};
		var on_settings_save_sync = function () {
			// Reload settings
			this.load_values(true, null);
		};
		var on_image_expansion_enable_sync = function () {
			// Image hover has been enabled in another tab; make it so this tab can't re-disable it
			this.can_disable_image_hover = false;
		};


		var on_notification_link_click = function (settings_open, close_object, event) {
			// Open
			if (settings_open) {
				this.settings_open();
			}

			// Close
			if (close_object !== null) {
				close_object.close();
			}

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_notification_first_run_close = function () {
			this.notification_first_run = null;
		};
		var on_notification_install_fail_close = function () {
			this.notification_install_fail = null;
		};
		var on_notification_image_hover_close = function () {
			this.notification_image_hover = null;
		};

		var on_iex_settings_overlay_click = function (event) {
			// Close
			this.settings_close();

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_iex_settings_body_click = function (event) {
			// Stop event
			event.stopPropagation();
			return false;
		};
		var on_iex_settings_close_click = function (event) {
			// Close
			this.settings_close();

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_iex_setting_checkbox_change = function (node, descriptor, event) {
			// Set
			var value_new = node.checked, value_old;
			if ("values" in descriptor) {
				value_new = descriptor.values[value_new ? 1 : 0];
			}
			if ("modify" in descriptor) {
				value_new = descriptor.modify.call(this, value_new);
			}

			// Value tree
			if ("tree" in descriptor) {
				// Change
				value_old = this.change_value(descriptor.tree, value_new);
				this.save_values();
			}
			else if ("change" in descriptor) {
				// Modify
				value_new = descriptor.change.call(this, value_new, value_old);
			}

			// Update node
			node.checked = value_new;

			// After
			if ("after_callback" in descriptor) {
				descriptor.after_callback.call(this, value_new, value_old);
			}
		};
		var on_iex_setting_textbox_change = function (node, descriptor, event) {
			// Set
			var value_new = node.value, value_old;
			if ("modify" in descriptor) {
				value_new = descriptor.modify.call(this, value_new);
			}

			// Value tree
			if ("tree" in descriptor) {
				// Change
				value_old = this.change_value(descriptor.tree, value_new);
				this.save_values();
			}
			else if ("change" in descriptor) {
				// Modify
				value_new = descriptor.change.call(this, value_new, value_old);
			}

			// Update node
			node.value = "" + value_new;

			// After
			if ("after_callback" in descriptor) {
				descriptor.after_callback.call(this, value_new, value_old);
			}
		};
		var on_iex_setting_text_click = function (node, descriptor, event) {
			// Get new id
			var id_current = parseInt(node.getAttribute("data-iex-setting-current-id") || "", 10) || 0;
			var id_new = (id_current + 1) % descriptor.values.length;
			var update_id = false;

			// Set
			var value_new = descriptor.values[id_new], value_old;
			if ("modify" in descriptor) {
				value_new = descriptor.modify.call(this, value_new);
				update_id = true;
			}

			// Value tree
			if ("tree" in descriptor) {
				// Change
				value_old = this.change_value(descriptor.tree, value_new);
				this.save_values();
			}
			else if ("change" in descriptor) {
				// Modify
				value_new = descriptor.change.call(this, value_new, value_old);
				update_id = true;
			}

			// Update
			if (update_id) {
				var i = id_new;
				while (true) {
					i = (i + 1) % descriptor.values.length;
					if (i == id_new) break;

					if (descriptor.values[i] === value_new) {
						id_new = i;
						break;
					}
				}
			}
			node.setAttribute("data-iex-setting-current-id", id_new);
			node.textContent = ("value_labels" in descriptor ? descriptor.value_labels[id_new] : ("" + descriptor.values[id_new]));

			// After
			if ("after_callback" in descriptor) {
				descriptor.after_callback.call(this, value_new, value_old);
			}
		};
		var on_iex_setting_display_settings = function () {
			// Close settings
			this.settings_close();

			// Display
			this.display_settings_info_notification();
		};
		var on_iex_setting_delete_settings = function () {
			// Delete
			this.delete_values(on_iex_setting_delete_settings_complete.bind(this));
		};
		var on_iex_setting_delete_settings_complete = function () {
			// Reload
			this.settings_close();
			window.location.reload(false);
		};
		var on_iex_difficulty_link_click = function (event, node) {
			// Get target
			var target = node.getAttribute("data-iex-settings-difficulty-choice-level") || "";

			// Update difficulty
			change_settings_difficulty.call(this, target);

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_iex_setting_image_expansion_toggle = function (value_new, value_old) {
			// Update other settings after close
			this.settings_update_other_after_close = value_new;
		};

		var on_save_values_callback = function (next_callback) {
			// Sync
			sync.trigger("settings_save");

			if (next_callback) {
				next_callback.call(this);
			}
		};
		var on_load_values_callback = function (events, next_callback, value) {
			if (value) {
				update_values.call(this, [], this.values, value, false, events);
			}

			if (next_callback) {
				next_callback.call(this);
			}
		};
		var on_display_settings_info_notification_callback = function (saved_values) {
			// Get
			try {
				saved_values = JSON.stringify(saved_values, null, "    ");
			}
			catch (e) {}

			// Alert message
			var message = document.createElement("div"), m_part, m_link;

			// Line 1
			m_part = document.createElement("div");
			m_part.className = "iex_spaced_div";
			m_part.textContent = "These are iex's saved settings, which are useful for debugging purposes:";
			message.appendChild(m_part);

			// Textarea
			m_part = document.createElement("textarea");
			m_part.className = "iex_notification_textarea";
			m_part.setAttribute("spellcheck", "false");
			m_part.value = saved_values;
			message.appendChild(m_part);

			// Display
			this.notification_install_fail = new Notification({
				close: true,
				overlay_close: true,
				style: "success",
				title: "Saved iex settings",
				content: message,
			});
		};


		var modify_settings_4chanx_display = function (container) {
			// Get the hover setting
			var image_hover_setting = container.querySelector('input[name="Image Hover"]');
			if (!image_hover_setting) return;

			// Find the parent to clone
			var image_hover_setting_container;
			try {
				image_hover_setting_container = image_hover_setting.parentNode.parentNode;
			}
			catch (e) {
				image_hover_setting_container = null;
			}
			if (image_hover_setting_container) {
				// Clone container
				var container_clone = image_hover_setting_container.cloneNode(true),
					i, description_old;

				// Remove input names and disable
				var inputs = container_clone.querySelectorAll("input");
				for (i = 0; i < inputs.length; ++i) {
					inputs[i].disabled = true;
					inputs[i].removeAttribute("name");
				}

				// Dim labels and descriptions
				var labels = container_clone.querySelectorAll("label");
				for (i = 0; i < labels.length; ++i) {
					labels[i].style.opacity = "0.5";
				}

				var descriptions = container_clone.querySelectorAll(".description");
				for (i = 0; i < descriptions.length; ++i) {
					descriptions[i].style.opacity = "0.5";
				}

				// Add new
				if (api.is_appchanx) {
					container_clone.appendChild(document.createTextNode(" (disable iex)"));

					// Modify old
					description_old = image_hover_setting_container.querySelector("label");
					if (description_old) {
						description_old.appendChild(document.createTextNode(" (or use iex)"));
					}
				}
				else {
					var description_new = document.createElement("span");
					description_new.className = "description";

					var link_new = document.createElement("a");
					link_new.setAttribute("href", "//dnsev.github.io/iex/");
					link_new.setAttribute("target", "_blank");
					link_new.textContent = "disable iex version to use";
					link_new.addEventListener("click", on_edit_iex_settings_click.bind(this), false);

					description_new.appendChild(document.createTextNode(" ("));
					description_new.appendChild(link_new);
					description_new.appendChild(document.createTextNode(")"));

					container_clone.appendChild(description_new);

					// Modify old
					description_old = image_hover_setting_container.querySelector(".description");
					if (description_old) {
						link_new = document.createElement("a");
						link_new.setAttribute("href", "//dnsev.github.io/iex/");
						link_new.setAttribute("target", "_blank");
						link_new.textContent = "or use iex version";
						link_new.addEventListener("click", on_edit_iex_settings_click.bind(this), false);

						description_old.appendChild(document.createTextNode(" ("));
						description_old.appendChild(link_new);
						description_old.appendChild(document.createTextNode(")"));
					}
				}

				// Insert new container
				image_hover_setting_container.parentNode.insertBefore(container_clone, image_hover_setting_container);

				// Hide old
				if (this.values.image_expansion.enabled) {
					image_hover_setting_container.style.display = "none";
				}
				else {
					container_clone.style.display = "none";
				}

				// Update checkbox value
				setTimeout(modify_settings_4chanx_display_delay.bind(this, inputs, image_hover_setting), 10);
			}
		};
		var modify_settings_4chanx_display_delay = function (inputs, original) {
			for (var i = 0; i < inputs.length; ++i) {
				inputs[i].checked = original.checked;
			}
		};
		var modify_settings_vanilla_display = function (container) {
			// Get the hover setting
			var image_hover_setting = container.querySelector("input[data-option='imageHover']");
			if (!image_hover_setting) return;

			// Acquire nodes to clone
			var c, containers_original = [],
				clone, inputs, par, i, j, n, iex_link, iex_descr;

			try {
				c = image_hover_setting.parentNode.parentNode;
				if (c) {
					if ((par = c.parentNode)) {
						containers_original.push(c);
					}
					else {
						c = null;
					}
				}
			}
			catch (e) {
				c = null;
			}
			if (c) {
				c = c.nextSibling;
				if (style.has_class(c, "settings-tip")) containers_original.push(c);
			}

			for (i = 0; i < containers_original.length; ++i) {
				c = containers_original[i];

				// Clone container
				clone = c.cloneNode(true);

				// Disable inputs
				inputs = clone.querySelectorAll("input");
				for (j = 0; j < inputs.length; ++j) {
					inputs[j].disabled = true;
					inputs[j].removeAttribute("data-option");
				}

				if (i === 0) {
					// Dim
					if ((n = clone.querySelector("label"))) {
						n.style.opacity = "0.5";
					}

					// Text for new
					iex_link = document.createElement("a");
					iex_link.setAttribute("href", "//dnsev.github.io/iex/");
					iex_link.setAttribute("target", "_blank");
					iex_link.textContent = "disable iex version to use";
					iex_link.addEventListener("click", on_edit_iex_settings_click.bind(this), false);

					iex_descr = document.createElement("span");
					iex_descr.appendChild(document.createTextNode(" ("));
					iex_descr.appendChild(iex_link);
					iex_descr.appendChild(document.createTextNode(")"));

					clone.appendChild(iex_descr);

					// Text for old
					iex_link = document.createElement("a");
					iex_link.setAttribute("href", "//dnsev.github.io/iex/");
					iex_link.setAttribute("target", "_blank");
					iex_link.textContent = "or use iex version";
					iex_link.addEventListener("click", on_edit_iex_settings_click.bind(this), false);

					iex_descr = document.createElement("span");
					iex_descr.appendChild(document.createTextNode(" ("));
					iex_descr.appendChild(iex_link);
					iex_descr.appendChild(document.createTextNode(")"));
					c.appendChild(iex_descr);
				}
				else {
					// Dim
					clone.style.opacity = "0.5";
				}

				// Hide
				if (this.values.image_expansion.enabled) {
					c.style.display = "none";
				}
				else {
					clone.style.display = "none";
				}

				// Append
				par.insertBefore(clone, containers_original[0]);

				// Update checkbox value
				setTimeout(modify_settings_vanilla_display_delay.bind(this, inputs, image_hover_setting), 10);
			}
		};
		var modify_settings_vanilla_display_delay = function (inputs, original) {
			for (var i = 0; i < inputs.length; ++i) {
				inputs[i].checked = original.checked;
			}
		};

		var trigger = function (event, data) {
			// Trigger
			if (event in this.events) {
				var e_list = this.events[event];
				for (var i = 0; i < e_list.length; ++i) {
					e_list[i].call(this, data);
				}
			}
		};
		var trigger_ready = function () {
			// Trigger ready event
			if (this.ready_callbacks !== null) {
				for (var i = 0; i < this.ready_callbacks.length; ++i) {
					this.ready_callbacks[i].call(this);
				}
				this.ready_callbacks = null;
			}
		};
		var trigger_change = function (tree, old_value, new_value, source) {
			var key = tree.join("-");
			if (key in this.change_events) {
				// Get the proper tree
				tree = this.change_events[key].tree;

				// Callback list
				var list = this.change_events[key].callbacks;
				for (var i = 0; i < list.length; ++i) {
					list[i].call(this, {
						tree: tree,
						old_value: old_value,
						new_value: new_value,
						source: source,
					});
				}
			}
		};
		var trigger_modifying_settings_4chanx_cb = function (okay, settings_were_changed, status) {
			// Show
			var body = document.querySelector("body");
			if (body) style.remove_class(body, "iex_hide_other_settings");

			// Callback
			if (this.modifying_settings_4chanx_callback !== null) {
				this.modifying_settings_4chanx_callback.call(this, okay, settings_were_changed, status);
				this.modifying_settings_4chanx_callback = null;
			}
		};
		var trigger_modifying_settings_vanilla_cb = function (okay, settings_were_changed, status) {
			// Show
			var body = document.querySelector("body");
			if (body) style.remove_class(body, "iex_hide_other_settings");

			// Callback
			if (this.modifying_settings_vanilla_callback !== null) {
				this.modifying_settings_vanilla_callback.call(this, okay, settings_were_changed, status);
				this.modifying_settings_vanilla_callback = null;
			}
		};

		var update_values = function (tree, values, new_values, remove, events) {
			// Updates
			var old_value, key;

			for (key in new_values) {
				if (key in values) {
					// Update
					if (new_values[key] instanceof Object) {
						// Deeper
						if (!(values[key] instanceof Object)) {
							values[key] = {};
						}

						tree.push(key);
						update_values.call(this, tree, values[key], new_values[key], remove, events);
						tree.pop();
					}
					else {
						// Replace
						old_value = values[key];
						values[key] = new_values[key];

						if (events && old_value !== values[key]) {
							tree.push(key);
							trigger_change.call(this, tree, old_value, values[key], "update");
							tree.pop();
						}
					}
				}
				else {
					// New
					if (new_values[key] instanceof Object) {
						// Deeper
						values[key] = {};

						tree.push(key);
						update_values.call(this, tree, values[key], new_values[key], remove, events);
						tree.pop();
					}
					else {
						// Replace
						values[key] = new_values[key];

						if (events) {
							tree.push(key);
							trigger_change.call(this, tree, undefined, values[key], "update");
							tree.pop();
						}
					}
				}
			}

			// Removals
			if (remove) {
				for (key in values) {
					if (!(key in new_values)) {
						// Remove
						old_value = values[key];
						delete values[key];

						if (events) {
							tree.push(key);
							trigger_change.call(this, tree, old_value, undefined, "update");
							tree.pop();
						}
					}
				}
			}
		};

		var string_to_float = function (value) {
			return parseFloat(value.trim()) || 0;
		};

		var settings_open = function () {
			if (this.settings_container_outer !== null) return;

			var body = document.querySelector("body"),
				bg_color, settings_content, settings_buttons, cb,
				overlay, container, inner, bg, n1, n2, n3, n4;

			if (!body) return;

			// Get background color
			bg_color = style.parse_css_color(style.get_true_style_of_class("post reply", "backgroundColor", "div"));

			settings_buttons = generate_settings_difficulty_selector.call(this);
			settings_content = generate_settings_container.call(this, generate_settings_descriptors.call(this));
			this.settings_removal_data = settings_content[1].concat(settings_buttons[1]);


			// Create
			overlay = document.createElement("div");
			overlay.className = "iex_settings_popup_overlay" + style.theme;
			overlay.addEventListener("click", (cb = on_iex_settings_overlay_click.bind(this)), false);
			this.settings_removal_data.push({
				node: overlay,
				event: "click",
				callback: cb,
				capture: false
			});
			this.settings_container_outer = overlay;

			container = document.createElement("div");
			container.className = "iex_settings_popup" + style.theme;
			overlay.appendChild(container);

			inner = document.createElement("div");
			inner.className = "iex_settings_popup_aligner" + style.theme;
			container.appendChild(inner);

			inner = document.createElement("div");
			inner.className = "iex_settings_popup_inner" + style.theme;
			container.appendChild(inner);

			n1 = document.createElement("div");
			n1.className = "iex_settings_popup_table" + style.theme;
			n1.style.backgroundColor = style.color_to_css(bg_color);
			inner.appendChild(n1);
			n1.addEventListener("click", (cb = on_iex_settings_body_click.bind(this)), false);
			this.settings_removal_data.push({
				node: n1,
				event: "click",
				callback: cb,
				capture: false
			});


			// Top
			n2 = document.createElement("div");
			n2.className = "iex_settings_popup_top" + style.theme;
			n1.appendChild(n2);

			n3 = document.createElement("div");
			n3.className = "iex_settings_popup_top_content" + style.theme;
			n2.appendChild(n3);

			n4 = document.createElement("div");
			n4.className = "iex_settings_popup_top_label" + style.theme;
			n3.appendChild(n4);
			n4.textContent = "Image Extensions Settings";

			settings_buttons[0].className = "iex_settings_popup_top_right" + style.theme;
			n3.appendChild(settings_buttons[0]);
			this.settings_difficulty_container = settings_buttons[0];


			// Middle
			n2 = document.createElement("div");
			n2.className = "iex_settings_popup_middle" + style.theme;
			n1.appendChild(n2);

			n3 = document.createElement("div");
			n3.className = "iex_settings_popup_middle_content_pad" + style.theme;
			n2.appendChild(n3);
			n2 = n3;

			n3 = document.createElement("div");
			n3.className = "iex_settings_popup_middle_content" + style.theme;
			n2.appendChild(n3);
			n2 = n3;

			n3 = document.createElement("div");
			n3.className = "iex_settings_popup_middle_content_inner" + style.theme;
			n2.appendChild(n3);
			n3.appendChild(settings_content[0]);
			this.settings_container = settings_content[0];


			// Bottom
			n2 = document.createElement("div");
			n2.className = "iex_settings_popup_bottom" + style.theme;
			n1.appendChild(n2);



			// Update difficulty
			change_settings_difficulty.call(this, "normal");


			// Append
			body.appendChild(overlay);
		};

		var generate_settings_difficulty_selector = function () {
			var d_container, d_choice, d_span, cb,
				settings_removal_data = [];

			d_container = document.createElement("div");

			// Normal
			d_choice = document.createElement("a");
			d_choice.className = "iex_settings_difficulty_choice" + style.theme;
			d_choice.textContent = "normal";
			d_choice.setAttribute("data-iex-settings-difficulty-choice-level", "normal");
			d_container.appendChild(d_choice);
			cb = wrap_generic_event(this, on_iex_difficulty_link_click);
			d_choice.addEventListener("click", cb, false);
			settings_removal_data.push({
				node: d_choice,
				event: "click",
				callback: cb,
				capture: false
			});

			d_span = document.createElement("span");
			d_span.className = "iex_settings_difficulty_separator" + style.theme;
			d_span.textContent = " | ";
			d_container.appendChild(d_span);

			// Advanced
			d_choice = document.createElement("a");
			d_choice.className = "iex_settings_difficulty_choice" + style.theme;
			d_choice.textContent = "advanced";
			d_choice.setAttribute("data-iex-settings-difficulty-choice-level", "advanced");
			d_container.appendChild(d_choice);
			d_choice.addEventListener("click", cb, false);
			settings_removal_data.push({
				node: d_choice,
				event: "click",
				callback: cb,
				capture: false
			});

			d_span = document.createElement("span");
			d_span.className = "iex_settings_difficulty_separator" + style.theme;
			d_span.textContent = " | ";
			d_container.appendChild(d_span);

			// Homepage
			d_choice = document.createElement("a");
			d_choice.className = "iex_settings_homepage_link" + style.theme;
			d_choice.setAttribute("target", "_blank");
			d_choice.setAttribute("href", "//dnsev.github.io/iex/");
			d_choice.textContent = "homepage";
			d_container.appendChild(d_choice);

			d_span = document.createElement("span");
			d_span.className = "iex_settings_difficulty_separator" + style.theme;
			d_span.textContent = " | ";
			d_container.appendChild(d_span);

			// Close
			d_choice = document.createElement("a");
			d_choice.className = "iex_settings_popup_close_link" + style.theme;
			d_choice.setAttribute("target", "_blank");
			d_choice.setAttribute("href", "//dnsev.github.io/iex/");
			d_choice.textContent = "\u00D7";
			d_container.appendChild(d_choice);
			d_choice.addEventListener("click", (cb = on_iex_settings_close_click.bind(this)), false);
			settings_removal_data.push({
				node: d_choice,
				event: "click",
				callback: cb,
				capture: false
			});


			// Return
			return [ d_container , settings_removal_data ];
		};
		var generate_settings_descriptors = function () {
			var descriptors = [];

			// Image expansion
			descriptors.push({
				level: "normal",
				section: "Image Expansion",
				tree: [ "image_expansion" , "enabled" ],
				label: "Enabled",
				description: "Enable custom expansion of images on mouse hover",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
				descriptors: [],
				after_callback: on_iex_setting_image_expansion_toggle.bind(this)
			});

			descriptors.push({
				level: "normal",
				section: "Image Expansion",
				tree: [ "image_expansion" , "normal" , "enabled" ],
				label: "Enabled",
				sublabel: "for non-spoiler images",
				description: "Enable hover for non-spoiler images",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Image Expansion",
				tree: [ "image_expansion" , "spoiler" , "enabled" ],
				label: "Enabled",
				sublabel: "for spoiler images",
				description: "Enable hover for spoiler images",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Image Expansion",
				tree: [ "image_expansion" , "normal" , "to_fit" ],
				label: "Fit image",
				sublabel: "for non-spoiler images",
				description: "Automatically fit the image to the best screen size on hover",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "don't fit" , "fit" ],
			});

			descriptors.push({
				level: "normal",
				section: "Image Expansion",
				tree: [ "image_expansion" , "spoiler" , "to_fit" ],
				label: "Fit image",
				sublabel: "for spoiler images",
				description: "Automatically fit the image to the best screen size on hover",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "don't fit" , "fit" ],
			});

			descriptors.push({
				level: "normal",
				section: "Image Expansion",
				tree: [ "image_expansion" , "normal" , "timeout" ],
				modify: string_to_float,
				label: "Open timeout",
				sublabel: "for non-spoiler images",
				description: "Time to wait before displaying the image (in seconds)",
				type: "textbox",
			});

			descriptors.push({
				level: "normal",
				section: "Image Expansion",
				tree: [ "image_expansion" , "spoiler" , "timeout" ],
				modify: string_to_float,
				label: "Open timeout",
				sublabel: "for spoiler images",
				description: "Time to wait before displaying the image (in seconds)",
				type: "textbox",
			});

			// Hover settings
			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "header_overlap" ],
				label: "Overlap header",
				description: "If the header is visible, the preview will not overlap it",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "don't overlap" , "overlap" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "fit_large_allowed" ],
				label: "Fit large",
				description: "When enabled, image zooming can be snapped to both vertical and horizontal scales",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "display_stats" ],
				label: "Display stats",
				description: "Show the file name and relevant stats on top of the preview",
				type: "text",
				values: [ 0 , 1 , 2 ],
				value_labels: [ "show" , "hide" , "hide all" ]
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "zoom_invert" ],
				label: "Zoom invert mouse",
				description: "Zoom location based on mouse will be inverted",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "not inverted" , "inverted" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "zoom_borders_show" ],
				label: "Zoom borders",
				description: "Display borders inside the preview displaying the mouse movement region",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "zoom_borders_hide_time" ],
				modify: string_to_float,
				label: "Zoom borders hide timeout",
				description: "Time to wait after mouse has stopped to hide the zoom borders (in seconds)",
				type: "textbox",
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "zoom_buttons" ],
				label: "Zoom buttons",
				description: "Show zooming buttons when the zoom% is hovered",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "mouse_hide" ],
				label: "Cursor hide",
				description: "Hide the mouse cursor when hovering the image after inactivity",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "don't hide" , "hide" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "mouse_hide_time" ],
				modify: string_to_float,
				label: "Cursor hide timeout",
				description: "Time to wait after mouse has stopped to hide cursor (in seconds)",
				type: "textbox",
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "mouse_hide_time" ],
				modify: string_to_float,
				label: "Cursor hide timeout",
				description: "Time to wait after mouse has stopped to hide cursor (in seconds)",
				type: "textbox",
			});

			// File types
			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "extensions" , "jpg" , "background" ],
				label: "Thumbnail background (.jpg)",
				description: "How to display the thumbnail image in the background while loading",
				type: "text",
				values: [ 0 , 1 , 2 ],
				value_labels: [ "never show" , "semi-transparent" , "opaque" ]
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "extensions" , "png" , "background" ],
				label: "Thumbnail background (.png)",
				description: "How to display the thumbnail image in the background while loading",
				type: "text",
				values: [ 0 , 1 , 2 ],
				value_labels: [ "never show" , "semi-transparent" , "opaque" ]
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "extensions" , "gif" , "background" ],
				label: "Thumbnail background (.gif)",
				description: "How to display the thumbnail image in the background while loading",
				type: "text",
				values: [ 0 , 1 , 2 ],
				value_labels: [ "never show" , "semi-transparent" , "opaque" ]
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "extensions" , "webm" , "background" ],
				label: "Thumbnail background (.webm)",
				description: "How to display the thumbnail image in the background while loading",
				type: "text",
				values: [ 0 , 1 , 2 ],
				value_labels: [ "never show" , "transparent" , "opaque" ]
			});

			// Video settings
			descriptors.push({
				level: "normal",
				section: "Video",
				tree: [ "image_expansion" , "video" , "mini_controls" ],
				label: "Mini controls",
				description: "When to display the mini control bar",
				type: "text",
				values: [ 0 , 1 , 2 , 3 ],
				value_labels: [ "never" , "mouse over preview" , "mouse NOT over preview" , "always" ]
			});

			descriptors.push({
				level: "normal",
				section: "Video",
				tree: [ "image_expansion" , "video" , "autoplay" ],
				label: "Autoplay",
				description: "When the video should automatically play",
				type: "text",
				values: [ 0 , 1 , 2 , 3 ],
				value_labels: [ "never" , "as soon as possible" , "when it can play \"through\"" , "when fully loaded" ]
			});

			descriptors.push({
				level: "normal",
				section: "Video",
				tree: [ "image_expansion" , "video" , "loop" ],
				label: "Loop",
				description: "Enable automatic video looping",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "don't loop" , "loop" ],
			});

			descriptors.push({
				level: "normal",
				section: "Video",
				tree: [ "image_expansion" , "video" , "mute_initially" ],
				label: "Mute",
				description: "Mute the video when the preview is opened",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "don't mute" , "mute" ],
			});

			descriptors.push({
				level: "normal",
				section: "Video",
				tree: [ "image_expansion" , "video" , "volume" ],
				modify: string_to_float,
				label: "Default volume",
				description: "The default volume of a video when it is opened",
				type: "textbox",
			});

			descriptors.push({
				level: "normal",
				section: "Video",
				tree: [ "image_expansion" , "video" , "expand_state_save" ],
				label: "Expansion state save",
				description: "The video state should be saved and resumed when expanding",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "don't save" , "save" ],
			});

			descriptors.push({
				level: "normal",
				section: "Video",
				tree: [ "image_expansion" , "extensions" , "webm" , "mouse_wheel" ],
				label: "Mouse wheel action (.webm)",
				description: "What scrolling the mouse should do for .webm files",
				type: "text",
				values: [ 0 , 1 ],
				value_labels: [ "zoom" , "volume control" ]
			});

			// Link settings
			descriptors.push({
				level: "normal",
				section: "Linkification",
				tree: [ "file_linkification" , "enabled" ],
				label: "Named file URLs",
				description: "Appends the filename to the url as a #fragment (asthetic purposes)",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			// Style settings
			descriptors.push({
				level: "normal",
				section: "Style",
				tree: [ "image_expansion" , "style" , "animations_background" ],
				label: "Background image animations",
				description: "Use animated CSS transitions for the background image",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "unanimated" , "animated" ],
			});

			descriptors.push({
				level: "normal",
				section: "Style",
				tree: [ "image_expansion" , "style" , "controls_rounded_border" ],
				label: "Rounded borders on controls",
				description: "Use rounded corners on video control bars (doesn't work on Chrome)",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "square" , "rounded" ],
			});

			// Meta
			descriptors.push({
				level: "advanced",
				section: "Debugging",
				change: on_iex_setting_display_settings.bind(this),
				label: "Display local settings",
				description: "Display all saved local data in a pop-up textbox",
				type: "text",
				values: [ true ],
				value_labels: [ "display"  ]
			});

			descriptors.push({
				level: "advanced",
				section: "Debugging",
				change: on_iex_setting_delete_settings.bind(this),
				label: "Delete local settings",
				description: "Delete all saved local data and refresh the page",
				type: "text",
				values: [ true ],
				value_labels: [ "delete" ]
			});

			// Return
			return descriptors;
		};
		var generate_settings_container = function (descriptors, data) {
			// Create container
			var container = document.createElement("div");
			container.className = "iex_settings_region" + style.theme;

			// Groups
			data = data || [];
			var groups = {};
			var group_count = 0;

			// Setup
			var d, i, j, g_key, g_container, g_label, g_set, g_span, g_div, g_table, g_half_left, g_half_right, g_input, g_input_label, cb, val, s_val, odd = true;
			for (i = 0; i < descriptors.length; ++i) {
				d = descriptors[i];

				// Get group
				g_key = d.section || "";
				if (g_key in groups) {
					g_container = groups[g_key];
				}
				else {
					// New
					g_container = document.createElement("div");
					g_container.className = "iex_settings_group" + (group_count > 0 ? " iex_settings_group_padding_top" : "") + style.theme;
					container.appendChild(g_container);

					g_label = document.createElement("div");
					g_label.className = "iex_settings_group_label" + style.theme;
					g_label.textContent = g_key;
					g_container.appendChild(g_label);

					groups[g_key] = g_container;
					group_count += 1;
					odd = true;
				}

				// Add setting
				g_set = document.createElement("div");
				g_set.className = "iex_settings_setting" + (odd ? " iex_settings_setting_odd" : "") + (i > 0 ? " iex_settings_setting_top_padding" : "") + style.theme;
				g_set.setAttribute("data-iex-setting-level", d.level || "normal");
				g_container.appendChild(g_set);

				g_table = document.createElement("div");
				g_table.className = "iex_settings_setting_table" + style.theme;
				g_set.appendChild(g_table);

				// Halves
				g_half_right = document.createElement("div");
				g_half_right.className = "iex_settings_setting_right" + style.theme;
				g_table.appendChild(g_half_right);

				g_half_left = document.createElement("div");
				g_half_left.className = "iex_settings_setting_left" + style.theme;
				g_table.appendChild(g_half_left);

				// Left half
				g_label = document.createElement("div");
				g_label.className = "iex_settings_setting_label" + style.theme;
				g_half_left.appendChild(g_label);

				g_span = document.createElement("span");
				g_span.className = "iex_settings_setting_label_title" + style.theme;
				g_span.textContent = d.label;
				g_label.appendChild(g_span);

				if ("sublabel" in d) {
					g_span = document.createElement("span");
					g_span.className = "iex_settings_setting_label_subtitle" + style.theme;
					g_span.textContent = d.sublabel;
					g_label.appendChild(g_span);
				}

				g_label = document.createElement("div");
				g_label.className = "iex_settings_setting_description" + style.theme;
				g_label.textContent = d.description;
				g_half_left.appendChild(g_label);

				// Right half: input
				g_div = document.createElement("label");
				g_div.className = "iex_settings_setting_input_container" + style.theme;
				g_half_right.appendChild(g_div);

				if (d.type == "checkbox") {
					g_div.className += " iex_settings_setting_input_container_reverse";

					g_input = document.createElement("input");
					g_input.className = "iex_settings_setting_input_checkbox" + style.theme;
					g_input.setAttribute("type", "checkbox");
					g_div.appendChild(g_input);

					g_input_label = document.createElement("span");
					g_input_label.className = "iex_settings_setting_input_label" + style.theme;
					if ("value_labels" in d) {
						g_input_label.setAttribute("data-iex-checkbox-label-off", d.value_labels[0]);
						g_input_label.setAttribute("data-iex-checkbox-label-on", d.value_labels[1]);
					}
					else if ("values" in d) {
						g_input_label.setAttribute("data-iex-checkbox-label-off", "" + d.values[0]);
						g_input_label.setAttribute("data-iex-checkbox-label-on", "" + d.values[1]);
					}
					else {
						g_input_label.setAttribute("data-iex-checkbox-label-off", "off");
						g_input_label.setAttribute("data-iex-checkbox-label-on", "on");
					}
					g_div.appendChild(g_input_label);

					// Events
					cb = on_iex_setting_checkbox_change.bind(this, g_input, d);
					g_input.addEventListener("change", cb, false);
					data.push({
						node: g_input,
						event: "change",
						callback: cb,
						capture: false
					});

					// Check status
					if ("tree" in d) {
						val = this.get_value(d.tree);
						if ("values" in d) {
							g_input.checked = (val == d.values[1]);
						}
						else {
							g_input.checked = val;
						}
					}
				}
				else if (d.type == "textbox") {
					g_input = document.createElement("input");
					g_input.className = "iex_settings_setting_input_textbox" + style.theme;
					g_input.setAttribute("type", "text");
					g_div.appendChild(g_input);

					// Events
					cb = on_iex_setting_textbox_change.bind(this, g_input, d);
					g_input.addEventListener("change", cb, false);
					data.push({
						node: g_input,
						event: "change",
						callback: cb,
						capture: false
					});

					// Text
					if ("tree" in d) {
						g_input.value = this.get_value(d.tree).toString();
					}
				}
				else if (d.type == "text") {
					// Get current
					val = 0;
					if ("tree" in d) {
						s_val = this.get_value(d.tree);
						for (j = 0; j < d.values.length; ++j) {
							if (d.values[j] == s_val) {
								val = j;
								break;
							}
						}
					}
					else if ("get" in d) {
						val = d.get.call(this, d);
					}

					// Text
					g_input = document.createElement("a");
					g_input.className = "iex_settings_setting_input_text" + style.theme;
					g_input.textContent = ("value_labels" in d ? d.value_labels[val] : ("" + d.values[val]));
					g_input.setAttribute("data-iex-setting-current-id", val);
					g_div.appendChild(g_input);

					// Events
					cb = on_iex_setting_text_click.bind(this, g_input, d);
					g_input.addEventListener("click", cb, false);
					data.push({
						node: g_input,
						event: "click",
						callback: cb,
						capture: false
					});
				}

				// Sub-options
				if ("descriptors" in d) {
					g_div = document.createElement("div");
					g_div.className = "iex_settings_region_container" + style.theme;
					g_set.appendChild(g_div);

					g_div.appendChild(generate_settings_container.call(this, d.descriptors, data)[0]);
				}

				// Next
				odd = !odd;
			}

			// Return
			return [ container , data ];
		};
		var destroy_settings_data = function (data) {
			// Remove events
			for (var i = 0; i < data.length; ++i) {
				data[i].node.removeEventListener(data[i].event, data[i].callback, data[i].capture);
			}
		};
		var change_settings_difficulty = function (target) {
			if (this.settings_container === null) return;

			// Setup
			var groups = this.settings_container.querySelectorAll(".iex_settings_group"),
				levels = [ "normal" , "advanced" ],
				level_target = levels.indexOf(target),
				settings, s, s_pre, i, j, odd, count, level, choices;

			// Modify settings
			for (i = 0; i < groups.length; ++i) {
				settings = groups[i].querySelectorAll(".iex_settings_setting");
				odd = true;
				s_pre = null;
				count = 0;

				for (j = 0; j < settings.length; ++j) {
					s = settings[j];
					level = levels.indexOf(s.getAttribute("data-iex-setting-level"));

					// Display
					if (level <= level_target) {
						// Un-hide
						style.remove_class(s, "iex_settings_setting_hidden");
						++count;

						// Oddity
						if (odd) {
							style.add_class(s, "iex_settings_setting_odd");
						}
						else {
							style.remove_class(s, "iex_settings_setting_odd");
						}
						odd = !odd;

						// Previous
						if (s_pre !== null) {
							style.add_class(s, "iex_settings_setting_top_padding");
						}
						else {
							style.remove_class(s, "iex_settings_setting_top_padding");
						}
						s_pre = s;
					}
					else {
						// Hide
						style.add_class(s, "iex_settings_setting_hidden");
					}
				}

				if (count === 0) {
					style.add_class(groups[i], "iex_settings_group_hidden");
				}
				else {
					style.remove_class(groups[i], "iex_settings_group_hidden");
				}
			}

			// Modify difficulty
			choices = this.settings_difficulty_container.querySelectorAll(".iex_settings_difficulty_choice");
			for (i = 0; i < choices.length; ++i) {
				level = choices[i].getAttribute("data-iex-settings-difficulty-choice-level");
				if (level == target) {
					style.add_class(choices[i], "iex_settings_difficulty_choice_selected");
				}
				else {
					style.remove_class(choices[i], "iex_settings_difficulty_choice_selected");
				}
			}
		};



		Settings.prototype = {
			constructor: Settings,

			setup: function () {
				// Events
				sync.on("install_complete", this.on_install_complete_sync_bind = on_install_complete_sync.bind(this));
				sync.on("settings_save", this.on_settings_save_sync_bind = on_settings_save_sync.bind(this));
				sync.on("image_expansion_enable", this.on_image_expansion_enable_sync_bind = on_image_expansion_enable_sync.bind(this));

				// Modify other settings
				api.on("settings_4chanx_section_change", this.on_settings_4chanx_section_change_bind = on_settings_4chanx_section_change.bind(this));
				api.on("settings_vanilla_open", this.on_settings_vanilla_open_bind = on_settings_vanilla_open.bind(this));
				api.on("menu_4chanx_open", this.on_menu_4chanx_open_bind = on_menu_4chanx_open.bind(this));

				// First load
				this.load_values(false, on_initial_load.bind(this));
				ASAP.asap(on_insert_links.bind(this), on_insert_links_condition, 0.5);
			},

			get_value: function (tree) {
				// Traverse tree
				var val = this.values, i = 0, j = tree.length - 1;
				for (; i < j; ++i) {
					val = val[tree[i]];
				}

				// Get
				return val[tree[i]];
			},
			change_value: function (tree, new_value) {
				// Traverse tree
				var val = this.values, i = 0, j = tree.length - 1;
				for (; i < j; ++i) {
					val = val[tree[i]];
				}

				// Update
				var old_value = val[tree[i]];
				val[tree[i]] = new_value;

				// Change event
				trigger_change.call(this, tree, old_value, new_value, "same");

				// Return old
				return old_value;
			},
			load_values: function (events, complete_callback) {
				// Async save
				SaveAsync.get(this.save_key, on_load_values_callback.bind(this, events, complete_callback));
			},
			save_values: function (complete_callback) {
				// Async save
				SaveAsync.set(this.save_key, this.values, on_save_values_callback.bind(this, complete_callback));
			},
			delete_values: function (complete_callback) {
				// Async delete
				SaveAsync.del(this.save_key, complete_callback);
			},

			on: function (event, callback) {
				// Add callback
				if (event in this.events) {
					this.events[event].push(callback);
				}
			},
			off: function (event, callback) {
				// Add callback
				if (event in this.events) {
					var e_list = this.events[event];
					for (var i = 0; i < e_list.length; ++i) {
						if (e_list[i] === callback) {
							// Remove
							e_list.splice(i, 1);
							return true;
						}
					}
				}

				return false;
			},
			on_ready: function (callback) {
				if (this.ready_callbacks !== null) {
					// Add to callback list
					this.ready_callbacks.push(callback);
				}
				else {
					// Already ready
					callback.call(this);
				}
			},
			on_change: function (tree, callback) {
				var key = tree.join("-");
				if (key in this.change_events) {
					// Update old
					this.change_events[key].callbacks.push(callback);
				}
				else {
					// Create new
					var tree_clone = [];
					for (var i = 0; i < tree.length; ++i) {
						tree_clone.push(tree[i]);
					}

					this.change_events[key] = {
						tree: tree_clone,
						callbacks: [ callback ]
					};
				}
			},
			off_change: function (tree, callback) {
				var key = tree.join("-");
				if (key in this.change_events) {
					// Update old
					var list = this.change_events[key].callbacks;
					for (var i = 0; i < list.length; ++i) {
						if (list[i] === callback) {
							// Remove
							list[i].splice(i, 1);
							if (list.length === 0) {
								delete this.change_events[key];
							}
							return true;
						}
					}
				}

				return false;
			},

			modify_4chanx_settings: function (callback) {
				if (api.is_4chanx) {
					var body = document.querySelector("body");
					if (body) style.add_class(body, "iex_hide_other_settings");

					// Set the timer
					this.modifying_settings_4chanx_timer = setTimeout(on_modifying_settings_4chanx_timout.bind(this), 1000);
					this.modifying_settings_4chanx_callback = callback || null;

					// Open settings to Main tab
					var target_tab = api.is_appchanx ? "Script" : "Main";
					if (api.settings_4chanx_is_open()) {
						api.settings_4chanx_change_section(target_tab);
					}
					else {
						api.settings_4chanx_open(target_tab);
					}
				}
			},
			modify_vanilla_settings: function (callback) {
				if (!api.is_4chanx) {
					var body = document.querySelector("body");
					if (body) style.add_class(body, "iex_hide_other_settings");

					// Set the timer
					this.modifying_settings_vanilla_timer = setTimeout(on_modifying_settings_vanilla_timout.bind(this), 1000);
					this.modifying_settings_vanilla_callback = callback || null;

					// Open settings
					api.settings_vanilla_open();
				}
			},

			disable_image_expansion: function () {
				if (!this.can_disable_image_hover) return;

				// Disable
				settings.change_value(["image_expansion", "enabled"], false);
				settings.save_values();

				// Alert message
				this.display_image_hover_notification();
			},

			settings_open: function () {
				settings_open.call(this);
			},
			settings_close: function () {
				if (this.settings_container === null) return;

				// Remove
				destroy_settings_data.call(this, this.settings_removal_data);
				var par = this.settings_container_outer.parentNode;
				if (par) par.removeChild(this.settings_container_outer);

				this.settings_removal_data = null;
				this.settings_container = null;
				this.settings_container_outer = null;
				this.settings_difficulty_container = null;


				// Modify other settings
				if (this.settings_update_other_after_close) {
					this.settings_update_other_after_close = false;

					if (this.values.image_expansion.enabled) {
						// Modify
						var cb = on_settings_update_other_complete.bind(this);
						if (api.is_4chanx) {
							this.modify_4chanx_settings(cb);
						}
						else {
							this.modify_vanilla_settings(cb);
						}
					}
				}
			},

			display_first_run_notification: function () {
				if (this.notification_first_run !== null) return;

				// Alert message
				var message = document.createElement("div"), m_title, m_part, m_text, m_link;

				// Line 1
				m_title = document.createElement("div");
				m_title.appendChild(document.createTextNode("You've just installed "));

				m_link = document.createElement("a");
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("href", "//dnsev.github.io/iex/");
				m_link.textContent = "iex - Image Extensions";
				m_title.appendChild(m_link);

				m_title.appendChild(document.createTextNode("!"));

				// Line 2
				m_part = document.createElement("div");
				m_part.className = "iex_spaced_div";
				m_part.textContent = "If you use 4chan-x or appchan-x, you can access iex settings through the header menu. Otherwise, look for the [ iex ] link at the top of the page.";
				message.appendChild(m_part);

				// Line 3
				m_part = document.createElement("div");
				m_part.className = "iex_spaced_div";
				m_part.appendChild(document.createTextNode("Any questions or issues can be addressed on "));

				m_link = document.createElement("a");
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("href", "//dnsev.github.io/iex/");
				m_link.textContent = "its homepage";
				m_part.appendChild(m_link);

				m_part.appendChild(document.createTextNode("."));
				message.appendChild(m_part);

				// Line 4
				m_part = document.createElement("div");
				m_part.className = "iex_spaced_div";
				m_part.textContent = "Would you like to enable iex now? (page will be refreshed)";
				message.appendChild(m_part);

				// Line 5
				m_part = document.createElement("div");

				m_link = document.createElement("a");
				m_link.className = "iex_highlighted_link";
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("href", "//dnsev.github.io/iex/");
				m_link.textContent = "enable now";
				m_link.addEventListener("click", on_first_run_link_click.bind(this, true), false);
				m_part.appendChild(m_link);

				m_part.appendChild(document.createTextNode(" or "));

				m_link = document.createElement("a");
				m_link.className = "iex_highlighted_link";
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("href", "//dnsev.github.io/iex/");
				m_link.textContent = "leave disabled";
				m_link.addEventListener("click", on_first_run_link_click.bind(this, false), false);
				m_part.appendChild(m_link);

				message.appendChild(m_part);

				// Display
				this.notification_first_run = new Notification({
					close: false,
					overlay_close: false,
					style: "info",
					title: m_title,
					content: message,
					on: {
						close: on_notification_first_run_close.bind(this)
					}
				});
			},
			display_install_fail_notification: function (status) {
				if (this.notification_install_fail !== null) return;

				// Alert message
				var message = document.createElement("div"), m_part, m_link;

				// Line 1
				m_part = document.createElement("div");
				m_part.className = "iex_spaced_div";
				m_part.textContent = "Failed to resolve settings conflicts for reason: " + status + ".";
				message.appendChild(m_part);

				// Line 3
				m_part = document.createElement("div");
				m_part.textContent = "This is potentially due to other userscript extensions you have installed.";
				message.appendChild(m_part);

				// Line 4
				m_part = document.createElement("div");
				m_part.className = "iex_spaced_div";
				m_part.textContent = "You can try manually turning off any \"Image Hover\" settings to get iex to work.";
				message.appendChild(m_part);

				// Line 5
				m_part = document.createElement("div");
				m_part.className = "iex_spaced_div";
				m_part.appendChild(document.createTextNode("If you would like to get this fixed, "));

				m_link = document.createElement("a");
				m_link.className = "iex_underlined_link";
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("href", "http://github.com/dnsev/iex/issues");
				m_link.textContent = "file an issue request";
				m_part.appendChild(m_link);

				m_part.appendChild(document.createTextNode("."));
				message.appendChild(m_part);

				// Line 5
				m_part = document.createElement("div");
				m_part.textContent = "This script can be re-enabled through its settings page.";
				message.appendChild(m_part);

				// Display
				this.notification_install_fail = new Notification({
					close: true,
					overlay_close: false,
					style: "error",
					title: "iex error: Failed to modify settings",
					content: message,
					on: {
						close: on_notification_install_fail_close.bind(this)
					}
				});
			},
			display_settings_info_notification: function () {
				// Async get
				SaveAsync.get(this.save_key, on_display_settings_info_notification_callback.bind(this));
			},
			display_image_hover_notification: function () {
				// Alert message
				var message = document.createElement("div"),
					m_part, m_link;

				// Line 1
				m_part = document.createElement("div");

				// Text
				m_part.appendChild(document.createTextNode("Image Extensions will be disabled and can be re-enabled through "));

				// Link
				m_link = document.createElement("a");
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("href", "//dnsev.github.io/iex/");
				m_link.textContent = "settings";
				m_link.className = "iex_underlined_link" + style.theme;
				m_part.appendChild(m_link);

				// Text
				m_part.appendChild(document.createTextNode("."));

				// Add to message
				message.appendChild(m_part);

				// Display
				this.notification_image_hover = new Notification({
					close: true,
					overlay_close: true,
					style: "warning",
					title: "Default image hovering still enabled",
					content: message,
					on: {
						close: on_notification_image_hover_close.bind(this)
					}
				});
				m_link.addEventListener("click", on_notification_link_click.bind(this, true, this.notification_image_hover), false);
			},

		};



		return Settings;

	})();

	// Class to manage page styling
	var Style = (function () {

		var MutationObserver = (window.MutationObserver || window.WebKitMutationObserver);



		var Style = function () {
			// Append style
			this.stylesheet = null;

			// Observers
			this.head_observer = null;
			this.style_observers = [];
			this.stylesheet_observers = [];
			this.on_style_observe_bind = on_style_observe.bind(this);
			this.on_stylesheet_observe_bind = on_stylesheet_observe.bind(this);

			// Theme
			this.theme = " iex_no_theme";
			this.theme_check_count = 0;
			this.theme_check_count_max = 100;
			this.theme_check_timer = null;
			this.theme_check_timeout_bind = on_theme_check_timeout.bind(this);
			ASAP.asap(on_asap.bind(this), on_asap_condition.bind(this));
		};



		var on_insert_stylesheet = function () {
			var head = document.querySelector("head");
			if (head) head.appendChild(this.stylesheet);
		};
		var on_insert_stylesheet_condition = function () {
			return document.querySelector("head");
		};

		var on_asap = function () {
			// Theme check
			this.theme_check_timeout_bind.call(this);

			// Style changing
			var head = document.querySelector("head");
			if (!head) return;

			// Create new observer
			this.head_observer = new MutationObserver(on_head_observe.bind(this));
			this.head_observer.observe(
				head,
				{
					childList: true
				}
			);

			// Add event listeners to stylesheets
			var stylesheets = head.querySelectorAll("link[rel='stylesheet']"),
				styles = head.querySelectorAll("style"),
				i;

			for (i = 0; i < styles.length; ++i) {
				// Create new observer
				add_style_observer.call(this, styles[i]);
			}
			for (i = 0; i < stylesheets.length; ++i) {
				// Create new observer
				add_stylesheet_observer.call(this, stylesheets[i]);
			}
		};
		var on_asap_condition = function () {
			return document.querySelector("head") && document.querySelector("body");
		};
		var on_theme_check_timeout = function () {
			// Stop timer
			this.theme_check_timer = null;

			// New theme
			if (!theme_update.call(this)) {
				// Timeout
				if (++this.theme_check_count < this.theme_check_count_max) {
					this.theme_check_timer = setTimeout(this.theme_check_timeout_bind, 50);
				}
			}
		};

		var on_head_observe = function (records) {
			var nodes, i, j, r;
			for (i = 0; i < records.length; ++i) {
				r = records[i];
				if ((nodes = r.addedNodes)) {
					for (j = 0; j < nodes.length; ++j) {
						// Check
						on_head_observe_add.call(this, nodes[j]);
					}
				}
				if ((nodes = r.removedNodes)) {
					for (j = 0; j < nodes.length; ++j) {
						// Check
						on_head_observe_remove.call(this, nodes[j]);
					}
				}
			}
		};
		var on_head_observe_add = function (element) {
			if (element.tagName === "STYLE") {
				add_style_observer.call(this, element);
			}
			else if (element.tagName === "LINK") {
				if (element.getAttribute("rel") == "stylesheet") {
					add_stylesheet_observer.call(this, element);
				}
			}
		};
		var on_head_observe_remove = function (element) {
			if (element.tagName === "STYLE") {
				remove_style_observer.call(this, element);
			}
			else if (element.tagName === "LINK") {
				if (element.getAttribute("rel") == "stylesheet") {
					remove_stylesheet_observer.call(this, element);
				}
			}
		};

		var on_stylesheet_observe = function (records) {
			var i, r;
			for (i = 0; i < records.length; ++i) {
				r = records[i];

				if (r.attributeName === "href") {
					// Theme update
					theme_update.call(this);
				}
			}
		};

		var on_style_observe = function (records) {
			var i;
			for (i = 0; i < records.length; ++i) {
				// Theme update
				theme_update.call(this);
			}
		};

		var add_style_observer = function (element) {
			// Create new observer
			var observer = new MutationObserver(this.on_style_observe_bind);
			observer.observe(
				element,
				{
					childList: true,
					characterData: true
				}
			);

			this.style_observers.push({
				target: element,
				observer: observer,
			});
		};
		var add_stylesheet_observer = function (element) {
			// Create new observer
			var observer = new MutationObserver(this.on_stylesheet_observe_bind);
			observer.observe(
				element,
				{
					attributes: true
				}
			);

			this.stylesheet_observers.push({
				target: element,
				observer: observer,
			});
		};
		var remove_style_observer = function (element) {
			// Delete observer
			for (var i = 0; i < this.style_observers.length; ++i) {
				if (this.style_observers[i].target === element) {
					this.style_observers[i].observer.disconnect();
					this.style_observers.splice(i, 1);
					return;
				}
			}
		};
		var remove_stylesheet_observer = function (element) {
			// Delete observer
			for (var i = 0; i < this.stylesheet_observers.length; ++i) {
				if (this.stylesheet_observers[i].target === element) {
					this.stylesheet_observers[i].observer.disconnect();
					this.stylesheet_observers.splice(i, 1);
					return;
				}
			}
		};
		var theme_update = function () {
			// Find theme
			var theme_new = this.theme_detect();
			if (theme_new !== null) {
				// Clear timer
				if (this.theme_check_timer !== null) {
					clearTimeout(this.theme_check_timer);
					this.theme_check_timer = null;
				}

				// Change theme
				this.theme_change(theme_new);

				// Okay
				return true;
			}

			// Not okay
			return false;
		};



		Style.prototype = {
			constructor: Style,

			insert_stylesheet: function () {
				// Create stylesheet
				var stylesheet_text = [ //{
					'body.iex_hide_other_settings #settingsMenu,',
					'body.iex_hide_other_settings #overlay,',
					'body.iex_hide_other_settings #appchanx-settings,',
					'body.iex_hide_other_settings #fourchanx-settings{visibility:hidden !important;}',

					'.iex_no_padding_br{padding-bottom:0 !important;padding-right:0 !important;margin-bottom:0 !important;margin-right:0 !important;border-bottom-width:0 !important;border-right-width:0 !important;}',
					'.iex_no_padding_tl{padding-top:0 !important;padding-left:0 !important;margin-top:0 !important;margin-left:0 !important;border-top-width:0 !important;border-left-width:0 !important;}',

					'.iex_settings_popup_overlay{position:fixed;z-index:200;left:0;top:0;bottom:0;right:0;font-size:14px;background:rgba(0,0,0,0.25);}',
					'.iex_settings_popup_overlay.iex_dark{background:rgba(255,255,255,0.25);}',
					'.iex_settings_popup{margin:0;padding:0;width:100%;height:100%;text-align:center;white-space:nowrap;z-index:200;line-height:0;}',
					'.iex_settings_popup_aligner{height:100%;width:0;display:inline-block;vertical-align:middle;}',
					'.iex_settings_popup_inner{display:inline-block;vertical-align:middle;text-align:left;line-height:normal;white-space:normal;position:relative;width:40em;height:80%;min-height:14em;}',
					'.iex_settings_popup_table{display:table;position:relative;table-layout:fixed;width:100%;height:100%;box-shadow:0 0 1em 0.25em #000000;}',
					'.iex_settings_popup_table.iex_dark{box-shadow:0 0 1em 0.25em #ffffff;}',
					'.iex_settings_popup_top{display:table-row;width:100%;}',
					'.iex_settings_popup_top_content{display:table;width:100%;background:rgba(0,0,0,0.0625);}',
					'.iex_settings_popup_top_content.iex_dark{background:rgba(255,255,255,0.0625);}',
					'.iex_settings_popup_top_label{display:table-cell;vertical-align:middle;padding:0.25em;font-size:1.125em;font-weight:bold;text-shadow:0 0.0625em 0.25em #ffffff;}',
					'.iex_settings_popup_top_label.iex_dark{text-shadow:0 0.0625em 0.25em #000000;}',
					'.iex_settings_popup_top_right{display:table-cell;vertical-align:middle;padding:0.25em;text-align:right;}',
					'.iex_settings_popup_middle{display:table-row;width:100%;height:100%;}',
					'.iex_settings_popup_middle_content_pad{display:block;width:100%;height:100%;position:relative;}',
					'.iex_settings_popup_middle_content{display:block;position:absolute;left:0;top:0;bottom:0;right:0;padding:0;overflow:auto;}',
					'.iex_settings_popup_middle_content_inner{display:block;padding:0.25em;}',
					'.iex_settings_popup_close_link{font-weight:bold;text-decoration:none !important;padding:0em 0.2em;}',
					'.iex_settings_popup_bottom{display:table-row;width:100%;}',

					'.iex_settings_container{position:relative;}',
					'.iex_settings_region_container{margin:0.25em -0.25em -0.25em 2em;}',
					'.iex_settings_region{}',
					'.iex_settings_group{}',
					'.iex_settings_group.iex_settings_group_hidden{display:none;}',
					'.iex_settings_group_label{font-size:1.125em;padding-bottom:0.125em;margin-bottom:0.25em;font-weight:bold;text-align:left;color:#000000;border-bottom:0.125em solid rgba(0,0,0,0.5);text-shadow:0em 0em 0.25em #ffffff;}',
					'.iex_settings_group_label.iex_dark{color:#ffffff;border-bottom:0.125em solid rgba(255,255,255,0.5);text-shadow:0em 0em 0.25em #000000;}',
					'.iex_settings_group.iex_settings_group_padding_top{margin-top:1em;}',
					'.iex_settings_setting{padding:0.25em;background:transparent;}',
					'.iex_settings_setting.iex_settings_setting_top_padding{margin-top:0.25em;}',
					'.iex_settings_setting.iex_settings_setting_hidden{display:none;}',
					'.iex_settings_setting.iex_settings_setting_odd{background:rgba(0,0,0,0.0625);}',
					'.iex_settings_setting.iex_settings_setting_odd.iex_dark{background:rgba(255,255,255,0.0625);}',
					'.iex_settings_setting_table{display:block;width:100%;}',
					'.iex_settings_setting_left{display:block;overflow:hidden;text-align:left;vertical-align:top;}',
					'.iex_settings_setting_right{display:inline-block;float:right;text-align:right;vertical-align:middle;padding:0.5em 0em;}',
					'.iex_settings_setting_label{display:block;}',
					'.iex_settings_setting_label_title{color:#000000;font-weight:bold;font-size:1.125em;vertical-align:baseline;}',
					'.iex_settings_setting_label_title.iex_dark{color:#ffffff;}',
					'.iex_settings_setting_label_subtitle{color:#000000;font-weight:bold;font-size:1em;vertical-align:baseline;opacity:0.625;margin-left:0.5em;}',
					'.iex_settings_setting_label_subtitle.iex_dark{color:#ffffff;}',
					'.iex_settings_setting_label_subtitle:before{content:"(";}',
					'.iex_settings_setting_label_subtitle:after{content:")";}',
					'.iex_settings_setting_description{margin-left:0.5em;}',
					'.iex_settings_setting_input_container{display:inline-block;white-space:nowrap;cursor:pointer;}',
					'.iex_settings_setting_input_container.iex_settings_setting_input_container_reverse{direction:rtl;}',
					'.iex_settings_setting_input_checkbox{vertical-align:middle;}',
					'.iex_settings_setting_input_checkbox+.iex_settings_setting_input_label,',
					'.iex_settings_setting_input_checkbox+*+.iex_settings_setting_input_label{vertical-align:middle;padding-right:0.5em;}',
					'.iex_settings_setting_input_checkbox+.iex_settings_setting_input_label:after,',
					'.iex_settings_setting_input_checkbox+*+.iex_settings_setting_input_label:after{content:attr(data-iex-checkbox-label-off);}',
					'.iex_settings_setting_input_checkbox:checked+.iex_settings_setting_input_label:after,',
					'.iex_settings_setting_input_checkbox:checked+*+.iex_settings_setting_input_label:after{content:attr(data-iex-checkbox-label-on);}',
					'input.iex_settings_setting_input_textbox{width:5em;padding:0.125em;border:1px solid rgba(16,16,16,0.5) !important;}',
					'input.iex_settings_setting_input_textbox:focus{border-color:rgba(16,16,16,1) !important;}',
					'input.iex_settings_setting_input_textbox.iex_dark{border-color:rgba(240,240,240,0.5) !important;}',
					'input.iex_settings_setting_input_textbox.iex_dark:focus{border-color:rgba(240,240,240,1) !important;}',
					'.iex_settings_difficulty_container{position:absolute;right:0;top:0;margin-top:0.5em;}',
					'.iex_settings_popup a.iex_settings_difficulty_choice{cursor:pointer;text-decoration:none !important;}',
					'.iex_settings_popup a.iex_settings_difficulty_choice.iex_settings_difficulty_choice_selected{text-decoration:underline !important;}',
					'.iex_settings_popup a.iex_settings_homepage_link{text-decoration:none !important;}',
					'.iex_settings_difficulty_separator{}',

					'.iex_notification{position:fixed;left:0;top:0;bottom:0;right:0;z-index:100;background:rgba(255,255,255,0.5);font-size:14px;}',
					'.iex_notification.iex_dark{background:rgba(0,0,0,0.5);}',
					'.iex_notification_body_outer{margin:0;padding:0;width:100%;height:100%;text-align:center;white-space:nowrap;z-index:200;line-height:0;}',
					'.iex_notification_body_aligner{height:100%;width:0;display:inline-block;vertical-align:middle;}',
					'.iex_notification_body_inner{display:inline-block;vertical-align:middle;line-height:normal;}',
					'.iex_notification_body{position:relative;text-align:center;white-space:normal;width:36em;padding:0.375em 1em;border-radius:0.25em;box-shadow:0em 0em 0.25em 0.125em rgba(0,0,0,0.5);}',
					'.iex_notification_body.iex_dark{box-shadow:0em 0em 0.25em 0.125em rgba(255,255,255,0.5);}',
					'.iex_notification_body.iex_notification_info{background:rgba(0,120,220,0.9);}',
					'.iex_notification_body.iex_notification_success{background:rgba(0,168,20,0.9);}',
					'.iex_notification_body.iex_notification_error{background:rgba(220,0,0,0.9);}',
					'.iex_notification_body.iex_notification_warning{background:rgba(220,120,0,0.9);}',
					'a.iex_notification_close{color:#ffffff !important;position:absolute;top:0;right:0;z-index:10;cursor:pointer;font-weight:bold;}',
					'a.iex_notification_close:hover{color:#000000 !important;text-shadow:0em 0.0625em 0.125em #ffffff;}',
					'a.iex_notification_close.iex_notification_close_hidden{display:none;}',
					'.iex_notification_content_outer{position:relative;}',
					'.iex_notification_content{position:relative;}',
					'.iex_notification_content_title{font-weight:bold;margin-bottom:0.75em;color:#ffffff;text-shadow:0em 0.0625em 0.125em #000000;}',
					'.iex_notification_content_body{color:#ffffff;text-shadow:0em 0.0625em 0.125em rgba(0,0,0,0.5);}',
					'.iex_notification_content a{color:#ffffff !important;text-decoration:none;}',
					'.iex_notification_content a:hover{color:#c010e0 !important;}',
					'.iex_notification_content.iex_dark a:hover{color:#d040e8 !important;}',
					'.iex_notification_content .iex_spaced_div{margin-bottom:0.5em;}',
					'.iex_notification_content a.iex_highlighted_link{font-weight:bold;text-decoration:underline !important;}',
					'.iex_notification_content a.iex_underlined_link{text-decoration:underline !important;}',
					'textarea.iex_notification_textarea{width:100%;height:5em;min-height:2em;font-family:Courier New;font-size:1em;text-align:left;color:#ffffff !important;background-color:transparent !important;border:0.08em solid rgba(255,255,255,0.5) !important;padding:0.25em;margin:0;resize:vertical;box-sizing:border-box;-moz-box-sizing:border-box;}',
					'textarea.iex_notification_textarea:hover,',
					'textarea.iex_notification_textarea:focus{background-color:rgba(255,255,255,0.0625) !important;border:0.08em solid rgba(255,255,255,0.75) !important;}',


					'.iex_floating_container{display:block;margin:0;padding:0;border:0em hidden;}',
					'.iex_floating_image_connector{display:block;position:absolute;z-index:100;}',
					'.iex_floating_image_connector:not(.iex_floating_image_connector_visible){display:none;}',

					'.iex_cpreview_container{display:block;position:absolute;z-index:100;}',
					'.iex_cpreview_container.iex_cpreview_container_fixed{position:fixed;}',
					'.iex_cpreview_container:not(.iex_cpreview_container_visible){display:none;}',
					'.iex_cpreview_padding{display:block;position:relative;margin:0;padding:0;left:0;top:0;}',
					'.iex_cpreview_overflow{display:block;position:relative;overflow:hidden;}',
					'.iex_cpreview_offset{display:block;position:relative;width:100%;height:100%;text-align:center;}',
					'.iex_cpreview_offset.iex_cpreview_offset_sized{}',
					'.iex_cpreview_overlay{}',
					'.iex_cpreview_content{}',

					'.iex_cpreview_padding.iex_mpreview_padding{box-shadow:0em 0em 0.6em 0.3em rgba(0,0,0,0.75);background-color:rgba(255,255,255,0.5);}',
					'.iex_cpreview_padding.iex_mpreview_padding.iex_dark{box-shadow:0em 0em 0.6em 0.3em rgba(255,255,255,0.75);background-color:rgba(0,0,0,0.5);}',
					'.iex_cpreview_padding.iex_mpreview_mouse_hidden{cursor:none;}',

					'.iex_mpreview_background{display:block;position:absolute;left:0;top:0;bottom:0;right:0;background-color:transparent;background-repeat:no-repeat;background-position:left top;background-size:100% 100%;opacity:0.375;}',
					'.iex_mpreview_background.iex_mpreview_background_disabled{opacity:0;visibility:hidden;}',
					'.iex_mpreview_background.iex_mpreview_background_visible_full{opacity:1;}',
					'.iex_mpreview_background:not(.iex_mpreview_background_visible){display:none;}',
					'.iex_mpreview_background.iex_transitions.iex_mpreview_background_visible{transition:opacity 0.5s, visibility 0s linear 0s;}',
					'.iex_mpreview_background.iex_transitions.iex_mpreview_background_visible.iex_mpreview_background_disabled{transition:opacity 0.5s, visibility 0s linear 0.5s;}',

					'.iex_mpreview_zoom_borders{display:block;position:absolute;border:0.08em solid #ffffff;opacity:0.25;left:0;top:0;bottom:0;right:0;}',
					'.iex_mpreview_zoom_borders_inner{display:block;position:absolute;border:0.08em solid #000000;left:0;top:0;bottom:0;right:0;}',
					'.iex_mpreview_zoom_borders:not(.iex_mpreview_zoom_borders_visible),',
					'.iex_mpreview_zoom_borders:not(.iex_mpreview_zoom_borders_vertical):not(.iex_mpreview_zoom_borders_horizontal){opacity:0;visibility:hidden;}',
					'.iex_mpreview_zoom_borders:not(.iex_mpreview_zoom_borders_vertical){top:0 !important;bottom:0 !important;border-top:0 hidden;border-bottom:0 hidden;}',
					'.iex_mpreview_zoom_borders:not(.iex_mpreview_zoom_borders_horizontal){left:0 !important;right:0 !important;border-left:0 hidden;border-right:0 hidden;}',
					'.iex_mpreview_zoom_borders:not(.iex_mpreview_zoom_borders_vertical)>.iex_mpreview_zoom_borders_inner{border-top:0 hidden;border-bottom:0 hidden;}',
					'.iex_mpreview_zoom_borders:not(.iex_mpreview_zoom_borders_horizontal)>.iex_mpreview_zoom_borders_inner{border-left:0 hidden;border-right:0 hidden;}',

					'.iex_mpreview_stats_container{display:block;position:absolute;padding:0.125em 0em 0em 0.5em;left:-0.5em;right:0;bottom:100%;white-space:nowrap;overflow:hidden;color:#ffffff;text-shadow:0em 0em 0.4em #000000,0em 0em 0.3em #000000;}',
					'.iex_mpreview_stats_container.iex_dark{color:#000000;text-shadow:0em 0em 0.4em #ffffff,0em 0em 0.3em #ffffff;}',
					'.iex_mpreview_stat{font-weight:bold;}',
					'.iex_mpreview_stat.iex_mpreview_stat_red{color:#f03030;}',
					'.iex_mpreview_stat.iex_mpreview_stat_red.iex_dark{color:#a00000;}',
					'.iex_mpreview_stat_sep{opacity:0.825;}',
					'.iex_mpreview_stat:not(.iex_mpreview_stat_visible),',
					'.iex_mpreview_stat_sep:not(.iex_mpreview_stat_sep_visible){display:none;}',

					'.iex_mpreview_stat.iex_mpreview_stat_zoom_controls{margin-right:0.25em;position:absolute;}',
					'.iex_mpreview_stat.iex_mpreview_stat_zoom_controls.iex_mpreview_stat_zoom_controls_fixed{position:fixed;}',
					'.iex_mpreview_stat_zoom_controls_offset{display:none;}',
					'.iex_mpreview_stat.iex_mpreview_stat_zoom_controls.iex_mpreview_stat_visible+.iex_mpreview_stat_zoom_controls_offset{display:inline-block;}',
					'.iex_mpreview_stat_zoom_control{padding:0em 0.25em;cursor:pointer;}',
					'.iex_mpreview_stat_zoom_control_increase:hover{color:#80d0ff;}',
					'.iex_mpreview_stat_zoom_control_increase.iex_dark:hover{color:#a0e0ff;}',
					'.iex_mpreview_stat_zoom_control_decrease:hover{color:#f08060;}',
					'.iex_mpreview_stat_zoom_control_decrease.iex_dark:hover{color:#ffb0a0;}',

					'.iex_mpreview_image{display:inline-block;border:0em hidden;margin:0;padding:0;outline:0em hidden;}',
					'.iex_mpreview_image:not(.iex_mpreview_image_visible){display:none;}',
					'.iex_mpreview_image.iex_mpreview_image_unsized{max-width:100%;max-height:100%;}',
					'.iex_cpreview_offset.iex_cpreview_offset_sized>.iex_mpreview_image{position:absolute;left:0;top:0;bottom:0;right:0;width:100%;height:100%;}',
					'.iex_cpreview_offset:not(.iex_cpreview_offset_sized)>.iex_mpreview_image{max-width:100%;max-height:100%;width:auto;height:auto;}',

					'.iex_mpreview_video{display:inline-block;border:0em hidden;margin:0;padding:0;outline:0em hidden;}',
					'.iex_mpreview_video:not(.iex_mpreview_video_visible){display:none;}',
					'.iex_mpreview_video.iex_mpreview_video_unsized{max-width:100%;max-height:100%;}',
					'.iex_mpreview_video.iex_mpreview_video_not_ready{visibility:hidden;}',
					'.iex_cpreview_offset.iex_cpreview_offset_sized>.iex_mpreview_video{position:absolute;left:0;top:0;bottom:0;right:0;width:100%;height:100%;}',
					'.iex_cpreview_offset:not(.iex_cpreview_offset_sized)>.iex_mpreview_video{max-width:100%;max-height:100%;width:auto;height:auto;}',

					'.iex_mpreview_vcontrols_container{display:block;position:absolute;left:0;top:0;bottom:0;right:0;background:transparent;font-size:1.5em;}',
					'.iex_mpreview_vcontrols_container_inner{display:block;position:absolute;left:0;bottom:0;right:0;padding-top:2em;height:2em;background:transparent;}',
					'.iex_mpreview_vcontrols_table{display:table;width:100%;height:100%;}',
					'.iex_mpreview_vcontrols_table:not(.iex_mpreview_vcontrols_table_visible):not(.iex_mpreview_vcontrols_table_visible_temp):not(.iex_mpreview_vcontrols_table_visible_important):not(.iex_mpreview_vcontrols_table_mini),',
					'.iex_mpreview_vcontrols_table.iex_mpreview_vcontrols_table_mini_disabled{display:none;}',
					'.iex_mpreview_vcontrols_seek_container{display:table-cell;vertical-align:bottom;min-width:1em;}',
					'.iex_mpreview_vcontrols_seek_container_inner{display:block;width:100%;height:2em;position:relative;}',
					'.iex_mpreview_vcontrols_seek_bar{display:block;position:absolute;left:0;right:0;top:0.5em;bottom:0.5em;border-radius:0.5em;overflow:hidden;cursor:pointer;border:1px solid rgba(0,0,0,0.5);}',
					'.iex_mpreview_vcontrols_seek_bar.iex_mpreview_vcontrols_no_border_radius{border-radius:0;}',
					'.iex_mpreview_vcontrols_seek_bar_bg{position:absolute;left:0;top:0;bottom:0;right:0;background-color:#c0c0c0;opacity:0.825;}',
					'.iex_mpreview_vcontrols_seek_bar_loaded{position:absolute;left:0;top:0;bottom:0;width:0;background:#ffffff;}',
					'.iex_mpreview_vcontrols_seek_bar_played{position:absolute;left:0;top:0;bottom:0;width:0;background:#66cc33;}',
					'.iex_mpreview_vcontrols_seek_time_table{position:relative;display:table;width:100%;height:100%;font-size:0.625em;}',
					'.iex_mpreview_vcontrols_seek_time_current{display:table-cell;text-align:left;vertical-align:middle;padding:0em 0.25em 0em 0.375em;}',
					'.iex_mpreview_vcontrols_seek_time_duration{display:table-cell;text-align:right;vertical-align:middle;padding:0em 0.375em 0em 0.25em;}',
					'.iex_mpreview_vcontrols_seek_time_current,',
					'.iex_mpreview_vcontrols_seek_time_duration{color:#101010;text-shadow:0em 0.125em 0.125em #ffffff,0em 0.0625em 0.0625em #ffffff;}',

					'.iex_mpreview_vcontrols_volume_container_position{display:block;position:absolute;bottom:100%;right:0;margin-bottom:-0.5em;}',
					'.iex_mpreview_vcontrols_volume_container{width:2em;height:9em;position:relative;}',
					'.iex_mpreview_vcontrols_volume_container:not(.iex_mpreview_vcontrols_volume_container_visible):not(.iex_mpreview_vcontrols_volume_container_visible_important):not(.iex_mpreview_vcontrols_volume_container_visible_temp){display:none;}',
					'.iex_mpreview_vcontrols_volume_bar{position:absolute;left:0.5em;right:0.5em;top:0.5em;bottom:0.5em;border-radius:0.5em;overflow:hidden;cursor:pointer;border:1px solid rgba(0,0,0,0.5);}',
					'.iex_mpreview_vcontrols_volume_bar.iex_mpreview_vcontrols_no_border_radius{border-radius:0;}',
					'.iex_mpreview_vcontrols_volume_bar_bg{position:absolute;left:0;top:0;bottom:0;right:0;background-color:#ffffff;opacity:0.825;}',
					'.iex_mpreview_vcontrols_volume_bar_level{position:absolute;left:0;right:0;bottom:0;height:0;background-color:#ffbb50;}',

					'.iex_mpreview_vcontrols_button_container{display:table-cell;vertical-align:bottom;width:2em;}',
					'.iex_mpreview_vcontrols_button_container_inner{display:block;width:100%;height:2em;position:relative;}',
					'.iex_mpreview_vcontrols_button_container_inner2{display:block;position:absolute;left:0;top:0;bottom:0;right:0;}',
					'.iex_mpreview_vcontrols_button_mouse_controller{position:absolute;left:0;top:0;bottom:0;right:0;margin:0.4em;cursor:pointer;}',

					'.iex_mpreview_vcontrols_table.iex_mpreview_vcontrols_table_mini:not(.iex_mpreview_vcontrols_table_visible):not(.iex_mpreview_vcontrols_table_visible_temp):not(.iex_mpreview_vcontrols_table_visible_important)>.iex_mpreview_vcontrols_button_container{display:none;}',
					'.iex_mpreview_vcontrols_table.iex_mpreview_vcontrols_table_mini:not(.iex_mpreview_vcontrols_table_visible):not(.iex_mpreview_vcontrols_table_visible_temp):not(.iex_mpreview_vcontrols_table_visible_important)>.iex_mpreview_vcontrols_seek_container{min-width:0;}',
					'.iex_mpreview_vcontrols_table.iex_mpreview_vcontrols_table_mini:not(.iex_mpreview_vcontrols_table_visible):not(.iex_mpreview_vcontrols_table_visible_temp):not(.iex_mpreview_vcontrols_table_visible_important)>*>.iex_mpreview_vcontrols_seek_container_inner{height:0.125em;}',
					'.iex_mpreview_vcontrols_table.iex_mpreview_vcontrols_table_mini:not(.iex_mpreview_vcontrols_table_visible):not(.iex_mpreview_vcontrols_table_visible_temp):not(.iex_mpreview_vcontrols_table_visible_important)>*>*>.iex_mpreview_vcontrols_seek_bar{top:0;bottom:0;border-radius:0;border:0 hidden;}',
					'.iex_mpreview_vcontrols_table.iex_mpreview_vcontrols_table_mini:not(.iex_mpreview_vcontrols_table_visible):not(.iex_mpreview_vcontrols_table_visible_temp):not(.iex_mpreview_vcontrols_table_visible_important)>*>*>*>*>.iex_mpreview_vcontrols_seek_time_table{display:none;}',

					'.iex_svg_play_button{display:block;}',
					'.iex_svg_play_button.iex_svg_play_button_playing>.iex_svg_button_scale_group>.iex_svg_play_button_play_icon,',
					'.iex_svg_play_button.iex_svg_play_button_playing>.iex_svg_button_scale_group>.iex_svg_play_button_loop_icon,',
					'.iex_svg_play_button:not(.iex_svg_play_button_playing)>.iex_svg_button_scale_group>.iex_svg_play_button_pause_icon,',
					'.iex_svg_play_button:not(.iex_svg_play_button_playing).iex_svg_play_button_looping>.iex_svg_button_scale_group>.iex_svg_play_button_play_icon,',
					'.iex_svg_play_button:not(.iex_svg_play_button_playing):not(.iex_svg_play_button_looping)>.iex_svg_button_scale_group>.iex_svg_play_button_loop_icon{visibility:hidden;}',
					'.iex_svg_volume_button{display:block;}',
					'.iex_svg_volume_button.iex_svg_volume_button_muted>.iex_svg_button_scale_group>.iex_svg_volume_button_wave_big,',
					'.iex_svg_volume_button.iex_svg_volume_button_muted>.iex_svg_button_scale_group>.iex_svg_volume_button_wave_small,',
					'.iex_svg_volume_button:not(.iex_svg_volume_button_muted)>.iex_svg_button_scale_group>.iex_svg_volume_button_wave_mute_icon,',
					'.iex_svg_volume_button.iex_svg_volume_button_high>.iex_svg_button_scale_group>.iex_svg_volume_button_wave_small,',
					'.iex_svg_volume_button:not(.iex_svg_volume_button_medium)>.iex_svg_button_scale_group>.iex_svg_volume_button_wave_small,',
					'.iex_svg_volume_button:not(.iex_svg_volume_button_high)>.iex_svg_button_scale_group>.iex_svg_volume_button_wave_big{visibility:hidden;}',
					'.iex_svg_volume_button_wave_mute_icon{opacity:0.75;}',
					'.iex_svg_volume_button_wave_mute_icon_polygon{fill:#000000;}',
					'.iex_svg_button_fill{fill:rgba(255,255,255,0.825);stroke:rgba(0,0,0,0.5);stroke-width:1px;vector-effect:non-scaling-stroke;}',
					'.iex_mpreview_vcontrols_button_mouse_controller:hover+.iex_svg_play_button>.iex_svg_button_scale_group>.iex_svg_button_fill{fill:#44aaff;}',
					'.iex_mpreview_vcontrols_button_mouse_controller:hover+.iex_svg_volume_button>.iex_svg_button_scale_group>.iex_svg_button_fill{fill:#ff88aa;}',
					'.iex_mpreview_vcontrols_button_mouse_controller:hover+.iex_svg_volume_button>.iex_svg_button_scale_group>.iex_svg_volume_button_wave_mute_icon>.iex_svg_volume_button_wave_mute_icon_polygon{fill:#a00000;}',
				].join(""); //}


				// Append style
				this.stylesheet = document.createElement("style");
				this.stylesheet.innerHTML = stylesheet_text;
				ASAP.asap(on_insert_stylesheet.bind(this), on_insert_stylesheet_condition);
			},

			theme_detect: function () {
				// Theme detection
				var doc = document.documentElement,
					body = document.querySelector("body"),
					bg_colors, bg_color, e, i, j, a, a_inv;

				if (doc && body) {
					// Get background colors
					e = document.createElement("div");
					e.className = "post reply";

					bg_colors = [
						this.parse_css_color(this.get_true_style(doc, "backgroundColor")),
						this.parse_css_color(this.get_true_style(body, "backgroundColor")),
						this.parse_css_color(this.get_true_style(e, "backgroundColor")),
					];

					// Average
					bg_color = bg_colors[0];
					for (i = 1; i < bg_colors.length; ++i) {
						// Alphas
						a = bg_colors[i][3];
						a_inv = (1.0 - a) * bg_color[3];

						// Modify
						for (j = 0; j < 3; ++j) {
							bg_color[j] = (bg_color[j] * a_inv + bg_colors[i][j] * a);
						}
						bg_color[3] = Math.max(bg_color[3], a);
					}

					if (bg_color[3] > 0) {
						// Found
						return (bg_color[0] + bg_color[1] + bg_color[2] < (256 + 128)) ? "iex_dark" : "iex_light";
					}
				}

				// Not found
				return null;
			},
			theme_change: function (new_theme) {
				var theme_old = this.theme.trim(),
					theme_old_nodes, i, n;

				// No change
				if (theme_old == new_theme) return;

				// Update
				this.theme = " " + new_theme;

				// Replace themes
				theme_old_nodes = document.querySelectorAll("." + theme_old);
				for (i = 0; i < theme_old_nodes.length; ++i) {
					n = theme_old_nodes[i];
					this.remove_class(n, theme_old);
					n.className += this.theme;
				}
			},

			has_class: function (element, classname) {
				return (new RegExp("(\\s|^)" + classname + "(\\s|$)")).test(element.className);
			},
			add_class: function (element, classname) {
				if (element.classList) {
					element.classList.add(classname);
				}
				else {
					if (!(new RegExp("(\\s|^)" + classname + "(\\s|$)")).test(element.className)) {
						element.className = (element.className + " " + classname).trim();
					}
				}
			},
			remove_class: function (element, classname) {
				if (element.classList) {
					// classList
					element.classList.remove(classname);
				}
				else {
					// Regex
					var reg = new RegExp("(\\s|^)" + classname + "(\\s|$)", "g"),
						newCls = element.className.replace(reg, " ").trim();

					if (newCls != element.className) element.className = newCls;
				}
			},
			remove_classes: function (element, classnames) {
				// Split
				var i;
				classnames = classnames.split(" ");

				if (element.classList) {
					// classList
					for (i = 0; i < classnames.length; ++i) {
						element.classList.remove(classnames[i]);
					}
				}
				else {
					// Regex
					var newCls = element.className,
						reg;

					for (i = 0; i < classnames.length; ++i) {
						reg = new RegExp("(\\s|^)" + classnames[i] + "(\\s|$)", "g");
						newCls = newCls.replace(reg, " ").trim();
					}

					if (newCls != element.className) element.className = newCls;
				}
			},

			has_class_svg: function (element, classname) {
				return (new RegExp("(\\s|^)" + classname + "(\\s|$)")).test(element.getAttribute("class"));
			},
			add_class_svg: function (element, classname) {
				if (!(new RegExp("(\\s|^)" + classname + "(\\s|$)")).test(element.getAttribute("class"))) {
					element.setAttribute("class", (element.getAttribute("class") + " " + classname).trim());
				}
			},
			remove_class_svg: function (element, classname) {
				// Regex
				var reg = new RegExp("(\\s|^)" + classname + "(\\s|$)", "g"),
					oldCls = element.getAttribute("class"),
					newCls = oldCls.replace(reg, " ").trim();

				if (newCls != oldCls) element.setAttribute("class", newCls);
			},
			remove_classes_svg: function (element, classnames) {
				var oldCls = element.getAttribute("class"),
					newCls = oldCls,
					i, reg;

				// Split
				classnames = classnames.split(" ");

				for (i = 0; i < classnames.length; ++i) {
					reg = new RegExp("(\\s|^)" + classnames[i] + "(\\s|$)", "g");
					newCls = newCls.replace(reg, " ").trim();
				}

				if (newCls != oldCls) element.setAttribute("class", newCls);
			},
			change_classes_svg: function (element, classnames_add, classnames_remove) {
				var oldCls = element.getAttribute("class"),
					newCls = oldCls,
					i, reg;

				// Add classes
				if (classnames_add) {
					classnames_add = classnames_add.split(" ");
					for (i = 0; i < classnames_add.length; ++i) {
						reg = new RegExp("(\\s|^)" + classnames_add[i] + "(\\s|$)");
						if (!reg.test(newCls)) {
							newCls += " " + classnames_add[i];
						}
					}
				}

				// Remove classes
				if (classnames_remove) {
					classnames_remove = classnames_remove.split(" ");
					for (i = 0; i < classnames_remove.length; ++i) {
						reg = new RegExp("(\\s|^)" + classnames_remove[i] + "(\\s|$)", "g");
						newCls = newCls.replace(reg, " ");
					}
				}

				// Update class
				if ((newCls = newCls.trim()) != oldCls) {
					element.setAttribute("class", newCls);
				}
			},

			get_true_style_of_class: function (class_name, style_name, tag_name, parent_node) {
				var e = document.createElement(tag_name || "div"),
					s, v;

				// Set class
				e.className = class_name;

				// Add
				if (parent_node || (parent_node = document.querySelector("body"))) {
					parent_node.appendChild(e);
					s = window.getComputedStyle(e);
					v = style_name ? s[style_name] : s;
					parent_node.removeChild(e);
				}
				else {
					s = window.getComputedStyle(e);
				}

				// Return style
				return v;
			},
			get_true_style: function (element, style_name) {
				var s = window.getComputedStyle(element);
				return style_name ? s[style_name] : s;
			},

			parse_css_color: function (color) {
				if (/transparent/.test(color)) return [ 0 , 0 , 0 , 0 ];

				var m;
				if ((m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(color))) {
					return [
						parseInt(m[1], 16),
						parseInt(m[2], 16),
						parseInt(m[3], 16),
						1
					];
				}
				else if ((m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(color))) {
					return [
						Math.floor((parseInt(m[1], 16) * 255.0) / 0xF + 0.5),
						Math.floor((parseInt(m[2], 16) * 255.0) / 0xF + 0.5),
						Math.floor((parseInt(m[3], 16) * 255.0) / 0xF + 0.5),
						1
					];
				}
				else if ((m = /^rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)$/.exec(color))) {
					return [
						parseInt(m[1], 10),
						parseInt(m[2], 10),
						parseInt(m[3], 10),
						1
					];
				}
				else if ((m = /^rgba\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9\.]+)\s*\)$/.exec(color))) {
					return [
						parseInt(m[1], 10),
						parseInt(m[2], 10),
						parseInt(m[3], 10),
						parseFloat(m[4])
					];
				}
				else {
					// Default
					return [ 0 , 0 , 0 , 0 ];
				}
			},
			color_to_css: function (color) {
				return "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + color[3] + ")";
			},

			get_window_rect: function () {
				var doc = document.documentElement,
					left = (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0),
					top = (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0);

				return {
					left: left,
					top: top,
					right: left + (window.innerWidth || doc.clientWidth || 0),
					bottom: top + (window.innerHeight || doc.clientHeight || 0),
				};
			},
			get_document_rect: function () {
				var doc = document.documentElement,
					left = (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0),
					top = (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0);

				return {
					left: left,
					top: top,
					right: left + (doc.clientWidth || window.innerWidth || 0),
					bottom: top + (doc.clientHeight || window.innerHeight || 0),
				};
			},
			get_document_offset: function () {
				var doc = document.documentElement;

				return {
					left: (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0),
					top: (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0),
				};
			},
			get_object_rect: function (obj) {
				var bounds = obj.getBoundingClientRect(),
					doc = document.documentElement,
					left = (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0),
					top = (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0);

				return {
					left: left + bounds.left,
					top: top + bounds.top,
					right: left + bounds.right,
					bottom: top + bounds.bottom,
				};
			},
			get_object_rect_inner: function (obj) {
				// Document scroll offset
				var doc = document.documentElement,
					left = (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0),
					top = (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0),
					bounds0, bounds1, bounds2, b1_w, b1_h;

				// Measure bounds with and without paddings
				bounds0 = obj.getBoundingClientRect();
				this.add_class(obj, "iex_no_padding_br");
				bounds1 = obj.getBoundingClientRect();
				this.add_class(obj, "iex_no_padding_tl");
				bounds2 = obj.getBoundingClientRect();
				this.remove_classes(obj, "iex_no_padding_br iex_no_padding_tl");

				b1_w = bounds1.right - bounds1.left;
				b1_h = bounds1.bottom - bounds1.top;

				return {
					left: left + bounds1.left + (b1_w - (bounds2.right - bounds2.left)),
					top: top + bounds1.top + (b1_h - (bounds2.bottom - bounds2.top)),
					right: left + bounds0.right + (b1_w - (bounds0.right - bounds0.left)),
					bottom: top + bounds0.bottom + (b1_h - (bounds0.bottom - bounds0.top)),
				};
			},

		};



		return Style;

	})();

	// Class to manage hotkey interactions
	var HotkeyManager = (function () {

		// Hotkey registration class
		var Hotkey = function (key, keyCode, modifiers, callback) {
			this.key = key;
			this.keyCode = keyCode;
			this.modifiers = modifiers;
			this.callback = callback;
		};


		// Setup key conversions
		var key_conversions = {
			"backspace": 8,
			"tab": 9,
			"enter": 13,
			"shift": 16,
			"ctrl": 17,
			"alt": 18,
			"pause": 19,
			"capslock": 20,
			"esc": 27,
			"space": 32,
			"page up": 33,
			"page down": 34,
			"end": 35,
			"home": 36,
			"left": 37,
			"up": 38,
			"right": 39,
			"down": 40,
			"insert": 45,
			"delete": 46,
			",": 188,
			".": 190,
			"/": 191,
			"`": 192,
			"[": 219,
			"\\": 220,
			"]": 221,
			"'": 222,
			";": (is_firefox || is_opera ? 59 : 186),
			"=": (is_firefox ? 107 : (is_opera ? 61 : 187)),
			"-": (is_firefox || is_opera ? 109 : 189),
			"numpad0": 96,
			"numpad1": 97,
			"numpad2": 98,
			"numpad3": 99,
			"numpad4": 100,
			"numpad5": 101,
			"numpad6": 102,
			"numpad7": 103,
			"numpad8": 104,
			"numpad9": 105,
			"numpad*": 106,
			"numpad+": 107,
			"numpad-": 109,
			"numpad.": 110,
			"numpad/": 111,
		};

		var i, iEnd, iDiff;
		for (i = "a".charCodeAt(0), iEnd = "z".charCodeAt(0), iDiff = (i - "A".charCodeAt(0)); i <= iEnd; ++i) {
			key_conversions[String.fromCharCode(i)] = i - iDiff;
		}
		for (i = "0".charCodeAt(0), iEnd = "9".charCodeAt(0); i <= iEnd; ++i) {
			key_conversions[String.fromCharCode(i)] = i;
		}
		for (i = 112; i <= 123; ++i) {
			key_conversions["f" + (i - 112)] = i;
		}


		// Constructor
		var HotkeyManager = function () {
			// Event
			document.addEventListener("keydown", this.on_window_keydown_bound = this.on_window_keydown.bind(this), false);

			// Registrations
			this.registrations = {};
		};

		// Static values
		HotkeyManager.instance = null;
		HotkeyManager.MODIFIER_NONE = 0;
		HotkeyManager.MODIFIER_SHIFT = 1;
		HotkeyManager.MODIFIER_CTRL = 2;
		HotkeyManager.MODIFIER_ALT = 4;
		HotkeyManager.MODIFIER_TYPING = 8;

		// Public functions
		HotkeyManager.prototype = {
			constructor: HotkeyManager,

			/**
				Destroy any events and/or data created by the instance that will not be necessary
				after this object is no longer used.
			*/
			destroy: function () {
				// Remove event listener
				document.removeEventListener("keydown", this.on_window_keydown_bound, false);

				// Remove registrations
				this.registrations = {};
			},

			/**
				Convert a string-based key to an integer key code.

				@param key
					The string representing a key
					This should be lowercase
				@return
					An integer value representing the key, or 0 if not found
			*/
			key_to_keycode: function (key) {
				// Convert the key
				if (key in key_conversions) {
					return key_conversions[key];
				}
				else {
					log_error(
						"Invalid use of HotkeyManager.key_to_keycode\n" +
						"Make sure you're using a valid key (lowercase; check key_conversions)"
					);
					return 0;
				}
			},

			/**
				Register a hotkey event.

				@param key
					The key to use, as a lowercase string. If the string contains a non-alphabetic character,
					use whichever symbol is on the key with the shift key NOT held.
					Check key_conversions for any other issues.
				@param [modifiers]
					Bitflags of which key modifiers are required. Available values are:
						HotkeyManager.MODIFIER_NONE
						HotkeyManager.MODIFIER_SHIFT
						HotkeyManager.MODIFIER_CTRL
						HotkeyManager.MODIFIER_ALT
						HotkeyManager.MODIFIER_TYPING
					Optional parameter
				@param callback
					A callback function, which will be called using:
						callback.call(HotkeyManager.instance, keydown_event, hotkey_instance)
					If the callback function returns false, no other hotkeys registered for this key
					will recieve the event.
					The default action of the event can be canceled with:
						event.preventDefault()
						event.stopPropagation()
				@return
					An object describing the registered hotkey.
					This value can be passed to the unregister function to remove the hotkey.
			*/
			register: function (key, modifiers, callback) {
				// Argument shifting
				if (arguments.length < 3) {
					modifiers = 0;
					callback = arguments[1];
				}

				// Get key code
				var keyCode = this.key_to_keycode(key);

				// Create registration
				var reg = new Hotkey(key, keyCode, modifiers, callback);

				// Add to or create a list
				if (keyCode in this.registrations) {
					this.registrations[keyCode].push(reg);
				}
				else {
					this.registrations[keyCode] = [ reg ];
				}

				// Return
				return reg;
			},
			/**
				Unregister a hotkey event.

				@param hotkey
					The hotkey registration value returned from calling the register function.
				@return
					true if the hotkey was removed,
					false if it was not found (maybe already removed)
			*/
			unregister: function (hotkey) {
				if (hotkey.keyCode in this.registrations) {
					var list = this.registrations[hotkey.keyCode];
					for (var i = 0; i < list.length; ++i) {
						if (list[i] === hotkey) {
							// Successfully unregistered
							list.splice(i, 1);
							if (list.length === 0) {
								// Remove if empty
								delete this.registrations[hotkey.keyCode];
							}
							return true;
						}
					}
				}

				// Not found
				return false;
			},

			/**
				The event handler for the document.onkeydown event.
				This will propagate the event to any hotkeys if necessary.

				@param event
					The event event passed in
			*/
			on_window_keydown: function (event) {
				// Key and modifiers
				var key = event.which || event.keyCode || (event = window.event).keyCode;

				// Check
				if (key in this.registrations) {
					// Get modifiers
					var modifiers = (event.shiftKey ? 1 : 0) | (event.ctrlKey ? 2 : 0) | (event.altKey ? 4 : 0);

					// Check if typing
					var t = document.activeElement;
					if (t) {
						t = t.tagName;
						if (t == "INPUT" || t == "TEXTAREA") {
							modifiers |= 8;
						}
					}

					// Get registration list
					var list = this.registrations[key];
					for (var i = 0; i < list.length; ++i) {
						// Check modifiers
						if (modifiers === list[i].modifiers) {
							// Callback
							if (list[i].callback.call(this, event, list[i]) === false) {
								break;
							}
						}
					}
				}
			}
		};

		// Return the class
		return HotkeyManager;

	})();

	// Class to re-linkify file links
	var FileLink = (function () {

		var FileLink = function () {
			// Enabled
			this.enabled = false;
			this.disabled = false;
			this.post_queue = null;

			// Binds
			this.on_api_post_add_bind = on_api_post_add.bind(this);
			this.on_api_post_remove_bind = on_api_post_remove.bind(this);
		};



		var modify_post_container = function (post_container) {
			// Find file
			var file_nodes = api.post_get_file_nodes(post_container),
				file_info, href;

			if (
				file_nodes &&
				(file_info = api.post_get_file_info(post_container)).name
			) {
				// Modify hrefs
				if (file_nodes.link !== null) {
					modify_href.call(this, file_nodes.link, file_info.name);
				}
				if (file_nodes.link_thumbnail !== null) {
					modify_href.call(this, file_nodes.link_thumbnail, file_info.name);
				}
			}
		};
		var modify_href = function (node, filename) {
			var href = node.getAttribute("href");
			if (href !== null) {
				href = href.replace(/#.*/, "") + "#!" + this.escape(filename);
				node.setAttribute("href", href);
			}
		};

		var on_api_post_add = function (post_container) {
			// Queue add hooks
			this.post_queue.push(post_container);
		};
		var on_api_post_remove = function (post_container) {
			// Nothing
		};

		var on_post_queue_callback = function (post_container) {
			// Add hooks
			modify_post_container.call(this, post_container);
		};



		FileLink.prototype = {
			constructor: FileLink,

			destroy: function () {
				// Remove api events
				api.off("post_add", this.on_api_post_add_bind);
				api.off("post_remove", this.on_api_post_remove_bind);
			},

			start: function () {
				// Enable if settings allow it
				if (settings.values.file_linkification.enabled) {
					this.enable();
				}
			},
			enable: function () {
				// Enable
				if (this.enabled) return;
				this.enabled = true;

				// Get posts
				this.post_queue = Delay.queue(api.get("posts"), on_post_queue_callback.bind(this), 50, 0.25);

				// Bind post acquiring
				api.on("post_add", this.on_api_post_add_bind);
				api.on("post_remove", this.on_api_post_remove_bind);
			},
			disable: function () {
				// Not enabled or already disabled
				if (!this.enabled || this.disabled) return;

				// Disable
				this.disabled = true;
			},

			escape: function (s) {
				return encodeURIComponent(s).replace(/\%20/g, "+");
			},
			unescape: function (s) {
				return decodeURIComponent(s.replace(/\+/g, "%20"));
			},

		};



		return FileLink;

	})();

	// Class to manage files in a separate window
	var FileView = (function () {

		var FileView = function () {
		};



		FileView.prototype = {
			constructor: FileView,

			start: function () {
				// Auto-loop .webm's
				var video = document.body.querySelector("video");

				if (video) video.loop = true;
			},
		};



		return FileView;

	})();

	// Hover container control
	var Hover = (function () {

		var Hover = function () {
			this.container = null;
		};



		var on_asap = function () {
			var body = document.querySelector("body"),
				theme = style.theme;

			// Parent
			if (body) {
				// Create floating container
				this.container = document.createElement("div");
				this.container.className = "iex_floating_container" + theme;

				// Append
				body.appendChild(this.container);
			}
		};
		var on_asap_condition = function () {
			return document.querySelector("body");
		};



		Hover.prototype = {
			constructor: Hover,

			destroy: function () {
				// Remove container
				var par = this.container.parentNode;
				if (par) par.removeChild(this.container);
			},

			start: function () {
				// Setup
				ASAP.asap(on_asap.bind(this), on_asap_condition);
			},

		};



		return Hover;

	})();

	// Image hover control
	var ImageHover = (function () {

		var ImageHover = function (hover) {
			// Preview object
			this.mpreview = null;

			// Enabled
			this.enabled = false;
			this.disabled = false;
			this.current_image_container = null;
			this.current_hover_container = null;

			// Post queue
			this.post_queue = null;

			// Extension settings
			this.extensions_valid = {
				".jpg": {
					ext: "jpg",
					mime: "image/jpeg",
					type: "image",
				},
				".jpeg": {
					ext: "jpg",
					mime: "image/jpeg",
					type: "image",
				},
				".png": {
					ext: "png",
					mime: "image/png",
					type: "image",
				},
				".gif": {
					ext: "gif",
					mime: "image/gif",
					type: "image",
				},
				".webm": {
					ext: "webm",
					mime: "video/webm",
					type: "video",
				},
			};

			// Parent node
			this.hover = hover;
			this.connector = null;

			// Open and closing timers
			this.preview_open_timer = null;
			this.preview_close_timer = null;
			this.zoom_borders_hide_timer = null;
			this.mouse_hide_timer = null;

			// Event bindings
			this.on_image_mouseenter_bind = wrap_mouseenterleave_event(this, on_image_mouseenter);
			this.on_image_mouseleave_bind = wrap_mouseenterleave_event(this, on_image_mouseleave);
			this.on_image_connector_mouseenter_bind = wrap_mouseenterleave_event(this, on_image_connector_mouseenter);
			this.on_image_connector_mouseleave_bind = wrap_mouseenterleave_event(this, on_image_connector_mouseleave);

			this.on_image_click_bind = wrap_generic_event(this, on_image_click);

			// More bindings
			this.on_preview_close_timeout_bind = on_preview_close_timeout.bind(this);
			this.on_preview_zoom_borders_hide_timeout_bind = on_preview_zoom_borders_hide_timeout.bind(this);
			this.on_preview_mouse_hide_timeout_bind = on_preview_mouse_hide_timeout.bind(this);

			this.on_preview_image_load_bind = on_preview_image_load.bind(this);
			this.on_preview_image_error_bind = on_preview_image_error.bind(this);

			this.on_preview_video_ready_bind = on_preview_video_ready.bind(this);
			this.on_preview_video_can_play_bind = on_preview_video_can_play.bind(this);
			this.on_preview_video_can_play_through_bind = on_preview_video_can_play_through.bind(this);
			this.on_preview_video_load_bind = on_preview_video_load.bind(this);
			this.on_preview_video_error_bind = on_preview_video_error.bind(this);
			//this.on_preview_video_volume_change_bind = on_preview_video_volume_change.bind(this);

			this.on_preview_size_change_bind = on_preview_size_change.bind(this);

			this.on_preview_mouse_wheel_bind = on_preview_mouse_wheel.bind(this);
			this.on_preview_mouse_enter_bind = on_preview_mouse_enter.bind(this);
			this.on_preview_mouse_leave_bind = on_preview_mouse_leave.bind(this);
			this.on_preview_mouse_down_bind = on_preview_mouse_down.bind(this);
			this.on_preview_mouse_move_bind = on_preview_mouse_move.bind(this);
			this.on_preview_mouse_enter_main_bind = on_preview_mouse_enter_main.bind(this);

			this.on_preview_stats_zoom_control_click_bind = on_preview_stats_zoom_control_click.bind(this);

			this.on_image_connector_mousedown_bind = on_image_connector_mousedown.bind(this);

			this.on_window_resize_bind = on_window_resize.bind(this);
			this.on_window_scroll_bind = on_window_scroll.bind(this);

			this.on_api_post_add_bind = on_api_post_add.bind(this);
			this.on_api_post_remove_bind = on_api_post_remove.bind(this);
			this.on_api_image_hover_open_bind = on_api_image_hover_open.bind(this);

			// Callbacks
			this.on_settings_value_change_bind = on_settings_value_change.bind(this);
			settings.on_change(["image_expansion", "hover", "zoom_invert"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "zoom_borders_show"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "zoom_borders_hide_time"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "zoom_buttons"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "mouse_hide"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "mouse_hide_time"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "header_overlap"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "fit_large_allowed"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "display_stats"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "video", "autoplay"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "video", "loop"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "video", "mute_initially"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "video", "volume"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "video", "mini_controls"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "video", "expand_state_save"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "style", "controls_rounded_border"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "style", "animations_background"], this.on_settings_value_change_bind);

			// Settings
			this.hotkeys = null;
			this.mouse_x = 0;
			this.mouse_y = 0;
			this.paddings_active = false;
			this.display_window_max = {
				x: 0,
				y: 0,
				width: 0,
				height: 0,
			};
			this.settings = {
				fit_large_allowed: true,
				display_stats: 0, // 0: all, 1: some, 2: none
				zoom_limits: {
					increase: 2.0,
					decrease: 2.0,
					min: 1.0,
					max: 32.0,
				},
				zoom_margins: {
					horizontal: 0.1,
					vertical: 0.1
				},
				zoom_invert: false,
				zoom_borders_show: true,
				zoom_borders_hide_time: 500,
				zoom_buttons: true,
				mouse_hide: true,
				mouse_hide_time: 1000,
				padding_extra: {
					left: 10,
					top: 10,
					right: 10,
					bottom: 10
				},
				header_overlap: false,
				region_paddings: {
					left: 20,
					top: 20,
					right: 20,
					bottom: 20
				},
				video: {
					autoplay: 1, // 0 = not at all, 1 = asap, 2 = when it can play "through", 3 = fully loaded
					loop: true,
					mute_initially: false,
					volume: 0.5,
					mini_controls: 1, // 0 = never, 1 = when mouse is over the video, 2 = when mouse is NOT over the video, 3 = always
					expand_state_save: true
				},
				style: {
					controls_rounded_border: true,
					animations_background: true,
				},
			};
		};



		var log2 = function (x) {
			return Math.log(x) / Math.LN2;
		};

		var add_post_container_callbacks = function (post_container) {
			// Find file
			var image_container = api.post_get_image_container(post_container);
			if (image_container) {
				// Add mouseover/mouseout/click listeners
				image_container.addEventListener("mouseover", this.on_image_mouseenter_bind, false);
				image_container.addEventListener("mouseout", this.on_image_mouseleave_bind, false);
				image_container.addEventListener("click", this.on_image_click_bind, false);
			}
		};
		var remove_post_container_callbacks = function (post_container) {
			// Find file
			var image_container = api.post_get_image_container(post_container);
			if (image_container) {
				// Remove listeners
				image_container.removeEventListener("mouseover", this.on_image_mouseenter_bind, false);
				image_container.removeEventListener("mouseout", this.on_image_mouseleave_bind, false);
				image_container.removeEventListener("click", this.on_image_click_bind, false);
			}
		};

		var preview_open_test = function (image_container, post_container, obey_timer) {
			// Don't open if same
			if (this.current_image_container === image_container) {
				this.preview_close_cancel();
				return;
			}

			// Get info
			if (post_container === null) post_container = api.post_get_post_container_from_image_container(image_container);
			var post_info = api.post_get_file_info(post_container);
			if (!post_info.url) return;

			// Don't open if expanded
			if (api.post_is_image_expanded_or_expanding(post_container)) return;

			// Spoiler check
			var val_check = (post_info.spoiler === null) ? settings.values.image_expansion.normal : settings.values.image_expansion.spoiler;
			if (!val_check.enabled) return;

			// Extension check
			var ext = /\.[^\.]+$/.exec(post_info.url);
			ext = ext ? ext[0].toLowerCase() : "";
			if (!(ext in this.extensions_valid)) return;

			// Open preview
			var time = val_check.timeout;
			if (time === 0 || !obey_timer) {
				this.preview_open(image_container, post_info, val_check.to_fit);
			}
			else {
				if (this.preview_open_timer !== null) {
					clearTimeout(this.preview_open_timer);
				}
				this.preview_open_timer = setTimeout(on_preview_open_timeout.bind(this, image_container, post_info, val_check.to_fit), time * 1000);
			}
		};

		var preview_create = function () {
			var zoom_margins = this.settings.zoom_margins;

			// Create new
			this.mpreview = new MediaPreview();

			// Setup size
			this.mpreview.set_view_borders(zoom_margins.horizontal, zoom_margins.vertical);

			// Hook events
			this.mpreview.on("image_load", this.on_preview_image_load_bind);
			this.mpreview.on("image_error", this.on_preview_image_error_bind);

			this.mpreview.on("video_ready", this.on_preview_video_ready_bind);
			this.mpreview.on("video_can_play", this.on_preview_video_can_play_bind);
			this.mpreview.on("video_can_play_through", this.on_preview_video_can_play_through_bind);
			this.mpreview.on("video_load", this.on_preview_video_load_bind);
			this.mpreview.on("video_error", this.on_preview_video_error_bind);
			//this.mpreview.on("video_volume_change", this.on_preview_video_volume_change_bind);

			this.mpreview.on("size_change", this.on_preview_size_change_bind);

			this.mpreview.on("mouse_wheel", this.on_preview_mouse_wheel_bind);
			this.mpreview.on("mouse_enter", this.on_preview_mouse_enter_bind);
			this.mpreview.on("mouse_leave", this.on_preview_mouse_leave_bind);
			this.mpreview.on("mouse_down", this.on_preview_mouse_down_bind);
			this.mpreview.on("mouse_move", this.on_preview_mouse_move_bind);
			this.mpreview.on("mouse_enter_main", this.on_preview_mouse_enter_main_bind);

			this.mpreview.on("stats_zoom_control_click", this.on_preview_stats_zoom_control_click_bind);

			window.addEventListener("resize", this.on_window_resize_bind, false);
			window.addEventListener("scroll", this.on_window_scroll_bind, false);

			// Add
			this.mpreview.add_to(this.hover.container);
		};
		var preview_detach = function (destroy) {
			if (this.mpreview === null) return;

			// Unhook events
			this.mpreview.off("image_load", this.off_preview_image_load_bind);
			this.mpreview.off("image_error", this.off_preview_image_error_bind);

			this.mpreview.off("video_ready", this.off_preview_video_ready_bind);
			this.mpreview.off("video_can_play", this.off_preview_video_can_play_bind);
			this.mpreview.off("video_can_play_through", this.off_preview_video_can_play_through_bind);
			this.mpreview.off("video_load", this.off_preview_video_load_bind);
			this.mpreview.off("video_error", this.off_preview_video_error_bind);
			this.mpreview.off("video_volume_change", this.off_preview_video_volume_change_bind);

			this.mpreview.off("size_change", this.off_preview_size_change_bind);

			this.mpreview.off("mouse_wheel", this.off_preview_mouse_wheel_bind);
			this.mpreview.off("mouse_enter", this.off_preview_mouse_enter_bind);
			this.mpreview.off("mouse_leave", this.off_preview_mouse_leave_bind);
			this.mpreview.off("mouse_down", this.off_preview_mouse_down_bind);
			this.mpreview.off("mouse_move", this.off_preview_mouse_move_bind);
			this.mpreview.off("mouse_enter_main", this.off_preview_mouse_enter_main_bind);

			this.mpreview.off("stats_zoom_control_click", this.off_preview_stats_zoom_control_click_bind);

			window.removeEventListener("resize", this.on_window_resize_bind, false);
			window.removeEventListener("scroll", this.on_window_scroll_bind, false);

			// Nullify
			if (destroy) this.mpreview.destroy();
			this.mpreview = null;
		};

		var change_zoom_level = function (delta) {
			// Update zoom
			var set = this.settings,
				size_update = false,
				zoom_limits = set.zoom_limits,
				img_size = this.mpreview.size,
				disp_size = this.mpreview.get_window(),
				disp_size_max = this.display_window_max,
				zoom = this.mpreview.zoom,
				fit = this.mpreview.fit,
				fit_large = this.mpreview.fit_large,
				fit_large_allowed = set.fit_large_allowed,
				z, w_scale, h_scale, z_scale, scale;

			if (delta > 0) {
				// Larger
				if (fit) {
					if (fit_large || !fit_large_allowed) {
						// Zoom in
						z = zoom * zoom_limits.increase;
						if (z > zoom_limits.max) z = zoom_limits.max;
						if (zoom != z) {
							// Update
							zoom = z;
							size_update = true;
						}
					}
					else {
						// Zoom in
						w_scale = disp_size_max.width / img_size.width;
						h_scale = disp_size_max.height / img_size.height;
						z_scale = (w_scale < h_scale) ? w_scale : h_scale;

						z = zoom * zoom_limits.increase;

						w_scale = disp_size_max.width / (img_size.width * z * z_scale);
						h_scale = disp_size_max.height / (img_size.height * z * z_scale);

						if (w_scale <= 1.0 && h_scale <= 1.0) {
							// Fit large
							fit_large = true;
							zoom = 1.0;
						}
						else {
							// Not fit large
							zoom = z;
						}

						// Update
						size_update = true;
					}
				}
				else {
					// Zoom in
					z = zoom * zoom_limits.increase;
					w_scale = disp_size_max.width / (img_size.width * z);
					h_scale = disp_size_max.height / (img_size.height * z);

					if (w_scale <= 1.0 || h_scale <= 1.0) {
						// Fit
						fit = true;
						fit_large = (Math.abs(w_scale - h_scale) < 1e-5) && fit_large_allowed;
						zoom = 1.0;
					}
					else {
						// Not fit
						zoom = z;
					}

					// Update
					size_update = true;
				}
			}
			else if (delta < 0) {
				// Smaller
				if (fit) {
					if (zoom == 1.0) {
						if (fit_large) {
							// Switch to normal fit
							w_scale = disp_size_max.width / img_size.width;
							h_scale = disp_size_max.height / img_size.height;
							z_scale = (w_scale < h_scale) ? w_scale : h_scale;

							w_scale = disp_size_max.width / (img_size.width * z_scale);
							h_scale = disp_size_max.height / (img_size.height * z_scale);
							scale = (w_scale > h_scale) ? w_scale : h_scale;
							scale = Math.pow(2, Math.floor(log2(scale)));

							fit_large = false;
							zoom = scale;
							size_update = true;
						}
						else {
							// Stop fitting if possible
							w_scale = disp_size_max.width / img_size.width;
							h_scale = disp_size_max.height / img_size.height;

							if (w_scale > 1.0 && h_scale > 1.0) {
								// Calculate new zoom
								scale = (w_scale < h_scale) ? w_scale : h_scale;
								scale = Math.pow(2, Math.floor(log2(scale)));

								// Update
								fit = false;
								fit_large = false;
								zoom = scale;
								size_update = true;
							}
						}
					}
					else {
						// Zoom out
						zoom /= zoom_limits.decrease;
						if (zoom < 1.0) zoom = 1.0;

						// Update
						size_update = true;
					}
				}
				else {
					// Zoom out
					z = zoom / zoom_limits.decrease;
					if (z < zoom_limits.min) z = zoom_limits.min;

					if (zoom != z) {
						// Update
						zoom = z;
						size_update = true;
					}
				}
			}

			// Update
			if (size_update) {
				// Update
				this.mpreview.set_zoom(zoom, fit, fit_large);
				this.preview_update(true, false, false);
				update_zoom_offset.call(this);
			}
		};
		var change_zoom_borders_visibility = function (visible) {
			this.mpreview.set_view_borders_visible(visible);
			if (visible) {
				if (this.zoom_borders_hide_timer !== null) clearTimeout(this.zoom_borders_hide_timer);
				this.zoom_borders_hide_timer = setTimeout(this.on_preview_zoom_borders_hide_timeout_bind, this.settings.zoom_borders_hide_time);
			}
		};
		var change_mouse_visibility = function (visible) {
			this.mpreview.set_mouse_visible(visible);
			if (visible && this.settings.mouse_hide) {
				if (this.mouse_hide_timer !== null) clearTimeout(this.mouse_hide_timer);
				this.mouse_hide_timer = setTimeout(this.on_preview_mouse_hide_timeout_bind, this.settings.mouse_hide_time);
			}
		};

		var update_zoom_offset = function () {
			// Change zoom offset
			var rect = this.mpreview.get_inner_rect(),
				r_w = (rect.right - rect.left),
				r_h = (rect.bottom - rect.top),
				zoom_margins = this.settings.zoom_margins,
				x = (this.mouse_x - (rect.left + zoom_margins.horizontal * r_w)) / (r_w * (1.0 - 2.0 * zoom_margins.horizontal)),
				y = (this.mouse_y - (rect.top + zoom_margins.vertical * r_h)) / (r_h * (1.0 - 2.0 * zoom_margins.vertical));

			if (x < 0) x = 0;
			else if (x > 1) x = 1;
			if (y < 0) y = 0;
			else if (y > 1) y = 1;

			if (this.settings.zoom_invert) {
				x = 1.0 - x;
				y = 1.0 - y;
			}

			this.mpreview.set_offset(x, y);
		};


		var on_asap = function () {
			var body = document.querySelector("body"),
				theme = style.theme;

			// Parent
			if (body) {
				// Create connector
				this.connector = document.createElement("div");
				this.connector.className = "iex_floating_image_connector" + theme;
				this.connector.addEventListener("mouseover", this.on_image_connector_mouseenter_bind, false);
				this.connector.addEventListener("mouseout", this.on_image_connector_mouseleave_bind, false);
				this.connector.addEventListener("mousedown", this.on_image_connector_mousedown_bind, false);
				this.hover.container.appendChild(this.connector);
			}
		};
		var on_asap_condition = function () {
			return document.querySelector("body");
		};

		var on_post_queue_callback = function (post_container) {
			// Add hooks
			add_post_container_callbacks.call(this, post_container);
		};

		var on_preview_image_load = function (event) {
			// Hide fallback
			this.mpreview.set_background_style(0);
		};
		var on_preview_image_error = function (event) {
			// Display fallback
			this.mpreview.set_background_style(2);

			// Show error
			this.mpreview.set_stat_status(true, event.reason, "error");
		};

		var on_preview_video_ready = function (event) {
			// Hide fallback
			this.mpreview.set_background_style(0);
		};
		var on_preview_video_can_play = function (event) {
			// Auto-play
			if (this.settings.video.autoplay == 1 && !this.mpreview.video_interacted()) {
				this.mpreview.set_video_paused(false);
			}
		};
		var on_preview_video_can_play_through = function (event) {
			// Auto-play
			if (this.settings.video.autoplay == 2 && !this.mpreview.video_interacted()) {
				this.mpreview.set_video_paused(false);
			}
		};
		var on_preview_video_load = function (event) {
			// Auto-play
			if (this.settings.video.autoplay == 3 && !this.mpreview.video_interacted()) {
				this.mpreview.set_video_paused(false);
			}
		};
		var on_preview_video_error = function (event) {
			// Display fallback
			this.mpreview.set_background_style(2);

			// Show error
			this.mpreview.set_stat_status(true, event.reason, "error");
		};
		var on_preview_video_volume_change = function (event) {
			// Save volume changes
			if (event.reason == "seek") {
				settings.change_value(["image_expansion", "video", "volume"], event.volume);
				settings.save_values();
			}
		};

		var on_preview_size_change = function (event) {
			// Update size
			this.mpreview.set_size(event.width, event.height, true);
			this.mpreview.set_stat_resolution(undefined, event.width + "x" + event.height);

			// Reposition
			this.preview_update(false, false, false);
		};

		var on_preview_mouse_wheel = function (event) {
			if (event.mode === 0) {
				// Zoom
				change_zoom_level.call(this, event.delta);
				if (this.settings.zoom_borders_show) change_zoom_borders_visibility.call(this, true);
			}
			else { // if (event.mode === 1) {
				// Change volume
				if (this.mpreview.get_type() === MediaPreview.TYPE_VIDEO) {
					// New volume
					var v = this.mpreview.get_video_volume() + (event.delta * 5.0 / 100.0);

					// Bound
					if (v < 0.0) v = 0.0;
					else if (v > 1.0) v = 1.0;

					// Update
					this.mpreview.set_video_volume(v);
					if (this.mpreview.get_video_muted()) {
						this.mpreview.set_video_muted(false);
					}
					this.mpreview.set_show_volume_controls_temp(true, 0.5);
				}
			}
			change_mouse_visibility.call(this, true);
		};
		var on_preview_mouse_enter = function (event) {
			// Cancel close
			this.preview_close_cancel();
			change_mouse_visibility.call(this, true);

			// Mini controls
			var mc = this.settings.video.mini_controls;
			if (mc < 3) this.mpreview.set_vcontrols_mini_visible(mc == 1);
		};
		var on_preview_mouse_leave = function (event) {
			// Delay close
			this.preview_close(false);

			// Mini controls
			var mc = this.settings.video.mini_controls;
			if (mc < 3) this.mpreview.set_vcontrols_mini_visible(mc == 2);
		};
		var on_preview_mouse_down = function (event) {
			// Close
			this.preview_close(true);
		};
		var on_preview_mouse_move = function (event) {
			// Change zoom offset
			this.mouse_x = event.x;
			this.mouse_y = event.y;
			update_zoom_offset.call(this);
			if (this.settings.zoom_borders_show) change_zoom_borders_visibility.call(this, true);
			change_mouse_visibility.call(this, true);
		};
		var on_preview_mouse_enter_main = function (event) {
			// Hide paddings
			if (this.paddings_active) {
				this.paddings_active = false;
				this.mpreview.clear_paddings();
			}
		};

		var on_preview_stats_zoom_control_click = function (event) {
			// Zoom in/out
			change_zoom_level.call(this, event.delta);
		};

		var on_preview_open_timeout = function (image_container, post_info, auto_fit) {
			// Nullify timer
			this.preview_open_timer = null;
			// Close
			this.preview_open(image_container, post_info, auto_fit);
		};
		var on_preview_close_timeout = function () {
			// Nullify timer
			this.preview_close_timer = null;
			// Close
			this.preview_close(true);
		};
		var on_preview_zoom_borders_hide_timeout = function () {
			this.zoom_borders_hide_timer = null;
			change_zoom_borders_visibility.call(this, false);
		};
		var on_preview_mouse_hide_timeout = function () {
			this.mouse_hide_timer = null;
			change_mouse_visibility.call(this, false);
		};

		var on_image_mouseenter = function (event, image_container) {
			// Don't run if disabled
			if (this.disabled) return;

			// Attempt to open
			this.current_hover_container = image_container;
			preview_open_test.call(this, image_container, null, true);
		};
		var on_image_mouseleave = function (event, image_container) {
			// Don't run if disabled
			if (this.disabled) return;

			// Close preview
			this.current_hover_container = null;
			this.preview_close(false);
		};
		var on_image_click = function (event, image_container) {
			// Don't run if disabled
			if (this.disabled) return;

			// Close preview
			setTimeout(on_image_click_delay.bind(this, image_container), 10);
		};
		var on_image_click_delay = function (image_container) {
			var post_container = api.post_get_post_container_from_image_container(image_container);
			if (post_container === null) return;

			if (api.post_is_image_expanded_or_expanding(post_container)) {
				// Transfer state
				if (this.settings.video.expand_state_save) {
					var expanded_node = api.post_get_image_expanded_from_image_container(image_container);
					if (expanded_node !== null) {
						this.mpreview.transfer_video_state(expanded_node);
					}
				}

				// Close
				this.preview_close(true);

				// Observe expanded node
				if (this.settings.video.expand_state_save) {
					observe_expanded.call(this, expanded_node, image_container);
				}
			}
			else {
				// Attempt to open if still hovered
				if (this.current_hover_container === image_container) {
					preview_open_test.call(this, image_container, post_container, false);
				}
			}
		};

		var on_image_connector_mouseenter = function (event, image_container) {
			// Cancel close
			this.preview_close_cancel();
		};
		var on_image_connector_mouseleave = function (event, image_container) {
			// Close preview
			this.preview_close(false);
		};
		var on_image_connector_mousedown = function (event) {
			// Close
			this.preview_close(true);
		};

		var on_window_resize = function (event) {
			// Reposition
			this.preview_update(false, false, false);
		};
		var on_window_scroll = function (event) {
			// Reposition
			this.preview_update(false, false, false);
		};

		var on_api_post_add = function (container) {
			// Queue add hooks
			this.post_queue.push(container);
		};
		var on_api_post_remove = function (container) {
			// Remove hooks
			remove_post_container_callbacks.call(this, container);
		};
		var on_api_image_hover_open = function () {
			// Disable
			if (this.disabled) return;
			this.disable();

			// Remove event
			api.off("image_hover_open", this.on_api_image_hover_open_bind);

			// Update settings
			settings.disable_image_expansion();
		};

		var on_settings_value_change = function (data) {
			// Update
			this.update_settings_from_global();
		};

		var on_hotkey = function (event, hotkey) {
			// Don't run if disabled
			if (this.disabled) return;

			if (hotkey.key == "esc") {
				// Close
				this.preview_close(true);
				event.preventDefault();
				event.stopPropagation();
				return false;
			}
		};

		var observe_expanded = function (node, image_container) {
			// Ignore if invalid node
			if (node.parentNode === null || node.tagName !== "VIDEO" || style.has_class(node, "iex_observing")) return;
			style.add_class(node, "iex_observing");

			var State = function (time, n) {
				this.time = time;
				this.volume = n.volume;
				this.muted = n.muted;
				this.paused = n.paused;
			};

			var self = this,
				time_min_interval = 0.25 * 1000,
				state_pre = new State(timing() - time_min_interval, node),
				state = state_pre,
				current_time = 0.0,
				disconnect, on_volumechange, on_timeupdate, on_pause, on_play;

			// Listen for video state changing events
			on_volumechange = function (event) {
				var t = timing();
				if (t - state.time >= time_min_interval) {
					state_pre = state;
					state = new State(t, this);
				}
				else {
					state.volume = this.volume;
					state.muted = this.muted;
				}
			};
			on_pause = function (event) {
				var t = timing();
				if (t - state.time >= time_min_interval) {
					state_pre = state;
					state = new State(t, this);
				}
				else {
					state.paused = this.paused;
				}
			};
			on_play = function (event) {
				var t = timing();
				if (t - state.time >= time_min_interval) {
					state_pre = state;
					state = new State(t, this);
				}
				else {
					state.paused = this.paused;
				}
			};
			on_timeupdate = function (event) {
				current_time = this.currentTime;
			};

			node.addEventListener("play", on_volumechange, false);
			node.addEventListener("pause", on_volumechange, false);
			node.addEventListener("timeupdate", on_timeupdate, false);
			node.addEventListener("volumechange", on_volumechange, false);

			// Observe for removal
			disconnect = api.observe_children(node.parentNode, function (added, n) {
				if (!added && n === node) {
					// Node removed
					disconnect();
					n.removeEventListener("play", on_volumechange, false);
					n.removeEventListener("pause", on_volumechange, false);
					n.removeEventListener("timeupdate", on_timeupdate, false);
					n.removeEventListener("volumechange", on_volumechange, false);
					style.remove_class(n, "iex_observing");

					// Update
					if (self.mpreview !== null && self.mpreview.is_visible()) {
						var t = timing(),
							s = state;

						if (t - s.time < time_min_interval) s = state_pre;

						// Update state
						self.mpreview.load_video_state({
							time: current_time,
							volume: s.volume,
							muted: s.muted,
							paused: s.paused,
						});
					}
				}
			});
		};



		ImageHover.prototype = {
			constructor: ImageHover,

			destroy: function () {
				var par;

				// Detach preview
				preview_detach.call(this, true);

				// Create connector
				par = this.connector.parentNode;
				if (par) {
					this.connector.removeEventListener("mouseover", this.on_image_connector_mouseenter_bind, false);
					this.connector.removeEventListener("mouseout", this.on_image_connector_mouseleave_bind, false);
					this.connector.removeEventListener("mousedown", this.on_image_connector_mousedown_bind, false);

					par.removeChild(this.connector);
				}

				// Remove hotkeys
				if (this.hotkeys !== null) {
					for (var i = 0; i < this.hotkeys.length; ++i) {
						hotkey_manager.unregister(this.hotkeys[i]);
					}
					this.hotkeys = null;
				}

				// Remove api events
				api.off("post_add", this.on_api_post_add_bind);
				api.off("post_remove", this.on_api_post_remove_bind);
				api.off("image_hover_open", this.on_api_image_hover_open_bind);

				// Remove settings events
				settings.off_change(["image_expansion", "hover", "zoom_invert"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "hover", "zoom_borders_show"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "hover", "zoom_borders_hide_time"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "hover", "zoom_buttons"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "hover", "mouse_hide"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "hover", "mouse_hide_time"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "hover", "header_overlap"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "hover", "fit_large_allowed"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "hover", "display_stats"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "video", "autoplay"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "video", "loop"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "video", "mute_initially"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "video", "volume"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "video", "mini_controls"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "style", "controls_rounded_border"], this.off_settings_value_change_bind);
				settings.off_change(["image_expansion", "style", "animations_background"], this.off_settings_value_change_bind);
			},

			start: function () {
				// Enable if settings allow it
				if (settings.values.image_expansion.enabled) {
					this.update_settings_from_global();
					this.enable();
				}
			},
			enable: function () {
				// Enable
				if (this.enabled) return;
				this.enabled = true;

				// Setup nodes
				ASAP.asap(on_asap.bind(this), on_asap_condition);

				// Get posts
				this.post_queue = Delay.queue(api.get("posts"), on_post_queue_callback.bind(this), 50, 0.25);

				// Bind post acquiring
				api.on("post_add", this.on_api_post_add_bind);
				api.on("post_remove", this.on_api_post_remove_bind);

				// Bind default image hover test
				api.on("image_hover_open", this.on_api_image_hover_open_bind);

				// Hotkeys
				var on_hotkey_bind = on_hotkey.bind(this);
				this.hotkeys = [
					hotkey_manager.register("esc", 0, on_hotkey_bind),
				];
			},
			disable: function () {
				// Not enabled or already disabled
				if (!this.enabled || this.disabled) return;

				// Disable
				this.disabled = true;

				// Stop the current preview
				this.preview_close(true);
			},

			preview_open: function (image_container, post_info, auto_fit) {
				var display_stats = this.settings.display_stats,
					v_set = this.settings.video,
					mc = this.settings.video.mini_controls,
					ext, ext_info, ext_bg_show;

				// Clear timer
				if (this.preview_open_timer !== null) {
					clearTimeout(this.preview_open_timer);
					this.preview_open_timer = null;
				}
				if (this.preview_close_timer !== null) {
					clearTimeout(this.preview_close_timer);
					this.preview_close_timer = null;
				}

				// Set
				this.current_image_container = image_container;

				// Create new
				if (this.mpreview === null) {
					preview_create.call(this);
					this.update_mpreview();
				}

				// Expansion type
				ext = /\.[^\.]+$/.exec(post_info.url);
				ext = ext ? ext[0].toLowerCase() : "";
				ext_info = this.extensions_valid[ext];
				ext_bg_show = settings.values.image_expansion.extensions[ext_info.ext].background;

				if (ext_info.type == "video") {
					// Set video
					this.mpreview.set_vcontrols_mini_available(true);
					this.mpreview.set_video(post_info.url);

					// Playback settings
					this.mpreview.set_video_muted(v_set.mute_initially);
					this.mpreview.set_video_volume(v_set.volume);
					this.mpreview.set_video_paused(true, v_set.loop);
					this.mpreview.clear_video_interactions();
				}
				else {
					// Set image
					this.mpreview.set_vcontrols_mini_available(false);
					this.mpreview.set_image(post_info.url);
				}

				// Background
				this.mpreview.set_background(post_info.thumb, ext_bg_show);
				this.mpreview.set_mouse_wheel_mode(settings.values.image_expansion.extensions[ext_info.ext].mouse_wheel);

				// Size
				if (post_info.resolution.width > 0 && post_info.resolution.height > 0) {
					this.mpreview.set_size(post_info.resolution.width, post_info.resolution.height, true);
					this.mpreview.set_stat_resolution((display_stats === 0), post_info.resolution.width + "x" + post_info.resolution.height);
				}
				else {
					this.mpreview.set_size(post_info.resolution_thumb.width, post_info.resolution_thumb.height, false);
					this.mpreview.set_stat_resolution((display_stats === 0), "unknown");
				}

				// Stats
				if (post_info.name) {
					this.mpreview.set_stat_file_name((display_stats === 0), post_info.name);
				}
				this.mpreview.set_stat_file_size((display_stats === 0), post_info.size + post_info.size_label);

				// Mini controls
				this.mpreview.set_vcontrols_mini_visible(mc == 3 || mc == 2);

				// Set visible
				this.mpreview.set_visible(true);
				style.add_class(this.connector, "iex_floating_image_connector_visible");

				// Update position
				this.mpreview.set_fixed(true);
				this.preview_update(false, true, auto_fit);
			},
			preview_close: function (immediate) {
				// Cancel the open timer
				if (this.preview_open_timer !== null) {
					clearTimeout(this.preview_open_timer);
					this.preview_open_timer = null;
				}

				if (this.mpreview === null || !this.mpreview.is_visible()) return;

				if (immediate) {
					// Immediate
					this.mpreview.set_visible(false);
					this.current_image_container = null;

					// Connector
					style.remove_class(this.connector, "iex_floating_image_connector_visible");
				}
				else {
					// Delay
					if (this.preview_close_timer !== null) {
						clearTimeout(this.preview_close_timer);
					}
					this.preview_close_timer = setTimeout(this.on_preview_close_timeout_bind, 20);
				}
			},
			preview_close_cancel: function () {
				// Cancel the timer
				if (this.preview_close_timer !== null) {
					clearTimeout(this.preview_close_timer);
					this.preview_close_timer = null;
				}
			},

			preview_update: function (keep_mouse_inside, fit_reset, fit_start) {
				// Update the position and sizing of the preview after a zoom, resize, or open event
				if (this.mpreview === null || !this.mpreview.is_visible()) return;

				// Vars
				var set = this.settings,
					header_overlap = set.header_overlap,
					paddings = set.region_paddings,
					max_rect = style.get_document_rect(),
					img = this.current_image_container.querySelector("img") || this.current_image_container,
					img_rect = style.get_object_rect_inner(img),
					left = max_rect.left,
					top = max_rect.top,
					fit = this.mpreview.fit,
					fit_large = this.mpreview.fit_large,
					fit_large_allowed = set.fit_large_allowed,
					fit_axis = 0,
					w = this.mpreview.size.width,
					h = this.mpreview.size.height,
					zoom = this.mpreview.zoom,
					x, y, w_max, h_max, w_scale, h_scale;

				// Include header
				if (!header_overlap) {
					var header_rect = api.get_header_rect();

					// Subtract
					if (header_rect.top <= max_rect.top && header_rect.bottom > max_rect.top) {
						// It's on the top
						max_rect.top = header_rect.bottom;
					}
					else if (header_rect.bottom >= max_rect.bottom && header_rect.top < max_rect.bottom) {
						// It's on the bottom
						max_rect.bottom = header_rect.top;
					}
				}

				// Update max_rect
				max_rect.left = img_rect.right;
				max_rect.left += paddings.left;
				max_rect.top += paddings.top;
				max_rect.right -= paddings.right;
				max_rect.bottom -= paddings.bottom;

				// Maximum size
				w_max = (max_rect.right - max_rect.left);
				h_max = (max_rect.bottom - max_rect.top);
				if (w_max < 1) w_max = 1;
				if (h_max < 1) h_max = 1;
				this.display_window_max.width = w_max;
				this.display_window_max.height = h_max;

				// Get the minimum scale and apply it
				w_scale = w_max / w;
				h_scale = h_max / h;

				if (fit_reset) {
					zoom = 1;
					fit = fit_start;
					fit_large = false;
					if (w_scale < 1.0 || h_scale < 1.0) {
						fit = true;
						fit_large = (Math.abs(w_scale - h_scale) < 1e-5) && fit_large_allowed;
					}
				}
				if (fit) {
					var best_scale;
					if ((w_scale > h_scale) == fit_large) {
						best_scale = w_scale;
						fit_axis = 0;
					}
					else {
						best_scale = h_scale;
						fit_axis = 1;
					}

					w *= best_scale;
					h *= best_scale;
				}
				w *= zoom;
				h *= zoom;

				// Limit
				this.mpreview.set_view_borders_visible_sides((w - w_max) > 1e-5, (h - h_max) > 1e-5);
				if (w > w_max) w = w_max;
				if (h > h_max) h = h_max;

				// Position
				x = max_rect.left;
				y = (img_rect.top + img_rect.bottom - h) / 2.0;
				if (y + h >= max_rect.bottom) y = max_rect.bottom - h;
				if (y < max_rect.top) y = max_rect.top;

				// Mouse inside
				if (keep_mouse_inside) {
					// Setup
					var off_right = 0,
						off_top = 0,
						off_bottom = 0,
						padding_extra = set.padding_extra,
						x_r = x + w,
						y_b = y + h;

					off_right = (this.mouse_x - x_r);
					off_top = (y - this.mouse_y);
					off_bottom = (this.mouse_y - y_b);

					// Right offset
					if (off_right <= 0) {
						off_right = 0;
					}
					else {
						off_right += padding_extra.right;
						if (x_r + off_right > max_rect.right) {
							off_right = Math.max(0, max_rect.right - x_r);
						}
					}

					// Top offset
					if (off_top <= 0) {
						off_top = 0;
					}
					else {
						off_top += padding_extra.top;
						if (y - off_top < max_rect.top) {
							off_top = Math.max(0, y - max_rect.top);
						}
					}

					// Bottom offset
					if (off_bottom <= 0) {
						off_bottom = 0;
					}
					else {
						off_bottom += padding_extra.bottom;
						if (y_b + off_bottom > max_rect.bottom) {
							off_bottom = Math.max(0, max_rect.bottom - y_b);
						}
					}

					// Set
					if (off_top > 0 || off_right > 0 || off_bottom > 0) {
						this.paddings_active = true;
						this.mpreview.set_paddings(off_top, off_right, off_bottom, 0);
					}
					else {
						this.paddings_active = false;
						this.mpreview.clear_paddings();
					}
				}
				else {
					// No paddings
					this.paddings_active = false;
					this.mpreview.clear_paddings();
				}

				// Set
				this.mpreview.set_window(x - left, y - top, w, h);
				this.mpreview.set_zoom(zoom, fit, fit_large, fit_axis);

				// Connector
				this.connector.style.left = (img_rect.right).toFixed(2) + "px";
				this.connector.style.top = (img_rect.top).toFixed(2) + "px";
				this.connector.style.width = (paddings.left).toFixed(2) + "px";
				this.connector.style.height = (img_rect.bottom - img_rect.top).toFixed(2) + "px";

				// Stats
				this.mpreview.set_stat_zoom((set.display_stats <= 1), (zoom * 100) + "%", fit ? " fit-" + (this.mpreview.fit_axis === 0 ? "x" : "y") : "");
			},

			update_settings_from_global: function () {
				// Copy settings
				var hs = settings.values.image_expansion.hover,
					vs = settings.values.image_expansion.video,
					ss = settings.values.image_expansion.style,
					set = this.settings,
					v_set = set.video,
					s_set = set.style;

				set.zoom_invert = hs.zoom_invert;
				set.zoom_borders_show = hs.zoom_borders_show;
				set.zoom_borders_hide_time = hs.zoom_borders_hide_time * 1000;
				set.zoom_buttons = hs.zoom_buttons;
				set.mouse_hide = hs.mouse_hide;
				set.mouse_hide_time = hs.mouse_hide_time * 1000;
				set.header_overlap = hs.header_overlap;
				set.fit_large_allowed = hs.fit_large_allowed;
				set.display_stats = hs.display_stats;

				v_set.autoplay = vs.autoplay;
				v_set.loop = vs.loop;
				v_set.mute_initially = vs.mute_initially;
				v_set.volume = vs.volume;
				v_set.mini_controls = vs.mini_controls;
				v_set.expand_state_save = vs.expand_state_save;

				s_set.controls_rounded_border = ss.controls_rounded_border;
				s_set.animations_background = ss.animations_background;

				if (this.mpreview !== null) {
					this.update_mpreview();
				}
			},
			update_mpreview: function () {
				// Rounded borders
				this.mpreview.set_vcontrols_borders_rounded(!is_chrome && this.settings.style.controls_rounded_border);
				this.mpreview.set_background_animations(this.settings.style.animations_background);

				// Zoom buttons
				this.mpreview.set_zoom_control_buttons_enabled(this.settings.zoom_buttons);
			},

		};



		return ImageHover;

	})();

	// Media preview base
	var MediaPreview = (function () {

		var MediaPreviewGenericNodes = function (parent) {
			// Create the preview container
			var zoom_border_inner,
				stat_zoom_inc,
				stat_zoom_dec,
				stat_sep,
				theme = style.theme;


			// Vars
			this.stats_zoom_controls_enabled = true;
			this.zoom_controls_hide_timer = null;
			this.mouse_in_stats = false;
			this.on_hide_zoom_controls_timeout_bind = hide_zoom_controls.bind(parent, true, false);


			// Background
			this.background = document.createElement("div");
			this.background.className = "iex_mpreview_background" + theme; // iex_mpreview_background_disabled iex_mpreview_background_visible iex_mpreview_background_fallback


			// Zoom borders
			this.zoom_borders = document.createElement("div");
			this.zoom_borders.className = "iex_mpreview_zoom_borders" + theme; // iex_mpreview_zoom_borders_visible iex_mpreview_zoom_borders_vertical iex_mpreview_zoom_borders_horizontal

			zoom_border_inner = document.createElement("div");
			zoom_border_inner.className = "iex_mpreview_zoom_borders_inner" + theme;
			this.zoom_borders.appendChild(zoom_border_inner);


			// Stats container
			this.stats_container = document.createElement("div");
			this.stats_container.className = "iex_mpreview_stats_container" + theme;

			// Zoom controls
			this.zoom_controls = document.createElement("span");
			this.zoom_controls.className = "iex_mpreview_stat iex_mpreview_stat_zoom_controls" + theme; // iex_mpreview_stat_zoom_controls_visible iex_mpreview_stat_zoom_controls_fixed
			this.stats_container.appendChild(this.zoom_controls);

			stat_zoom_inc = document.createElement("span");
			stat_zoom_inc.className = "iex_mpreview_stat_zoom_control iex_mpreview_stat_zoom_control_increase" + theme;
			stat_zoom_inc.textContent = "+";
			this.zoom_controls.appendChild(stat_zoom_inc);

			stat_zoom_dec = document.createElement("span");
			stat_zoom_dec.className = "iex_mpreview_stat_zoom_control iex_mpreview_stat_zoom_control_decrease" + theme;
			stat_zoom_dec.textContent = "\u2212";
			this.zoom_controls.appendChild(stat_zoom_dec);

			this.zoom_controls_offset = document.createElement("span");
			this.zoom_controls_offset.className = "iex_mpreview_stat_zoom_controls_offset" + theme;
			this.stats_container.appendChild(this.zoom_controls_offset);



			// Stats items
			this.stat_zoom_container = document.createElement("span");
			this.stat_zoom_container.className = "iex_mpreview_stat" + theme;
			this.stats_container.appendChild(this.stat_zoom_container);

			this.stat_zoom = document.createElement("span");
			this.stat_zoom.className = "" + theme;
			this.stat_zoom_container.appendChild(this.stat_zoom);

			this.stat_zoom_fit = document.createElement("span");
			this.stat_zoom_fit.className = "" + theme;
			this.stat_zoom_container.appendChild(this.stat_zoom_fit);

			stat_sep = document.createElement("span");
			stat_sep.className = "iex_mpreview_stat_sep" + theme;
			stat_sep.textContent = ", ";
			this.stats_container.appendChild(stat_sep);

			this.stat_status = document.createElement("span");
			this.stat_status.className = "iex_mpreview_stat" + theme;
			this.stats_container.appendChild(this.stat_status);

			stat_sep = document.createElement("span");
			stat_sep.className = "iex_mpreview_stat_sep" + theme;
			stat_sep.textContent = ", ";
			this.stats_container.appendChild(stat_sep);

			this.stat_resolution = document.createElement("span");
			this.stat_resolution.className = "iex_mpreview_stat" + theme;
			this.stats_container.appendChild(this.stat_resolution);

			stat_sep = document.createElement("span");
			stat_sep.className = "iex_mpreview_stat_sep" + theme;
			stat_sep.textContent = ", ";
			this.stats_container.appendChild(stat_sep);

			this.stat_filesize = document.createElement("span");
			this.stat_filesize.className = "iex_mpreview_stat" + theme;
			this.stats_container.appendChild(this.stat_filesize);

			stat_sep = document.createElement("span");
			stat_sep.className = "iex_mpreview_stat_sep" + theme;
			stat_sep.textContent = ", ";
			this.stats_container.appendChild(stat_sep);

			this.stat_filename = document.createElement("span");
			this.stat_filename.className = "iex_mpreview_stat" + theme;
			this.stats_container.appendChild(this.stat_filename);


			// Events
			parent.add_event_listener(this.stats_container, "mouseover", wrap_mouseenterleave_event(parent, on_stats_mouseenter), false);
			parent.add_event_listener(this.stats_container, "mouseout", wrap_mouseenterleave_event(parent, on_stats_mouseleave), false);
			parent.add_event_listener(this.stat_zoom, "mouseover", wrap_mouseenterleave_event(parent, on_stats_zoom_mouseenter), false);
			parent.add_event_listener(this.zoom_controls, "mousedown", on_stats_zoom_controls_mousedown.bind(parent), false);
			parent.add_event_listener(this.zoom_controls, "mouseover", wrap_mouseenterleave_event(parent, on_stats_zoom_controls_mouseenter), false);
			parent.add_event_listener(this.zoom_controls, "mouseout", wrap_mouseenterleave_event(parent, on_stats_zoom_controls_mouseleave), false);
			parent.add_event_listener(stat_zoom_inc, "click", on_stats_zoom_control_click.bind(parent, 1), false);
			parent.add_event_listener(stat_zoom_dec, "click", on_stats_zoom_control_click.bind(parent, -1), false);


			// Add
			parent.cpreview.add_content(this.background);
			parent.cpreview.add_overlay(this.stats_container, true);
			parent.cpreview.add_overlay(this.zoom_borders);
		};
		var MediaPreviewImageNodes = function (parent) {
			var theme = style.theme;


			// Image
			this.image = document.createElement("img");
			this.image.className = "iex_mpreview_image" + theme;
			this.image.setAttribute("alt", "");
			this.image.setAttribute("title", "");


			// Events
			parent.add_event_listener(this.image, "load", on_image_load.bind(parent), false);
			parent.add_event_listener(this.image, "error", on_image_error.bind(parent), false);


			// Add
			parent.cpreview.add_content(this.image);
		};
		var MediaPreviewVideoNodes = function (parent) {
			var svgns = "http://www.w3.org/2000/svg",
				theme = style.theme,
				c_inner,
				svg_e1, svg_e2,
				c_div1, c_div2, c_div3, c_div4, c_buttons_left, c_buttons_right,
				c_seek_container, c_play_button,
				c_volume_button;

			// Vars
			this.interacted = false;

			this.seeking = false;
			this.seeking_paused = false;
			this.volume_modifying = false;

			this.mouse_capturing_rect = null;
			this.mouse_capturing_element = null;
			this.on_capture_mousemove = on_vcontrols_capture_mousemove.bind(parent);
			this.on_capture_mouseup = on_vcontrols_capture_mouseup.bind(parent);


			// Video
			this.video = document.createElement("video");
			this.video.className = "iex_mpreview_video" + theme;
			this.video.setAttribute("preload", "auto");



			// Controller overlay
			this.overlay = document.createElement("div");
			this.overlay.className = "iex_mpreview_vcontrols_container" + theme;

			c_inner = document.createElement("div");
			c_inner.className = "iex_mpreview_vcontrols_container_inner" + theme;
			this.overlay.appendChild(c_inner);

			this.overlay_table = document.createElement("div");
			this.overlay_table.className = "iex_mpreview_vcontrols_table" + theme; // iex_mpreview_vcontrols_table_visible iex_mpreview_vcontrols_table_visible_important iex_mpreview_vcontrols_table_mini
			c_inner.appendChild(this.overlay_table);



			// Pause/play button
			c_buttons_left = document.createElement("div");
			c_buttons_left.className = "iex_mpreview_vcontrols_button_container" + theme;
			this.overlay_table.appendChild(c_buttons_left);

			c_div1 = document.createElement("div");
			c_div1.className = "iex_mpreview_vcontrols_button_container_inner" + theme;
			c_buttons_left.appendChild(c_div1);

			c_div2 = document.createElement("div");
			c_div2.className = "iex_mpreview_vcontrols_button_container_inner2" + theme;
			c_div1.appendChild(c_div2);

			// Mouse event controller
			c_play_button = document.createElement("div");
			c_play_button.className = "iex_mpreview_vcontrols_button_mouse_controller" + theme;
			c_div2.appendChild(c_play_button);

			// SVG image
			this.svg_play = document.createElementNS(svgns, "svg");
			this.svg_play.setAttribute("class", "iex_svg_play_button"); // iex_svg_play_button_playing iex_svg_play_button_looping
			this.svg_play.setAttribute("svgns", svgns);
			this.svg_play.setAttribute("width", "2em");
			this.svg_play.setAttribute("height", "2em");
			this.svg_play.setAttribute("viewBox", "0 0 1 1");
			c_div2.appendChild(this.svg_play);

			svg_e1 = document.createElementNS(svgns, "g");
			svg_e1.setAttribute("class", "iex_svg_button_scale_group");
			svg_e1.setAttribute("transform", "translate(0.25,0.25) scale(0.5)");
			this.svg_play.appendChild(svg_e1);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_svg_play_button_play_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0,0 0,1 1,0.5");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_svg_play_button_loop_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0.1,0.05 1,0.5 0.1,0.95");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_svg_play_button_loop_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0,0.7 0.4,0.5 0,0.3");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_svg_play_button_pause_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0.125,0 0.375,0 0.375,1 0.125,1");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_svg_play_button_pause_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0.625,0 0.875,0 0.875,1 0.625,1");
			svg_e1.appendChild(svg_e2);



			// Seek bar
			c_div1 = document.createElement("div");
			c_div1.className = "iex_mpreview_vcontrols_seek_container" + theme;
			this.overlay_table.appendChild(c_div1);

			c_div2 = document.createElement("div");
			c_div2.className = "iex_mpreview_vcontrols_seek_container_inner" + theme;
			c_div1.appendChild(c_div2);

			this.seek_bar = document.createElement("div");
			this.seek_bar.className = "iex_mpreview_vcontrols_seek_bar" + theme; // iex_mpreview_vcontrols_no_border_radius
			c_div2.appendChild(this.seek_bar);

			c_div3 = document.createElement("div");
			c_div3.className = "iex_mpreview_vcontrols_seek_bar_bg" + theme;
			this.seek_bar.appendChild(c_div3);

			this.load_progress = document.createElement("div");
			this.load_progress.className = "iex_mpreview_vcontrols_seek_bar_loaded" + theme;
			c_div3.appendChild(this.load_progress);

			this.play_progress = document.createElement("div");
			this.play_progress.className = "iex_mpreview_vcontrols_seek_bar_played" + theme;
			c_div3.appendChild(this.play_progress);

			c_div4 = document.createElement("div");
			c_div4.className = "iex_mpreview_vcontrols_seek_time_table" + theme;
			c_div3.appendChild(c_div4);

			this.time_current = document.createElement("div");
			this.time_current.className = "iex_mpreview_vcontrols_seek_time_current" + theme;
			c_div4.appendChild(this.time_current);

			this.time_duration = document.createElement("div");
			this.time_duration.className = "iex_mpreview_vcontrols_seek_time_duration" + theme;
			c_div4.appendChild(this.time_duration);



			// Volume bar/mute button
			c_buttons_right = document.createElement("div");
			c_buttons_right.className = "iex_mpreview_vcontrols_button_container" + theme;
			this.overlay_table.appendChild(c_buttons_right);

			c_div1 = document.createElement("div");
			c_div1.className = "iex_mpreview_vcontrols_button_container_inner" + theme;
			c_buttons_right.appendChild(c_div1);

			c_div2 = document.createElement("div");
			c_div2.className = "iex_mpreview_vcontrols_button_container_inner2" + theme;
			c_div1.appendChild(c_div2);

			// Mouse event controller
			c_volume_button = document.createElement("div");
			c_volume_button.className = "iex_mpreview_vcontrols_button_mouse_controller" + theme;
			c_div2.appendChild(c_volume_button);

			// SVG image
			this.svg_volume = document.createElementNS(svgns, "svg");
			this.svg_volume.setAttribute("class", "iex_svg_volume_button"); // iex_svg_volume_button_muted iex_svg_volume_button_high iex_svg_volume_button_medium iex_svg_volume_button_low
			this.svg_volume.setAttribute("svgns", svgns);
			this.svg_volume.setAttribute("width", "2em");
			this.svg_volume.setAttribute("height", "2em");
			this.svg_volume.setAttribute("viewBox", "0 0 1 1");
			c_div2.appendChild(this.svg_volume);

			svg_e1 = document.createElementNS(svgns, "g");
			svg_e1.setAttribute("class", "iex_svg_button_scale_group");
			svg_e1.setAttribute("transform", "translate(0.25,0.25) scale(0.5)");
			this.svg_volume.appendChild(svg_e1);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_svg_volume_button_speaker iex_svg_button_fill");
			svg_e2.setAttribute("points", "0,0.3 0.2,0.3 0.5,0 0.6,0 0.6,1 0.5,1 0.2,0.7 0,0.7");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "path");
			svg_e2.setAttribute("class", "iex_svg_volume_button_wave_big iex_svg_button_fill");
			svg_e2.setAttribute("d", "M 0.75,0.1 Q 1.3,0.5 0.75,0.9 L 0.75,0.75 Q 1.05,0.5 0.75,0.25 Z");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "path");
			svg_e2.setAttribute("class", "iex_svg_volume_button_wave_small iex_svg_button_fill");
			svg_e2.setAttribute("d", "M 0.75,0.75 Q 1.05,0.5 0.75,0.25 Z");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "g");
			svg_e2.setAttribute("class", "iex_svg_volume_button_wave_mute_icon");
			svg_e1.appendChild(svg_e2);
			svg_e1 = svg_e2;

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_svg_volume_button_wave_mute_icon_polygon");
			svg_e2.setAttribute("points", "0.7,0.3 1.0,0.6 0.9,0.7 0.6,0.4");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_svg_volume_button_wave_mute_icon_polygon");
			svg_e2.setAttribute("points", "0.7,0.7 1.0,0.4 0.9,0.3 0.6,0.6");
			svg_e1.appendChild(svg_e2);



			// Volume bar
			c_div2 = document.createElement("div");
			c_div2.className = "iex_mpreview_vcontrols_volume_container_position" + theme;
			c_div1.appendChild(c_div2);

			this.volume_container = document.createElement("div");
			this.volume_container.className = "iex_mpreview_vcontrols_volume_container" + theme; // iex_mpreview_vcontrols_volume_container_visible iex_mpreview_vcontrols_volume_container_visible_important
			c_div2.appendChild(this.volume_container);

			this.volume_bar = document.createElement("div");
			this.volume_bar.className = "iex_mpreview_vcontrols_volume_bar" + theme; // iex_mpreview_vcontrols_no_border_radius
			this.volume_container.appendChild(this.volume_bar);

			c_div3 = document.createElement("div");
			c_div3.className = "iex_mpreview_vcontrols_volume_bar_bg" + theme;
			this.volume_bar.appendChild(c_div3);

			this.volume_progress = document.createElement("div");
			this.volume_progress.className = "iex_mpreview_vcontrols_volume_bar_level" + theme;
			c_div3.appendChild(this.volume_progress);


			// Events
			parent.add_event_listener(this.video, "loadedmetadata", on_video_loadedmetadata.bind(parent), false);
			parent.add_event_listener(this.video, "canplay", on_video_canplay.bind(parent), false);
			parent.add_event_listener(this.video, "canplaythrough", on_video_canplaythrough.bind(parent), false);
			parent.add_event_listener(this.video, "error", on_video_error.bind(parent), false);
			parent.add_event_listener(this.video, "progress", on_video_progress.bind(parent), false);
			parent.add_event_listener(this.video, "timeupdate", on_video_timeupdate.bind(parent), false);
			parent.add_event_listener(this.video, "ended", on_video_ended.bind(parent), false);

			var prevent = on_vcontrols_prevent_default_mousedown.bind(parent);

			parent.add_event_listener(c_inner, "mouseover", wrap_mouseenterleave_event(parent, on_vcontrols_mouseenter), false);
			parent.add_event_listener(c_inner, "mouseout", wrap_mouseenterleave_event(parent, on_vcontrols_mouseleave), false);
			parent.add_event_listener(this.overlay_table, "mousedown", on_vcontrols_container_mousedown.bind(parent), false);
			parent.add_event_listener(c_play_button, "click", on_vcontrols_play_button_click.bind(parent), false);
			parent.add_event_listener(c_volume_button, "click", on_vcontrols_volume_button_click.bind(parent), false);
			parent.add_event_listener(c_volume_button, "mouseover", wrap_mouseenterleave_event(parent, on_vcontrols_volume_button_mouseenter), false);
			parent.add_event_listener(c_buttons_right, "mouseout", wrap_mouseenterleave_event(parent, on_vcontrols_volume_button_container_mouseleave), false);
			parent.add_event_listener(this.seek_bar, "mousedown", on_vcontrols_seek_bar_mousedown.bind(parent), false);
			parent.add_event_listener(this.volume_bar, "mousedown", on_vcontrols_volume_bar_mousedown.bind(parent), false);
			parent.add_event_listener(this.time_current, "mousedown", prevent, false);
			parent.add_event_listener(this.time_duration, "mousedown", prevent, false);


			// Add
			parent.cpreview.add_content(this.video);
			parent.cpreview.add_overlay(this.overlay);
		};



		var MediaPreview = function () {
			// Setup preview
			this.cpreview = new ContentPreview();
			this.event_listeners = [];

			// Events
			var cp_nodes = this.cpreview.nodes,
				event_bind;

			this.add_event_listener(cp_nodes.container, "mouseover", wrap_mouseenterleave_event(this, on_mouseenter), false);
			this.add_event_listener(cp_nodes.container, "mouseout", wrap_mouseenterleave_event(this, on_mouseleave), false);
			this.add_event_listener(cp_nodes.container, "mousemove", on_mousemove.bind(this), false);
			this.add_event_listener(cp_nodes.container, "mousewheel", (event_bind = on_mousewheel.bind(this)), false);
			this.add_event_listener(cp_nodes.container, "DOMMouseScroll", event_bind, false);
			this.add_event_listener(cp_nodes.container, "mousedown", on_mousedown.bind(this), false);
			this.add_event_listener(cp_nodes.container, "contextmenu", on_contextmenu.bind(this), false);

			this.add_event_listener(cp_nodes.overflow, "mouseover", wrap_mouseenterleave_event(this, on_overflow_mouseenter), false);


			// Setup classes
			style.add_class(this.cpreview.nodes.padding, "iex_mpreview_padding");

			// Setup nodes
			this.nodes = new MediaPreviewGenericNodes(this);
			this.nodes_image = null;
			this.nodes_video = null;


			// Settings
			this.type = MediaPreview.TYPE_NONE;

			this.zoom = 1;

			this.fit = false;
			this.fit_large = false;
			this.fit_large_allowed = true;
			this.fit_axis = 0;

			this.mouse_wheel_mode = 0;
			this.volume_controls_temp_timer = null;

			this.style = {
				vcontrols_rounded: true,
			};

			this.size = {
				width: 0,
				height: 0,
				acquired: false
			};

			// Events
			this.events = {
				"image_load": [],
				"image_error": [],

				"video_ready": [],
				"video_can_play": [],
				"video_can_play_through": [],
				"video_load": [],
				"video_error": [],
				"video_volume_change": [],

				"size_change": [],

				"mouse_wheel": [],
				"mouse_enter": [],
				"mouse_leave": [],
				"mouse_down": [],
				"mouse_move": [],
				"mouse_enter_main": [],

				"stats_zoom_control_click": [],
			};
		};



		MediaPreview.TYPE_NONE = 0;
		MediaPreview.TYPE_IMAGE = 1;
		MediaPreview.TYPE_VIDEO = 2;



		var trigger = function (event, data) {
			// Trigger
			if (event in this.events) {
				var e_list = this.events[event];
				for (var i = 0; i < e_list.length; ++i) {
					e_list[i].call(this, data);
				}
			}
		};

		var format_video_time = function (time) {
			time = Math.floor(time + 0.5);

			var s = (time % 60).toString();
			if (s.length < 2) s = "0" + s;

			time = Math.floor(time / 60);
			return time + ":" + s;
		};

		var update_size = function (width_new, height_new) {
			// Change
			this.size.width = width_new;
			this.size.height = height_new;
			this.size.acquired = true;

			// Event
			trigger.call(this, "size_change", {
				width: width_new,
				height: height_new,
			});
		};
		var update_video_duration_status = function () {
			var video = this.nodes_video.video,
				duration = video.duration;

			// Update seek bar
			if (isNaN(duration)) {
				// Update time numbers
				this.nodes_video.time_duration.textContent = "";
			}
			else {
				// Update time numbers
				this.nodes_video.time_duration.textContent = format_video_time.call(this, duration);
			}
		};
		var update_video_seek_status = function (time) {
			var video = this.nodes_video.video,
				duration = video.duration;

			// Update seek bar
			if (time < 0 || isNaN(duration)) {
				// Bar
				this.nodes_video.play_progress.style.width = "0";

				// Update time numbers
				this.nodes_video.time_current.textContent = "";
			}
			else {
				// Bar
				this.nodes_video.play_progress.style.width = ((time / duration) * 100).toFixed(2) + "%";

				// Update time numbers
				this.nodes_video.time_current.textContent = format_video_time.call(this, time);
			}
		};
		var update_video_play_status = function (paused) {
			var loop = this.nodes_video.video.loop,
				svg_play = this.nodes_video.svg_play;

			// Update button
			if (paused) {
				style.remove_class(svg_play, "iex_svg_play_button_playing");
			}
			else {
				style.add_class(svg_play, "iex_svg_play_button_playing");
			}
			if (loop) {
				style.add_class(svg_play, "iex_svg_play_button_looping");
			}
			else {
				style.remove_class(svg_play, "iex_svg_play_button_looping");
			}
		};

		var set_video_volume = function (volume, reason, interacted) {
			var svg_volume = this.nodes_video.svg_volume;

			// Set volume on video
			if (volume >= 0) {
				if (volume > 1) volume = 1;
				this.nodes_video.video.volume = volume;
			}
			else {
				volume = this.nodes_video.video.volume;
			}

			// Update bar
			this.nodes_video.volume_progress.style.height = (volume * 100).toFixed(2) + "%";

			// Update icons
			if (volume > 0.625) {
				style.change_classes_svg(svg_volume, "iex_svg_volume_button_high", "iex_svg_volume_button_low iex_svg_volume_button_medium");
			}
			else if (volume > 0.125) {
				style.change_classes_svg(svg_volume, "iex_svg_volume_button_medium", "iex_svg_volume_button_low iex_svg_volume_button_high");
			}
			else {
				style.change_classes_svg(svg_volume, "iex_svg_volume_button_low", "iex_svg_volume_button_medium iex_svg_volume_button_high");
			}

			// Interacted
			if (interacted) this.nodes_video.interacted = true;

			// Event
			trigger.call(this, "video_volume_change", {
				reason: reason,
				volume: volume
			});
		};

		var setup_vcontrols_mouse_capture = function () {
			// Setup mouse capturing events
			if (
				this.nodes_video.mouse_capturing_element === null &&
				(this.nodes_video.mouse_capturing_element = document.documentElement) !== null
			) {
				this.nodes_video.mouse_capturing_element.addEventListener("mousemove", this.nodes_video.on_capture_mousemove, false);
				this.nodes_video.mouse_capturing_element.addEventListener("mouseup", this.nodes_video.on_capture_mouseup, false);
				update_vcontrols_mouse_capture.call(this);
			}
		};
		var teardown_vcontrols_mouse_capture = function () {
			// Destroy mouse capturing events
			if (this.nodes_video.mouse_capturing_element !== null) {
				this.nodes_video.mouse_capturing_element.removeEventListener("mousemove", this.nodes_video.on_capture_mousemove, false);
				this.nodes_video.mouse_capturing_element.removeEventListener("mouseup", this.nodes_video.on_capture_mouseup, false);
				this.nodes_video.mouse_capturing_element = null;
			}
		};
		var update_vcontrols_mouse_capture = function () {
			// Update node rectangle
			if (this.nodes_video.seeking) {
				this.nodes_video.mouse_capturing_rect = style.get_object_rect(this.nodes_video.seek_bar);
			}
			else if (this.nodes_video.volume_modifying) {
				this.nodes_video.mouse_capturing_rect = style.get_object_rect(this.nodes_video.volume_bar);
			}
		};

		var show_zoom_controls = function (force_open) {
			// Stop timer
			if (this.nodes.zoom_controls_hide_timer !== null) {
				clearTimeout(this.nodes.zoom_controls_hide_timer);
				this.nodes.zoom_controls_hide_timer = null;
			}

			// Display
			if (force_open) {
				var zoom_controls = this.nodes.zoom_controls,
					z_rect;

				style.add_class(zoom_controls, "iex_mpreview_stat_visible");
				z_rect = style.get_object_rect(zoom_controls);

				this.nodes.zoom_controls_offset.style.width = (z_rect.right - z_rect.left).toFixed(2) + "px";
			}
		};
		var hide_zoom_controls = function (instant, timer_check) {
			if (instant) {
				// Hide
				style.remove_class(this.nodes.zoom_controls, "iex_mpreview_stat_visible");
				this.nodes.zoom_controls_offset.style.width = "";

				// Stop timer
				if (timer_check && this.nodes.zoom_controls_hide_timer !== null) {
					clearTimeout(this.nodes.zoom_controls_hide_timer);
				}
				this.nodes.zoom_controls_hide_timer = null;
			}
			else {
				// Set timer
				this.nodes.zoom_controls_hide_timer = setTimeout(this.nodes.on_hide_zoom_controls_timeout_bind, 10);
			}
		};
		var set_zoom_controls_fixed = function (fixed) {
			// Set fixed
			var zoom_controls = this.nodes.zoom_controls;

			if (fixed) {
				var w_rect = style.get_document_rect(),
					z_rect = style.get_object_rect(zoom_controls);

				// Fix
				style.add_class(zoom_controls, "iex_mpreview_stat_zoom_controls_fixed");
				zoom_controls.style.left = (z_rect.left - w_rect.left).toFixed(2) + "px";
				zoom_controls.style.top = (z_rect.top - w_rect.top).toFixed(2) + "px";
			}
			else {
				// Un-fix
				style.remove_class(zoom_controls, "iex_mpreview_stat_zoom_controls_fixed");
				zoom_controls.style.left = "";
				zoom_controls.style.top = "";
			}
		};

		var update_stat_sep_visibility = function (node, visible) {
			var n;

			if (visible) {
				// Previous
				for (n = node; (n = n.previousSibling); ) {
					if (style.has_class(n, "iex_mpreview_stat_sep_visible")) break;
					if (style.has_class(n, "iex_mpreview_stat_visible")) {
						if ((n = node.previousSibling) !== null && style.has_class(n, "iex_mpreview_stat_sep")) {
							style.add_class(n, "iex_mpreview_stat_sep_visible");
						}
						break;
					}
				}

				// Next
				for (n = node; (n = n.nextSibling); ) {
					if (style.has_class(n, "iex_mpreview_stat_sep_visible")) break;
					if (style.has_class(n, "iex_mpreview_stat_visible")) {
						if ((n = node.nextSibling) !== null && style.has_class(n, "iex_mpreview_stat_sep")) {
							style.add_class(n, "iex_mpreview_stat_sep_visible");
						}
						break;
					}
				}
			}
			else {
				// Hide next
				n = node.nextSibling;
				if (n !== null && style.has_class(n, "iex_mpreview_stat_sep")) {
					if (style.has_class(n, "iex_mpreview_stat_sep_visible")) {
						style.remove_class(n, "iex_mpreview_stat_sep_visible");
						return;
					}
				}

				// Hide previous
				n = node.previousSibling;
				if (n !== null && style.has_class(n, "iex_mpreview_stat_sep")) {
					style.remove_class(n, "iex_mpreview_stat_sep_visible");
				}
			}
		};


		var on_window_resize = function (event) {
			// Update bar position
			if (this.nodes_video.mouse_capturing_element !== null) {
				update_vcontrols_mouse_capture.call(this);
			}
		};
		var on_window_scroll = function (event) {
			// Update bar position
			if (this.nodes_video.mouse_capturing_element !== null) {
				update_vcontrols_mouse_capture.call(this);
			}
		};

		var on_video_loadedmetadata = function (event) {
			if (this.type !== MediaPreview.TYPE_VIDEO) return;

			var video = this.nodes_video.video,
				w = video.videoWidth,
				h = video.videoHeight;


			// Update seek bar
			update_video_duration_status.call(this);
			update_video_seek_status.call(this, 0);

			// Un-hide video
			style.remove_class(video, "iex_mpreview_video_not_ready");

			// Update size
			if (!this.size.acquired || (this.size.width != w || this.size.height != h)) {
				update_size.call(this, w, h);
				style.remove_class(video, "iex_mpreview_video_unsized");
			}

			// Event
			trigger.call(this, "video_ready", {});
		};
		var on_video_canplay = function (event) {
			if (this.type !== MediaPreview.TYPE_VIDEO) return;

			// Event
			on_video_progress.call(this, event);
			trigger.call(this, "video_can_play", {});
		};
		var on_video_canplaythrough = function (event) {
			if (this.type !== MediaPreview.TYPE_VIDEO) return;

			// Event
			on_video_progress.call(this, event);
			trigger.call(this, "video_can_play_through", {});
		};
		var on_video_progress = function (event) {
			if (this.type !== MediaPreview.TYPE_VIDEO) return;

			var video = this.nodes_video.video,
				percent = 0.0;

			if (video.buffered.length > 0) {
				percent = (video.buffered.end(0) / video.duration);
			}

			// Update progress bar
			this.nodes_video.load_progress.style.width = (percent * 100).toFixed(2) + "%";

			// Complete
			if (percent >= 1.0) {
				trigger.call(this, "video_load", {});
			}
		};
		var on_video_error = function (event) {
			if (this.type !== MediaPreview.TYPE_VIDEO) return;

			// Hide video
			style.remove_class(this.nodes_video.video, "iex_mpreview_video_visible");
			this.nodes_video.video.removeAttribute("src");

			// Error
			trigger.call(this, "video_error", {
				reason: "error"
			});
		};
		var on_video_timeupdate = function (event) {
			if (this.type !== MediaPreview.TYPE_VIDEO) return;

			// Update time progress
			update_video_seek_status.call(this, this.nodes_video.video.currentTime);
		};
		var on_video_ended = function (event) {
			if (this.type !== MediaPreview.TYPE_VIDEO) return;

			// Update buttons
			update_video_play_status.call(this, this.nodes_video.video.paused);
		};

		var on_vcontrols_mouseenter = function (event, node) {
			// Do not show for non-video
			if (this.type !== MediaPreview.TYPE_VIDEO) return;

			// Show controls
			style.remove_class(this.nodes_video.volume_container, "iex_mpreview_vcontrols_volume_container_visible");
			style.add_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_visible");
		};
		var on_vcontrols_mouseleave = function (event, node) {
			// Hide controls
			style.remove_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_visible");
		};
		var on_vcontrols_container_mousedown = function (event) {
			var button = 0; // 1=left, 2=middle, 3=right
            if (event.which) {
				if (event.which === 1) button = 1;
				else if (event.which === 2) button = 2;
				else if (event.which === 3) button = 3;
            }
			else {
				if ((event.button & 1) !== 0) button = 1;
				else if ((event.button & 2) !== 0) button = 3;
				else if ((event.button & 4) !== 0) button = 2;
			}

			// Ignore if not left mb
			if (button != 1) return;

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_vcontrols_play_button_click = function (event) {
			// Play/pause
			var video = this.nodes_video.video;

			this.set_video_paused(!video.paused, (event.shiftKey && video.paused) ? (!video.loop) : undefined);
		};
		var on_vcontrols_volume_button_click = function (event) {
			// Mute/unmute
			this.set_video_muted(!this.nodes_video.video.muted);
		};
		var on_vcontrols_volume_button_mouseenter = function (event, node) {
			// Show volume bar
			style.add_class(this.nodes_video.volume_container, "iex_mpreview_vcontrols_volume_container_visible");
		};
		var on_vcontrols_volume_button_container_mouseleave = function (event, node) {
			// Hide volume bar
			style.remove_class(this.nodes_video.volume_container, "iex_mpreview_vcontrols_volume_container_visible");
		};
		var on_vcontrols_seek_bar_mousedown = function (event) {
			// Get the mouse button
			var button = 0; // 1=left, 2=middle, 3=right
            if (event.which) {
				if (event.which === 1) button = 1;
				else if (event.which === 2) button = 2;
				else if (event.which === 3) button = 3;
            }
			else {
				if ((event.button & 1) !== 0) button = 1;
				else if ((event.button & 2) !== 0) button = 3;
				else if ((event.button & 4) !== 0) button = 2;
			}
			if (button != 1) return;

			// Begin seeking
			var video = this.nodes_video.video;

			// Set paused state
			this.nodes_video.seeking = true;
			this.nodes_video.seeking_paused = video.paused;
			if (!video.paused) video.pause();

			// Force visibility
			style.add_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_visible_important");

			// Setup window mousemove and mouseup events
			setup_vcontrols_mouse_capture.call(this);

			// Initial update
			on_vcontrols_capture_mousemove.call(this, event);

			// Stop
			event.stopPropagation();
			event.preventDefault();
			return false;
		};
		var on_vcontrols_volume_bar_mousedown = function (event) {
			// Get the mouse button
			var button = 0; // 1=left, 2=middle, 3=right
            if (event.which) {
				if (event.which === 1) button = 1;
				else if (event.which === 2) button = 2;
				else if (event.which === 3) button = 3;
            }
			else {
				if ((event.button & 1) !== 0) button = 1;
				else if ((event.button & 2) !== 0) button = 3;
				else if ((event.button & 4) !== 0) button = 2;
			}
			if (button != 1) return;

			// Begin volume changing
			var video = this.nodes_video.video;

			// Set paused state
			this.nodes_video.volume_modifying = true;

			// Force visibility
			style.add_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_visible_important");
			style.add_class(this.nodes_video.volume_container, "iex_mpreview_vcontrols_volume_container_visible_important");

			// Setup window mousemove and mouseup events
			setup_vcontrols_mouse_capture.call(this);

			// Initial update
			on_vcontrols_capture_mousemove.call(this, event);

			// Stop
			event.stopPropagation();
			event.preventDefault();
			return false;
		};
		var on_vcontrols_prevent_default_mousedown = function (event) {
			event.preventDefault();
			return false;
		};

		var on_vcontrols_capture_mousemove = function (event) {
			// Begin seeking
			var video = this.nodes_video.video,
				bar_rect = this.nodes_video.mouse_capturing_rect,
				percent, x, y;


			// Get mouse x/y
			if (event.pageX === undefined && (event = event || window.event).clientX !== undefined) {
				var html = document.documentElement, body = document.body;
				if (html && body) {
					x = ((event.clientX || 0) + (html.scrollLeft || (body && body.scrollLeft) || 0)) - (html.clientLeft || 0);
					y = ((event.clientY || 0) + (html.scrollTop || (body && body.scrollTop) || 0)) - (html.clientTop || 0);
				}
			}
			else {
				x = event.pageX || 0;
				y = event.pageY || 0;
			}


			// Set paused state
			if (this.nodes_video.seeking) {
				var duration = video.duration;
				if (!isNaN(duration)) {
					var loaded = (video.buffered.length > 0) ? video.buffered.end(0) / duration : 0.0;

					// Get percent
					percent = (x - bar_rect.left) / (bar_rect.right - bar_rect.left);

					// Bound
					if (percent < 0) percent = 0;
					else if (percent > loaded) percent = loaded;

					// Apply
					percent *= duration;
					video.currentTime = percent;
					update_video_seek_status.call(this, percent);
				}
			}
			else if (this.nodes_video.volume_modifying) {
				// Get percent
				percent = 1.0 - (y - bar_rect.top) / (bar_rect.bottom - bar_rect.top);

				// Bound
				if (percent < 0) percent = 0;
				else if (percent > 1.0) percent = 1.0;

				// Set volume
				set_video_volume.call(this, percent, "seeking", true);
			}
		};
		var on_vcontrols_capture_mouseup = function (event) {
			if (this.nodes_video.seeking) {
				// Unpause
				if (!this.nodes_video.seeking_paused) this.nodes_video.video.play();

				// Un-force visibility
				style.remove_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_visible_important");

				// Done
				this.nodes_video.seeking = false;
			}
			else if (this.nodes_video.volume_modifying) {
				// Save volume
				set_video_volume.call(this, -1, "seek", true);

				// Un-force visibility
				style.remove_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_visible_important");
				style.remove_class(this.nodes_video.volume_container, "iex_mpreview_vcontrols_volume_container_visible_important");

				// Done
				this.nodes_video.volume_modifying = false;
			}

			// Stop capture
			teardown_vcontrols_mouse_capture.call(this);
		};

		var on_image_load = function (event) {
			if (this.type != MediaPreview.TYPE_IMAGE) return;

			// True size
			var w = this.nodes_image.image.naturalWidth,
				h = this.nodes_image.image.naturalHeight;

			// Update size
			if (!this.size.acquired || (this.size.width != w || this.size.height != h)) {
				update_size.call(this, w, h);
				style.remove_class(this.nodes_image.image, "iex_mpreview_image_unsized");
			}

			// Event
			trigger.call(this, "image_load", {});
		};
		var on_image_error = function (event) {
			if (this.type != MediaPreview.TYPE_IMAGE) return;

			// Hide image
			style.remove_class(this.nodes_image.image, "iex_mpreview_image_visible");
			this.nodes_image.image.removeAttribute("src");

			// Error
			trigger.call(this, "image_error", {
				reason: "error"
			});
		};

		var on_mousewheel = function (event) {
			// Get direction
			var delta = (event.wheelDelta || -event.detail || 0);
			if (delta < 0) delta = -1;
			else if (delta > 0) delta = 1;

			// Trigger event
			trigger.call(this, "mouse_wheel", {
				delta: delta,
				mode: this.mouse_wheel_mode
			});

			// Prevent
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_mouseenter = function (event, node) {
			// Trigger event
			trigger.call(this, "mouse_enter", {});
		};
		var on_mouseleave = function (event, node) {
			// Trigger event
			trigger.call(this, "mouse_leave", {});
		};
		var on_mousedown = function (event) {
			// Get the mouse button
			var button = 0; // 1=left, 2=middle, 3=right
            if (event.which) {
				if (event.which === 1) button = 1;
				else if (event.which === 2) button = 2;
				else if (event.which === 3) button = 3;
            }
			else {
				if ((event.button & 1) !== 0) button = 1;
				else if ((event.button & 2) !== 0) button = 3;
				else if ((event.button & 4) !== 0) button = 2;
			}

			// Activate close
			trigger.call(this, "mouse_down", {
				button: button
			});
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_contextmenu = function (event) {
			// Stop
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_mousemove = function (event) {
			// Get mouse x/y
			var x, y;
			if (event.pageX === undefined && (event = event || window.event).clientX !== undefined) {
				var html = document.documentElement, body = document.body;
				if (html && body) {
					x = ((event.clientX || 0) + (html.scrollLeft || (body && body.scrollLeft) || 0)) - (html.clientLeft || 0);
					y = ((event.clientY || 0) + (html.scrollTop || (body && body.scrollTop) || 0)) - (html.clientTop || 0);
				}
			}
			else {
				x = event.pageX || 0;
				y = event.pageY || 0;
			}

			// Event
			trigger.call(this, "mouse_move", {
				x: x,
				y: y,
			});
		};
		var on_overflow_mouseenter = function (event, node) {
			// Trigger event
			trigger.call(this, "mouse_enter_main", {});
		};

		var on_stats_mouseenter = function (event, node) {
			// Stop hiding if it's already open
			this.nodes.mouse_in_stats = true;
			show_zoom_controls.call(this, false);
		};
		var on_stats_mouseleave = function (event, node) {
			// Hide controls
			this.nodes.mouse_in_stats = false;
			hide_zoom_controls.call(this, false, true);
		};
		var on_stats_zoom_mouseenter = function (event, node) {
			// Show controls
			if (this.nodes.stats_zoom_controls_enabled) {
				show_zoom_controls.call(this, true);
			}
		};
		var on_stats_zoom_controls_mouseenter = function (event, node) {
			// Display controls and make fixed
			show_zoom_controls.call(this, true);
			set_zoom_controls_fixed.call(this, true);
		};
		var on_stats_zoom_controls_mouseleave = function (event, node) {
			// Make un-fixed and possibly hide
			set_zoom_controls_fixed.call(this, false);
			if (!this.nodes.mouse_in_stats) {
				hide_zoom_controls.call(this, true, true);
			}
		};
		var on_stats_zoom_controls_mousedown = function (event) {
			// Stop
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_stats_zoom_control_click = function (delta, event) {
			// Event
			trigger.call(this, "stats_zoom_control_click", {
				delta: delta
			});

			// Stop
			event.preventDefault();
			event.stopPropagation();
			return false;
		};



		MediaPreview.prototype = {
			constructor: MediaPreview,

			destroy: function () {
				// Clear
				this.clear();

				// Remove events
				for (var i = 0, el; i < this.event_listeners.length; ++i) {
					el = this.event_listeners[i];
					this.remove_event_listener(el[0], el[1], el[2], el[3]);
				}
				this.event_listeners = [];

				// Remove
				this.remove();
			},

			clear: function () {
				var type = this.type;
				this.type = MediaPreview.TYPE_NONE;

				// Clear background
				this.nodes.background.style.backgroundImage = "";
				style.remove_classes(this.nodes.background, "iex_mpreview_background_visible iex_mpreview_background_visible_full iex_mpreview_background_disabled iex_mpreview_background_fallback");

				if (type == MediaPreview.TYPE_IMAGE) {
					// Remove previous image
					style.remove_class(this.nodes_image.image, "iex_mpreview_image_visible");
					this.nodes_image.image.removeAttribute("src");
				}
				else if (type == MediaPreview.TYPE_VIDEO) {
					// Clear video
					style.remove_classes(this.nodes_video.video, "iex_mpreview_video_visible iex_mpreview_video_not_ready");
					this.set_video_paused(true);
					this.nodes_video.video.removeAttribute("src");

					// Clear seek status
					this.nodes_video.load_progress.style.width = "0";
					this.nodes_video.play_progress.style.width = "0";

					// Update time numbers
					this.nodes_video.time_current.textContent = "";
					this.nodes_video.time_duration.textContent = "";

					update_video_play_status.call(this, true);
				}

				// Clear stats
				this.clear_stats();
			},

			on: function (event, callback) {
				// Add callback
				if (event in this.events) {
					this.events[event].push(callback);
				}
			},
			off: function (event, callback) {
				// Add callback
				if (event in this.events) {
					var e_list = this.events[event];
					for (var i = 0; i < e_list.length; ++i) {
						if (e_list[i] === callback) {
							// Remove
							e_list.splice(i, 1);
							return true;
						}
					}
				}

				return false;
			},

			get_type: function () {
				return this.type;
			},
			get_video_volume: function () {
				return (this.type !== MediaPreview.TYPE_VIDEO) ? 0.0 : this.nodes_video.video.volume;
			},
			get_video_muted: function () {
				return (this.type !== MediaPreview.TYPE_VIDEO) ? true : this.nodes_video.video.muted;
			},

			set_image: function (image) {
				// Unset previous
				this.clear();

				// Set type
				this.type = MediaPreview.TYPE_IMAGE;
				if (this.nodes_image === null) this.nodes_image = new MediaPreviewImageNodes(this);

				// Set
				style.add_class(this.nodes_image.image, "iex_mpreview_image_visible");
				this.nodes_image.image.setAttribute("src", image.replace(/#.*$/, ""));
			},
			set_video: function (video) {
				// Unset previous
				this.clear();

				// Set type
				this.type = MediaPreview.TYPE_VIDEO;
				if (this.nodes_video === null) {
					this.nodes_video = new MediaPreviewVideoNodes(this);
					this.set_vcontrols_borders_rounded(this.style.vcontrols_rounded);
				}

				// Set
				style.add_class(this.nodes_video.video, "iex_mpreview_video_visible");
				style.add_class(this.nodes_video.video, "iex_mpreview_video_not_ready");
				this.nodes_video.video.setAttribute("src", video.replace(/#.*$/, ""));
			},
			set_background: function (image, visibility_level) {
				// visibility_level: 0=hidden, 1=transparent, 2=full
				if (image) {
					// Set background
					style.add_class(this.nodes.background, "iex_mpreview_background_visible");
					this.set_background_style(visibility_level);
					this.nodes.background.style.backgroundImage = 'url("' + image + '")';
				}
				else {
					// Clear background
					style.remove_classes(this.nodes.background, "iex_mpreview_background_visible iex_mpreview_background_disabled iex_mpreview_background_visible_full");
					this.nodes.background.style.backgroundImage = "";
				}
			},
			set_background_style: function (visibility_level) {
				// visibility_level: 0=hidden, 1=transparent, 2=full
				if (visibility_level === 0) {
					style.add_class(this.nodes.background, "iex_mpreview_background_disabled");
					style.remove_class(this.nodes.background, "iex_mpreview_background_visible_full");
				}
				else if (visibility_level == 1) {
					style.remove_classes(this.nodes.background, "iex_mpreview_background_disabled iex_mpreview_background_visible_full");
				}
				else {
					style.add_class(this.nodes.background, "iex_mpreview_background_visible_full");
					style.remove_class(this.nodes.background, "iex_mpreview_background_disabled");
				}
			},
			set_background_animations: function (animate) {
				if (animate) style.add_class(this.nodes.background, "iex_transitions");
				else style.remove_class(this.nodes.background, "iex_transitions");
			},

			set_mouse_wheel_mode: function (mode) {
				this.mouse_wheel_mode = mode;
			},

			set_view_borders: function (horizontal, vertical) {
				var zoom_borders = this.nodes.zoom_borders,
					w = (horizontal * 100).toFixed(2) + "%",
					h = (vertical * 100).toFixed(2) + "%";

				// Set view borders sizing
				zoom_borders.style.left = w;
				zoom_borders.style.top = h;
				zoom_borders.style.right = w;
				zoom_borders.style.bottom = h;
			},
			set_view_borders_visible: function (visible) {
				var zoom_borders = this.nodes.zoom_borders;

				// Change visibility
				if (visible === true) {
					style.add_class(zoom_borders, "iex_mpreview_zoom_borders_visible");
				}
				else {
					style.remove_class(zoom_borders, "iex_mpreview_zoom_borders_visible");
				}
			},
			set_view_borders_visible_sides: function (horizontal, vertical) {
				var zoom_borders = this.nodes.zoom_borders;

				// Change visibility
				if (horizontal) style.add_class(zoom_borders, "iex_mpreview_zoom_borders_horizontal");
				else style.remove_class(zoom_borders, "iex_mpreview_zoom_borders_horizontal");

				if (vertical) style.add_class(zoom_borders, "iex_mpreview_zoom_borders_vertical");
				else style.remove_class(zoom_borders, "iex_mpreview_zoom_borders_vertical");
			},
			set_mouse_visible: function (visible) {
				if (visible) style.remove_class(this.cpreview.nodes.padding, "iex_mpreview_mouse_hidden");
				else style.add_class(this.cpreview.nodes.padding, "iex_mpreview_mouse_hidden");
			},

			add_to: function (parent) {
				this.cpreview.add_to(parent);
			},
			remove: function () {
				this.cpreview.remove();
			},

			set_visible: function (visible) {
				this.cpreview.set_visible(visible);
				if (!visible) this.clear();
			},
			set_fixed: function (fixed) {
				this.cpreview.set_fixed(fixed);
			},
			set_window: function (x, y, width, height, fixed) {
				this.cpreview.set_window(x, y, width, height, fixed);
			},
			set_zoom: function (zoom, fit, large, axis) {
				// Update fit
				if (fit !== undefined) {
					this.fit = fit;
					this.fit_large = large;
				}

				// Detect scale
				if (axis !== undefined) this.fit_axis = axis;
				var scale = 1.0;
				if (this.fit) {
					scale = (this.fit_axis === 0) ?
						(this.cpreview.display.width / this.size.width) :
						(this.cpreview.display.height / this.size.height);
				}

				// Set zoom
				if (zoom !== undefined) {
					this.zoom = zoom;
				}

				scale *= this.zoom;
				this.cpreview.set_size(this.size.width * scale, this.size.height  * scale);
			},
			set_size: function (width, height, acquired) {
				this.size.width = width;
				this.size.height = height;
				if (acquired === true || acquired === false) this.size.acquired = acquired;
			},
			set_offset: function (x, y) {
				this.cpreview.set_offset(x, y);
			},
			set_paddings: function (top, right, bottom, left) {
				this.cpreview.set_paddings(top, right, bottom, left);
			},
			clear_size: function () {
				this.cpreview.clear_size();
			},
			clear_paddings: function () {
				this.cpreview.clear_paddings();
			},

			video_interacted: function () {
				return (this.nodes_video !== null && this.nodes_video.interacted);
			},
			clear_video_interactions: function () {
				if (this.nodes_video !== null) this.nodes_video.interacted = false;
			},

			set_video_muted: function (muted) {
				if (this.nodes_video === null) return;

				// Apply
				this.nodes_video.video.muted = muted;

				// Change icon
				if (muted) style.add_class_svg(this.nodes_video.svg_volume, "iex_svg_volume_button_muted");
				else style.remove_class_svg(this.nodes_video.svg_volume, "iex_svg_volume_button_muted");

				// Interacted
				this.nodes_video.interacted = true;
			},
			set_video_volume: function (volume) {
				if (this.nodes_video === null) return;

				set_video_volume.call(this, volume, "set", true);
			},
			set_video_paused: function (paused, loop) {
				if (this.nodes_video === null) return;

				var video = this.nodes_video.video;

				// Loop
				if (loop === true || loop === false) {
					video.loop = loop;
				}

				// Pause or play
				if (paused) video.pause();
				else video.play();

				// Interacted
				this.nodes_video.interacted = true;

				// Update buttons
				update_video_play_status.call(this, paused);
			},

			set_show_volume_controls_temp: function (show, duration) {
				if (this.type !== MediaPreview.TYPE_VIDEO) return;

				// Toggle
				var cls1 = "iex_mpreview_vcontrols_table_visible_temp",
					cls2 = "iex_mpreview_vcontrols_volume_container_visible_temp";

				if (show) {
					style.add_class(this.nodes_video.overlay_table, cls1);
					style.add_class(this.nodes_video.volume_container, cls2);

					// Timer
					if (duration !== undefined) {
						if (this.volume_controls_temp_timer !== null) {
							clearTimeout(this.volume_controls_temp_timer);
						}
						this.volume_controls_temp_timer = setTimeout(this.set_show_volume_controls_temp.bind(this, false, 0.0), duration * 1000);
					}
				}
				else {
					// Hide
					style.remove_class(this.nodes_video.overlay_table, cls1);
					style.remove_class(this.nodes_video.volume_container, cls2);

					// Clear timeout
					if (this.volume_controls_temp_timer !== null) {
						clearTimeout(this.volume_controls_temp_timer);
						this.volume_controls_temp_timer = null;
					}
				}
			},

			is_visible: function () {
				return this.cpreview.visible;
			},

			get_inner_rect: function () {
				return style.get_object_rect(this.cpreview.nodes.overflow);
			},
			get_window: function () {
				return this.cpreview.display;
			},

			add_event_listener: function (node, event, callback, capture) {
				node.addEventListener(event, callback, capture);
				this.event_listeners.push([node, event, callback, capture]);
			},
			remove_event_listener: function (node, event, callback, capture, remove) {
				node.removeEventListener(event, callback, capture);
				if (remove) {
					for (var i = 0, j = this.event_listeners.length; i < j; ++i) {
						if (
							this.event_listeners[i][0] === event &&
							this.event_listeners[i][1] === callback &&
							this.event_listeners[i][2] === capture
						) {
							this.event_listeners.splice(i, 1);
							return;
						}
					}
				}
			},

			set_vcontrols_mini_available: function (available) {
				if (this.nodes_video === null) return;

				if (available) style.remove_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_mini_disabled");
				else style.add_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_mini_disabled");
			},
			set_vcontrols_mini_visible: function (visible) {
				if (this.nodes_video === null) return;

				if (visible) style.add_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_mini");
				else style.remove_class(this.nodes_video.overlay_table, "iex_mpreview_vcontrols_table_mini");
			},
			set_vcontrols_borders_rounded: function (rounded) {
				this.style.vcontrols_rounded = rounded;
				if (this.nodes_video === null) return;

				if (rounded) {
					style.remove_class(this.nodes_video.volume_bar, "iex_mpreview_vcontrols_no_border_radius");
					style.remove_class(this.nodes_video.seek_bar, "iex_mpreview_vcontrols_no_border_radius");
				}
				else {
					style.add_class(this.nodes_video.volume_bar, "iex_mpreview_vcontrols_no_border_radius");
					style.add_class(this.nodes_video.seek_bar, "iex_mpreview_vcontrols_no_border_radius");
				}
			},

			clear_stats: function () {
				this.set_stat_zoom(false);
				this.set_stat_status(false);
				this.set_stat_resolution(false);
				this.set_stat_file_size(false);
				this.set_stat_file_name(false);
			},
			set_stat_zoom: function (visible, text, text_fit) {
				if (visible === false) {
					style.remove_class(this.nodes.stat_zoom_container, "iex_mpreview_stat_visible");
					update_stat_sep_visibility.call(this, this.nodes.stat_zoom_container, false);
					this.nodes.stat_zoom.textContent = "";
					this.nodes.stat_zoom_fit.textContent = "";
				}
				else {
					if (visible) {
						style.add_class(this.nodes.stat_zoom_container, "iex_mpreview_stat_visible");
						update_stat_sep_visibility.call(this, this.nodes.stat_zoom_container, true);
					}
					this.nodes.stat_zoom.textContent = text;
					this.nodes.stat_zoom_fit.textContent = text_fit;
				}
			},
			set_stat_status: function (visible, text, type) {
				if (visible === false) {
					style.remove_classes(this.nodes.stat_status, "iex_mpreview_stat_visible iex_mpreview_stat_red");
					update_stat_sep_visibility.call(this, this.nodes.stat_status, false);
					this.nodes.stat_status.textContent = "";
				}
				else {
					if (visible) {
						style.add_class(this.nodes.stat_status, "iex_mpreview_stat_visible");
						update_stat_sep_visibility.call(this, this.nodes.stat_status, true);
					}
					if (type == "error") {
						style.add_class(this.nodes.stat_status, "iex_mpreview_stat_red");
					}
					else {
						style.remove_class(this.nodes.stat_status, "iex_mpreview_stat_red");
					}
					this.nodes.stat_status.textContent = text;
				}
			},
			set_stat_resolution: function (visible, text) {
				if (visible === false) {
					style.remove_class(this.nodes.stat_resolution, "iex_mpreview_stat_visible");
					update_stat_sep_visibility.call(this, this.nodes.stat_resolution, false);
					this.nodes.stat_resolution.textContent = "";
				}
				else {
					if (visible) {
						style.add_class(this.nodes.stat_resolution, "iex_mpreview_stat_visible");
						update_stat_sep_visibility.call(this, this.nodes.stat_resolution, true);
					}
					this.nodes.stat_resolution.textContent = text;
				}
			},
			set_stat_file_size: function (visible, text) {
				if (visible === false) {
					style.remove_class(this.nodes.stat_filesize, "iex_mpreview_stat_visible");
					update_stat_sep_visibility.call(this, this.nodes.stat_filesize, false);
					this.nodes.stat_filesize.textContent = "";
				}
				else {
					if (visible) {
						style.add_class(this.nodes.stat_filesize, "iex_mpreview_stat_visible");
						update_stat_sep_visibility.call(this, this.nodes.stat_filesize, true);
					}
					this.nodes.stat_filesize.textContent = text;
				}
			},
			set_stat_file_name: function (visible, text) {
				if (visible === false) {
					style.remove_class(this.nodes.stat_filename, "iex_mpreview_stat_visible");
					update_stat_sep_visibility.call(this, this.nodes.stat_filename, false);
					this.nodes.stat_filename.textContent = "";
				}
				else {
					if (visible) {
						style.add_class(this.nodes.stat_filename, "iex_mpreview_stat_visible");
						update_stat_sep_visibility.call(this, this.nodes.stat_filename, true);
					}
					this.nodes.stat_filename.textContent = text;
				}
			},

			set_zoom_control_buttons_enabled: function (enabled) {
				if (this.nodes === null) return;

				this.nodes.stats_zoom_controls_enabled = enabled;
			},

			transfer_video_state: function (node) {
				if (node.tagName === "VIDEO" && this.type === MediaPreview.TYPE_VIDEO) {
					// Transfer video state
					var v = this.nodes_video.video,
						muted = v.muted,
						volume = v.volume,
						time = v.currentTime,
						paused = v.paused,
						okay = false,
						fn;

					fn = function () {
						this.muted = muted;
						this.volume = volume;
						this.currentTime = time;
						if (paused) this.pause();
						else this.play();
					};

					if (!node.paused || !isNaN(node.duration)) {
						// Immediate
						try {
							fn.call(node);
							okay = true;
						}
						catch (e) {}
					}
					if (!okay) {
						// Delay until playing
						var play_fn = function (event) {
							try {
								fn.call(this);
							}
							catch (e) {}
							this.removeEventListener("play", play_fn, false);
						};
						node.addEventListener("play", play_fn, false);
					}
				}
			},
			load_video_state: function (state) {
				if (this.type === MediaPreview.TYPE_VIDEO) {
					// Update
					var self = this,
						v = this.nodes_video.video,
						target = v.getAttribute("src") || "",
						event_fn, fn;

					fn = function () {
						// Set state
						this.set_video_muted(state.muted);
						this.set_video_volume(state.volume);
						this.set_video_paused(state.paused);
						this.nodes_video.video.currentTime = state.time;
					};

					if (isNaN(v.currentTime) || v.buffered.length <= 0) {
						// Delay
						self = this;
						event_fn = function () {
							if (target === this.getAttribute("src") || "") {
								fn.call(self);
							}
							this.removeEventListener("loadedmetadata", event_fn, false);
						};

						// Listen
						v.addEventListener("loadedmetadata", event_fn, false);
					}
					else {
						fn.call(this);
					}
				}
			},
		};



		return MediaPreview;

	})();

	// Content preview base
	var ContentPreview = (function () {

		var ContentPreviewNodes = function () {
			var theme = style.theme;

			// Main container
			this.container = document.createElement("div");
			this.container.className = "iex_cpreview_container iex_cpreview_container_visible" + theme;

			// Position/padding container
			this.padding = document.createElement("div");
			this.padding.className = "iex_cpreview_padding" + theme;
			this.container.appendChild(this.padding);

			// Overflow container
			this.overflow = document.createElement("div");
			this.overflow.className = "iex_cpreview_overflow" + theme;
			this.padding.appendChild(this.overflow);

			// Offset container
			this.offset = document.createElement("div");
			this.offset.className = "iex_cpreview_offset" + theme;
			this.overflow.appendChild(this.offset);
		};



		var ContentPreview = function () {
			this.nodes = new ContentPreviewNodes();

			this.visible = true;

			this.offset_x = 0;
			this.offset_y = 0;

			this.size = {
				width: 0,
				height: 0,
			};
			this.display = {
				x: 0,
				y: 0,
				width: 0,
				height: 0,
			};

			this.fixed = false;
		};



		ContentPreview.prototype = {
			constructor: ContentPreview,

			set_visible: function (visible) {
				// Add or remove visibility
				this.visible = visible;
				if (visible) style.add_class(this.nodes.container, "iex_cpreview_container_visible");
				else style.remove_class(this.nodes.container, "iex_cpreview_container_visible");
			},
			set_fixed: function (fixed) {
				// No change
				if (this.fixed == fixed) return;

				var container = this.nodes.container,
					doc_offset = style.get_document_offset();

				// Fixed position
				this.fixed = fixed;
				if (this.fixed) {
					this.display.x -= doc_offset.left;
					this.display.y -= doc_offset.top;
					style.add_class(container, "iex_cpreview_container_fixed");
				}
				else {
					this.display.x += doc_offset.left;
					this.display.y += doc_offset.top;
					style.remove_class(container, "iex_cpreview_container_fixed");
				}

				// Position
				container.style.left = this.display.x.toFixed(2) + "px";
				container.style.top = this.display.y.toFixed(2) + "px";
			},
			set_window: function (x, y, width, height, fixed) {
				var container = this.nodes.container,
					overflow = this.nodes.overflow;

				// Fixed position
				if (fixed !== undefined) {
					this.fixed = fixed;
					if (fixed) style.add_class(this.nodes.container, "iex_cpreview_container_fixed");
					else style.remove_class(this.nodes.container, "iex_cpreview_container_fixed");
				}

				// Position
				container.style.left = x.toFixed(2) + "px";
				container.style.top = y.toFixed(2) + "px";

				// Size
				overflow.style.width = width.toFixed(2) + "px";
				overflow.style.height = height.toFixed(2) + "px";

				// Set
				this.display.x = x;
				this.display.y = y;
				this.display.width = width;
				this.display.height = height;
			},
			set_size: function (width, height, offset_x, offset_y) {
				var offset = this.nodes.offset,
					w_diff = width - this.display.width,
					h_diff = height - this.display.height;

				// Bound
				if (w_diff < 0) w_diff = 0;
				if (h_diff < 0) h_diff = 0;

				// Set size
				this.size.width = width;
				this.size.height = height;

				// Set offset
				if (offset_x !== undefined && offset_y !== undefined) {
					this.offset_x = offset_x;
					this.offset_y = offset_y;
				}

				// Set visible size
				offset.style.width = width.toFixed(2) + "px";
				offset.style.height = height.toFixed(2) + "px";
				style.add_class(offset, "iex_cpreview_offset_sized");

				// Set visible offset
				offset.style.left = (w_diff * -this.offset_x).toFixed(2) + "px";
				offset.style.top = (h_diff * -this.offset_y).toFixed(2) + "px";
			},
			set_offset: function (x, y) {
				var offset = this.nodes.offset,
					w_diff = this.size.width - this.display.width,
					h_diff = this.size.height - this.display.height;

				// Bound
				if (w_diff < 0) w_diff = 0;
				if (h_diff < 0) h_diff = 0;

				// Set offset
				this.offset_x = x;
				this.offset_y = y;

				// Set visible offset
				offset.style.left = (w_diff * -x).toFixed(2) + "px";
				offset.style.top = (h_diff * -y).toFixed(2) + "px";
			},
			set_paddings: function (top, right, bottom, left) {
				// Set paddings
				this.nodes.padding.style.top = (-top).toFixed(2) + "px";
				this.nodes.padding.style.left = (-left).toFixed(2) + "px";
				this.nodes.padding.style.padding = top.toFixed(2) + "px " + right.toFixed(2) + "px " + bottom.toFixed(2) + "px " + left.toFixed(2) + "px";
			},

			clear_size: function () {
				this.nodes.offset.style.width = "";
				this.nodes.offset.style.height = "";

				this.size.width = 0;
				this.size.height = 0;
			},
			clear_paddings: function () {
				// Clear paddings
				this.nodes.padding.style.top = "";
				this.nodes.padding.style.left = "";
				this.nodes.padding.style.padding = "";
			},

			add_to: function (parent) {
				parent.appendChild(this.nodes.container);
			},
			remove: function () {
				var par = this.nodes.container.parentNode;
				if (par) par.removeChild(this.nodes.container);
			},
			add_content: function (node) {
				// Add to offset
				style.add_class(node, "iex_cpreview_content");
				this.nodes.offset.appendChild(node);
			},
			add_overlay: function (node, outside) {
				// Add to overflow or padding
				style.add_class(node, "iex_cpreview_overlay");
				(outside ? this.nodes.padding : this.nodes.overflow).appendChild(node);
			},

		};



		return ContentPreview;

	})();



	// Style
	style = new Style();
	// Create the API
	api = new API();
	// Sync
	sync = new Sync();
	// Create the settings
	settings = new Settings();
	// Hotkey manager
	hotkey_manager = new HotkeyManager();

	// Execute once page type is detected
	api.on("page_type_detected", function (event) {
		if (event.page_type == "board" || event.page_type == "thread" || event.page_type == "catalog") {
			// Settings
			settings.setup();

			// Insert stylesheet
			style.insert_stylesheet();

			// Create new hover
			hover = new Hover();
			hover.start();

			// Create image hover manager
			image_hover = new ImageHover(hover);
			settings.on_ready(image_hover.start.bind(image_hover));

			// Create image link modifier
			file_link = new FileLink();
			settings.on_ready(file_link.start.bind(file_link));
		}
		else if (event.page_type == "image" || event.page_type == "video") {
			// Settings
			settings.setup();

			// File view
			file_view = new FileView();
			settings.on_ready(file_view.start.bind(file_view));
		}
	});
	api.setup();

})();


