// ==UserScript==
// @name        Image Extensions
// @description Expand images nicely
// @namespace   dnsev
// @version     2.0
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @run-at      document-start
// @icon        data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAr0lEQVRo3u2ZQQ6AIAwEW+Nj9UX623pVQ2NRDIIzZyHdMGkhqhwxSaNSh8t6Bmmc5gPo6Zi0kboNhQhAgE4CABQYZOlJsbj3kDqFzula6UK1GV1tpp1Bq2PaFLBsvzayp7O/iVpKJxT6lEIhnqgV0SlTMxRqT6FcVd7oTijUjUKrltGPLvQrhbzjLtVtMr9HIV5kvMgA/g0/OOhCBCAAAQjQ1XXabqx5bUhFakCh2mytCzMhi1UZlAAAAABJRU5ErkJggg==
// @include     *://boards.4chan.org/*
// @updateURL   https://raw.githubusercontent.com/dnsev/iex/master/builds/iex.meta.js
// @downloadURL https://raw.githubusercontent.com/dnsev/iex/master/builds/iex.user.js
// ==/UserScript==



(function () {
	"use strict";



	// Browser version
	var is_firefox = (navigator.userAgent.toString().indexOf("Firefox") >= 0);
	var is_chrome = (navigator.userAgent.toString().indexOf(" Chrome/") >= 0);
	var is_opera = !is_firefox && !is_chrome && !(navigator.userAgent.toString().indexOf("MSIE") >= 0);
	var userscript = {"include":["*://boards.4chan.org/*"],"name":"Image Extensions","grant":["GM_getValue","GM_setValue","GM_deleteValue"],"run-at":"document-start","namespace":"dnsev","updateURL":"https://raw.githubusercontent.com/dnsev/iex/master/builds/iex.meta.js","downloadURL":"https://raw.githubusercontent.com/dnsev/iex/master/builds/iex.user.js","version":"2.0","icon":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAr0lEQVRo3u2ZQQ6AIAwEW+Nj9UX623pVQ2NRDIIzZyHdMGkhqhwxSaNSh8t6Bmmc5gPo6Zi0kboNhQhAgE4CABQYZOlJsbj3kDqFzula6UK1GV1tpp1Bq2PaFLBsvzayp7O/iVpKJxT6lEIhnqgV0SlTMxRqT6FcVd7oTijUjUKrltGPLvQrhbzjLtVtMr9HIV5kvMgA/g0/OOhCBCAAAQjQ1XXabqx5bUhFakCh2mytCzMhi1UZlAAAAABJRU5ErkJggg==","description":"Expand images nicely"};

	// Error logging
	var log_error = function (error_string) {
		console.log(error_string);
		for (var i = 1; i < arguments.length; ++i) {
			console.log(arguments[i]);
		}
		try {
			null.null;
		}
		catch (e) {
			console.log(e.stack.toString());
		}
		alert(error_string);
	};
	var wrap_callback = function (callback, args) {
		return function () {
			callback.apply(this, args.concat(Array.prototype.slice.call(arguments, 0)));
		};
	};
	var on_mouseenterleave_prehandle = function (self, callback, data, event) {
		// Must check for same parent element
		var parent = event.relatedTarget;

		// Error handling
		try {
			// Find parents
			while (parent && parent !== this) {
				parent = parent.parentNode;
			}

			if (parent !== this) {
				// Okay, handle event
				return callback.call(self, this, data, event);
			}
		}
		catch (e) {
		}
	};



	// Instances
	var api = null, settings = null, sync = null, style = null, image_hover = null, hotkey_manager = null;



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
				var a = undefined;
				return a.b;
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
			// State check
			if (document.readyState == "interactive") {
				if (state == 0) {
					// Mostly loaded
					state = 1;

					// Callbacks
					var c = callbacks_asap;
					callbacks_asap = null;
					trigger_callbacks(c);
				}
			}
			else if (document.readyState == "complete") {
				// Loaded
				state = 2;

				// Callbacks
				var c;
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
		var on_document_load = function () {
			// Loaded
			state = 2;

			// Callbacks
			var c;
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
			if (callbacks_check.length == 0) {
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
			document.addEventListener("load", on_document_load, false);
			on_document_readystatechange_interval = setInterval(on_document_readystatechange, 20);
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

	// Module to manage data saving
	var Save = (function () {

		// Acquire functions
		var w_set_value = window.localStorage.setItem.bind(window.localStorage);
		var w_get_value = window.localStorage.getItem.bind(window.localStorage);
		var w_del_value = window.localStorage.removeItem.bind(window.localStorage);
		var set_value = w_set_value;
		var get_value = w_get_value;
		var del_value = w_del_value;
		var using_localstorage = true;
		try {
			if (GM_setValue && GM_getValue && GM_deleteValue) {
				set_value = GM_setValue;
				get_value = GM_getValue;
				del_value = GM_deleteValue;
				using_localstorage = false;
			}
		}
		catch (e) {
			set_value = w_set_value;
			get_value = w_get_value;
			del_value = w_del_value;
		}

		// Return functions
		return {

			set: set_value, // key, value
			get: get_value, // key, default
			del: del_value, // key
			w_set: w_set_value,
			w_get: w_get_value,
			w_del: w_del_value,
			s_set: window.sessionStorage.setItem.bind(window.sessionStorage),
			s_get: window.sessionStorage.getItem.bind(window.sessionStorage),
			s_del: window.sessionStorage.removeItem.bind(window.sessionStorage),
			is_using_localstorage: using_localstorage,

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
							if (list.length == 0) {
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
				"posts": get_all_posts.bind(this)
			};

			// Nodes
			this.settings_4chanx_container = null;
			this.settings_vanilla_container = null;
			this.menu_4chanx_container = null;

			// Script
			this.is_4chanx = false;
			this.is_appchanx = false;

			// Document listening
			this.doc_observer = null;
			this.body_observer = null;
			this.delform_observer = null;
			this.settings_observer = null;
			this.hover_ui_observer = null;
			this.header_settings_menu_observer = null;

			// Check for other addons
			hook_document_observer.call(this);
			ASAP.asap(on_asap_check.bind(this));
		};



		var on_4chanx_post_callback = function (self, callback) {
			callback.call(self, this);
		};
		var on_4chanx_thread_callback = function (self, callback) {
			callback.call(self, this);
		};

		var on_document_observe = function (records) {
			var i, j, nodes, r;

			for (i = 0; i < records.length; ++i) {
				var r = records[i];

				if (r.attributeName == "class") {
					// Detect
					detect_scripts.call(this, r.target);
				}
			}
		};

		var on_body_observe = function (records) {
			for (var i = 0; i < records.length; ++i) {
				var nodes;
				if ((nodes = records[i].addedNodes)) {
					for (var j = 0; j < nodes.length; ++j) {
						// Check
						on_body_element_add.call(this, nodes[j]);
					}
				}
				if ((nodes = records[i].removedNodes)) {
					for (var j = 0; j < nodes.length; ++j) {
						// Check
						on_body_element_remove.call(this, nodes[j]);
					}
				}
			}
		};
		var on_body_element_add = function (element) {
			var id = element.getAttribute("id");
			if (id == "fourchanx-settings") {
				// 4chan-x / Spittie
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
				var pc = n.querySelector(".postContainer");
				if (pc) {
					trigger.call(this, "post_add", pc);
				}
				// else, post might not be loaded yet
			}
			else if (id == "menu") {
				// 4chan-x / Spittie, appchan-x
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
				var pc = n.querySelector(".postContainer");
				if (pc) {
					trigger.call(this, "post_remove", pc);
				}
			}
			else if (id == "menu") {
				// 4chan-x / Spittie, appchan-x
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

		var on_menu_4chanx_entry_mouseenter = function (element, data, event) {
			if (this.menu_4chanx_container) {
				var focused = this.menu_4chanx_container.querySelectorAll(".focused"),
					i;

				for (i = 0; i < focused.length; ++i) {
					style.remove_class(focused[i], "focused");
				}
			}

			style.add_class(element, "focused");
		};
		var on_menu_4chanx_entry_mouseleave = function (element, data, event) {
			// This is removed even for versions which menu items keep it (4chan-x / Spittie, etc.)
			style.remove_class(element, "focused");
		};

		var on_asap_check = function () {
			// Hook
			hook_body_observers.call(this);
			hook_hover_observers.call(this, null);
			hook_delform_observers.call(this, null);
			hook_header_observers.call(this, null);

			// Detect scripts
			var el = document.documentElement;
			if (el) {
				detect_scripts.call(this, el, true);
			}
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
				var e_enter = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_menu_4chanx_entry_mouseenter , null ]),
					e_leave = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_menu_4chanx_entry_mouseleave , null ]);
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
				// Expanded
				if (this.is_4chanx) {
					if (style.has_class(post_container, "expanded-image")) return true;

					// Get the .file container
					var n_file = this.post_get_file_info_container(post_container),
						n_img;

					// Find image
					n_img = n_file.querySelector("img");
					return (n_img && style.has_class(n_img, "expanding"));
				}
				else {
					// Get the .file container
					var n_file = this.post_get_file_info_container(post_container);

					// Return
					return (style.has_class(n_file, "image-expanded"));
				}
			},
			post_get_file_info: function (post_container) {
				// Setup info
				var info = {
					image: "",
					thumb: null,
					spoiler: null,
					filename: "",
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
							info.image = n.getAttribute("href") || "";
							info.filename = n.textContent.trim();
						}
						if ((n = n_p.lastChild)) {
							m = /([0-9\.]+)\s*(\w?b),(?:\s*([0-9]+)x([0-9]+))?/i.exec((n.textContent || ""));
							if (m) {
								info.size = parseFloat(m[1]);
								info.size_label = m[2].toLowerCase();
								if (m[3] != null) {
									info.resolution.width = parseInt(m[3], 10);
									info.resolution.height = parseInt(m[4], 10);
								}
							}
						}
					}
					else if ((n_p = n_file.querySelector(".fileText"))) {
						// Vanilla
						if ((n = n_p.querySelector("a"))) {
							info.image = n.getAttribute("href") || "";

							if ((n = n.nextSibling)) {
								m = /([0-9\.]+)\s*(\w?b),(?:\s*([0-9]+)x([0-9]+))?/i.exec((n.textContent || ""));
								if (m) {
									info.size = parseFloat(m[1]);
									info.size_label = m[2].toLowerCase();
									if (m[3] != null) {
										info.resolution.width = parseInt(m[3], 10);
										info.resolution.height = parseInt(m[4], 10);
									}
								}
							}
						}
						if ((n = n_p.querySelector("span"))) {
							info.filename = n.getAttribute("title") || n.textContent || "";
						}
						else {
							// Spoilers
							info.filename = n_p.getAttribute("title") || "";
						}
					}

					// Thumbnail and spoiler status
					if ((n_p = n_file.querySelector(".fileThumb"))) {
						if ((n = n_p.querySelector("img:not(.full-image):not(.expanded-thumb)"))) {
							m = n.getAttribute("src");
							if (style.has_class(n_p, "imgspoiler")) {
								info.spoiler = m;
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
						"to_fit": false
					},
					"spoiler": {
						"enabled": true,
						"timeout": 0.0,
						"to_fit": false
					},
					"hover": {
						"zoom_invert": false,
						"zoom_border_show": true,
						"zoom_border_hide_time": 0.5,
						"mouse_hide": true,
						"mouse_hide_time": 1.0,
						"header_overlap": false,
						"fit_large_allowed": true,
						"display_stats": 0
					},
					"video": {
						"autoplay": 1, // 0 = not at all, 1 = asap, 2 = when it can play "through", 3 = fully loaded
						"loop": true,
						"mute_initially": false,
						"volume": 0.5,
						"mini_controls": 1, // 0 = never, 1 = when mouse is over the video, 2 = when mouse is NOT over the video, 3 = always
					},
					"style": {
						"controls_rounded_border": true
					}
				}
			};
			this.save_key = "iex_settings";

			// Value changing events
			this.change_events = {};

			// Load settings
			//this.save_values(); // clear settings to default
			this.load_values(false);

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

			// Events
			sync.on("install_complete", this.on_install_complete_sync_bind = on_install_complete_sync.bind(this));
			sync.on("settings_save", this.on_settings_save_sync_bind = on_settings_save_sync.bind(this));
			sync.on("image_expansion_enable", this.on_image_expansion_enable_sync_bind = on_image_expansion_enable_sync.bind(this));

			// Modify other settings
			api.on("settings_4chanx_section_change", this.on_settings_4chanx_section_change_bind = on_settings_4chanx_section_change.bind(this));
			api.on("settings_vanilla_open", this.on_settings_vanilla_open_bind = on_settings_vanilla_open.bind(this));
			api.on("menu_4chanx_open", this.on_menu_4chanx_open_bind = on_menu_4chanx_open.bind(this));

			// Check for 4chan-x
			ASAP.asap(on_first_run_check.bind(this));
			ASAP.asap(on_insert_links.bind(this), on_insert_links_condition, 0.5);
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
				this.save_values();
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

		var on_first_run_check = function () {
			// First run check
			if (this.values["first_run"]) {
				// Show message
				this.display_first_run_notification();
			}

			// Trigger ready
			trigger_ready.call(this);
		};
		var on_insert_links = function () {
			var nav_nodes = [],
				nav, par, i, c, n;

			if ((nav = document.getElementById("navtopright"))) {
				nav_nodes.push(nav);
			}
			if ((nav = document.getElementById("navbotright"))) {
				nav_nodes.push(nav);
			}

			// Insert
			for (i = 0; i < nav_nodes.length; ++i) {
				par = nav_nodes[i];

				c = par.firstChild;
				if (c && c.nodeType == 3) { // TEXT_NODE
					c.nodeValue = "] [";
				}
				else {
					n = document.createTextNode("]");
					if (c) par.insertBefore(n, c);
					else par.appendChild(n);

					c = n;
				}

				n = document.createElement("a");
				n.textContent = "iex";
				n.setAttribute("target", "_blank");
				n.setAttribute("href", "//dnsev.github.io/iex/");
				n.addEventListener("click", on_main_page_iex_link_click.bind(this), false);
				par.insertBefore(n, c);
				c = n;

				n = document.createTextNode("[")
				par.insertBefore(n, c);
			}
		};
		var on_insert_links_condition = function () {
			return document.getElementById("navtopright") || document.getElementById("navbotright");
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
			this.load_values(true);
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
			var value_new = node.checked, value_old = undefined;
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
			var value_new = node.value, value_old = undefined;
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
			var value_new = descriptor.values[id_new], value_old = undefined;
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
			this.delete_values();

			// Reload
			this.settings_close();
			window.location.reload(false);
		};
		var on_iex_difficulty_link_click = function (self, event) {
			// Get target
			var target = this.getAttribute("iex-settings-difficulty-choice-level") || "";

			// Update difficulty
			change_settings_difficulty.call(self, target);

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_iex_setting_image_expansion_toggle = function (value_new, value_old) {
			// Update other settings after close
			this.settings_update_other_after_close = value_new;
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
				var container_clone = image_hover_setting_container.cloneNode(true);

				// Remove input names and disable
				var inputs = container_clone.querySelectorAll("input");
				for (var i = 0; i < inputs.length; ++i) {
					inputs[i].disabled = true;
					inputs[i].removeAttribute("name");
				}

				// Dim labels and descriptions
				var labels = container_clone.querySelectorAll("label");
				for (var i = 0; i < labels.length; ++i) {
					labels[i].style.opacity = "0.5";
				}

				var descriptions = container_clone.querySelectorAll(".description");
				for (var i = 0; i < descriptions.length; ++i) {
					descriptions[i].style.opacity = "0.5";
				}

				// Add new
				if (api.is_appchanx) {
					container_clone.appendChild(document.createTextNode(" (disable iex)"));

					// Modify old
					var description_old = image_hover_setting_container.querySelector("label");
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
					var description_old = image_hover_setting_container.querySelector(".description");
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
				if (this.values["image_expansion"]["enabled"]) {
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
		var modify_settings_vanilla_display = function (data) {
			// Get the hover setting
			var image_hover_setting = data.container.querySelector("input[data-option='imageHover']");
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
				clone = c.cloneNode(true),

				// Disable inputs
				inputs = clone.querySelectorAll("input");
				for (j = 0; j < inputs.length; ++j) {
					inputs[j].disabled = true;
					inputs[j].removeAttribute("data-option");
				}

				if (i == 0) {
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
				if (this.values["image_expansion"]["enabled"]) {
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
			var old_value;

			for (var key in new_values) {
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
				for (var key in values) {
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
			d_choice.setAttribute("iex-settings-difficulty-choice-level", "normal");
			d_container.appendChild(d_choice);
			cb = wrap_callback(on_iex_difficulty_link_click, [ this ]);
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
			d_choice.setAttribute("iex-settings-difficulty-choice-level", "advanced");
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
				label: "Fit Image",
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
				label: "Fit Image",
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
				label: "Open Timeout",
				sublabel: "for non-spoiler images",
				description: "Time to wait before displaying the image (in seconds)",
				type: "textbox",
			});

			descriptors.push({
				level: "normal",
				section: "Image Expansion",
				tree: [ "image_expansion" , "spoiler" , "timeout" ],
				modify: string_to_float,
				label: "Open Timeout",
				sublabel: "for spoiler images",
				description: "Time to wait before displaying the image (in seconds)",
				type: "textbox",
			});

			// Hover settings
			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "header_overlap" ],
				label: "Overlap Header",
				description: "If the header is visible, the preview will not overlap it",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "don't overlap" , "overlap" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "fit_large_allowed" ],
				label: "Fit Large",
				description: "When enabled, image zooming can be snapped to both vertical and horizontal scales",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "display_stats" ],
				label: "Display Stats",
				description: "Show the file name and relevant stats on top of the preview",
				type: "text",
				values: [ 0 , 1 , 2 ],
				value_labels: [ "show" , "hide" , "hide all" ]
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "zoom_invert" ],
				label: "Zoom Invert Mouse",
				description: "Zoom location based on mouse will be inverted",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "not inverted" , "inverted" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "zoom_border_show" ],
				label: "Zoom Borders",
				description: "Display borders inside the preview displaying the mouse movement region",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "zoom_border_hide_time" ],
				modify: string_to_float,
				label: "Zoom Borders Hide Timeout",
				description: "Time to wait after mouse has stopped to hide the zoom borders (in seconds)",
				type: "textbox",
			});

			descriptors.push({
				level: "normal",
				section: "Hover",
				tree: [ "image_expansion" , "hover" , "mouse_hide" ],
				label: "Cursor Hide",
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
				label: "Cursor Hide Timeout",
				description: "Time to wait after mouse has stopped to hide cursor (in seconds)",
				type: "textbox",
			});

			// Video settings
			descriptors.push({
				level: "normal",
				section: "Video",
				tree: [ "image_expansion" , "video" , "mini_controls" ],
				label: "Mini Controls",
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

			// Style settings
			descriptors.push({
				level: "normal",
				section: "Style",
				tree: [ "image_expansion" , "style" , "controls_rounded_border" ],
				label: "Rounded Borders on Controls",
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
				label: "Display Local Settings",
				description: "Display all saved local data in a pop-up textbox",
				type: "text",
				values: [ true ],
				value_labels: [ "display"  ]
			});

			descriptors.push({
				level: "advanced",
				section: "Debugging",
				change: on_iex_setting_delete_settings.bind(this),
				label: "Delete Local Settings",
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
				var g_key = d.section || "";
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

					g_div.appendChild(generate_settings_container.call(this, d.descriptors, data)[0])
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

				if (count == 0) {
					style.add_class(groups[i], "iex_settings_group_hidden");
				}
				else {
					style.remove_class(groups[i], "iex_settings_group_hidden");
				}
			}

			// Modify difficulty
			choices = this.settings_difficulty_container.querySelectorAll(".iex_settings_difficulty_choice");
			for (i = 0; i < choices.length; ++i) {
				level = choices[i].getAttribute("iex-settings-difficulty-choice-level");
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
			load_values: function (events) {
				// Get
				var new_values = Save.get(this.save_key, null);
				if (new_values != null) {
					// Load
					try {
						new_values = JSON.parse(new_values);
					}
					catch (e) {
						new_values = null;
					}

					if (new_values != null) {
						// Update
						update_values.call(this, [], this.values, new_values, false, events);
					}
					// else, json fail
				}
				// else, not saved
			},
			save_values: function () {
				// Save
				var json_str = JSON.stringify(this.values);
				Save.set(this.save_key, json_str);

				// Sync
				sync.trigger("settings_save");
			},
			delete_values: function () {
				// Delete
				Save.del(this.save_key);
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
							if (list.length == 0) {
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

					if (this.values["image_expansion"]["enabled"]) {
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
				// Get
				var saved_values = Save.get(this.save_key, null);
				if (saved_values === null) {
					saved_values = "null";
				}
				else {
					try {
						saved_values = JSON.stringify(JSON.parse(saved_values), null, "    ");
					}
					catch (e) {}
				}

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
			// Create stylesheet
			var stylesheet_text = "";
			stylesheet_text += //{ Stylesheet
				'\
body.iex_hide_other_settings #settingsMenu,\
body.iex_hide_other_settings #overlay,\
body.iex_hide_other_settings #appchanx-settings,\
body.iex_hide_other_settings #fourchanx-settings{visibility:hidden !important;}\
\
.iex_settings_popup_overlay{position:fixed;z-index:200;left:0;top:0;bottom:0;right:0;font-size:14px;background:rgba(0,0,0,0.25);}\
.iex_settings_popup_overlay.iex_dark{background:rgba(255,255,255,0.25);}\
.iex_settings_popup{margin:0;padding:0;width:100%;height:100%;text-align:center;white-space:nowrap;z-index:200;line-height:0;}\
.iex_settings_popup_aligner{height:100%;width:0;display:inline-block;vertical-align:middle;}\
.iex_settings_popup_inner{display:inline-block;vertical-align:middle;text-align:left;line-height:normal;white-space:normal;position:relative;width:40em;height:80%;min-height:14em;}\
.iex_settings_popup_table{display:table;position:relative;table-layout:fixed;width:100%;height:100%;box-shadow:0 0 1em 0.25em #000000;}\
.iex_settings_popup_table.iex_dark{box-shadow:0 0 1em 0.25em #ffffff;}\
.iex_settings_popup_top{display:table-row;width:100%;}\
.iex_settings_popup_top_content{display:table;width:100%;background:rgba(0,0,0,0.0625);}\
.iex_settings_popup_top_content.iex_dark{background:rgba(255,255,255,0.0625);}\
.iex_settings_popup_top_label{display:table-cell;vertical-align:middle;padding:0.25em;font-size:1.125em;font-weight:bold;text-shadow:0 0.0625em 0.25em #ffffff;}\
.iex_settings_popup_top_label.iex_dark{text-shadow:0 0.0625em 0.25em #000000;}\
.iex_settings_popup_top_right{display:table-cell;vertical-align:middle;padding:0.25em;text-align:right;}\
.iex_settings_popup_middle{display:table-row;width:100%;height:100%;}\
.iex_settings_popup_middle_content_pad{display:block;width:100%;height:100%;position:relative;}\
.iex_settings_popup_middle_content{display:block;position:absolute;left:0;top:0;bottom:0;right:0;padding:0;overflow:auto;}\
.iex_settings_popup_middle_content_inner{display:block;padding:0.25em;}\
.iex_settings_popup_close_link{font-weight:bold;text-decoration:none !important;padding:0em 0.2em;}\
.iex_settings_popup_bottom{display:table-row;width:100%;}\
\
.iex_settings_container{position:relative;}\
.iex_settings_region_container{margin:0.25em -0.25em -0.25em 2em;}\
.iex_settings_region{}\
.iex_settings_group{}\
.iex_settings_group.iex_settings_group_hidden{display:none;}\
.iex_settings_group_label{font-size:1.125em;padding-bottom:0.125em;margin-bottom:0.25em;font-weight:bold;text-align:left;color:#000000;border-bottom:0.125em solid rgba(0,0,0,0.5);text-shadow:0em 0em 0.25em #ffffff;}\
.iex_settings_group_label.iex_dark{color:#ffffff;border-bottom:0.125em solid rgba(255,255,255,0.5);text-shadow:0em 0em 0.25em #000000;}\
.iex_settings_group.iex_settings_group_padding_top{margin-top:1em;}\
.iex_settings_setting{padding:0.25em;background:transparent;}\
.iex_settings_setting.iex_settings_setting_top_padding{margin-top:0.25em;}\
.iex_settings_setting.iex_settings_setting_hidden{display:none;}\
.iex_settings_setting.iex_settings_setting_odd{background:rgba(0,0,0,0.0625);}\
.iex_settings_setting.iex_settings_setting_odd.iex_dark{background:rgba(255,255,255,0.0625);}\
.iex_settings_setting_table{display:block;width:100%;}\
.iex_settings_setting_left{display:block;overflow:hidden;text-align:left;vertical-align:top;}\
.iex_settings_setting_right{display:inline-block;float:right;text-align:right;vertical-align:middle;padding:0.5em 0em;}\
.iex_settings_setting_label{display:block;}\
.iex_settings_setting_label_title{color:#000000;font-weight:bold;font-size:1.125em;vertical-align:baseline;}\
.iex_settings_setting_label_title.iex_dark{color:#ffffff;}\
.iex_settings_setting_label_subtitle{color:#000000;font-weight:bold;font-size:1em;vertical-align:baseline;opacity:0.625;margin-left:0.5em;}\
.iex_settings_setting_label_subtitle.iex_dark{color:#ffffff;}\
.iex_settings_setting_label_subtitle:before{content:"(";}\
.iex_settings_setting_label_subtitle:after{content:")";}\
.iex_settings_setting_description{margin-left:0.5em;}\
.iex_settings_setting_input_container{display:inline-block;white-space:nowrap;cursor:pointer;}\
.iex_settings_setting_input_container.iex_settings_setting_input_container_reverse{direction:rtl;}\
.iex_settings_setting_input_checkbox{vertical-align:middle;}\
.iex_settings_setting_input_checkbox+.iex_settings_setting_input_label,\
.iex_settings_setting_input_checkbox+*+.iex_settings_setting_input_label{vertical-align:middle;padding-right:0.5em;}\
.iex_settings_setting_input_checkbox+.iex_settings_setting_input_label:after,\
.iex_settings_setting_input_checkbox+*+.iex_settings_setting_input_label:after{content:attr(data-iex-checkbox-label-off);}\
.iex_settings_setting_input_checkbox:checked+.iex_settings_setting_input_label:after,\
.iex_settings_setting_input_checkbox:checked+*+.iex_settings_setting_input_label:after{content:attr(data-iex-checkbox-label-on);}\
.iex_settings_setting_input_textbox{width:10em;padding:0.125em;}\
.iex_settings_difficulty_container{position:absolute;right:0;top:0;margin-top:0.5em;}\
.iex_settings_popup a.iex_settings_difficulty_choice{cursor:pointer;text-decoration:none !important;}\
.iex_settings_popup a.iex_settings_difficulty_choice.iex_settings_difficulty_choice_selected{text-decoration:underline !important;}\
.iex_settings_popup a.iex_settings_homepage_link{text-decoration:none !important;}\
.iex_settings_difficulty_separator{}\
\
.iex_notification{position:fixed;left:0;top:0;bottom:0;right:0;z-index:100;background:rgba(255,255,255,0.5);font-size:14px;}\
.iex_notification.iex_dark{background:rgba(0,0,0,0.5);}\
.iex_notification_body_outer{margin:0;padding:0;width:100%;height:100%;text-align:center;white-space:nowrap;z-index:200;line-height:0;}\
.iex_notification_body_aligner{height:100%;width:0;display:inline-block;vertical-align:middle;}\
.iex_notification_body_inner{display:inline-block;vertical-align:middle;line-height:normal;}\
.iex_notification_body{position:relative;text-align:center;white-space:normal;width:36em;padding:0.375em 1em;border-radius:0.25em;box-shadow:0em 0em 0.25em 0.125em rgba(0,0,0,0.5);}\
.iex_notification_body.iex_dark{box-shadow:0em 0em 0.25em 0.125em rgba(255,255,255,0.5);}\
.iex_notification_body.iex_notification_info{background:rgba(0,120,220,0.9);}\
.iex_notification_body.iex_notification_success{background:rgba(0,168,20,0.9);}\
.iex_notification_body.iex_notification_error{background:rgba(220,0,0,0.9);}\
.iex_notification_body.iex_notification_warning{background:rgba(220,120,0,0.9);}\
a.iex_notification_close{color:#ffffff !important;position:absolute;top:0;right:0;z-index:10;cursor:pointer;font-weight:bold;}\
a.iex_notification_close:hover{color:#000000 !important;text-shadow:0em 0.0625em 0.125em #ffffff;}\
a.iex_notification_close.iex_notification_close_hidden{display:none;}\
.iex_notification_content_outer{position:relative;}\
.iex_notification_content{position:relative;}\
.iex_notification_content_title{font-weight:bold;margin-bottom:0.75em;color:#ffffff;text-shadow:0em 0.0625em 0.125em #000000;}\
.iex_notification_content_body{color:#ffffff;text-shadow:0em 0.0625em 0.125em rgba(0,0,0,0.5);}\
.iex_notification_content a{color:#ffffff !important;text-decoration:none;}\
.iex_notification_content a:hover{color:#c010e0 !important;}\
.iex_notification_content.iex_dark a:hover{color:#d040e8 !important;}\
.iex_notification_content .iex_spaced_div{margin-bottom:0.5em;}\
.iex_notification_content a.iex_highlighted_link{font-weight:bold;text-decoration:underline !important;}\
.iex_notification_content a.iex_underlined_link{text-decoration:underline !important;}\
textarea.iex_notification_textarea{width:100%;height:5em;min-height:2em;font-family:Courier New;font-size:1em;text-align:left;color:#ffffff !important;background-color:transparent !important;border:0.08em solid rgba(255,255,255,0.5) !important;padding:0.25em;margin:0;resize:vertical;box-sizing:border-box;-moz-box-sizing:border-box;}\
textarea.iex_notification_textarea:hover,\
textarea.iex_notification_textarea:focus{background-color:rgba(255,255,255,0.0625) !important;border:0.08em solid rgba(255,255,255,0.75) !important;}\
\
.iex_floating_container{display:block;margin:0;padding:0;border:0em hidden;}\
.iex_floating_image_container{display:none;position:fixed;z-index:100;}\
.iex_floating_image_container.iex_floating_image_container_visible{display:block;}\
.iex_floating_image_padding{display:block;position:relative;margin:0;padding:0;left:0;top:0;box-shadow:0em 0em 0.6em 0.3em rgba(0,0,0,0.75);background-color:rgba(255,255,255,0.5);}\
.iex_floating_image_padding.iex_dark{box-shadow:0em 0em 0.6em 0.3em rgba(255,255,255,0.75);background-color:rgba(0,0,0,0.5);}\
.iex_floating_image_overflow{display:block;position:relative;overflow:hidden;}\
.iex_floating_image_overflow.iex_floating_image_overflow_no_cursor{cursor:none !important;}\
.iex_floating_image_offset{display:block;position:relative;}\
.iex_floating_image_background{display:block;position:absolute;left:0;top:0;bottom:0;right:0;background-color:transparent;background-repeat:no-repeat;background-position:left top;background-size:100% 100%;opacity:0.375;}\
.iex_floating_image_background.iex_floating_image_background_disabled{visibility:hidden;}\
.iex_floating_image_background.iex_floating_image_background_hidden{display:none;}\
.iex_floating_image_background.iex_floating_image_background_fallback{opacity:1;}\
.iex_floating_image_image{display:block;position:absolute;left:0;top:0;bottom:0;right:0;width:100%;height:100%;border:0em hidden;margin:0;padding:0;outline:0em hidden;}\
.iex_floating_image_image.iex_floating_image_image_unsized{max-width:100%;max-height:100%;}\
.iex_floating_image_image.iex_floating_image_image_hidden{display:none;}\
.iex_floating_image_video{display:block;position:absolute;left:0;top:0;bottom:0;right:0;width:100%;height:100%;border:0em hidden;margin:0;padding:0;outline:0em hidden;}\
.iex_floating_image_video.iex_floating_image_video_unsized{max-width:100%;max-height:100%;}\
.iex_floating_image_video.iex_floating_image_video_hidden{display:none;}\
.iex_floating_image_video.iex_floating_image_video_not_ready{visibility:hidden;}\
.iex_floating_image_zoom_border{display:block;position:absolute;border:0.08em solid #ffffff;opacity:0.25;}\
.iex_floating_image_zoom_border_inner{display:block;position:absolute;border:0.08em solid #000000;left:0;top:0;bottom:0;right:0;}\
.iex_floating_image_zoom_border.iex_floating_image_zoom_border_hidden{opacity:0;visibility:hidden;}\
.iex_floating_image_zoom_border:not(.iex_floating_image_zoom_border_vertical):not(.iex_floating_image_zoom_border_horizontal){opacity:0;}\
.iex_floating_image_zoom_border:not(.iex_floating_image_zoom_border_vertical){top:0 !important;bottom:0 !important;border-top:0em hidden;border-bottom:0em hidden;}\
.iex_floating_image_zoom_border:not(.iex_floating_image_zoom_border_horizontal){left:0 !important;right:0 !important;border-left:0em hidden;border-right:0em hidden;}\
.iex_floating_image_zoom_border:not(.iex_floating_image_zoom_border_vertical)>.iex_floating_image_zoom_border_inner{border-top:0em hidden;border-bottom:0em hidden;}\
.iex_floating_image_zoom_border:not(.iex_floating_image_zoom_border_horizontal)>.iex_floating_image_zoom_border_inner{border-left:0em hidden;border-right:0em hidden;}\
.iex_floating_image_stats_container{display:block;position:absolute;padding:0.125em 0em 0em 0.5em;left:-0.5em;right:0;bottom:100%;white-space:nowrap;overflow:hidden;color:#ffffff;text-shadow:0em 0em 0.4em #000000,0em 0em 0.3em #000000;}\
.iex_floating_image_stats_container.iex_dark{color:#000000;text-shadow:0em 0em 0.4em #ffffff,0em 0em 0.3em #ffffff;}\
.iex_floating_image_stat{}\
.iex_floating_image_stats_sep{opacity:0.825;}\
.iex_floating_image_stats_hidden{display:none;}\
.iex_floating_image_stats_status{font-weight:bold;}\
.iex_floating_image_stats_status.iex_floating_image_stats_status_error{color:#f03030;}\
.iex_floating_image_stats_status.iex_floating_image_stats_status_error.iex_dark{color:#a00000;}\
.iex_floating_image_stats_status.iex_floating_image_stats_status_archive{color:#f09030;}\
.iex_floating_image_stats_status.iex_floating_image_stats_status_archive.iex_dark{color:#a06000;}\
.iex_floating_image_stats_zoom{font-weight:bold;}\
.iex_floating_image_stats_zoom_fit{font-weight:bold;}\
.iex_floating_image_stats_resolution{font-weight:bold;}\
.iex_floating_image_stats_size{font-weight:bold;}\
.iex_floating_image_stats_name{font-weight:bold;}\
.iex_floating_image_stats_container.iex_floating_image_stats_container_minimal>.iex_floating_image_stat:not(.iex_floating_image_stats_important),\
.iex_floating_image_stats_container.iex_floating_image_stats_container_very_minimal>.iex_floating_image_stat:not(.iex_floating_image_stats_very_important){display:none;}\
.iex_floating_image_connector{display:none;position:absolute;z-index:100;}\
.iex_floating_image_connector.iex_floating_image_connector_visible{display:block;}\
.iex_floating_image_stats_zoom_controls{margin-right:0.25em;position:absolute;}\
.iex_floating_image_stats_zoom_controls.iex_floating_image_stats_zoom_controls_hidden{display:none;}\
.iex_floating_image_stats_zoom_controls.iex_floating_image_stats_zoom_controls_fixed{position:fixed;}\
.iex_floating_image_stats_zoom_control{padding:0em 0.25em;cursor:pointer;}\
.iex_floating_image_stats_zoom_control_increase:hover{color:#80d0ff;}\
.iex_floating_image_stats_zoom_control_decrease:hover{color:#f08060;}\
.iex_floating_image_stats_zoom_control_increase.iex_dark:hover{color:#a0e0ff;}\
.iex_floating_image_stats_zoom_control_decrease.iex_dark:hover{color:#ffb0a0;}\
\
.iex_floating_image_overlay_controls_container{display:block;position:absolute;left:0;top:0;bottom:0;right:0;background:transparent;font-size:1.5em;}\
.iex_floating_image_overlay_controls_inner_container{display:block;position:absolute;left:0;bottom:0;right:0;padding-top:2em;height:2em;background:transparent;}\
.iex_floating_image_overlay_controls_table{display:table;width:100%;height:100%;}\
.iex_floating_image_overlay_controls_table:not(.iex_floating_image_overlay_controls_table_visible):not(.iex_floating_image_overlay_controls_table_visible_important):not(.iex_floating_image_overlay_controls_table_mini){display:none;}\
.iex_floating_image_overlay_controls_seek_container{display:table-cell;vertical-align:bottom;min-width:1em;}\
.iex_floating_image_overlay_controls_seek_container2{display:block;width:100%;height:2em;position:relative;}\
.iex_floating_image_overlay_controls_seek_bar{display:block;position:absolute;left:0;right:0;top:0.5em;bottom:0.5em;border-radius:0.5em;overflow:hidden;cursor:pointer;border:1px solid rgba(0,0,0,0.5);}\
.iex_floating_image_overlay_controls_seek_bar.iex_floating_image_overlay_controls_no_border_radius{border-radius:0;}\
.iex_floating_image_overlay_controls_seek_bar_bg{position:absolute;left:0;top:0;bottom:0;right:0;background-color:#c0c0c0;opacity:0.825;}\
.iex_floating_image_overlay_controls_seek_bar_loaded{position:absolute;left:0;top:0;bottom:0;width:0;background:#ffffff;}\
.iex_floating_image_overlay_controls_seek_bar_played{position:absolute;left:0;top:0;bottom:0;width:0;background:#66cc33;}\
.iex_floating_image_overlay_controls_seek_time_table{position:relative;display:table;width:100%;height:100%;font-size:0.625em;}\
.iex_floating_image_overlay_controls_seek_time_current{display:table-cell;text-align:left;vertical-align:middle;padding:0em 0.25em 0em 0.375em;}\
.iex_floating_image_overlay_controls_seek_time_duration{display:table-cell;text-align:right;vertical-align:middle;padding:0em 0.375em 0em 0.25em;}\
.iex_floating_image_overlay_controls_seek_time_current,\
.iex_floating_image_overlay_controls_seek_time_duration{color:#101010;text-shadow:0em 0.125em 0.125em #ffffff,0em 0.0625em 0.0625em #ffffff;}\
.iex_floating_image_overlay_controls_buttons_container{display:table-cell;vertical-align:bottom;width:2em;}\
.iex_floating_image_overlay_controls_buttons_container2{display:block;width:100%;height:2em;position:relative;}\
.iex_floating_image_overlay_controls_buttons_container_left{display:block;position:absolute;left:0;top:0;bottom:0;right:0;}\
.iex_floating_image_overlay_controls_buttons_container_right{display:block;position:absolute;left:0;top:0;bottom:0;right:0;}\
.iex_floating_image_overlay_controls_buttons_container_right_upper{display:block;position:absolute;bottom:100%;right:0;margin-bottom:-0.5em;}\
.iex_floating_image_overlay_controls_volume_container{width:2em;height:9em;position:relative;}\
.iex_floating_image_overlay_controls_volume_container:not(.iex_floating_image_overlay_controls_volume_container_visible):not(.iex_floating_image_overlay_controls_volume_container_visible_important){display:none;}\
.iex_floating_image_overlay_controls_volume_bar{position:absolute;left:0.5em;right:0.5em;top:0.5em;bottom:0.5em;border-radius:0.5em;overflow:hidden;cursor:pointer;border:1px solid rgba(0,0,0,0.5);}\
.iex_floating_image_overlay_controls_volume_bar.iex_floating_image_overlay_controls_no_border_radius{border-radius:0;}\
.iex_floating_image_overlay_controls_volume_bar_bg{position:absolute;left:0;top:0;bottom:0;right:0;background-color:#ffffff;opacity:0.825;}\
.iex_floating_image_overlay_controls_volume_bar_level{position:absolute;left:0;right:0;bottom:0;height:0;background-color:#ffbb50;}\
\
.iex_floating_image_overlay_controls_table.iex_floating_image_overlay_controls_table_mini:not(.iex_floating_image_overlay_controls_table_visible):not(.iex_floating_image_overlay_controls_table_visible_important)>.iex_floating_image_overlay_controls_buttons_container{display:none;}\
.iex_floating_image_overlay_controls_table.iex_floating_image_overlay_controls_table_mini:not(.iex_floating_image_overlay_controls_table_visible):not(.iex_floating_image_overlay_controls_table_visible_important)>.iex_floating_image_overlay_controls_seek_container{min-width:0;}\
.iex_floating_image_overlay_controls_table.iex_floating_image_overlay_controls_table_mini:not(.iex_floating_image_overlay_controls_table_visible):not(.iex_floating_image_overlay_controls_table_visible_important)>*>.iex_floating_image_overlay_controls_seek_container2{height:0.125em;}\
.iex_floating_image_overlay_controls_table.iex_floating_image_overlay_controls_table_mini:not(.iex_floating_image_overlay_controls_table_visible):not(.iex_floating_image_overlay_controls_table_visible_important)>*>*>.iex_floating_image_overlay_controls_seek_bar{top:0;bottom:0;border-radius:0;border:0em hidden;}\
.iex_floating_image_overlay_controls_table.iex_floating_image_overlay_controls_table_mini:not(.iex_floating_image_overlay_controls_table_visible):not(.iex_floating_image_overlay_controls_table_visible_important)>*>*>*>*>.iex_floating_image_overlay_controls_seek_time_table{display:none;}\
\
.iex_floating_image_overlay_button_mouse_controller{position:absolute;left:0;top:0;bottom:0;right:0;margin:0.4em;cursor:pointer;}\
.iex_floating_image_overlay_play_button{display:block;}\
.iex_floating_image_overlay_play_button.iex_floating_image_overlay_play_button_playing>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_play_button_play_icon,\
.iex_floating_image_overlay_play_button.iex_floating_image_overlay_play_button_playing>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_play_button_loop_icon,\
.iex_floating_image_overlay_play_button:not(.iex_floating_image_overlay_play_button_playing)>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_play_button_pause_icon,\
.iex_floating_image_overlay_play_button:not(.iex_floating_image_overlay_play_button_playing).iex_floating_image_overlay_play_button_looping>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_play_button_play_icon,\
.iex_floating_image_overlay_play_button:not(.iex_floating_image_overlay_play_button_playing):not(.iex_floating_image_overlay_play_button_looping)>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_play_button_loop_icon{visibility:hidden;}\
.iex_floating_image_overlay_volume_button{display:block;}\
.iex_floating_image_overlay_volume_button.iex_floating_image_overlay_volume_button_muted>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_volume_button_wave_big,\
.iex_floating_image_overlay_volume_button.iex_floating_image_overlay_volume_button_muted>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_volume_button_wave_small,\
.iex_floating_image_overlay_volume_button:not(.iex_floating_image_overlay_volume_button_muted)>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_volume_button_mute_icon,\
.iex_floating_image_overlay_volume_button.iex_floating_image_overlay_volume_button_high>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_volume_button_wave_small,\
.iex_floating_image_overlay_volume_button:not(.iex_floating_image_overlay_volume_button_medium)>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_volume_button_wave_small,\
.iex_floating_image_overlay_volume_button:not(.iex_floating_image_overlay_volume_button_high)>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_volume_button_wave_big{visibility:hidden;}\
.iex_floating_image_overlay_volume_button_mute_icon{opacity:0.75;}\
.iex_floating_image_overlay_volume_button_mute_icon_polygon{fill:#000000;}\
.iex_floating_image_overlay_button_fill{fill:rgba(255,255,255,0.825);stroke:rgba(0,0,0,0.5);stroke-width:1px;vector-effect:non-scaling-stroke;}\
.iex_floating_image_overlay_button_mouse_controller:hover+.iex_floating_image_overlay_play_button>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_button_fill{fill:#44aaff;}\
.iex_floating_image_overlay_button_mouse_controller:hover+.iex_floating_image_overlay_volume_button>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_button_fill{fill:#ff88aa;}\
.iex_floating_image_overlay_button_mouse_controller:hover+.iex_floating_image_overlay_volume_button>.iex_floating_image_overlay_button_scale_group>.iex_floating_image_overlay_volume_button_mute_icon>.iex_floating_image_overlay_volume_button_mute_icon_polygon{fill:#a00000;}\
\
.iex_floating_image_zoom_border.iex_floating_image_zoom_border_hidden.iex_animated{transition:opacity 0.5s linear 0s,visibility 0s linear 0.5s;}\
.iex_floating_image_zoom_border:not(.iex_floating_image_zoom_border_hidden).iex_animated{transition:opacity 0.25s linear 0s,visibility 0s linear 0s;}\
.iex_floating_image_background.iex_animated{transition:opacity 0.5s linear 0s;}\
				'
			"";//}



			// Append style
			this.stylesheet = document.createElement("style");
			this.stylesheet.innerHTML = stylesheet_text;
			ASAP.asap(on_insert_stylesheet.bind(this), on_insert_stylesheet_condition);

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
					s = window.getComputedStyle(e)
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
		for (var i = "a".charCodeAt(0), iEnd = "z".charCodeAt(0), iDiff = (i - "A".charCodeAt(0)); i <= iEnd; ++i) {
			key_conversions[String.fromCharCode(i)] = i - iDiff;
		}
		for (var i = "0".charCodeAt(0), iEnd = "9".charCodeAt(0); i <= iEnd; ++i) {
			key_conversions[String.fromCharCode(i)] = i;
		}
		for (var i = 112; i <= 123; ++i) {
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
							if (list.length == 0) {
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

	// Image hover control
	var ImageHover = (function () {

		var ImageHover = function () {
			// Enabled
			this.enabled = false;
			this.disabled = false;

			// Extension settings
			this.extensions_valid = [ ".jpg" , ".jpeg" , ".png" , ".gif" , ".webm" ];
			this.extensions_video = [ ".webm" ];
			this.extensions_display_bg = {
				".jpg": true,
				".jpeg": true,
				".webm": true
			};

			// Events
			this.on_api_image_hover_open_bind = null;
			this.hotkeys = null;

			// Callbacks
			this.on_image_mouseenter_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_image_mouseenter , null ]);
			this.on_image_mouseleave_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_image_mouseleave , null ]);
			this.on_image_click_bind = wrap_callback.call(this, on_image_click, [ this ]);
			this.on_settings_value_change_bind = on_settings_value_change.bind(this);
			settings.on_change(["image_expansion", "hover", "zoom_invert"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "zoom_border_show"], this.on_settings_value_change_bind);
			settings.on_change(["image_expansion", "hover", "zoom_border_hide_time"], this.on_settings_value_change_bind);
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
			settings.on_change(["image_expansion", "style", "controls_rounded_border"], this.on_settings_value_change_bind);

			// Close
			this.preview_open_timer = null;
			this.preview_close_timer = null;
			this.on_preview_close_timeout_bind = on_preview_close_timeout.bind(this);

			// Floating container
			this.image_visible = false;
			this.image_data = null;
			this.settings = {
				image_container: null,
				fit: false,
				fit_large: false,
				fit_axis: 0,
				zoom: 1.0,
				zoom_x: 0.0,
				zoom_y: 0.0,
				mouse_x: 0.0,
				mouse_y: 0.0,
				padding_active: false,
				type: TYPE_NONE,
				size: {
					width: 0,
					height: 0,
				},
				display_size: {
					width: 0,
					height: 0,
				},
				display_size_max: {
					width: 0,
					height: 0,
				},
				size_acquired: false,

				fit_large_allowed: true,
				display_stats: true,
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
				zoom_border_show: true,
				zoom_border_hide_time: 500,
				mouse_hide: true,
				mouse_hide_time: 2000,
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
				},
				style: {
					controls_rounded_border: true,
				},
			};
			ASAP.asap(on_asap.bind(this), on_asap_condition);
		};



		var TYPE_NONE = 0;
		var TYPE_IMAGE = 1;
		var TYPE_VIDEO = 2;



		var on_image_mouseenter = function (image_container, data, event) {
			// Don't run if disabled
			if (this.disabled) return;

			// Attempt to open
			var post_container = api.post_get_post_container_from_image_container(image_container);
			if (post_container) {
				preview_open_test.call(this, image_container, post_container, true);
			}
		};
		var on_image_mouseleave = function (image_container, data, event) {
			// Don't run if disabled
			if (this.disabled) return;

			// Close preview
			this.preview_close(false);

			// Cancel the open timer
			if (this.preview_open_timer !== null) {
				clearTimeout(this.preview_open_timer);
				this.preview_open_timer = null;
			}
		};
		var on_image_click = function (self, data, event) {
			// Don't run if disabled
			if (self.disabled) return;

			// Close preview
			var post_container = api.post_get_post_container_from_image_container(this);
			setTimeout(on_image_click_delay.bind(self, this, post_container), 10);
		};
		var on_image_click_delay = function (node, post_container) {
			if (api.post_is_image_expanded_or_expanding(post_container)) {
				// Close
				this.preview_close(true);
			}
			else {
				// Attempt to open
				preview_open_test.call(this, node, post_container, false);
			}
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
			this.on_api_image_hover_open_bind = null;

			// Update settings
			settings.disable_image_expansion();
		};

		var on_post_queue_callback = function (container) {
			// Add hooks
			add_post_container_callbacks.call(this, container);
		};

		var on_connector_mouseenter = function (node, data, event) {
			// Cancel close
			this.preview_close_cancel();
		};
		var on_connector_mouseleave = function (node, data, event) {
			// Activate close
			this.preview_close(false);
		};
		var on_preview_mousewheel = function (event) {
			// Get direction
			var delta = (event.wheelDelta || -event.detail || 0);
			if (delta < 0) delta = -1;
			else if (delta > 0) delta = 1;

			// Modify zoom
			this.preview_update_zoom(delta, true);

			// Show zoom borders and mouse
			if (this.settings.zoom_border_show) show_zoom_border.call(this, false);
			show_mouse.call(this, !this.settings.mouse_hide);

			// Prevent
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_preview_mouseenter = function (node, data, event) {
			// Cancel close
			this.preview_close_cancel();

			// Show zoom borders and mouse
			if (this.settings.zoom_border_show) show_zoom_border.call(this, false);
			show_mouse.call(this, !this.settings.mouse_hide);

			// Mini controls
			if (this.settings.type == TYPE_VIDEO) {
				if (this.settings.video.mini_controls == 1) set_video_mini_controls_enabled.call(this, true);
				else if (this.settings.video.mini_controls == 2) set_video_mini_controls_enabled.call(this, false);
			}
		};
		var on_preview_mouseleave = function (node, data, event) {
			// Activate close
			this.preview_close(false);

			// Hide zoom borders and show the mouse
			hide_zoom_border.call(this, false);
			show_mouse.call(this, true);

			// Remove padding if enabled
			if (this.settings.padding_active) {
				// Remove
				hide_paddings.call(this);
			}

			// Mini controls
			if (this.settings.type == TYPE_VIDEO) {
				if (this.settings.video.mini_controls == 1) set_video_mini_controls_enabled.call(this, false);
				else if (this.settings.video.mini_controls == 2) set_video_mini_controls_enabled.call(this, true);
			}
		};
		var on_preview_mousedown = function (event) {
			// Get the mouse button
			var button = 0; // 1=left, 2=middle, 3=right
            if (event.which) {
				if (event.which == 1) button = 1;
				else if (event.which == 2) button = 2;
				else if (event.which == 3) button = 3;
            }
			else {
				if ((event.button & 1) != 0) button = 1;
				else if ((event.button & 2) != 0) button = 3;
				else if ((event.button & 4) != 0) button = 2;
			}

			// Activate close
			if (button != 3) this.preview_close(true);
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_preview_contextmenu = function (event) {
			// Stop
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_preview_mousemove = function (event) {
			// Get mouse x/y
			var x, y;
			if (event.pageX == null && (event = event || window.event).clientX != null) {
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

			// Apply
			this.settings.mouse_x = x;
			this.settings.mouse_y = y;

			// Update zoom
			this.preview_update_zoom_position(true);

			// Show zoom borders and mouse
			if (this.settings.zoom_border_show) show_zoom_border.call(this, false);
			show_mouse.call(this, !this.settings.mouse_hide);
		};
		var on_preview_image_load = function (event) {
			if (this.settings.type != TYPE_IMAGE) return;

			// Hide background image
			var nodes = this.image_data.nodes,
				set = this.settings,
				w = nodes.image.naturalWidth,
				h = nodes.image.naturalHeight;

			style.add_class(nodes.background, "iex_floating_image_background_hidden");


			// Update size
			if (!set.size_acquired || (set.size.width != w || set.size.height != h)) {
				update_preview_size.call(this, w, h);
				style.remove_class(nodes.image, "iex_floating_image_image_unsized");
			}
		};
		var on_preview_image_error = function (event) {
			if (this.settings.type != TYPE_IMAGE) return;

			// Show fallback
			var nodes = this.image_data.nodes,
				stats = nodes.stats;
			style.remove_class(nodes.background, "iex_floating_image_background_disabled");
			style.add_class(nodes.background, "iex_floating_image_background_fallback");
			style.add_class(nodes.image, "iex_floating_image_i_hidden");
			nodes.image.removeAttribute("src");

			// Archive check, eventually

			// Modify status
			stats.status[0].textContent = "Error";
			style.add_class(stats.status[0], "iex_floating_image_stats_status_error");
			style.remove_class(stats.status[0], "iex_floating_image_stats_hidden");
			style.remove_class(stats.status[1], "iex_floating_image_stats_hidden");
		};
		var on_preview_overflow_mouseenter = function (node, data, event) {
			// Remove padding if enabled
			if (this.settings.padding_active) {
				// Remove
				hide_paddings.call(this);
			}
		};
		var on_preview_stats_mouseenter = function (node, data, event) {
			// Stop hiding if it's already open
			this.image_data.state.mouse_in_stats = true;
			show_zoom_controls.call(this, false);
		};
		var on_preview_stats_mouseleave = function (node, data, event) {
			// Hide controls
			this.image_data.state.mouse_in_stats = false;
			hide_zoom_controls.call(this, false, true);
		};
		var on_preview_stats_zoom_mouseenter = function (node, data, event) {
			// Show controls
			show_zoom_controls.call(this, true);
		};
		var on_preview_stats_zoom_controls_mouseenter = function (node, data, event) {
			// Display controls and make fixed
			show_zoom_controls.call(this, true);
			set_zoom_controls_fixed.call(this, true);
		};
		var on_preview_stats_zoom_controls_mouseleave = function (node, data, event) {
			// Make un-fixed and possibly hide
			set_zoom_controls_fixed.call(this, false);
			if (!this.image_data.state.mouse_in_stats) {
				hide_zoom_controls.call(this, true, true);
			}
		};
		var on_preview_stats_zoom_controls_mousedown = function (event) {
			// Stop
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_preview_stats_zoom_control_click = function (delta, event) {
			// Modify zoom
			this.preview_update_zoom(delta, true);

			// Show zoom borders and mouse
			if (this.settings.zoom_border_show) show_zoom_border.call(this, false);
			show_mouse.call(this, !this.settings.mouse_hide);

			// Stop
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_window_resize = function (event) {
			// Reposition
			this.preview_update(false, false, false);

			// Update bar position
			if (this.image_data.state.video.mouse_capturing_element !== null) {
				update_video_mouse_capture.call(this);
			}
		};
		var on_window_scroll = function (event) {
			// Reposition
			this.preview_update(false, false, false);

			// Update bar position
			if (this.image_data.state.video.mouse_capturing_element !== null) {
				update_video_mouse_capture.call(this);
			}
		};

		var on_preview_video_loadedmetadata = function (event) {
			if (this.settings.type != TYPE_VIDEO) return;

			var set = this.settings,
				v_set = set.video,
				nodes = this.image_data.nodes,
				video = nodes.video,
				w = video.videoWidth,
				h = video.videoHeight;


			// Update seek bar
			update_video_duration_status.call(this);
			update_video_seek_status.call(this, 0);

			// Hide background image and un-hide video
			style.remove_class(video, "iex_floating_image_video_not_ready");
			style.add_class(nodes.background, "iex_floating_image_background_hidden");

			// Update size
			if (!set.size_acquired || (set.size.width != w || set.size.height != h)) {
				update_preview_size.call(this, w, h);
				style.remove_class(nodes.video, "iex_floating_image_video_unsized");
			}
		};
		var on_preview_video_canplay = function (event) {
			if (this.settings.type != TYPE_VIDEO) return;

			var v_set = this.settings.video,
				nodes = this.image_data.nodes;

			// Auto-play
			if (v_set.autoplay == 1 && nodes.video.paused && !this.image_data.state.video.interacted) {
				set_video_paused.call(this, false);
			}
		};
		var on_preview_video_canplaythrough = function (event) {
			if (this.settings.type != TYPE_VIDEO) return;

			var v_set = this.settings.video,
				nodes = this.image_data.nodes;

			// Auto-play
			if (v_set.autoplay == 2 && nodes.video.paused && !this.image_data.state.video.interacted) {
				set_video_paused.call(this, false);
			}
		};
		var on_preview_video_progress = function (event) {
			if (this.settings.type != TYPE_VIDEO) return;

			var v_set = this.settings.video,
				nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes,
				percent = (video.buffered.end(0) / video.duration);

			// Update progress bar
			v_nodes.load_progress.style.width = (percent * 100).toFixed(2) + "%";

			// Autoplay
			if (v_set.autoplay == 3 && video.paused && percent >= 1.0 && !this.image_data.state.video.interacted) {
				set_video_paused.call(this, false);
			}
		};
		var on_preview_video_error = function (event) {
			if (this.settings.type != TYPE_VIDEO) return;

			// Show fallback
			var nodes = this.image_data.nodes,
				stats = nodes.stats;
			style.remove_class(nodes.background, "iex_floating_image_background_disabled");
			style.add_class(nodes.background, "iex_floating_image_background_fallback");
			style.add_class(nodes.video, "iex_floating_image_video_hidden");

			// Archive check, eventually

			// Modify status
			stats.status[0].textContent = "Error";
			style.add_class(stats.status[0], "iex_floating_image_stats_status_error");
			style.remove_class(stats.status[0], "iex_floating_image_stats_hidden");
			style.remove_class(stats.status[1], "iex_floating_image_stats_hidden");
		};
		var on_preview_video_abort = function (event) {
			if (this.settings.type != TYPE_VIDEO) return;

			// Show fallback
			var nodes = this.image_data.nodes,
				stats = nodes.stats;
			style.remove_class(nodes.background, "iex_floating_image_background_disabled");
			style.add_class(nodes.background, "iex_floating_image_background_fallback");
			style.add_class(nodes.video, "iex_floating_image_video_hidden");
			nodes.video.removeAttribute("src");

			// Archive check, eventually

			// Modify status
			stats.status[0].textContent = "Abort";
			style.add_class(stats.status[0], "iex_floating_image_stats_status_error");
			style.remove_class(stats.status[0], "iex_floating_image_stats_hidden");
			style.remove_class(stats.status[1], "iex_floating_image_stats_hidden");
		};
		var on_preview_video_timeupdate = function (event) {
			if (this.settings.type != TYPE_VIDEO) return;

			// Update time progress
			var video = this.image_data.nodes.video;
			update_video_seek_status.call(this, video.currentTime);
		};
		var on_preview_video_ended = function (event) {
			if (this.settings.type != TYPE_VIDEO) return;

			// Update buttons
			var video = this.image_data.nodes.video;
			update_video_play_status.call(this, video.paused);
		};

		var on_preview_controls_mouseenter = function (node, data, event) {
			// Do not show for non-video
			if (this.settings.type != TYPE_VIDEO) return;

			// Show controls
			var v_nodes = this.image_data.nodes.video_nodes;

			style.remove_class(v_nodes.volume_container, "iex_floating_image_overlay_controls_volume_container_visible");
			style.add_class(v_nodes.container, "iex_floating_image_overlay_controls_table_visible");
		};
		var on_preview_controls_mouseleave = function (node, data, event) {
			// Hide controls
			var v_nodes = this.image_data.nodes.video_nodes;

			style.remove_class(v_nodes.container, "iex_floating_image_overlay_controls_table_visible");
		};
		var on_preview_controls_container_mousedown = function (event) {
			var button = 0; // 1=left, 2=middle, 3=right
            if (event.which) {
				if (event.which == 1) button = 1;
				else if (event.which == 2) button = 2;
				else if (event.which == 3) button = 3;
            }
			else {
				if ((event.button & 1) != 0) button = 1;
				else if ((event.button & 2) != 0) button = 3;
				else if ((event.button & 4) != 0) button = 2;
			}

			// Ignore if not left mb
			if (button != 1) return;

			// Stop event
			event.preventDefault();
			event.stopPropagation();
			return false;
		};
		var on_preview_controls_play_button_click = function (event) {
			// Play/pause
			var video = this.image_data.nodes.video;

			set_video_paused.call(this, !video.paused, (event.shiftKey && video.paused) ? (!video.loop) : undefined);
		};
		var on_preview_controls_volume_button_click = function (event) {
			// Mute/unmute
			set_video_muted.call(this, !this.image_data.nodes.video.muted);
		};
		var on_preview_controls_volume_button_mouseenter = function (node, data, event) {
			// Show volume bar
			var v_nodes = this.image_data.nodes.video_nodes;

			style.add_class(v_nodes.volume_container, "iex_floating_image_overlay_controls_volume_container_visible");
		};
		var on_preview_controls_volume_button_container_mouseleave = function (node, data, event) {
			// Hide volume bar
			var v_nodes = this.image_data.nodes.video_nodes;

			style.remove_class(v_nodes.volume_container, "iex_floating_image_overlay_controls_volume_container_visible");
		};
		var on_preview_controls_seek_bar_mousedown = function (event) {
			// Get the mouse button
			var button = 0; // 1=left, 2=middle, 3=right
            if (event.which) {
				if (event.which == 1) button = 1;
				else if (event.which == 2) button = 2;
				else if (event.which == 3) button = 3;
            }
			else {
				if ((event.button & 1) != 0) button = 1;
				else if ((event.button & 2) != 0) button = 3;
				else if ((event.button & 4) != 0) button = 2;
			}
			if (button != 1) return;

			// Begin seeking
			var v_state = this.image_data.state.video,
				nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes;

			// Set paused state
			v_state.seeking_paused = video.paused;
			if (!video.paused) video.pause();
			v_state.seeking = true;

			// Force visibility
			style.add_class(v_nodes.container, "iex_floating_image_overlay_controls_table_visible_important");

			// Setup window mousemove and mouseup events
			setup_video_mouse_capture.call(this);

			// Initial update
			on_preview_controls_capture_mousemove.call(this, event);

			// Stop
			event.stopPropagation();
			event.preventDefault();
			return false;
		};
		var on_preview_controls_volume_bar_mousedown = function (event) {
			// Get the mouse button
			var button = 0; // 1=left, 2=middle, 3=right
            if (event.which) {
				if (event.which == 1) button = 1;
				else if (event.which == 2) button = 2;
				else if (event.which == 3) button = 3;
            }
			else {
				if ((event.button & 1) != 0) button = 1;
				else if ((event.button & 2) != 0) button = 3;
				else if ((event.button & 4) != 0) button = 2;
			}
			if (button != 1) return;

			// Begin volume changing
			var v_state = this.image_data.state.video,
				nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes;

			// Set paused state
			v_state.volume_modifying = true;

			// Force visibility
			style.add_class(v_nodes.container, "iex_floating_image_overlay_controls_table_visible_important");
			style.add_class(v_nodes.volume_container, "iex_floating_image_overlay_controls_volume_container_visible_important");

			// Setup window mousemove and mouseup events
			setup_video_mouse_capture.call(this);

			// Initial update
			on_preview_controls_capture_mousemove.call(this, event);

			// Stop
			event.stopPropagation();
			event.preventDefault();
			return false;
		};
		var on_preview_controls_prevent_default_mousedown = function (event) {
			event.preventDefault();
			return false;
		};

		var on_preview_controls_capture_mousemove = function (event) {
			// Begin seeking
			var v_state = this.image_data.state.video,
				nodes = this.image_data.nodes,
				v_nodes = nodes.video_nodes,
				video = nodes.video,
				x, y;


			// Get mouse x/y
			if (event.pageX == null && (event = event || window.event).clientX != null) {
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
			if (v_state.seeking) {
				var duration = video.duration;
				if (!isNaN(duration)) {
					var loaded = video.buffered.end(0) / duration;

					// Get percent
					var percent = (x - v_state.bar_rect.left) / (v_state.bar_rect.right - v_state.bar_rect.left);

					// Bound
					if (percent < 0) percent = 0;
					else if (percent > loaded) percent = loaded;

					// Apply
					percent *= duration;
					video.currentTime = percent;
					update_video_seek_status.call(this, percent);
				}
			}
			else if (v_state.volume_modifying) {
				// Get percent
				var percent = 1.0 - (y - v_state.bar_rect.top) / (v_state.bar_rect.bottom - v_state.bar_rect.top);

				// Bound
				if (percent < 0) percent = 0;
				else if (percent > loaded) percent = loaded;

				// Set volume
				set_video_volume.call(this, percent, false, false);
			}
		};
		var on_preview_controls_capture_mouseup = function (event) {
			var v_state = this.image_data.state.video,
				nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes;

			if (v_state.seeking) {
				// Unpause
				if (!v_state.seeking_paused) video.play();

				// Un-force visibility
				style.remove_class(v_nodes.container, "iex_floating_image_overlay_controls_table_visible_important");

				// Done
				v_state.seeking = false;
			}
			else if (v_state.volume_modifying) {
				// Save volume
				set_video_volume.call(this, -1, true, true);

				// Un-force visibility
				style.remove_class(v_nodes.container, "iex_floating_image_overlay_controls_table_visible_important");
				style.remove_class(v_nodes.volume_container, "iex_floating_image_overlay_controls_volume_container_visible_important");

				// Done
				v_state.volume_modifying = false;
			}

			// Stop capture
			teardown_video_mouse_capture.call(this);
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

		var on_asap = function () {
			// Create floating container
			this.floating_container = document.createElement("div");
			this.floating_container.className = "iex_floating_container" + style.theme;

			// Parent
			var body = document.querySelector("body");
			if (body) {
				// Append
				body.appendChild(this.floating_container);
			}
			else {
				// Invalid
				this.floating_container = null;
			}
		};
		var on_asap_condition = function () {
			return document.querySelector("body");
		};

		var on_settings_value_change = function (data) {
			// Update
			this.update_settings_from_global();
		};



		var log2 = function (x) {
			return Math.log(x) / Math.LN2;
		};

		var format_video_time = function (time) {
			time = Math.floor(time + 0.5);

			var s = (time % 60).toString();
			if (s.length < 2) s = "0" + s;

			time = Math.floor(time / 60);
			return time + ":" + s;
		};

		var preview_open_test = function (image_container, post_container, obey_timer) {
			// Get info
			var info = api.post_get_file_info(post_container);
			if (!info.image) return;

			// Don't open if expanded
			if (api.post_is_image_expanded_or_expanding(post_container)) return;

			// Spoiler check
			var val_check = settings.values["image_expansion"][info.spoiler === null ? "normal" : "spoiler"];
			if (!val_check["enabled"]) return;

			// Extension check
			var ext = /\.[^\.]+$/.exec(info.image);
			ext = ext ? ext[0].toLowerCase() : "";
			if (this.extensions_valid.indexOf(ext) < 0) return;

			// Open preview
			var time = val_check["timeout"];
			if (time == 0 || !obey_timer) {
				this.preview_open(image_container, info, val_check["to_fit"]);
			}
			else {
				if (this.preview_open_timer !== null) {
					clearTimeout(this.preview_open_timer);
				}
				this.preview_open_timer = setTimeout(on_preview_open_timeout.bind(this, image_container, info, val_check["to_fit"]), time * 1000);
			}
		};
		var preview_reset = function () {
			var nodes = this.image_data.nodes,
				stats = nodes.stats,
				set = this.settings,
				ani = "",
				type = set.type;

			// Not visible
			this.image_visible = false;
			set.type = TYPE_NONE;

			// Hide
			style.remove_class(nodes.container, "iex_floating_image_container_visible");
			style.remove_class(nodes.connector, "iex_floating_image_connector_visible");
			nodes.background.style.backgroundImage = "";

			// Class resetting
			nodes.padding.className = "iex_floating_image_padding" + ani + style.theme;
			nodes.overflow.className = "iex_floating_image_overflow" + style.theme;
			nodes.background.className = "iex_floating_image_background" + ani + style.theme;
			nodes.zoom_border.className = "iex_floating_image_zoom_border iex_floating_image_zoom_border_hidden" + ani + style.theme

			// Hide status
			style.add_class(stats.status[0], "iex_floating_image_stats_hidden");
			style.add_class(stats.status[1], "iex_floating_image_stats_hidden");
			style.remove_classes(stats.status[0], "iex_floating_image_stats_status_archive iex_floating_image_stats_status_error");
			style.remove_classes(stats.status[1], "iex_floating_image_stats_status_archive iex_floating_image_stats_status_error");
			stats.status[0].textContent = "";

			// Remove media
			if (type == TYPE_IMAGE) {
				nodes.image.removeAttribute("src");
				style.add_class(nodes.image, "iex_floating_image_image_hidden");
				style.remove_class(nodes.image, "iex_floating_image_image_unsized");
			}
			else if (type == TYPE_VIDEO) {
				var v_nodes = nodes.video_nodes;

				// Hide controls
				style.remove_class(v_nodes.container, "iex_floating_image_overlay_controls_table_visible");
				style.remove_class(v_nodes.container, "iex_floating_image_overlay_controls_table_visible_important");
				style.remove_class(v_nodes.volume_container, "iex_floating_image_overlay_controls_volume_container_visible");
				style.remove_class(v_nodes.volume_container, "iex_floating_image_overlay_controls_volume_container_visible_important");
				set_video_mini_controls_enabled.call(this, false);

				nodes.video.removeAttribute("src");
				style.add_class(nodes.video, "iex_floating_image_video_hidden");
				style.remove_class(nodes.video, "iex_floating_image_video_unsized");
				nodes.video.load();
			}
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

		var addEventListenerManaged = function (list, node, event, callback, capture) {
			node.addEventListener(event, callback, capture);
			list.push([ node , event , callback , capture ]);
		};

		var create_new_image_preview = function () {
			// Create the preview container
			var c, c_pad, c_over, c_offset, c_bg, c_img, c_stats, c_zoom_border1, c_zoom_border2,
				c_stat_i, c_stat_zoom_controls, c_stat_zoom_inc, c_stat_zoom_dec, c_stat_zoom, c_stat_zoom_fit,
				c_stat_res, c_stat_status1, c_stat_status2, c_stat_size, c_stat_name, c_connector, w, h, events = [];

			c = document.createElement("div");
			c.className = "iex_floating_image_container" + style.theme;

			// Position/padding container
			c_pad = document.createElement("div");
			c_pad.className = "iex_floating_image_padding" + style.theme;
			c.appendChild(c_pad);

			// Overflow container
			c_over = document.createElement("div");
			c_over.className = "iex_floating_image_overflow" + style.theme;
			c_pad.appendChild(c_over);

			// Padding container
			c_offset = document.createElement("div");
			c_offset.className = "iex_floating_image_offset" + style.theme;
			c_over.appendChild(c_offset);

			// Background image
			c_bg = document.createElement("div");
			c_bg.className = "iex_floating_image_background" + style.theme;
			c_offset.appendChild(c_bg);

			// Image
			c_img = document.createElement("img");
			c_img.className = "iex_floating_image_image iex_floating_image_image_hidden" + style.theme;
			c_img.setAttribute("alt", "");
			c_img.setAttribute("title", "");
			c_offset.appendChild(c_img);

			// Zoom borders
			w = (this.settings.zoom_margins.horizontal * 100).toFixed(2) + "%";
			h = (this.settings.zoom_margins.vertical * 100).toFixed(2) + "%";
			c_zoom_border1 = document.createElement("div");
			c_zoom_border1.className = "iex_floating_image_zoom_border iex_floating_image_zoom_border_hidden" + style.theme;
			c_zoom_border1.style.left = w;
			c_zoom_border1.style.top = h;
			c_zoom_border1.style.right = w;
			c_zoom_border1.style.bottom = w;
			c_over.appendChild(c_zoom_border1);

			c_zoom_border2 = document.createElement("div");
			c_zoom_border2.className = "iex_floating_image_zoom_border_inner" + style.theme;
			c_zoom_border1.appendChild(c_zoom_border2);

			// Stats container
			c_stats = document.createElement("div");
			c_stats.className = "iex_floating_image_stats_container" + style.theme;
			c_pad.appendChild(c_stats);

			// Zoom controls
			c_stat_zoom_controls = document.createElement("span");
			c_stat_zoom_controls.className = "iex_floating_image_stat iex_floating_image_stats_important iex_floating_image_stats_zoom_controls iex_floating_image_stats_zoom_controls_hidden" + style.theme;
			c_stats.appendChild(c_stat_zoom_controls);

			c_stat_zoom_inc = document.createElement("span");
			c_stat_zoom_inc.className = "iex_floating_image_stats_zoom_control iex_floating_image_stats_zoom_control_increase" + style.theme;
			c_stat_zoom_inc.textContent = "+";
			c_stat_zoom_controls.appendChild(c_stat_zoom_inc);

			c_stat_zoom_dec = document.createElement("span");
			c_stat_zoom_dec.className = "iex_floating_image_stats_zoom_control iex_floating_image_stats_zoom_control_decrease" + style.theme;
			c_stat_zoom_dec.textContent = "\u2212";
			c_stat_zoom_controls.appendChild(c_stat_zoom_dec);

			// Stats items
			c_stat_zoom = document.createElement("span");
			c_stat_zoom.className = "iex_floating_image_stat iex_floating_image_stats_important iex_floating_image_stats_zoom" + style.theme;
			c_stats.appendChild(c_stat_zoom);

			c_stat_zoom_fit = document.createElement("span");
			c_stat_zoom_fit.className = "iex_floating_image_stat iex_floating_image_stats_important iex_floating_image_stats_zoom_fit" + style.theme;
			c_stats.appendChild(c_stat_zoom_fit);

			c_stat_i = document.createElement("span");
			c_stat_i.className = "iex_floating_image_stat iex_floating_image_stats_sep" + style.theme;
			c_stat_i.textContent = ", ";
			c_stats.appendChild(c_stat_i);

			c_stat_status1 = document.createElement("span");
			c_stat_status1.className = "iex_floating_image_stat iex_floating_image_stats_important iex_floating_image_stats_very_important iex_floating_image_stats_status iex_floating_image_stats_hidden" + style.theme;
			c_stats.appendChild(c_stat_status1);

			c_stat_status2 = document.createElement("span");
			c_stat_status2.className = "iex_floating_image_stat iex_floating_image_stats_sep iex_floating_image_stats_hidden" + style.theme;
			c_stat_status2.textContent = ", ";
			c_stats.appendChild(c_stat_status2);

			c_stat_res = document.createElement("span");
			c_stat_res.className = "iex_floating_image_stat iex_floating_image_stats_resolution" + style.theme;
			c_stats.appendChild(c_stat_res);

			c_stat_i = document.createElement("span");
			c_stat_i.className = "iex_floating_image_stat iex_floating_image_stats_sep" + style.theme;
			c_stat_i.textContent = ", ";
			c_stats.appendChild(c_stat_i);

			c_stat_size = document.createElement("span");
			c_stat_size.className = "iex_floating_image_stat iex_floating_image_stats_size" + style.theme;
			c_stats.appendChild(c_stat_size);

			c_stat_i = document.createElement("span");
			c_stat_i.className = "iex_floating_image_stat iex_floating_image_stats_sep" + style.theme;
			c_stat_i.textContent = ", ";
			c_stats.appendChild(c_stat_i);

			c_stat_name = document.createElement("span");
			c_stat_name.className = "iex_floating_image_stat iex_floating_image_stats_name" + style.theme;
			c_stats.appendChild(c_stat_name);


			// Connector
			c_connector = document.createElement("div");
			c_connector.className = "iex_floating_image_connector" + style.theme;


			// Events
			var on_connector_mouseenter_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_connector_mouseenter , null ]),
				on_connector_mouseleave_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_connector_mouseleave , null ]),
				on_preview_mouseenter_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_mouseenter , null ]),
				on_preview_mouseleave_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_mouseleave , null ]),
				on_preview_mousewheel_bind = on_preview_mousewheel.bind(this),
				on_preview_mousemove_bind = on_preview_mousemove.bind(this),
				on_preview_mousedown_bind = on_preview_mousedown.bind(this),
				on_preview_contextmenu_bind = on_preview_contextmenu.bind(this),
				on_preview_image_load_bind = on_preview_image_load.bind(this),
				on_preview_image_error_bind = on_preview_image_error.bind(this),
				on_preview_overflow_mouseenter_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_overflow_mouseenter , null ]),
				on_window_resize_bind = on_window_resize.bind(this),
				on_window_scroll_bind = on_window_scroll.bind(this),

				on_preview_stats_mouseenter_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_stats_mouseenter , null ]),
				on_preview_stats_mouseleave_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_stats_mouseleave , null ]),
				on_preview_stats_zoom_mouseenter_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_stats_zoom_mouseenter , null ]),
				on_preview_stats_zoom_controls_mouseenter_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_stats_zoom_controls_mouseenter , null ]),
				on_preview_stats_zoom_controls_mouseleave_bind = wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_stats_zoom_controls_mouseleave , null ]),
				on_preview_stats_zoom_controls_mousedown_bind = on_preview_stats_zoom_controls_mousedown.bind(this),
				on_preview_stats_zoom_control_click_increase_bind = on_preview_stats_zoom_control_click.bind(this, 1),
				on_preview_stats_zoom_control_click_decrease_bind = on_preview_stats_zoom_control_click.bind(this, -1);

			addEventListenerManaged(events, c_connector, "mouseover", on_connector_mouseenter_bind, false);
			addEventListenerManaged(events, c_connector, "mouseout", on_connector_mouseleave_bind, false);
			addEventListenerManaged(events, c_connector, "mousedown", on_preview_mousedown_bind, false);
			addEventListenerManaged(events, c, "mouseover", on_preview_mouseenter_bind, false);
			addEventListenerManaged(events, c, "mouseout", on_preview_mouseleave_bind, false);
			addEventListenerManaged(events, c, "mousemove", on_preview_mousemove_bind, false);
			addEventListenerManaged(events, c, "mousewheel", on_preview_mousewheel_bind, false);
			addEventListenerManaged(events, c, "DOMMouseScroll", on_preview_mousewheel_bind, false);
			addEventListenerManaged(events, c, "mousedown", on_preview_mousedown_bind, false);
			addEventListenerManaged(events, c, "contextmenu", on_preview_contextmenu_bind, false);
			addEventListenerManaged(events, c_img, "load", on_preview_image_load_bind, false);
			addEventListenerManaged(events, c_img, "error", on_preview_image_error_bind, false);
			addEventListenerManaged(events, c_over, "mouseover", on_preview_overflow_mouseenter_bind, false);

			addEventListenerManaged(events, c_stats, "mouseover", on_preview_stats_mouseenter_bind, false);
			addEventListenerManaged(events, c_stats, "mouseout", on_preview_stats_mouseleave_bind, false);
			addEventListenerManaged(events, c_stat_zoom, "mouseover", on_preview_stats_zoom_mouseenter_bind, false);
			addEventListenerManaged(events, c_stat_zoom_controls, "mousedown", on_preview_stats_zoom_controls_mousedown_bind, false);
			addEventListenerManaged(events, c_stat_zoom_controls, "mouseover", on_preview_stats_zoom_controls_mouseenter_bind, false);
			addEventListenerManaged(events, c_stat_zoom_controls, "mouseout", on_preview_stats_zoom_controls_mouseleave_bind, false);
			addEventListenerManaged(events, c_stat_zoom_inc, "click", on_preview_stats_zoom_control_click_increase_bind, false);
			addEventListenerManaged(events, c_stat_zoom_dec, "click", on_preview_stats_zoom_control_click_decrease_bind, false);

			addEventListenerManaged(events, window, "resize", on_window_resize_bind, false);
			addEventListenerManaged(events, window, "scroll", on_window_scroll_bind, false);


			// Append
			this.floating_container.appendChild(c);
			this.floating_container.appendChild(c_connector);


			// Assign
			var obj = {
				nodes: {
					container: c,
					padding: c_pad,
					overflow: c_over,
					offset: c_offset,
					background: c_bg,
					image: c_img,
					video: null,
					video_nodes: null,
					zoom_border: c_zoom_border1,
					stats: {
						container: c_stats,
						zoom: c_stat_zoom,
						zoom_fit: c_stat_zoom_fit,
						resolution: c_stat_res,
						filesize: c_stat_size,
						filename: c_stat_name,
						status: [ c_stat_status1 , c_stat_status2 ],
					},
					controls: {
						zoom_container: c_stat_zoom_controls,
						zoom_decrease: c_stat_zoom_dec,
						zoom_increase: c_stat_zoom_inc,
					},
					connector: c_connector,
				},
				events: events,
				bindings: {
					on_hide_zoom_border_timeout_bind: hide_zoom_border.bind(this, true),
					on_hide_mouse_timeout_bind: hide_mouse.bind(this, true),
					on_hide_zoom_controls_timeout_bind: hide_zoom_controls.bind(this, true, false),
				},
				timers: {
					zoom_border: null,
					mouse: null,
					zoom_controls: null
				},
				state: {
					mouse_in_stats: false,
					video: null
				},
			};

			// Return
			add_video_to_image_preview.call(this, obj);
			return obj;
		};
		var add_video_to_image_preview = function (data) {
			var nodes = data.nodes,
				events = data.events,
				svgns = "http://www.w3.org/2000/svg",
				c_video, c_overlay, c_padding, c_div1, c_div2, c_div3, c_div4, svg_e1, svg_e2, c_container, c_buttons_left, c_buttons_right,
				c_seek_container, c_load_progress, c_play_progress, c_volume_progress, c_volume_container, svg_play, svg_volume, c_play_button,
				c_volume_button, c_seek_bar, c_volume_bar, c_time_current, c_time_duration;

			// Video
			c_video = document.createElement("video");
			c_video.className = "iex_floating_image_video iex_floating_image_video_hidden" + style.theme;



			// Controller overlay
			c_overlay = document.createElement("div");
			c_overlay.className = "iex_floating_image_overlay_controls_container" + style.theme;

			c_padding = document.createElement("div");
			c_padding.className = "iex_floating_image_overlay_controls_inner_container" + style.theme;
			c_overlay.appendChild(c_padding);

			c_container = document.createElement("div");
			c_container.className = "iex_floating_image_overlay_controls_table" + style.theme;
			c_padding.appendChild(c_container);



			// Pause/play button
			c_buttons_left = document.createElement("div");
			c_buttons_left.className = "iex_floating_image_overlay_controls_buttons_container" + style.theme;
			c_container.appendChild(c_buttons_left);

			c_div1 = document.createElement("div");
			c_div1.className = "iex_floating_image_overlay_controls_buttons_container2" + style.theme;
			c_buttons_left.appendChild(c_div1);

			c_div2 = document.createElement("div");
			c_div2.className = "iex_floating_image_overlay_controls_buttons_container_left" + style.theme;
			c_div1.appendChild(c_div2);

			// Mouse event controller
			c_play_button = document.createElement("div");
			c_play_button.className = "iex_floating_image_overlay_button_mouse_controller" + style.theme;
			c_div2.appendChild(c_play_button);

			// SVG image
			svg_play = document.createElementNS(svgns, "svg");
			svg_play.setAttribute("class", "iex_floating_image_overlay_play_button");
			svg_play.setAttribute("svgns", svgns);
			svg_play.setAttribute("width", "2em");
			svg_play.setAttribute("height", "2em");
			svg_play.setAttribute("viewBox", "0 0 1 1");
			c_div2.appendChild(svg_play);

			svg_e1 = document.createElementNS(svgns, "g");
			svg_e1.setAttribute("class", "iex_floating_image_overlay_button_scale_group");
			svg_e1.setAttribute("transform", "translate(0.25,0.25) scale(0.5)");
			svg_play.appendChild(svg_e1);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_play_button_play_icon iex_floating_image_overlay_button_fill");
			svg_e2.setAttribute("points", "0,0 0,1 1,0.5");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_play_button_loop_icon iex_floating_image_overlay_button_fill");
			svg_e2.setAttribute("points", "0.1,0.05 1,0.5 0.1,0.95");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_play_button_loop_icon iex_floating_image_overlay_button_fill");
			svg_e2.setAttribute("points", "0,0.7 0.4,0.5 0,0.3");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_play_button_pause_icon iex_floating_image_overlay_button_fill");
			svg_e2.setAttribute("points", "0.125,0 0.375,0 0.375,1 0.125,1");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_play_button_pause_icon iex_floating_image_overlay_button_fill");
			svg_e2.setAttribute("points", "0.625,0 0.875,0 0.875,1 0.625,1");
			svg_e1.appendChild(svg_e2);



			// Seek bar
			c_div1 = document.createElement("div");
			c_div1.className = "iex_floating_image_overlay_controls_seek_container" + style.theme;
			c_container.appendChild(c_div1);

			c_div2 = document.createElement("div");
			c_div2.className = "iex_floating_image_overlay_controls_seek_container2" + style.theme;
			c_div1.appendChild(c_div2);

			c_seek_bar = document.createElement("div");
			c_seek_bar.className = "iex_floating_image_overlay_controls_seek_bar" + style.theme;
			c_div2.appendChild(c_seek_bar);

			c_div3 = document.createElement("div");
			c_div3.className = "iex_floating_image_overlay_controls_seek_bar_bg" + style.theme;
			c_seek_bar.appendChild(c_div3);

			c_load_progress = document.createElement("div");
			c_load_progress.className = "iex_floating_image_overlay_controls_seek_bar_loaded" + style.theme;
			c_div3.appendChild(c_load_progress);

			c_play_progress = document.createElement("div");
			c_play_progress.className = "iex_floating_image_overlay_controls_seek_bar_played" + style.theme;
			c_div3.appendChild(c_play_progress);

			c_div4 = document.createElement("div");
			c_div4.className = "iex_floating_image_overlay_controls_seek_time_table" + style.theme;
			c_div3.appendChild(c_div4);

			c_time_current = document.createElement("div");
			c_time_current.className = "iex_floating_image_overlay_controls_seek_time_current" + style.theme;
			c_div4.appendChild(c_time_current);

			c_time_duration = document.createElement("div");
			c_time_duration.className = "iex_floating_image_overlay_controls_seek_time_duration" + style.theme;
			c_div4.appendChild(c_time_duration);



			// Volume bar/mute button
			c_buttons_right = document.createElement("div");
			c_buttons_right.className = "iex_floating_image_overlay_controls_buttons_container" + style.theme;
			c_container.appendChild(c_buttons_right);

			c_div1 = document.createElement("div");
			c_div1.className = "iex_floating_image_overlay_controls_buttons_container2" + style.theme;
			c_buttons_right.appendChild(c_div1);

			c_div2 = document.createElement("div");
			c_div2.className = "iex_floating_image_overlay_controls_buttons_container_right" + style.theme;
			c_div1.appendChild(c_div2);

			// Mouse event controller
			c_volume_button = document.createElement("div");
			c_volume_button.className = "iex_floating_image_overlay_button_mouse_controller" + style.theme;
			c_div2.appendChild(c_volume_button);

			// SVG image
			svg_volume = document.createElementNS(svgns, "svg");
			svg_volume.setAttribute("class", "iex_floating_image_overlay_volume_button");
			svg_volume.setAttribute("svgns", svgns);
			svg_volume.setAttribute("width", "2em");
			svg_volume.setAttribute("height", "2em");
			svg_volume.setAttribute("viewBox", "0 0 1 1");
			c_div2.appendChild(svg_volume);

			svg_e1 = document.createElementNS(svgns, "g");
			svg_e1.setAttribute("class", "iex_floating_image_overlay_button_scale_group");
			svg_e1.setAttribute("transform", "translate(0.25,0.25) scale(0.5)");
			svg_volume.appendChild(svg_e1);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_volume_button_speaker iex_floating_image_overlay_button_fill");
			svg_e2.setAttribute("points", "0,0.3 0.2,0.3 0.5,0 0.6,0 0.6,1 0.5,1 0.2,0.7 0,0.7");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "path");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_volume_button_wave_big iex_floating_image_overlay_button_fill");
			svg_e2.setAttribute("d", "M 0.75,0.1 Q 1.3,0.5 0.75,0.9 L 0.75,0.75 Q 1.05,0.5 0.75,0.25 Z");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "path");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_volume_button_wave_small iex_floating_image_overlay_button_fill");
			svg_e2.setAttribute("d", "M 0.75,0.75 Q 1.05,0.5 0.75,0.25 Z");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "g");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_volume_button_mute_icon");
			svg_e1.appendChild(svg_e2);
			svg_e1 = svg_e2;

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_volume_button_mute_icon_polygon");
			svg_e2.setAttribute("points", "0.7,0.3 1.0,0.6 0.9,0.7 0.6,0.4");
			svg_e1.appendChild(svg_e2);

			svg_e2 = document.createElementNS(svgns, "polygon");
			svg_e2.setAttribute("class", "iex_floating_image_overlay_volume_button_mute_icon_polygon");
			svg_e2.setAttribute("points", "0.7,0.7 1.0,0.4 0.9,0.3 0.6,0.6");
			svg_e1.appendChild(svg_e2);



			// Volume bar
			c_div2 = document.createElement("div");
			c_div2.className = "iex_floating_image_overlay_controls_buttons_container_right_upper" + style.theme;
			c_div1.appendChild(c_div2);

			c_volume_container = document.createElement("div");
			c_volume_container.className = "iex_floating_image_overlay_controls_volume_container" + style.theme;
			c_div2.appendChild(c_volume_container);

			c_volume_bar = document.createElement("div");
			c_volume_bar.className = "iex_floating_image_overlay_controls_volume_bar" + style.theme;
			c_volume_container.appendChild(c_volume_bar);

			c_div3 = document.createElement("div");
			c_div3.className = "iex_floating_image_overlay_controls_volume_bar_bg" + style.theme;
			c_volume_bar.appendChild(c_div3);

			c_volume_progress = document.createElement("div");
			c_volume_progress.className = "iex_floating_image_overlay_controls_volume_bar_level" + style.theme;
			c_div3.appendChild(c_volume_progress);



			// Events
			addEventListenerManaged(events, c_video, "loadedmetadata", on_preview_video_loadedmetadata.bind(this), false);
			addEventListenerManaged(events, c_video, "canplay", on_preview_video_canplay.bind(this), false);
			addEventListenerManaged(events, c_video, "canplaythrough", on_preview_video_canplaythrough.bind(this), false);
			addEventListenerManaged(events, c_video, "error", on_preview_video_error.bind(this), false);
			addEventListenerManaged(events, c_video, "abort", on_preview_video_abort.bind(this), false);
			addEventListenerManaged(events, c_video, "progress", on_preview_video_progress.bind(this), false);
			addEventListenerManaged(events, c_video, "timeupdate", on_preview_video_timeupdate.bind(this), false);
			addEventListenerManaged(events, c_video, "ended", on_preview_video_ended.bind(this), false);

			var prevent = on_preview_controls_prevent_default_mousedown.bind(this);

			addEventListenerManaged(events, c_padding, "mouseover", wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_controls_mouseenter , null ]), false);
			addEventListenerManaged(events, c_padding, "mouseout", wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_controls_mouseleave , null ]), false);
			addEventListenerManaged(events, c_container, "mousedown", on_preview_controls_container_mousedown.bind(this), false);
			addEventListenerManaged(events, c_play_button, "click", on_preview_controls_play_button_click.bind(this), false);
			addEventListenerManaged(events, c_volume_button, "click", on_preview_controls_volume_button_click.bind(this), false);
			addEventListenerManaged(events, c_volume_button, "mouseover", wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_controls_volume_button_mouseenter , null ]), false);
			addEventListenerManaged(events, c_buttons_right, "mouseout", wrap_callback.call(this, on_mouseenterleave_prehandle, [ this , on_preview_controls_volume_button_container_mouseleave , null ]), false);
			addEventListenerManaged(events, c_seek_bar, "mousedown", on_preview_controls_seek_bar_mousedown.bind(this), false);
			addEventListenerManaged(events, c_volume_bar, "mousedown", on_preview_controls_volume_bar_mousedown.bind(this), false);
			addEventListenerManaged(events, c_time_current, "mousedown", prevent, false);
			addEventListenerManaged(events, c_time_duration, "mousedown", prevent, false);



			// Apply data
			data.nodes.video = c_video;
			data.nodes.video_nodes = {
				overlay: c_overlay,
				padding: c_padding,
				container: c_container,

				play_button: c_play_button,
				volume_button: c_volume_button,
				volume_button_container: c_buttons_right,
				volume_container: c_volume_container,

				seek_bar: c_seek_bar,
				volume_bar: c_volume_bar,

				time_current: c_time_current,
				time_duration: c_time_duration,

				play_progress: c_play_progress,
				load_progress: c_load_progress,
				volume_progress: c_volume_progress,

				svg_volume: svg_volume,
				svg_play: svg_play,
			};
			data.state.video = {
				seeking: false,
				seeking_paused: false,
				volume_modifying: false,
				on_capture_mousemove: on_preview_controls_capture_mousemove.bind(this),
				on_capture_mouseup: on_preview_controls_capture_mouseup.bind(this),
				mouse_capturing_element: null,
				interacted: false,
				bar_rect: null
			};


			// Insert
			nodes.overflow.appendChild(c_overlay);
			nodes.offset.appendChild(c_video);
		};

		var show_zoom_border = function (persistent) {
			var i_d = this.image_data,
				i_d_t = i_d.timers;

			// Remove the class
			style.remove_class(i_d.nodes.zoom_border, "iex_floating_image_zoom_border_hidden");

			// Timer
			if (persistent) {
				if (i_d_t.zoom_border !== null) {
					clearTimeout(i_d_t.zoom_border);
					i_d_t.zoom_border = null;
				}
			}
			else {
				if (i_d_t.zoom_border !== null) {
					clearTimeout(i_d_t.zoom_border);
				}
				i_d_t.zoom_border = setTimeout(i_d.bindings.on_hide_zoom_border_timeout_bind, this.settings.zoom_border_hide_time);
			}
		};
		var hide_zoom_border = function (nullify_timer) {
			var i_d = this.image_data,
				i_d_t = i_d.timers;

			// Timer
			if (!nullify_timer && i_d_t.zoom_border !== null) {
				clearTimeout(i_d_t.zoom_border);
			}
			i_d_t.zoom_border = null;

			// Add the class
			style.add_class(i_d.nodes.zoom_border, "iex_floating_image_zoom_border_hidden");
		};
		var show_mouse = function (persistent) {
			var i_d = this.image_data,
				i_d_t = i_d.timers;

			// Remove the class
			style.remove_class(i_d.nodes.overflow, "iex_floating_image_overflow_no_cursor");

			// Timer
			if (persistent) {
				if (i_d_t.mouse !== null) {
					clearTimeout(i_d_t.mouse);
					i_d_t.mouse = null;
				}
			}
			else {
				if (i_d_t.mouse !== null) {
					clearTimeout(i_d_t.mouse);
				}
				i_d_t.mouse = setTimeout(i_d.bindings.on_hide_mouse_timeout_bind, this.settings.mouse_hide_time);
			}
		};
		var hide_mouse = function (nullify_timer) {
			var i_d = this.image_data,
				i_d_t = i_d.timers;

			// Timer
			if (!nullify_timer && i_d_t.mouse !== null) {
				clearTimeout(i_d_t.mouse);
			}
			i_d_t.mouse = null;

			// Add the class
			style.add_class(i_d.nodes.overflow, "iex_floating_image_overflow_no_cursor");
		};
		var hide_paddings = function () {
			// Remove
			var c_pad = this.image_data.nodes.padding;

			c_pad.style.top = "0";
			c_pad.style.padding = "0";

			this.settings.padding_active = false;
		};
		var update_zoom_stat = function () {
			// Update zoom display
			var set = this.settings,
				stats = this.image_data.nodes.stats,
				s;

			// Level
			s = (set.zoom * 100).toFixed(0) + "%";
			stats.zoom.textContent = s;

			// Fit status
			s = "";
			if (set.fit) {
				s = " fit";
				if (set.fit_large_allowed) {
					s += "-" + (set.fit_axis == 0 ? "x" : "y");
				}
			}
			stats.zoom_fit.textContent = s;
		};
		var show_zoom_controls = function (force_open) {
			var i_data = this.image_data;

			// Display
			if (force_open) {
				var zoom_container = i_data.nodes.controls.zoom_container,
					z_rect;
				style.remove_class(zoom_container, "iex_floating_image_stats_zoom_controls_hidden");

				var z_rect = this.get_object_rect(zoom_container);
				i_data.nodes.stats.zoom.style.paddingLeft = (z_rect.right - z_rect.left) + "px";
			}

			// Stop timer
			if (i_data.timers.zoom_controls !== null) {
				clearTimeout(i_data.timers.zoom_controls);
				i_data.timers.zoom_controls = null;
			}
		};
		var hide_zoom_controls = function (instant, timer_check) {
			var i_data = this.image_data;
			if (instant) {
				// Hide
				var zoom_container = i_data.nodes.controls.zoom_container;
				style.add_class(zoom_container, "iex_floating_image_stats_zoom_controls_hidden");
				i_data.nodes.stats.zoom.style.paddingLeft = "";

				// Stop timer
				if (timer_check && i_data.timers.zoom_controls !== null) {
					clearTimeout(i_data.timers.zoom_controls);
				}
				i_data.timers.zoom_controls = null;
			}
			else {
				// Set timer
				i_data.timers.zoom_controls = setTimeout(i_data.bindings.on_hide_zoom_controls_timeout_bind, 10);
			}
		};
		var set_zoom_controls_fixed = function (fixed) {
			// Set fixed
			var i_data = this.image_data,
				zoom_container = i_data.nodes.controls.zoom_container;

			if (fixed) {
				var w_rect = this.get_document_rect(),
					z_rect = this.get_object_rect(zoom_container);

				// Fix
				style.add_class(zoom_container, "iex_floating_image_stats_zoom_controls_fixed");
				zoom_container.style.left = (z_rect.left - w_rect.left) + "px";
				zoom_container.style.top = (z_rect.top - w_rect.top) + "px";
			}
			else {
				// Un-fix
				style.remove_class(zoom_container, "iex_floating_image_stats_zoom_controls_fixed");
				zoom_container.style.left = "";
				zoom_container.style.top = "";
			}

		};

		var set_video_initial = function () {
			var nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes,
				v_set = this.settings.video;

			// Initial video setup
			set_video_muted.call(this, v_set.mute_initially);
			set_video_volume.call(this, v_set.volume, false, false);
			video.loop = v_set.loop;
			v_nodes.load_progress.style.width = "0";
			this.image_data.state.video.interacted = false;
			if (v_set.mini_controls >= 2) {
				set_video_mini_controls_enabled.call(this, true);
			}

			// Update seek bar
			update_video_seek_status.call(this, -1);
			update_video_duration_status.call(this);

			// Update icons
			update_video_play_status.call(this, true);
		};
		var set_video_muted = function (muted) {
			var nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes,
				v_state = this.image_data.state.video;

			// Apply
			video.muted = muted;

			// Change icon
			if (muted) style.add_class_svg(v_nodes.svg_volume, "iex_floating_image_overlay_volume_button_muted");
			else style.remove_class_svg(v_nodes.svg_volume, "iex_floating_image_overlay_volume_button_muted");

			// Interacted
			v_state.interacted = true;
		};
		var set_video_volume = function (volume, apply_changes, save_changes) {
			var nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes,
				v_state = this.image_data.state.video,
				cls;

			// Set volume on video
			if (volume >= 0) {
				if (volume > 1) volume = 1;
				video.volume = volume;
			}
			else {
				volume = video.volume;
			}

			// Update bar
			v_nodes.volume_progress.style.height = (volume * 100).toFixed(2) + "%";

			// Update icons
			cls = "iex_floating_image_overlay_volume_button" + (video.muted ? " iex_floating_image_overlay_volume_button_muted" : "");
			if (volume > 0.625) cls += " iex_floating_image_overlay_volume_button_high";
			else if (volume > 0.125) cls += " iex_floating_image_overlay_volume_button_medium";
			else cls += " iex_floating_image_overlay_volume_button_low";
			v_nodes.svg_volume.setAttribute("class", cls);

			// Interacted
			v_state.interacted = true;

			// Save
			if (apply_changes) {
				this.settings.video.volume = volume;
			}
			if (save_changes) {
				// Save
				settings.change_value(["image_expansion", "video", "volume"], volume);
				settings.save_values();
			}
		};
		var set_video_paused = function (paused, loop) {
			var video = this.image_data.nodes.video;

			// Loop
			if (loop === true || loop === false) {
				video.loop = loop;
			}

			// Pause or play
			if (paused) video.pause();
			else video.play();

			// Interacted
			this.image_data.state.video.interacted = true;

			// Update buttons
			update_video_play_status.call(this, paused);
		};
		var update_video_play_status = function (paused) {
			var nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes;

			// Update buttons
			v_nodes.svg_play.setAttribute("class", "iex_floating_image_overlay_play_button" + (video.loop ? " iex_floating_image_overlay_play_button_looping" : "") + (paused ? "" : " iex_floating_image_overlay_play_button_playing"));
		};
		var update_video_duration_status = function () {
			var nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes,
				duration = video.duration;

			// Update seek bar
			if (isNaN(duration)) {
				// Update time numbers
				v_nodes.time_duration.textContent = "";
			}
			else {
				// Update time numbers
				v_nodes.time_duration.textContent = format_video_time.call(this, duration);
			}
		};
		var update_video_seek_status = function (time) {
			var nodes = this.image_data.nodes,
				video = nodes.video,
				v_nodes = nodes.video_nodes,
				duration = video.duration;

			// Update seek bar
			if (time < 0 || isNaN(duration)) {
				// Bar
				v_nodes.play_progress.style.width = "0";

				// Update time numbers
				v_nodes.time_current.textContent = "";
			}
			else {
				// Bar
				v_nodes.play_progress.style.width = ((time / duration) * 100).toFixed(2) + "%";

				// Update time numbers
				v_nodes.time_current.textContent = format_video_time.call(this, time);
			}
		};
		var setup_video_mouse_capture = function () {
			var v_state = this.image_data.state.video;

			if (v_state.mouse_capturing_element === null && (v_state.mouse_capturing_element = document.documentElement) !== null) {
				v_state.mouse_capturing_element.addEventListener("mousemove", v_state.on_capture_mousemove, false);
				v_state.mouse_capturing_element.addEventListener("mouseup", v_state.on_capture_mouseup, false);
				update_video_mouse_capture.call(this);
			}
		};
		var teardown_video_mouse_capture = function () {
			var v_state = this.image_data.state.video;

			if (v_state.mouse_capturing_element !== null) {
				v_state.mouse_capturing_element.removeEventListener("mousemove", v_state.on_capture_mousemove, false);
				v_state.mouse_capturing_element.removeEventListener("mouseup", v_state.on_capture_mouseup, false);
				v_state.mouse_capturing_element = null;
			}
		};
		var update_video_mouse_capture = function () {
			var v_nodes = this.image_data.nodes.video_nodes,
				v_state = this.image_data.state.video;

			// Set paused state
			if (v_state.seeking) {
				v_state.bar_rect = this.get_object_rect(v_nodes.seek_bar);
			}
			else if (v_state.volume_modifying) {
				v_state.bar_rect = this.get_object_rect(v_nodes.volume_bar);
			}
		};
		var set_video_mini_controls_enabled = function (enabled) {
			// Show or hide the mini controller
			var v_nodes = this.image_data.nodes.video_nodes;

			if (enabled) style.add_class(v_nodes.container, "iex_floating_image_overlay_controls_table_mini");
			else style.remove_class(v_nodes.container, "iex_floating_image_overlay_controls_table_mini");
		};

		var update_preview_size = function (width_new, height_new) {
			var set = this.settings,
				stats = this.image_data.nodes.stats;

			// Change
			set.size.width = width_new;
			set.size.height = height_new;
			set.size_acquired = true;

			// Change info
			stats.resolution.textContent = set.size.width + "x" + set.size.height;

			// Reset size
			this.preview_update(true, false, false);
		};



		ImageHover.prototype = {
			constructor: ImageHover,

			destroy: function () {
				// Remove events
				if (this.on_api_image_hover_open_bind !== null) {
					api.off("image_hover_open", this.on_api_image_hover_open_bind);
					this.on_api_image_hover_open_bind = null;
				}
				if (this.hotkeys !== null) {
					for (var i = 0; i < this.hotkeys.length; ++i) {
						hotkey_manager.unregister(this.hotkeys[i]);
					}
					this.hotkeys = null;
				}
			},

			start: function () {
				// Enable if settings allow it
				if (settings.values["image_expansion"]["enabled"]) {
					this.update_settings_from_global();
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
				api.on("post_add", on_api_post_add.bind(this));
				api.on("post_remove", on_api_post_remove.bind(this));

				// Bind default image hover test
				api.on("image_hover_open", this.on_api_image_hover_open_bind = on_api_image_hover_open.bind(this));

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

			update_settings_from_global: function () {
				// Copy settings
				var hs = settings.values["image_expansion"]["hover"],
					vs = settings.values["image_expansion"]["video"],
					ss = settings.values["image_expansion"]["style"],
					set = this.settings,
					v_set = set.video,
					s_set = set.style;

				set.zoom_invert = hs.zoom_invert;
				set.zoom_border_show = hs.zoom_border_show;
				set.zoom_border_hide_time = hs.zoom_border_hide_time * 1000;
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

				s_set.controls_rounded_border = ss.controls_rounded_border;

				if (this.image_data !== null) this.update_style();
			},

			preview_open: function (image_container, post_info, auto_fit) {
				// Can't open
				if (this.floating_container === null) return;

				// Cancel the open timer
				if (this.preview_open_timer !== null) {
					clearTimeout(this.preview_open_timer);
					this.preview_open_timer = null;
				}

				// Cancel the close timer
				if (this.preview_close_timer !== null) {
					clearTimeout(this.preview_close_timer);
					this.preview_close_timer = null;
				}

				// Already opened
				if (this.image_visible && image_container === this.settings.image_container) return;



				// Create
				if (this.image_data === null) {
					// Create new
					this.image_data = create_new_image_preview.call(this);
					this.update_style();
				}



				// Vars
				var nodes = this.image_data.nodes,
					stats = nodes.stats,
					set = this.settings,
					ext = /\.[^\.]+$/.exec(post_info.filename);



				// Expansion type
				ext = ext ? ext[0].toLowerCase() : "";
				set.type = (this.extensions_video.indexOf(ext) >= 0) ? TYPE_VIDEO : TYPE_IMAGE;



				// Reset
				if (this.image_visible) preview_reset.call(this);



				// Apply settings
				set.image_container = image_container;
				set.fit = auto_fit;
				set.fit_large = false;
				set.fit_axis = 0;
				set.zoom = 1.0;
				set.zoom_x = 0.0;
				set.zoom_y = 0.0;
				set.mouse_x = 0.0;
				set.mouse_y = 0.0;
				if (post_info.resolution.width > 0 && post_info.resolution.height > 0) {
					// Size info okay
					set.size.width = post_info.resolution.width;
					set.size.height = post_info.resolution.height;
					set.size_acquired = true;
				}
				else {
					// No size found
					if (post_info.resolution_thumb.width > 0 && post_info.resolution_thumb.height > 0) {
						set.size.width = post_info.resolution_thumb.width;
						set.size.height = post_info.resolution_thumb.height;
					}
					else {
						set.size.width = 100;
						set.size.height = 100;
					}
					set.size_acquired = false;
				}



				// Positioning
				this.image_visible = true;
				this.preview_update(true, false, false);



				// Stats display level
				if (set.display_stats == 0) {
					style.remove_classes(stats.container, "iex_floating_image_stats_container_minimal iex_floating_image_stats_container_very_minimal");
				}
				else if (set.display_stats == 1) {
					style.remove_class(stats.container, "iex_floating_image_stats_container_very_minimal");
					style.add_class(stats.container, "iex_floating_image_stats_container_minimal");
				}
				else if (set.display_stats == 2) {
					style.remove_class(stats.container, "iex_floating_image_stats_container_minimal");
					style.add_class(stats.container, "iex_floating_image_stats_container_very_minimal");
				}

				// Set stats
				if (set.size_acquired) {
					stats.resolution.textContent = set.size.width + "x" + set.size.height;
				}
				else {
					stats.resolution.textContent = "unknown";
				}
				stats.filesize.textContent = post_info.size + post_info.size_label;
				stats.filename.textContent = post_info.filename;
				update_zoom_stat.call(this);



				// Background image
				if (post_info.thumb !== null) {
					nodes.background.style.backgroundImage = "url('" + post_info.thumb + "')";
					if (!this.extensions_display_bg[ext]) {
						// Hide it
						style.add_class(nodes.background, "iex_floating_image_background_disabled");
					}
				}
				else {
					// Hide
					style.add_class(nodes.background, "iex_floating_image_background_disabled");
				}

				// Image or video setup
				if (set.type == TYPE_IMAGE) {
					// Image
					style.remove_class(nodes.image, "iex_floating_image_image_hidden");

					if (!set.size_acquired) style.add_class(nodes.image, "iex_floating_image_image_unsized");

					nodes.image.removeAttribute("src");
					nodes.image.setAttribute("src", post_info.image);
				}
				else { // if (set.type == TYPE_VIDEO) {
					// Reset controls
					var video = nodes.video;
					set_video_initial.call(this);

					// Video
					style.remove_class(video, "iex_floating_image_video_hidden");
					style.add_class(video, "iex_floating_image_video_not_ready");

					if (!set.size_acquired) style.add_class(nodes.video, "iex_floating_image_video_unsized");

					video.setAttribute("src", post_info.image);
					video.load();
				}



				// Visible
				style.add_class(nodes.container, "iex_floating_image_container_visible");
				style.add_class(nodes.connector, "iex_floating_image_connector_visible");
			},
			preview_close: function (immediate) {
				// Cancel the open timer
				if (this.preview_open_timer !== null) {
					clearTimeout(this.preview_open_timer);
					this.preview_open_timer = null;
				}

				// Already closed
				if (!this.image_visible) return;

				// Timer
				if (immediate) {
					if (this.preview_close_timer !== null) {
						clearTimeout(this.preview_close_timer);
						this.preview_close_timer = null;
					}
				}
				else {
					this.preview_close_timer = setTimeout(this.on_preview_close_timeout_bind, 20);
					return;
				}

				// Remove visibility
				preview_reset.call(this);
			},
			preview_close_cancel: function () {
				// Cancel the timer
				if (this.preview_close_timer !== null) {
					clearTimeout(this.preview_close_timer);
					this.preview_close_timer = null;
				}
			},
			preview_update: function (fit_best, keep_mouse_inside, update_zoom_pos) {
				// Update the position and sizing of the preview after a zoom, resize, or open event
				if (!this.image_visible) return;

				// Vars
				var set = this.settings,
					paddings = set.region_paddings,
					max_rect = this.get_document_rect(),
					left = max_rect.left,
					top = max_rect.top,
					img_rect = this.get_object_rect(set.image_container),
					size = set.size,
					w = size.width,
					h = size.height,
					nodes = this.image_data.nodes,
					c = nodes.container,
					c_pad = nodes.padding,
					c_over = nodes.overflow,
					c_offset = nodes.offset,
					c_connector = nodes.connector;


				// Include header
				if (!set.header_overlap) {
					var header_rect = this.get_header_rect();

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

				// Sizing
				var w_max = (max_rect.right - max_rect.left);
				var h_max = (max_rect.bottom - max_rect.top);
				if (w_max < 1) w_max = 1;
				if (h_max < 1) h_max = 1;

				set.display_size_max.width = w_max;
				set.display_size_max.height = h_max;

				// Get the minimum scale and apply it
				var w_scale = w_max / w,
					h_scale = h_max / h;

				if (fit_best && (w_scale < 1.0 || h_scale < 1.0)) {
					set.fit = true;
					set.fit_large = (Math.abs(w_scale - h_scale) < 1e-5) && set.fit_large_allowed;
				}
				if (set.fit) {
					var best_scale;
					if ((w_scale > h_scale) == set.fit_large) {
						best_scale = w_scale;
						set.fit_axis = 0; // x
					}
					else {
						best_scale = h_scale;
						set.fit_axis = 1; // y
					}

					w *= best_scale;
					h *= best_scale;
				}
				w *= set.zoom;
				h *= set.zoom;

				set.display_size.width = w;
				set.display_size.height = h;

				// Connector
				c_connector.style.left = img_rect.right + "px";
				c_connector.style.width = paddings.left + "px";
				c_connector.style.top = img_rect.top + "px";
				c_connector.style.height = (img_rect.bottom - img_rect.top) + "px";

				// Position
				var disp_h = ((h < h_max) ? h : h_max),
					x = max_rect.left,
					y = (img_rect.top + img_rect.bottom - disp_h) / 2.0;
				if (y + disp_h >= max_rect.bottom) y = max_rect.bottom - disp_h;
				if (y < max_rect.top) y = max_rect.top;

				c.style.left = (x - left).toFixed(2) + "px";
				c.style.top = (y - top).toFixed(2) + "px";

				// Size
				c_over.style.maxWidth = w_max.toFixed(2) + "px";
				c_over.style.maxHeight = h_max.toFixed(2) + "px";
				c_offset.style.width = w + "px";
				c_offset.style.height = h + "px";

				// Mouse inside
				var off_right = 0,
					off_top = 0,
					off_bottom = 0,
					off_any = false;
				if (keep_mouse_inside) {
					// Setup
					var m_extra = set.padding_extra,
						disp_w = ((w < w_max) ? w : w_max),
						x_r = x + disp_w,
						y_b = y + disp_h;
					off_right = (set.mouse_x - x_r);
					off_top = (y - set.mouse_y);
					off_bottom = (set.mouse_y - y_b);

					// Right offset
					if (off_right <= 0) {
						off_right = 0;
					}
					else {
						off_right += m_extra.right;
						if (x_r + off_right > max_rect.right) {
							off_right = Math.max(0, max_rect.right - x_r);
						}
						off_any = (off_right > 0);
					}

					// Top offset
					if (off_top <= 0) {
						off_top = 0;
					}
					else {
						off_top += m_extra.top;
						if (y - off_top < max_rect.top) {
							off_top = Math.max(0, y - max_rect.top);
						}
						off_any = off_any || (off_top > 0);
					}

					// Bottom offset
					if (off_bottom <= 0) {
						off_bottom = 0;
					}
					else {
						off_bottom += m_extra.bottom;
						if (y_b + off_bottom > max_rect.bottom) {
							off_bottom = Math.max(0, max_rect.bottom - y_b);
						}
						off_any = off_any || (off_bottom > 0);
					}
				}

				// Apply mouse
				c_pad.style.top = (-off_top).toFixed(2) + "px";
				c_pad.style.padding = off_top.toFixed(2) + "px " + off_right.toFixed(2) + "px " + off_bottom.toFixed(2) + "px 0px";
				set.padding_active = off_any;

				// Mouse position
				this.preview_update_zoom_position(update_zoom_pos);
			},
			preview_update_zoom: function (delta, position_update) {
				// Update zoom
				var set = this.settings,
					img_size = set.size,
					disp_size = set.display_size,
					disp_size_max = set.display_size_max,
					size_update = false,
					zoom_limits = set.zoom_limits;

				if (delta > 0) {
					// Larger
					if (set.fit) {
						if (set.fit_large || !set.fit_large_allowed) {
							// Zoom in
							var z = set.zoom;
							z *= zoom_limits.increase;
							if (z > zoom_limits.max) z = zoom_limits.max;
							if (set.zoom != z) {
								// Update
								set.zoom = z;
								size_update = true;
							}
						}
						else {
							// Zoom in
							var z = set.zoom * zoom_limits.increase,
								w_scale = disp_size_max.width / img_size.width,
								h_scale = disp_size_max.height / img_size.height,
								z_scale = (w_scale < h_scale) ? w_scale : h_scale;

							w_scale = disp_size_max.width / (img_size.width * z * z_scale);
							h_scale = disp_size_max.height / (img_size.height * z * z_scale);

							if (w_scale <= 1.0 && h_scale <= 1.0) {
								// Fit large
								set.fit_large = true;
								set.zoom = 1.0;
							}
							else {
								// Not fit large
								set.zoom = z;
							}

							// Update
							size_update = true;
						}
					}
					else {
						// Zoom in
						var z = set.zoom;
						z *= zoom_limits.increase;

						var w_scale = disp_size_max.width / (img_size.width * z);
						var h_scale = disp_size_max.height / (img_size.height * z);
						if (w_scale <= 1.0 || h_scale <= 1.0) {
							// Fit
							set.fit = true;
							set.fit_large = (Math.abs(w_scale - h_scale) < 1e-5) && set.fit_large_allowed;
							set.zoom = 1.0;
						}
						else {
							// Not fit
							set.zoom = z;
						}

						// Update
						size_update = true;
					}
				}
				else if (delta < 0) {
					// Smaller
					if (set.fit) {
						if (set.zoom == 1.0) {
							if (set.fit_large) {
								// Switch to normal fit
								var w_scale = disp_size_max.width / img_size.width,
									h_scale = disp_size_max.height / img_size.height,
									z_scale = (w_scale < h_scale) ? w_scale : h_scale,
									scale;

								w_scale = disp_size_max.width / (img_size.width * z_scale);
								h_scale = disp_size_max.height / (img_size.height * z_scale);
								scale = (w_scale > h_scale) ? w_scale : h_scale;
								scale = Math.pow(2, Math.floor(log2(scale)));

								set.fit_large = false;
								set.zoom = scale;
								size_update = true;
							}
							else {
								// Stop fitting if possible
								var w_scale = disp_size_max.width / img_size.width,
									h_scale = disp_size_max.height / img_size.height,
									scale;

								if (w_scale > 1.0 && h_scale > 1.0) {
									// Calculate new zoom
									scale = (w_scale < h_scale) ? w_scale : h_scale;
									scale = Math.pow(2, Math.floor(log2(scale)));

									// Update
									set.fit = false;
									set.fit_large = false;
									set.zoom = scale;
									size_update = true;
								}
							}
						}
						else {
							// Zoom out
							set.zoom /= zoom_limits.decrease;
							if (set.zoom < 1.0) set.zoom = 1.0;

							// Update
							size_update = true;
						}
					}
					else {
						// Zoom out
						var z = set.zoom;
						z /= zoom_limits.decrease;
						if (z < 1.0) z = 1.0;

						if (set.zoom != z) {
							// Update
							set.zoom = z;
							size_update = true;
						}
					}
				}

				// Update
				if (size_update) {
					// Update
					this.preview_update(false, true, position_update);

					// Update text
					update_zoom_stat.call(this);
				}
			},
			preview_update_zoom_position: function (update) {
				var set = this.settings,
					disp_size = set.display_size,
					disp_size_max = set.display_size_max,
					preview_rect = null,
					margins = set.zoom_margins,
					w_diff = disp_size.width - disp_size_max.width,
					h_diff = disp_size.height - disp_size_max.height,
					nodes = this.image_data.nodes,
					c_zoom_border = nodes.zoom_border,
					c_offset = nodes.offset,
					x, y;

				if (update) {
					if (w_diff > 1e-5) {
						// Update x
						preview_rect = this.get_object_rect(this.image_data.nodes.overflow);

						// Get local mouse
						x = set.mouse_x - preview_rect.left;
						var w = (preview_rect.right - preview_rect.left);
						var m_w = margins.horizontal * w;
						x = (x - m_w) / (w - m_w * 2);
						if (x < 0.0) x = 0.0;
						else if (x > 1.0) x = 1.0;

						// Apply
						set.zoom_x = x;
						style.add_class(c_zoom_border, "iex_floating_image_zoom_border_horizontal");
					}
					else {
						// Zero
						set.zoom_x = 0.0;
						x = 0.0;
						w_diff = 0.0;
						style.remove_class(c_zoom_border, "iex_floating_image_zoom_border_horizontal");
					}

					if (h_diff > 1e-5) {
						// Update y
						if (preview_rect === null) preview_rect = this.get_object_rect(this.image_data.nodes.overflow);

						// Get local mouse
						y = set.mouse_y - preview_rect.top;
						var h = (preview_rect.bottom - preview_rect.top);
						var m_v = margins.vertical * h;
						y = (y - m_v) / (h - m_v * 2);
						if (y < 0.0) y = 0.0;
						else if (y > 1.0) y = 1.0;

						// Apply
						set.zoom_y = y;
						style.add_class(c_zoom_border, "iex_floating_image_zoom_border_vertical");
					}
					else {
						// Zero
						set.zoom_y = 0.0;
						y = 0.0;
						h_diff = 0.0;
						style.remove_class(c_zoom_border, "iex_floating_image_zoom_border_vertical");
					}
				}
				else {
					// Get vars
					x = set.zoom_x;
					y = set.zoom_y;
					if (w_diff < 0.0) w_diff = 0.0;
					if (h_diff < 0.0) h_diff = 0.0;
				}

				// Invert
				if (set.zoom_invert) {
					x = 1.0 - x;
					y = 1.0 - y;
				}

				// Set offset
				c_offset.style.left = (w_diff * -x).toFixed(2) + "px";
				c_offset.style.top = (h_diff * -y).toFixed(2) + "px";
			},

			update_style: function () {
				var nodes = this.image_data.nodes,
					v_nodes = nodes.video_nodes,
					set = this.settings,
					b_class = "iex_floating_image_overlay_controls_no_border_radius";

				// Rounded borders
				if (is_chrome || !set.style.controls_rounded_border) {
					style.add_class(v_nodes.seek_bar, b_class);
					style.add_class(v_nodes.volume_bar, b_class);
				}
				else {
					style.remove_class(v_nodes.seek_bar, b_class);
					style.remove_class(v_nodes.volume_bar, b_class);
				}
			},

			get_window_rect: function () {
				var doc = document.documentElement;

				var left = (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0);
				var top = (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0);

				return {
					left: left,
					top: top,
					right: left + (window.innerWidth || doc.clientWidth || 0),
					bottom: top + (window.innerHeight || doc.clientHeight || 0),
				};
			},
			get_document_rect: function () {
				var doc = document.documentElement;

				var left = (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0);
				var top = (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0);

				return {
					left: left,
					top: top,
					right: left + (doc.clientWidth || window.innerWidth || 0),
					bottom: top + (doc.clientHeight || window.innerHeight || 0),
				};
			},
			get_header_rect: function () {
				var header = document.getElementById("header-bar");
				if (header) {
					var bounds = header.getBoundingClientRect();

					// Document scroll offset
					var doc = document.documentElement;
					var left = (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0);
					var top = (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0);

					return {
						left: left + bounds.left,
						top: top + bounds.top,
						right: left + bounds.right,
						bottom: top + bounds.bottom,
					};
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
			get_object_rect: function (obj) {
				var bounds = obj.getBoundingClientRect();

				// Document scroll offset
				var doc = document.documentElement;
				var left = (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0);
				var top = (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0);

				return {
					left: left + bounds.left,
					top: top + bounds.top,
					right: left + bounds.right,
					bottom: top + bounds.bottom,
				};
			},

		};



		return ImageHover;

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
	// Create image hover manager
	image_hover = new ImageHover();
	settings.on_ready(image_hover.start.bind(image_hover));

})();



