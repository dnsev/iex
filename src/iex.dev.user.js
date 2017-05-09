// ==UserScript==
// @name        Image Extensions (dev)
// @description Expand images nicely
// @namespace   dnsev
// @version     3.0.2
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
// ==/UserScript==
// ==Meta==
// @updateURL   https://raw.githubusercontent.com/dnsev/iex/master/builds/{{meta}}
// @downloadURL https://raw.githubusercontent.com/dnsev/iex/master/builds/{{target}}
// ==/Meta==



(function () {
	"use strict";



	// Timing function
	var timing = (function () {
		var perf, now;

		if (
			(perf = window.performance) &&
			(now = perf.now || perf.mozNow || perf.msNow || perf.oNow || perf.webkitNow)
		) {
			return function () {
				return now.call(perf);
			};
		}
		else {
			perf = null;
			now = null;
			return function () {
				return new Date().getTime();
			};
		}
	})();

/*<debug>*/
	var timing_start = timing();

	// Debugging
	(function () {

		var log_exception = function (e) {
			console.log(e);
		};

		var wrapper_fn = "_w";

		if (wrapper_fn in Function.prototype || Function.prototype[wrapper_fn]) {
			console.log(wrapper_fn + " already in Function.prototype");
			throw "";
		}
		Function.prototype[wrapper_fn] = function () {
			var fn = this;
			return function () {
				try {
					return fn.apply(this, arguments);
				}
				catch (e) {
					log_exception(e);
					throw e;
				}
			};
		};

	})();
/*</debug>*/

	// Variables
	var doc = document,
		doc_el = doc.documentElement,
		user_agent = navigator.userAgent.toString(),
		is_firefox = (user_agent.indexOf("Firefox") >= 0),
		is_chrome = (user_agent.indexOf(" Chrome/") >= 0),
		is_opera = (!is_firefox && !is_chrome && user_agent.indexOf("MSIE") < 0),
		userscript = {/*{metadata}*/},
		api = null,
		settings = null,
		sync = null,
		style = null,
		hotkey_manager = null,
		hover = null,
		image_hover = null,
		file_link = null,
		file_view = null;



	// Failure
	if (doc_el === null) {
		console.log("iex failed to start: document.documentElement = " + doc_el + ";");
		console.log(doc_el);
		return;
	}



	// Better binding
	Function.prototype.bind = function (self) {
		var fn = this;

		if (arguments.length > 1) {
			var slice = Array.prototype.slice,
				push = Array.prototype.push,
				args = slice.call(arguments, 1);

			return function () {
				var full_args = slice.call(args);
				push.apply(full_args, arguments);

				return fn.apply(self, full_args);
			}._w();
		}
		else {
			return function () {
				return fn.apply(self, arguments);
			}._w();
		}
	};

	// Helper functions
	var MutationObserver = (window.MutationObserver || window.WebKitMutationObserver);

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
		}._w();
	};
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
			catch (e) {}
		};



		// Return a wrapping function
		return function (self, callback) {
			// Get any extra arguments
			var args = Array.prototype.slice.call(arguments, 2);

			// Return the function wrapped
			return function (event) {
				return on_mouseenterleave_prehandle.call(this, event, callback, self, args);
			}._w();
		};

	})();

	var add_event_listener = function (list, node, event, callback, capture) {
		node.addEventListener(event, callback, capture);
		list.push([node, event, callback, capture]);
	};
	var remove_event_listeners = function (list) {
		var list_len = list.length,
			i = 0,
			li;

		for (; i < list_len; ++i) {
			li = list[i];
			li[0].removeEventListener(li[1], li[2], li[3]);
		}
	};
	var stop_event = function (event) {
		event.preventDefault();
		event.stopPropagation();
		return false;
	};
	var get_event_mouse_button = function (event) {
		// 1=left, 2=middle, 3=right
		if (event.which) {
			if (event.which === 1) return 1;
			else if (event.which === 2) return 2;
			else if (event.which === 3) return 3;
		}
		else {
			if ((event.button & 1) !== 0) return 1;
			else if ((event.button & 2) !== 0) return 3;
			else if ((event.button & 4) !== 0) return 2;
		}
		return 0;
	};
	var select_input = function (node, caret_start, caret_end) {
		var len = (node.value || "").length;

		// Bound
		if (caret_start === undefined) {
			caret_start = 0;
			caret_end = len;
		}
		else if (caret_end === undefined) {
			if (caret_start < 0) caret_start = 0;
			else if (caret_start > len) caret_start = len;

			caret_end = caret_start;
		}
		else {
			if (caret_start < 0) caret_start = 0;
			else if (caret_start > len) caret_start = len;

			if (caret_end < caret_start) caret_end = caret_start;
			else if (caret_end > len) caret_end = len;
		}

		// Select
		if (node.createTextRange) {
			var range = node.createTextRange();
			range.move("character", caret_start);
			range.select();
		}
		else {
			if (node.selectionStart) {
				node.focus();
				node.setSelectionRange(caret_start, caret_end);
			}
			else {
				node.focus();
			}
		}
	};

	var $ = function (tag) {
		return doc.createElement(tag);
	};
	$.node = function (tag, class_name) {
		var n = doc.createElement(tag);
		n.className = class_name + style.theme;
		return n;
	};
	$.node_ns = function (ns, tag, class_name) {
		var n = doc.createElementNS(ns, tag);
		n.setAttribute("class", class_name + style.theme);
		return n;
	};
	$.text = function (text) {
		return doc.createTextNode(text);
	};
	$.a = function (class_name) {
		var n = doc.createElement("a");
		n.className = class_name + style.theme;
		return n;
	};
	$.div = function (class_name) {
		var n = doc.createElement("div");
		n.className = class_name + style.theme;
		return n;
	};
	$.span = function (class_name) {
		var n = doc.createElement("span");
		n.className = class_name + style.theme;
		return n;
	};
	$.label = function (class_name) {
		var n = doc.createElement("label");
		n.className = class_name + style.theme;
		return n;
	};
	$.input = function (class_name) {
		var n = doc.createElement("input");
		n.className = class_name + style.theme;
		return n;
	};
	$.input.check = function (class_name) {
		var n = doc.createElement("input");
		n.setAttribute("type", "checkbox");
		n.className = class_name + style.theme;
		return n;
	};
	$.input.text = function (class_name) {
		var n = doc.createElement("input");
		n.setAttribute("type", "text");
		n.className = class_name + style.theme;
		return n;
	};
	$.input.file = function (class_name) {
		var n = doc.createElement("input");
		n.setAttribute("type", "file");
		n.className = class_name + style.theme;
		return n;
	};
	$.input.button = function (class_name) {
		var n = doc.createElement("input");
		n.setAttribute("type", "button");
		n.className = class_name + style.theme;
		return n;
	};

	var crc32 = (function () {

		var crc_table = new Uint32Array([ //{
			0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA, 0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
			0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988, 0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
			0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE, 0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
			0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC, 0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
			0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172, 0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
			0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940, 0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
			0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116, 0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
			0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924, 0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
			0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A, 0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
			0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818, 0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
			0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E, 0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
			0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C, 0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
			0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2, 0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
			0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0, 0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
			0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086, 0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
			0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4, 0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
			0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A, 0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
			0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8, 0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
			0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE, 0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
			0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC, 0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
			0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252, 0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
			0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60, 0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
			0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236, 0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
			0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04, 0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
			0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A, 0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
			0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38, 0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
			0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E, 0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
			0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C, 0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
			0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2, 0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
			0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0, 0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
			0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6, 0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
			0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94, 0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D,
		]); //}

		return function (data) {
			var crc = (0 ^ (-1)),
				data_len = data.length,
				ct = crc_table,
				i;

			for (i = 0; i < data_len; ++i) {
				crc = (crc >>> 8) ^ ct[(crc ^ data[i]) & 0xFF];
			}

			return (crc ^ (-1)) >>> 0;
		};

	})();



	// Function for performing actions as soon as possible
	var on_ready = (function () {

		// Vars
		var callbacks = [],
			check_interval = null,
			check_interval_time = 250;

		// Data to store callback and relevant data
		var Data = function (callback, condition, time_limit) {
			this.callback = callback;
			this.condition = condition;
			this.time_limit = time_limit;
		};
		Data.prototype.delay = function () {
			var limit = null,
				condition = this.condition,
				check;

			if (this.time_limit) {
				limit = setTimeout(function () {
					clearInterval(check);
				}, this.time_limit * 1000);
			}

			check = setInterval(function () {
				if (condition.call(null)) {
					clearInterval(check);
					if (limit !== null) clearTimeout(limit);
					this.callback.call(null);
				}
			}, 20);
		};

		// Check if ready and run callbacks
		var callback_check = function () {
			if (
				(document.readyState === "interactive" || document.readyState === "complete") &&
				callbacks !== null
			) {
				// Run callbacks
				var cbs = callbacks,
					cb_count = cbs.length,
					cb, i;

				// Clear
				callbacks = null;

				for (i = 0; i < cb_count; ++i) {
					cb = cbs[i];
					if (!cb.condition || cb.condition.call(null)) {
						cb.callback.call(null);
					}
					else {
						cb.delay();
					}
				}

				// Clear events and checking interval
				window.removeEventListener("load", callback_check, false);
				window.removeEventListener("readystatechange", callback_check, false);

				if (check_interval !== null) {
					clearInterval(check_interval);
					check_interval = null;
				}

				// Okay
				return true;
			}

			// Not executed
			return false;
		};

		// Listen
		window.addEventListener("load", callback_check, false);
		window.addEventListener("readystatechange", callback_check, false);

		// Callback adding function
		return function (callback, condition, time_limit) {
			if (callbacks === null) {
				// Ready to execute
				if (!condition || condition.call(null)) {
					callback.call(null);
				}
				else {
					// Delay
					new Data(callback, condition, time_limit).delay();
				}
			}
			else {
				// Delay
				callbacks.push(new Data(callback, condition, time_limit));

				// Set a check interval
				if (check_interval === null && callback_check() !== true) {
					check_interval = setInterval(callback_check, check_interval_time);
				}
			}
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



			var run_loop = function () {
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
			var run_loop_with_remove = function () {
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

				pop: function (value) {
					for (var i = this.array.length - 1; i >= 0; --i) {
						if (this.array[i] === value) {
							this.array.splice(i, 1);
							return true;
						}
					}
					return false;
				},
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
				"quick_reply_add": [],
				"quick_reply_remove": [],
				"quick_reply_show": [],
				"quick_reply_hide": [],
				"file_info_update": [],
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
			this.quick_reply_observer = null;
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

				var qr;
				if ((qr = el.querySelector("body>#qr,body>#quickReply"))) {
					trigger.call(this, "quick_reply_add", qr);
					trigger.call(this, "quick_reply_show", qr);
					hook_quick_reply_observers.call(this, qr);
				}
			}
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
				// 4chan-x / ihavenoface
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
				// 4chan-x
				var pc = element.querySelector(".postContainer");
				if (pc) {
					trigger.call(this, "post_add", pc);
				}
				// else, post might not be loaded yet
			}
			else if (id == "header-bar" || id == "header") {
				hook_header_observers.call(this, element);
			}
			else if (id == "qr" || id == "quickReply") {
				// 4chan-x quick reply
				trigger.call(this, "quick_reply_add", element);
				trigger.call(this, "quick_reply_show", element);
				hook_quick_reply_observers.call(this, element);
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
				// 4chan-x
				var pc = element.querySelector(".postContainer");
				if (pc) {
					trigger.call(this, "post_remove", pc);
				}
			}
			else if (id == "qr" || id == "quickReply") {
				trigger.call(this, "quick_reply_hide", element);
				trigger.call(this, "quick_reply_remove", element);
				unhook_quick_reply_observers.call(this);
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
						else if (style.has_class(n, "file-info")) {
							trigger.call(this, "file_info_update", n);
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

		var on_quick_reply_observe = function (records) {
			var i, r;

			for (i = 0; i < records.length; ++i) {
				r = records[i];

				if (r.attributeName == "hidden") {
					// Detect
					if (r.target.getAttribute(r.attributeName) === null) {
						trigger.call(this, "quick_reply_show", r.target);
					}
					else {
						trigger.call(this, "quick_reply_hide", r.target);
					}
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
				// 4chan-x
				trigger_menu_4chanx_open.call(this, element, type);
			}
		};
		var on_4chanx_menu_element_remove = function (element, type) {
			var id = element.getAttribute("id");
			if (id == "menu") {
				// 4chan-x
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
		var hook_quick_reply_observers = function (qr) {
			// Observe the quick reply
			if (!qr) return;

			if (this.quick_reply_observer === null) {
				// Create new observer
				this.quick_reply_observer = new MutationObserver(on_quick_reply_observe.bind(this));

				// Observe
				this.quick_reply_observer.observe(
					qr,
					{
						attributes: true,
						attributeOldValue: true,
					}
				);
			}
		};
		var unhook_quick_reply_observers = function () {
			// Stop observing
			if (this.quick_reply_observer !== null) {
				this.quick_reply_observer.disconnect();
				this.quick_reply_observer = null;
				return true;
			}
			return false;
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
					var n = doc_el.querySelectorAll("body>*");

					if (n.length === 1) {
						n = n[0];
						if (n.tagName === "IMG") {
							this.page_type = "image";
						}
						else if (n === "VIDEO") {
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

		var deep_dom_wrap = (function () {

			// Internal helper class
			var Offset = function (text_offset, node) {
				this.text_offset = text_offset;
				this.node = node;
				this.node_text_length = node.nodeValue.length;
			};



			// Main function
			var deep_dom_wrap = function (container, tag, matcher, element_checker, setup_function, quick) {
				var text = "",
					offsets = [],
					d = document,
					count = 0,
					match_pos = 0,
					node, par, next, check, match,
					pos_start, pos_end, offset_start, offset_end,
					prefix, suffix, link_base, link_node, relative_node, relative_par, clone, i, n1, n2, len, offset_current, offset_node;


				// Create a string of the container's contents (similar to but not exactly the same as node.textContent)
				// Also lists all text nodes into the offsets array
				par = container;
				node = container.firstChild;
				if (node === null) return 0; // Quick exit for empty container
				while (true) {
					if (node !== null) {
						if (node.nodeType === 3) { // TEXT_NODE
							// Add to list and text
							offsets.push(new Offset(text.length, node));
							text += node.nodeValue;
						}
						else if (node.nodeType === 1) { // ELEMENT_NODE
							// Action callback
							check = element_checker.call(null, node);
							// Line break
							if ((check & deep_dom_wrap.EL_TYPE_LINE_BREAK) !== 0) {
								text += "\n";
							}
							// Parse
							if ((check & deep_dom_wrap.EL_TYPE_NO_PARSE) === 0) {
								par = node;
								node = node.firstChild;
								continue;
							}
						}

						// Next
						node = node.nextSibling;
					}
					else {
						// Done?
						if (par === container) break;

						// Move up
						node = par;
						par = node.parentNode;
						node = node.nextSibling;
					}
				}

				// Quick mode: just find all the matches
				if (quick) {
					// Match the text
					match = matcher.call(null, text, match_pos);
					if (match === null) return count;

					++count;

					match_pos = match[1];
				}

				// Loop to find all links
				while (true) {
					// Match the text
					match = matcher.call(null, text, match_pos);
					if (match === null) break;
					++count;



					// Find the beginning and ending text nodes
					pos_start = match[0];
					pos_end = match[1];

					for (offset_start = 1; offset_start < offsets.length; ++offset_start) {
						if (offsets[offset_start].text_offset > pos_start) break;
					}
					for (offset_end = offset_start; offset_end < offsets.length; ++offset_end) {
						if (offsets[offset_end].text_offset > pos_end) break;
					}
					--offset_start;
					--offset_end;



					// Vars to create the link
					prefix = text.substr(offsets[offset_start].text_offset, pos_start - offsets[offset_start].text_offset);
					suffix = text.substr(pos_end, offsets[offset_end].text_offset + offsets[offset_end].node_text_length - pos_end);
					link_base = d.createElement(tag);
					link_node = link_base;
					relative_node = null;

					// Prefix update
					i = offset_start;
					offset_current = offsets[i];
					offset_node = offset_current.node;
					if (prefix.length > 0) {
						// Insert prefix
						n1 = d.createTextNode(prefix);
						offset_node.parentNode.insertBefore(n1, offset_node);

						// Update text
						offset_node.nodeValue = offset_node.nodeValue.substr(prefix.length);

						// Set first relative
						relative_node = n1;
						relative_par = n1.parentNode;

						// Update offset for next search
						len = prefix.length;
						offset_current.text_offset += len;
						offset_current.node_text_length -= len;
					}
					else {
						// Set first relative
						relative_node = offset_node.previousSibling;
						relative_par = offset_node.parentNode;
					}

					// Loop over ELEMENT_NODEs; add TEXT_NODEs to the link, remove empty nodes where necessary
					// The only reason the par variable is necessary is because some nodes are removed during this process
					for (; i < offset_end; ++i) {
						// Next
						node = offsets[i].node;
						next = node.nextSibling;
						par = node.parentNode;

						// Add text
						link_node.appendChild(node);

						// Node loop
						while (true) {
							if (next) {
								if (next.nodeType == 3) { // TEXT_NODE
									// Done
									break;
								}
								else if (next.nodeType == 1) { // ELEMENT_NODE
									// Deeper
									node = next;
									next = node.firstChild;
									par = node;

									// Update link node
									clone = node.cloneNode(false);
									link_node.appendChild(clone);
									link_node = clone;

									continue;
								}
								else {
									// Some other node type; continue anyway
									node = next;
									next = node.nextSibling;

									// Update link node
									link_node.appendChild(node);

									continue;
								}
							}

							// Shallower
							node = par;
							next = node.nextSibling;
							par = node.parentNode;

							if (node.firstChild === null) par.removeChild(node);

							// Update link node
							if (link_node !== link_base) {
								// Simply move up tree (link_node still has a parent)
								link_node = link_node.parentNode;
							}
							else {
								// Create a new wrapper node (link_node has no parent; it's the link_base)
								clone = node.cloneNode(false);
								for (n1 = link_base.firstChild; n1; n1 = n2) {
									n2 = n1.nextSibling;
									clone.appendChild(n1);
								}
								link_base.appendChild(clone);
								link_node = link_base;

								// Placement relatives
								relative_node = (next !== null) ? next.previousSibling : null;
								relative_par = par;
							}
						}
					}

					// Suffix update
					offset_current = offsets[i];
					offset_node = offset_current.node;
					if (suffix.length > 0) {
						// Insert suffix
						n1 = d.createTextNode(suffix);
						if ((n2 = offset_node.nextSibling) !== null) {
							offset_node.parentNode.insertBefore(n1, n2);
						}
						else {
							offset_node.parentNode.appendChild(n1);
						}

						// Update text
						len = offset_node.nodeValue.length - suffix.length;
						offset_node.nodeValue = offset_node.nodeValue.substr(0, len);

						// Update offset for next search
						offset_current.text_length += len;
						offset_current.node_text_length -= len;
						offset_current.node = n1;
					}

					// Add the last segment
					par = offset_node.parentNode;
					link_node.appendChild(offset_node);



					// Setup function
					if (setup_function !== null) setup_function.call(null, link_base, match);



					// Find the proper relative node
					relative_node = (relative_node !== null) ? relative_node.nextSibling : relative_par.firstChild;

					// Insert link
					if (relative_node !== null) {
						// Insert before it
						relative_par.insertBefore(link_base, relative_node);
					}
					else {
						// Add to end
						relative_par.appendChild(link_base);
					}

					// Remove empty suffix tags
					while (par.firstChild === null) {
						node = par;
						par = par.parentNode;
						par.removeChild(node);
					}



					// Update match position
					offsets[offset_end].text_offset = pos_end;
					match_pos = pos_end;
				}

				// Done
				return count;
			};



			// Element type constants
			deep_dom_wrap.EL_TYPE_PARSE = 0;
			deep_dom_wrap.EL_TYPE_NO_PARSE = 1;
			deep_dom_wrap.EL_TYPE_LINE_BREAK = 2;



			// Return the function
			return deep_dom_wrap;

		})();

		var deep_dom_wrap_filter = function (node) {
			if (node.tagName === "BR" || node.tagName === "A") {
				return deep_dom_wrap.EL_TYPE_NO_PARSE | deep_dom_wrap.EL_TYPE_LINE_BREAK;
			}
			else if (node.tagName === "WBR") {
				return deep_dom_wrap.EL_TYPE_NO_PARSE;
			}
			else if (node.tagName === "DIV") {
				if (style.has_class(node, "inline") || style.has_class(node, "inlined")) return deep_dom_wrap.EL_TYPE_NO_PARSE | deep_dom_wrap.EL_TYPE_LINE_BREAK;
				return deep_dom_wrap.EL_TYPE_LINE_BREAK;
			}

			return deep_dom_wrap.EL_TYPE_PARSE;
		};
		var deep_dom_wrap_filter_simple = function (node) {
			if (node.tagName === "BR") {
				return deep_dom_wrap.EL_TYPE_NO_PARSE | deep_dom_wrap.EL_TYPE_LINE_BREAK;
			}
			else if (node.tagName === "WBR") {
				return deep_dom_wrap.EL_TYPE_NO_PARSE;
			}
			else if (node.tagName === "DIV") {
				if (style.has_class(node, "inline") || style.has_class(node, "inlined")) return deep_dom_wrap.EL_TYPE_NO_PARSE | deep_dom_wrap.EL_TYPE_LINE_BREAK;
				return deep_dom_wrap.EL_TYPE_LINE_BREAK;
			}

			return deep_dom_wrap.EL_TYPE_PARSE;
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
				on_ready(on_asap.bind(this));
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
				return this.post_get_file_info_from_file_info_container(this.post_get_file_info_container(post_container));
			},
			post_get_file_info_from_file_info_container: function (file_info) {
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
				var n, m, n_p, style_str;

				if (file_info) {
					// Get info
					if ((n_p = file_info.querySelector(".file-info"))) {
						// 4chan-x
						if ((n = n_p.querySelector("a"))) {
							info.url = n.getAttribute("href") || "";
							var n2 = n.firstChild;
							if (n2 !== null && n2.className && style.has_class(n2, "fnswitch") && (n2 = n2.querySelector(".fnfull")) !== null) {
								info.name = n2.textContent.trim();
							}
							else {
								info.name = n.textContent.trim();
							}
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
					else if ((n_p = file_info.querySelector(".fileText"))) {
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
					if ((n_p = file_info.querySelector(".fileThumb"))) {
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

			get_post_container_from_id: function (id) {
				return document.getElementById("pc" + id);
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
				// Parent check
				var n = image_container;
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
			post_has_file: function (post_container) {
				var post = post_container.querySelector(".post"),
					node;

				if (post !== null && (node = post.firstChild)) {
					while (true) {
						// File container
						if (style.has_class(node, "file")) return true;

						// Next
						if (!(node = node.nextSibling)) break;
					}
				}

				return false;
			},
			post_get_file_node_link_from_file_info: function (file_info) {
				return file_info.querySelector("a");
			},
			post_get_file_name_from_file_info: function (file_info) {
				var n = file_info.parentNode;
				if (n !== null && (n = n.parentNode) !== null) {
				}
				return null;
			},
			post_get_file_container_from_file_info: function (file_info) {
				var n = file_info.parentNode;
				if (n !== null && (n = n.parentNode) !== null) {
					if (style.has_class(n, "file")) return n;
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
			post_get_id: function (post_container) {
				var id = post_container.getAttribute("id");
				return id ? parseInt(id.replace(/[^0-9]+/g, ""), 10) : -1;
			},
			post_get_id_from_node: function (node) {
				// Parent check
				while (true) {
					if (node === null) return -1;
					if (style.has_class(node, "postContainer")) return this.post_get_id(node);
					node = node.parentNode;
				}
			},
			post_get_comment_container: function (post_container) {
				var post = post_container.querySelector(".post"),
					comment;

				if (post === null) return null;

				// Find comment
				comment = post.lastChild;
				while (true) {
					if (comment === null) return 0;
					if (style.has_class(comment, "postMessage")) break;
					comment = comment.previousSibling;
				}

				return comment;
			},
			post_get_quotelinks: function (post_container) {
				return this.post_query_selector_all(post_container, ".quotelink");
			},
			post_comment_scan: function (post_container, regex, tag, setup_function) {
				var comment = this.post_get_comment_container(post_container),
					s_fn = null,
					m_fn;

				if (comment === null) return 0;

				// Matching function
				if (typeof(regex) === "function") {
					m_fn = regex;
				}
				else {
					if (!regex.global) return 0;
					m_fn = function (text, pos) {
						regex.lastIndex = pos;
						var m = regex.exec(text);
						if (m === null) return null;
						return [ m.index , m.index + m[0].length, m ];
					};
				}

				// Scanning function
				if (setup_function) {
					s_fn = setup_function;
					//s_fn = function (node, text) { setup_function(node, text); };
				}

				return deep_dom_wrap(comment, tag,
					m_fn,
					tag ? deep_dom_wrap_filter : deep_dom_wrap_filter_simple,
					s_fn,
					(!tag)
				);
			},
			post_get_comment_text: function (post_container) {
				var post_text = "",
					comment = this.post_get_comment_container(post_container);

				if (comment !== null) {
					deep_dom_wrap(comment, null,
						function (text) {
							post_text = text;
							return null;
						},
						deep_dom_wrap_filter_simple,
						null,
						true
					);
				}


				return post_text;
			},
			post_query_selector_all: function (post_container, selector) {
				var nodes = post_container.querySelectorAll(selector),
					other, other_len, i, first;

				if (nodes.length > 0 && (other_len = (other = post_container.querySelectorAll("div.inline,div.inlined")).length) > 0) {
					// Filter
					var filter = function (node) {
						while ((node = node.parentNode) !== post_container) {
							for (var i = 0; i < other_len; ++i) {
								if (other[i] === node) return true;
							}
						}
						return false;
					};

					// Filter out nodes
					first = true;
					for (i = 0; i < nodes.length; ++i) {
						if (filter(nodes[i])) {
							if (first) {
								first = false;
								nodes = Array.prototype.slice.call(nodes, 0);
							}
							nodes.splice(i, 1);
							continue;
						}
					}
				}

				return nodes;
			},
			post_is_floating_or_embedded: function (post_container) {
				var p = post_container.parentNode;
				if (!p) return false;

				return (
					style.has_class(p, "inline") || // 4chan x
					style.has_class(post_container, "inlined") || // vanilla
					p.id === "qp" || // 4chan x
					p === document.body || // vanilla
					p.id === "hoverUI" // 4chan x (?)
				);
			},

			get_quotelink_target: function (node) {
				return parseInt(node.textContent.replace(/[^0-9]+/g, ""), 10) || 0;
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

			get_post_container_from_post_number: function (post_number) {
				return document.getElementById("pc" + post_number);
			},

			get_quick_reply_file_4chanx: function (callback) {
				// Event listener
				var temp_listener = function (event) {
					clearTimeout(timer);
					document.removeEventListener("QRFile", temp_listener, false);
					if (event.detail && event.detail instanceof File) {
						callback.call(event.detail);
					}
					else {
						callback.call(null);
					}
				};

				// Events
				document.addEventListener("QRFile", temp_listener, false);
				document.dispatchEvent(new CustomEvent("QRGetFile", {
					bubbles: true,
					detail: null
				}));

				// Cancel event
				var timer = setTimeout(function () {
					timer = null;
					document.removeEventListener("QRFile", temp_listener, false);
				}, 1000);
			},
			set_quick_reply_file_4chanx: function (file) {
				var detail = {
					file: this.files[0],
					name: null,
				};

				if (cloneInto) {
					detail = cloneInto(detail, document.defaultView);
				}

				document.dispatchEvent(new CustomEvent("QRSetFile", {
					bubbles: true,
					detail: detail
				}));
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
				container = $.div("iex_notification");
				container.addEventListener("click", this.on_overlay_click_bind = on_overlay_click.bind(this), false);
				this.nodes.container = container;

				n_body_outer = $.div("iex_notification_body_outer");
				container.appendChild(n_body_outer);

				n_aligner = $.div("iex_notification_body_aligner");
				n_body_outer.appendChild(n_aligner);

				n_body_inner = $.div("iex_notification_body_inner");
				n_body_outer.appendChild(n_body_inner);

				if ("style" in data && [ "info" , "error" , "success" , "warning" ].indexOf(data.style) >= 0) {
					n_style = "iex_notification_" + data.style;
				}
				else {
					n_style = "iex_notification_info";
				}

				n_body = $.div("iex_notification_body " + n_style);
				n_body.addEventListener("click", this.on_body_click_bind = on_body_click.bind(this), false);
				n_body_inner.appendChild(n_body);
				this.nodes.body = n_body;

				n_content_outer = $.div("iex_notification_content_outer");
				n_body.appendChild(n_content_outer);

				n_close = $.a("iex_notification_close" + (data.close === false ? " iex_notification_close_hidden" : ""));
				n_close.textContent = "\u00D7";
				n_close.addEventListener("click", this.on_close_click_bind = on_close_click.bind(this), false);
				this.nodes.close = n_close;
				n_content_outer.appendChild(n_close);

				n_content = $.div("iex_notification_content");
				n_content_outer.appendChild(n_content);

				// Title
				if ("title" in data) {
					nc_title = $.div("iex_notification_content_title");
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
					nc_body = $.div("iex_notification_content_body");
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
			return stop_event(event);
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
			return stop_event(event);
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
				/*<feature:annotations>*/
				"annotations": {
					"enabled": true,
					"enabled_standalone": true,
					"editor": true,
					"editor_always_enable": false,
					"modify_urls": true,
					"transparent_until_hover": false,
					"toggle_hotkey": "a",
					"defaults": {
						"font": 1,
						"bold": false,
						"italic": false,
					},
				},
				/*</feature:annotations>*/
			};
			this.save_key = "iex_settings";

			// Value changing events
			this.change_events = {};

			// Events
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
						setTimeout(on_settings_4chanx_section_change_modify.bind(this, image_hover_setting), 100);
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

			var e = $.a("iex_4chanx_menu_link");
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
			return stop_event(event);
		};
		var on_main_page_iex_link_click = function (event) {
			// Open settings
			this.settings_open();

			// Stop event
			return stop_event(event);
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
			return stop_event(event);
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
			on_ready(on_first_run_check.bind(this));
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
						n = $.text("]");
						if (c) par.insertBefore(n, c);
						else par.appendChild(n);

						c = n;
					}
				}

				n = $.node("a");
				n.textContent = "iex";
				n.setAttribute("target", "_blank");
				n.setAttribute("rel", "noreferrer nofollow");
				n.setAttribute("href", "https://dnsev.github.io/iex/");
				n.addEventListener("click", on_main_page_iex_link_click.bind(this), false);
				par.insertBefore(n, c);
				c = n;

				if (separate) {
					n = $.text("[");
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
			return stop_event(event);
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
			return stop_event(event);
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
			return stop_event(event);
		};
		var on_iex_setting_checkbox_change = function (node, descriptor, event) {
			// Set
			var value_new = node.checked,
				value_old;

			if ("values" in descriptor) {
				value_new = descriptor.values[value_new ? 1 : 0];
			}
			if ("modify" in descriptor) {
				value_new = descriptor.modify.call(this, value_new, descriptor);
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
			var value_new = node.value,
				value_old;

			if ("modify" in descriptor) {
				value_new = descriptor.modify.call(this, value_new, descriptor);
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
				value_new = descriptor.modify.call(this, value_new, descriptor);
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
			return stop_event(event);
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
			var message = $.node("div"),
				m_part;

			// Line 1
			m_part = $.div("iex_spaced_div");
			m_part.textContent = "These are iex's saved settings, which are useful for debugging purposes:";
			message.appendChild(m_part);

			// Textarea
			m_part = $.node("textarea", "iex_notification_textarea");
			m_part.setAttribute("spellcheck", "false");
			m_part.value = saved_values;
			message.appendChild(m_part);

			// Display
			new Notification({
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
					container_clone.appendChild($.text(" (disable iex)"));

					// Modify old
					description_old = image_hover_setting_container.querySelector("label");
					if (description_old) {
						description_old.appendChild($.text(" (or use iex)"));
					}
				}
				else {
					var description_new = $.span("description");

					var link_new = $("a");
					link_new.setAttribute("href", "//dnsev.github.io/iex/");
					link_new.setAttribute("target", "_blank");
					link_new.textContent = "disable iex version to use";
					link_new.addEventListener("click", on_edit_iex_settings_click.bind(this), false);

					description_new.appendChild($.text(" ("));
					description_new.appendChild(link_new);
					description_new.appendChild($.text(")"));

					container_clone.appendChild(description_new);

					// Modify old
					description_old = image_hover_setting_container.querySelector(".description");
					if (description_old) {
						link_new = $("a");
						link_new.setAttribute("href", "//dnsev.github.io/iex/");
						link_new.setAttribute("target", "_blank");
						link_new.textContent = "or use iex version";
						link_new.addEventListener("click", on_edit_iex_settings_click.bind(this), false);

						description_old.appendChild($.text(" ("));
						description_old.appendChild(link_new);
						description_old.appendChild($.text(")"));
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
					iex_link = $("a");
					iex_link.setAttribute("href", "//dnsev.github.io/iex/");
					iex_link.setAttribute("target", "_blank");
					iex_link.textContent = "disable iex version to use";
					iex_link.addEventListener("click", on_edit_iex_settings_click.bind(this), false);

					iex_descr = $("span");
					iex_descr.appendChild($.text(" ("));
					iex_descr.appendChild(iex_link);
					iex_descr.appendChild($.text(")"));

					clone.appendChild(iex_descr);

					// Text for old
					iex_link = $("a");
					iex_link.setAttribute("href", "//dnsev.github.io/iex/");
					iex_link.setAttribute("target", "_blank");
					iex_link.textContent = "or use iex version";
					iex_link.addEventListener("click", on_edit_iex_settings_click.bind(this), false);

					iex_descr = $("span");
					iex_descr.appendChild($.text(" ("));
					iex_descr.appendChild(iex_link);
					iex_descr.appendChild($.text(")"));
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
		var string_to_hotkey = function (value, descriptor) {
			value = value.trim().toLowerCase();
			if (hotkey_manager.key_to_keycode(value) === 0) {
				// Return previous
				return this.get_value(descriptor.tree);
			}
			return value;
		};

		var settings_open = function () {
			if (this.settings_container_outer !== null) return;

			var body = document.querySelector("body"),
				bg_color, settings_content, settings_buttons, cb,
				overlay, container, inner, n1, n2, n3, n4;

			if (!body) return;

			// Get background color
			bg_color = style.parse_css_color(style.get_true_style_of_class("post reply", "backgroundColor", "div"));

			settings_buttons = generate_settings_difficulty_selector.call(this);
			settings_content = generate_settings_container.call(this, generate_settings_descriptors.call(this));
			this.settings_removal_data = settings_content[1].concat(settings_buttons[1]);


			// Create
			overlay = $.div("iex_settings_popup_overlay");
			overlay.addEventListener("click", (cb = on_iex_settings_overlay_click.bind(this)), false);
			this.settings_removal_data.push({
				node: overlay,
				event: "click",
				callback: cb,
				capture: false
			});
			this.settings_container_outer = overlay;

			container = $.div("iex_settings_popup");
			overlay.appendChild(container);

			inner = $.div("iex_settings_popup_aligner");
			container.appendChild(inner);

			inner = $.div("iex_settings_popup_inner");
			container.appendChild(inner);

			n1 = $.div("iex_settings_popup_table");
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
			n2 = $.div("iex_settings_popup_top");
			n1.appendChild(n2);

			n3 = $.div("iex_settings_popup_top_content");
			n2.appendChild(n3);

			n4 = $.div("iex_settings_popup_top_label");
			n3.appendChild(n4);
			n4.textContent = "Image Extensions - Settings";

			settings_buttons[0].className = "iex_settings_popup_top_right" + style.theme;
			n3.appendChild(settings_buttons[0]);
			this.settings_difficulty_container = settings_buttons[0];


			// Middle
			n2 = $.div("iex_settings_popup_middle");
			n1.appendChild(n2);

			n3 = $.div("iex_settings_popup_middle_content_pad");
			n2.appendChild(n3);
			n2 = n3;

			n3 = $.div("iex_settings_popup_middle_content");
			n2.appendChild(n3);
			n2 = n3;

			n3 = $.div("iex_settings_popup_middle_content_inner");
			n2.appendChild(n3);
			n3.appendChild(settings_content[0]);
			this.settings_container = settings_content[0];


			// Bottom
			n2 = $.div("iex_settings_popup_bottom");
			n1.appendChild(n2);



			// Update difficulty
			change_settings_difficulty.call(this, "normal");


			// Append
			body.appendChild(overlay);
		};

		var generate_settings_difficulty_selector = function () {
			var d_container, d_choice, d_span, cb,
				settings_removal_data = [];

			d_container = $("div");

			// Normal
			d_choice = $.a("iex_settings_difficulty_choice");
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

			d_span = $.span("iex_settings_difficulty_separator");
			d_span.textContent = " | ";
			d_container.appendChild(d_span);

			// Advanced
			d_choice = $.a("iex_settings_difficulty_choice");
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

			d_span = $.span("iex_settings_difficulty_separator");
			d_span.textContent = " | ";
			d_container.appendChild(d_span);

			// Homepage
			d_choice = $.a("iex_settings_homepage_link");
			d_choice.setAttribute("target", "_blank");
			d_choice.setAttribute("href", "//dnsev.github.io/iex/");
			d_choice.textContent = "homepage";
			d_container.appendChild(d_choice);

			d_span = $.span("iex_settings_difficulty_separator");
			d_span.textContent = " | ";
			d_container.appendChild(d_span);

			// Close
			d_choice = $.a("iex_settings_popup_close_link");
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

			/*<feature:annotations>*/
			// Annotations
			descriptors.push({
				level: "normal",
				section: "Annotations",
				tree: [ "annotations" , "enabled" ],
				label: "Enabled",
				description: "Enable image annotations",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Annotations",
				tree: [ "annotations" , "enabled_standalone" ],
				label: "Enabled on standalone images",
				description: "Enable image annotations on images opened in a new tab",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Annotations",
				tree: [ "annotations" , "editor" ],
				label: "Annotation editor",
				description: "Show the annotation editor option on the quick reply form",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Annotations",
				tree: [ "annotations" , "editor_always_enable" ],
				label: "Annotation editor always enabled",
				description: "Always enable the annotation editor when opening quick reply",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Annotations",
				tree: [ "annotations" , "modify_urls" ],
				label: "Modify image URLs",
				description: "Append a #fragment to image urls to allow standalone image annotations",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "disabled" , "enabled" ],
			});

			descriptors.push({
				level: "normal",
				section: "Annotations",
				tree: [ "annotations" , "transparent_until_hover" ],
				label: "Annotation transparency",
				description: "Make annotations more transparent when the mouse is not over them",
				type: "checkbox",
				values: [ false , true ],
				value_labels: [ "regular" , "transparent" ],
			});

			descriptors.push({
				level: "normal",
				section: "Annotations",
				tree: [ "annotations" , "toggle_hotkey" ],
				modify: string_to_hotkey,
				label: "Toggle Hotkey",
				description: "The key to use for toggling annotations on/off",
				type: "textbox",
			});

			var vals = [],
				val_labels = [],
				i;

			for (i = 0; i < Annotation.fonts.length; ++i) {
				vals.push(i);
				val_labels.push(Annotation.fonts[i].name);
			}

			descriptors.push({
				level: "normal",
				section: "Annotation Editor Defaults",
				tree: [ "annotations" , "defaults" , "font" ],
				label: "Default font",
				description: "Default font family for new annotations",
				type: "text",
				values: vals,
				value_labels: val_labels
			});

			descriptors.push({
				level: "normal",
				section: "Annotation Editor Defaults",
				tree: [ "annotations" , "defaults" , "bold" ],
				label: "Default bold",
				description: "Default bold setting for new annotations",
				type: "text",
				values: [ false , true ],
				value_labels: [ "not bold" , "bold" ],
			});

			descriptors.push({
				level: "normal",
				section: "Annotation Editor Defaults",
				tree: [ "annotations" , "defaults" , "italic" ],
				label: "Default italic",
				description: "Default italic setting for new annotations",
				type: "text",
				values: [ false , true ],
				value_labels: [ "not italic" , "italic" ],
			});
			/*</feature:annotations>*/

			// Meta
			descriptors.push({
				level: "advanced",
				section: "Debugging",
				change: on_iex_setting_display_settings.bind(this),
				label: "Display local settings",
				description: "Display all saved local data in a pop-up textbox",
				type: "text",
				values: [ true ],
				value_labels: [ "display" ]
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
			var container = $.div("iex_settings_region");

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
					g_container = $.div("iex_settings_group" + (group_count > 0 ? " iex_settings_group_padding_top" : ""));
					container.appendChild(g_container);

					g_label = $.div("iex_settings_group_label");
					g_label.textContent = g_key;
					g_container.appendChild(g_label);

					groups[g_key] = g_container;
					group_count += 1;
					odd = true;
				}

				// Add setting
				g_set = $.div("iex_settings_setting" + (odd ? " iex_settings_setting_odd" : "") + (i > 0 ? " iex_settings_setting_top_padding" : ""));
				g_set.setAttribute("data-iex-setting-level", d.level || "normal");
				g_container.appendChild(g_set);

				g_table = $.div("iex_settings_setting_table");
				g_set.appendChild(g_table);

				// Halves
				g_half_right = $.div("iex_settings_setting_right");
				g_table.appendChild(g_half_right);

				g_half_left = $.div("iex_settings_setting_left");
				g_table.appendChild(g_half_left);

				// Left half
				g_label = $.div("iex_settings_setting_label");
				g_half_left.appendChild(g_label);

				g_span = $.span("iex_settings_setting_label_title");
				g_span.textContent = d.label;
				g_label.appendChild(g_span);

				if ("sublabel" in d) {
					g_span = $.span("iex_settings_setting_label_subtitle");
					g_span.textContent = d.sublabel;
					g_label.appendChild(g_span);
				}

				g_label = $.div("iex_settings_setting_description");
				g_label.textContent = d.description;
				g_half_left.appendChild(g_label);

				// Right half: input
				g_div = $.label("iex_settings_setting_input_container");
				g_half_right.appendChild(g_div);

				if (d.type == "checkbox") {
					g_div.className += " iex_settings_setting_input_container_reverse";

					g_input = $.input.check("iex_settings_setting_input_checkbox");
					g_div.appendChild(g_input);

					g_input_label = $.span("iex_settings_setting_input_label");
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
					g_input = $.input.text("iex_settings_setting_input_textbox");
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
					g_input = $.a("iex_settings_setting_input_text");
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
					g_div = $.div("iex_settings_region_container");
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
				on_ready(on_insert_links.bind(this), on_insert_links_condition, 0.5);
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
				var message = $("div"), m_title, m_part, m_link;

				// Line 1
				m_title = $("div");
				m_title.appendChild($.text("You've just installed "));

				m_link = $("a");
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("rel", "nofollow noreferrer");
				m_link.setAttribute("href", "https://dnsev.github.io/iex/");
				m_link.textContent = "iex - Image Extensions";
				m_title.appendChild(m_link);

				m_title.appendChild($.text("!"));

				// Line 2
				m_part = $.div("iex_spaced_div");
				m_part.textContent = "If you use 4chan-x or appchan-x, you can access iex settings through the header menu. Otherwise, look for the [ iex ] link at the top of the page.";
				message.appendChild(m_part);

				// Line 3
				m_part = $.div("iex_spaced_div");
				m_part.appendChild($.text("Any questions or issues can be addressed on "));

				m_link = $("a");
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("rel", "nofollow noreferrer");
				m_link.setAttribute("href", "https://github.com/dnsev/iex/issues");
				m_link.textContent = "the github page";
				m_part.appendChild(m_link);

				m_part.appendChild($.text("."));
				message.appendChild(m_part);

				// Line 4
				m_part = $.div("iex_spaced_div");
				m_part.textContent = "Would you like to enable iex now? (page will be refreshed)";
				message.appendChild(m_part);

				// Line 5
				m_part = $("div");

				m_link = $.a("iex_highlighted_link");
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("href", "//dnsev.github.io/iex/");
				m_link.textContent = "enable now";
				m_link.addEventListener("click", on_first_run_link_click.bind(this, true), false);
				m_part.appendChild(m_link);

				m_part.appendChild($.text(" or "));

				m_link = $.a("iex_highlighted_link");
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
				var message = $("div"), m_part, m_link;

				// Line 1
				m_part = $.div("iex_spaced_div");
				m_part.textContent = "Failed to resolve settings conflicts for reason: " + status + ".";
				message.appendChild(m_part);

				// Line 3
				m_part = $("div");
				m_part.textContent = "This is potentially due to other userscript extensions you have installed.";
				message.appendChild(m_part);

				// Line 4
				m_part = $.div("iex_spaced_div");
				m_part.textContent = "You can try manually turning off any \"Image Hover\" settings to get iex to work.";
				message.appendChild(m_part);

				// Line 5
				m_part = $.div("iex_spaced_div");
				m_part.appendChild($.text("If you would like to get this fixed, "));

				m_link = $.a("iex_underlined_link");
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("href", "http://github.com/dnsev/iex/issues");
				m_link.textContent = "file an issue request";
				m_part.appendChild(m_link);

				m_part.appendChild($.text("."));
				message.appendChild(m_part);

				// Line 5
				m_part = $("div");
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
				var message = $("div"),
					m_part, m_link;

				// Line 1
				m_part = $("div");

				// Text
				m_part.appendChild($.text("Image Extensions will be disabled and can be re-enabled through "));

				// Link
				m_link = $.a("iex_underlined_link");
				m_link.setAttribute("target", "_blank");
				m_link.setAttribute("href", "//dnsev.github.io/iex/");
				m_link.textContent = "settings";
				m_part.appendChild(m_link);

				// Text
				m_part.appendChild($.text("."));

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

		var Style = function () {
			// Append style
			this.stylesheet = null;
			/*<feature:annotations>*/
			this.stylesheet_annotations = null;
			/*</feature:annotations>*/

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
			on_ready(on_asap.bind(this), on_asap_condition.bind(this));
		};



		var loaded_fonts = null;

		var on_insert_stylesheet = function (stylesheet) {
			var head = document.querySelector("head");
			if (head) head.appendChild(stylesheet);
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

		var get_true_style = function (element, style_name) {
			var s;
			try {
				s = document.defaultView.getComputedStyle(element);
			}
			catch (e) {}
			if (!s) {
				s = element.style || {};
			}
			return style_name ? s[style_name] : s;
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
					'.iex_settings_popup_middle_content_inner{display:block;padding:0.5em;}',
					'.iex_settings_popup_close_link{font-weight:bold;text-decoration:none !important;padding:0em 0.2em;}',
					'.iex_settings_popup_bottom{display:table-row;width:100%;}',

					'.iex_settings_container{position:relative;}',
					'.iex_settings_region_container{margin:0.25em -0.25em -0.25em 2em;}',
					'.iex_settings_region{}',
					'.iex_settings_group{}',
					'.iex_settings_group.iex_settings_group_hidden{display:none;}',
					'.iex_settings_group_label{font-size:1.125em;padding-bottom:0.125em;margin-bottom:0.25em;font-weight:bold;text-align:left;color:#000000;border-bottom:0.125em solid rgba(0,0,0,0.5);text-shadow:0em 0em 0.25em #ffffff;}',
					'.iex_settings_group_label.iex_dark{color:#ffffff;border-bottom:0.125em solid rgba(255,255,255,0.5);text-shadow:0em 0em 0.25em #000000;}',
					'.iex_settings_group.iex_settings_group_padding_top{margin-top:2em;}',
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
					'.iex_cpreview_container.iex_cpreview_container_auto{z-index:0;left:0;top:0;bottom:0;right:0;}',
					'.iex_cpreview_container.iex_cpreview_container_auto>.iex_cpreview_padding,',
					'.iex_cpreview_container.iex_cpreview_container_auto>.iex_cpreview_padding>.iex_cpreview_overflow{width:100%;height:100%;}',
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

					'.iex_mpreview_zoom_borders{display:block;position:absolute;border:0.08em solid #ffffff;opacity:0.25;left:0;top:0;bottom:0;right:0;pointer-events:none;}',
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

					'.iex_mpreview_image{display:inline-block;border:none;margin:0;padding:0;outline:none;}',
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
				this.stylesheet = $("style");
				this.stylesheet.textContent = stylesheet_text;
				on_ready(on_insert_stylesheet.bind(this, this.stylesheet), on_insert_stylesheet_condition);
			},

			/*<feature:annotations>*/
			insert_stylesheet_annotations: function () {
				// Create stylesheet
				var stylesheet_text = [ //{
					/*<feature:annotation-editor>*/
					'.iex_quick_reply_extra{margin:0.5em 0.125em 0.25em;}',
					'.iex_quick_reply_extra.iex_quick_reply_extra_4chanx{}',
					'.iex_quick_reply_label_table{display:table;width:100%;}',
					'.iex_quick_reply_label_row{display:table-row;height:100%;}',
					'.iex_quick_reply_label_cell{display:table-cell;width:100%;height:100%;vertical-align:middle;}',
					'.iex_quick_reply_label_cell.iex_quick_reply_label_cell_small{width:0;}',
					'.iex_quick_reply_label,#qr label.iex_quick_reply_label{display:inline-block;vertical-align:middle;text-transform:none;font-size:1em !important;}',
					'.iex_quick_reply_label_check{vertical-align:middle;margin:0.125em;padding:0;}',
					'.iex_quick_reply_label_check+.riceCheck{vertical-align:middle;}',
					'.iex_quick_reply_label_text{vertical-align:middle;}',
					'.iex_quick_reply_help_link_container{white-space:nowrap;display:inline-block;vertical-align:middle;}',
					'.iex_quick_reply_extra:not(.iex_quick_reply_extra_enabled) .iex_quick_reply_help_link_container{display:none;}',
					'.iex_quick_reply_help_link{cursor:pointer;display:inline-block;padding:0 0.125em;}',
					'.iex_quick_reply_content{font-size:0.8em;}',
					'.iex_quick_reply_extra:not(.iex_quick_reply_extra_enabled)>.iex_quick_reply_content{display:none;}',
					'.iex_quick_reply_info{margin:0.25em 0;}',
					'.iex_quick_reply_source_selection{}',
					'.iex_quick_reply_source_selection_text{vertical-align:middle;}',
					'.iex_quick_reply_source_selection_file,.iex_quick_reply_source_selection_url{padding:0.125em 0.25em;vertical-align:middle;font-size:inherit !important;}',
					'.iex_quick_reply_source_selection_file.iex_quick_reply_source_selection_file_selected,.iex_quick_reply_source_selection_url.iex_quick_reply_source_selection_url_selected{font-weight:bold;}',
					'.iex_quick_reply_source_selection_post{padding:0.125em 0.25em;vertical-align:middle;font-size:inherit !important;width:8em;}',
					'.iex_quick_reply_source_selection_post.iex_quick_reply_source_selection_post_selected{font-weight:bold;}',
					'.iex_quick_reply_source_selection_post_option{font-weight:bold;font-size:inherit !important}',
					'.iex_quick_reply_source_selection_post_option_default{opacity:0.5;font-weight:normal;font-size:inherit !important}',
					'.iex_quick_reply_error{margin-top:0.25em;font-weight:bold;font-style:italic;}',
					'.iex_quick_reply_error:not(.iex_quick_reply_error_visible){display:none;}',
					'.iex_quick_reply_file_input{display:none;visibility:hidden;}',

					'#quickReply,#quickReply~.preview,#quickReply~.dd-menu{z-index:20;}',

					'.iex_annotation_editor_outer_paddings{padding:1em;}',
					'.iex_annotation_editor{display:block;position:fixed;z-index:19;}',
					'.iex_annotation_editor:not(.iex_annotation_editor_visible){display:none;}',
					'.iex_annotation_editor{box-shadow:0em 0em 0.6em 0.3em rgba(0,0,0,0.75);background-color:rgba(255,255,255,0.75);}',
					'.iex_annotation_editor.iex_dark{box-shadow:0em 0em 0.6em 0.3em rgba(255,255,255,0.75);background-color:rgba(0,0,0,0.75);}',

					// layout=horizontal; primary display as horizontal
					'.iex_ae_t1c1{display:table;table-layout:fixed;width:100%;height:100%;}',
					'.iex_ae_t1c2{display:table-row;width:100%;height:100%;}',
					'.iex_ae_t1c3{display:table-cell;width:auto;height:100%;vertical-align:top;}',
					'.iex_ae_t1c3:not(:first-of-type){width:16em;height:100%;}',
					'.iex_ae_t1c4{display:block;width:100%;height:100%;}',
					// layout=vertical; primary display as vertical
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t1c1{display:block;width:100%;height:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t1c2{display:table;table-layout:fixed;width:100%;height:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t1c3{display:table-row;width:100%;height:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t1c3:not(:first-of-type){width:100%;height:16em;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t1c4{display:table-cell;width:100%;height:inherit;vertical-align:top;}',

					// layout=horizontal; controls displayed as vertical
					'.iex_ae_t2c0{display:block;width:100%;height:100%;box-sizing:border-box;-moz-box-sizing:border-box;xpadding:0 0.25em;border-style:solid;border-color:#111111;border-width:0 0 0 0.125em;background:#eeeeee;}',
					'.iex_ae_t2c0.iex_dark{background:#111111;border-color:#eeeeee;}',
					'.iex_ae_t2c1{display:block;width:100%;height:100%;}',
					'.iex_ae_t2c2{display:table;table-layout:fixed;width:100%;height:100%;}',
					'.iex_ae_t2c3{display:table-row;width:100%;height:100%;}',
					'.iex_ae_t2c3:first-of-type{width:100%;height:auto;}',
					'.iex_ae_t2c4{display:table-cell;width:100%;height:inherit;vertical-align:top;}',
					'.iex_ae_t2c3:not(:first-of-type)>.iex_ae_t2c4{vertical-align:bottom;}',
					// layout=vertical; controls displayed as horizontal
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t2c0{xpadding:0.25em 0;border-width:0.125em 0 0 0;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t2c1{display:table;table-layout:auto;width:100%;height:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t2c2{display:table-row;width:100%;height:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t2c3{display:table-cell;width:100%;height:100%;vertical-align:bottom;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t2c3:first-of-type{width:auto;height:100%;vertical-align:middle;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t2c4{display:inline-block;width:100%;height:100%;vertical-align:middle;}',

					// layout=horizontal; tools table as vertical
					'.iex_ae_t3c0{text-align:center;padding:0 0.25em;}',
					'.iex_ae_t3c1{display:inline-block;vertical-align:middle;padding:0.25em;text-align:left;border-box;-moz-box-sizing:border-box;}',
					'.iex_ae_t3c2{display:block;width:auto;height:100%;border-box;-moz-box-sizing:border-box;}',
					'.iex_ae_t3c3{display:table;table-layout:fixed;width:auto;height:100%;}',
					'.iex_ae_t3c4{display:table-row;width:100%;height:auto;}',
					'.iex_ae_t3c5{display:table-cell;width:100%;height:inherit;vertical-align:top;}',
					'.iex_ae_t3c4:first-of-type>.iex_ae_t3c5{text-align:center;}',
					// layout=vertical; tools table as horizontal
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t3c0{padding:0.25em 0;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t3c1{width:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t3c2{display:table;table-layout:auto;width:100%;height:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t3c3{display:table-row;width:100%;height:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t3c4{display:table-cell;width:100%;height:100%;vertical-align:top;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t3c4:first-of-type{width:0;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t3c5{display:block;width:100%;height:100%;box-sizing:border-box;-moz-box-sizing:border-box;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t3c4+.iex_ae_t3c4>.iex_ae_t3c5{padding-left:0.25em;}',

					// layout=horizontal; color table as horizontal
					'.iex_ae_t4c0{display:inline-block;vertical-align:middle;}',
					'.iex_ae_t4c1{display:table;table-layout:fixed;height:100%;}',
					'.iex_ae_t4c2{display:table-row;width:100%;height:100%;}',
					'.iex_ae_t4c3{display:table-cell;width:auto;height:100%;vertical-align:middle;}',
					'.iex_ae_t4c4{display:block;width:100%;white-space:nowrap;}',
					// layout=vertical; color table as vertical
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t4c1{height:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t4c2{display:table;table-layout:auto;width:100%;height:100%;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t4c3{display:table-row;width:100%;height:auto;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t4c4{display:table-cell;width:100%;height:inherit;vertical-align:top;text-align:center;}',

					'.iex_ae_color_selector{padding:0.125em;cursor:pointer;position:relative;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_color_selector{display:inline-block;vertical-align:middle;}',
					'.iex_ae_color_selector_inner{width:1em;height:1em;position:relative;}',
					'.iex_ae_color_selector_border{position:absolute;left:0;top:0;right:0;bottom:0;border:1px solid #000000;opacity:0.5;}',
					'.iex_ae_color_selector_border:after{content:"";display:block;box-sizing:border-box;-moz-box-sizing:border-box;width:100%;height:100%;border:1px solid #ffffff;}',
					'.iex_ae_color_selector_border.iex_dark{border-color:#ffffff;}',
					'.iex_ae_color_selector_border.iex_dark:after{border-color:#000000;}',
					'.iex_ae_color_selector.iex_ae_color_selector_disabled>.iex_ae_color_selector_inner{background-color:#b0b0b0 !important;}',
					'.iex_ae_color_selector.iex_ae_color_selector_disabled>.iex_ae_color_selector_inner.iex_dark{background-color:#404040 !important;}',
					'.iex_ae_color_selector_border2{position:absolute;left:0;top:0;right:0;bottom:0;border:2px solid #ffffff;}',
					'.iex_ae_color_selector_border2_alt{border-color:#808080;}',
					'.iex_ae_color_selector:not(.iex_ae_color_selector_selected)>.iex_ae_color_selector_inner>.iex_ae_color_selector_border2{display:none;}',

					// layout=horizontal; font tool table as horizontal
					'.iex_ae_t5c1{display:table;font-size:0.8em;margin-top:0.5em;}',
					'.iex_ae_t5c2{display:table-row;}',
					'.iex_ae_t5c3{display:table-cell;vertical-align:middle;}',
					'.iex_ae_t5c3:nth-of-type(n+2){padding-left:0.5em;}',
					// layout=vertical; font tool table as vertical
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t5c1{display:block;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t5c2{display:block;text-align:center;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t5c3{display:block;padding-left:0;text-align:left;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t5c3+.iex_ae_t5c3{margin-top:1em;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t5c3.iex_ae_t5c3_small_space+.iex_ae_t5c3{margin-top:0.25em;}',

					'.iex_ae_new_annotation_button{display:inline-block;width:3em;height:3em;border:0.15em dashed #000000;text-align:center;white-space:nowrap;line-height:0;font-weight:bold;cursor:pointer;}',
					'.iex_ae_new_annotation_button.iex_dark{border-color:#ffffff;}',
					'.iex_ae_new_annotation_button:hover{background-color:#ffffff;color:#000000;}',
					'.iex_ae_new_annotation_button.iex_dark:hover{background-color:#000000;color:#ffffff;}',
					'.iex_ae_new_annotation_button{transition:background-color 0.25s ease-in-out 0s,color 0.25s ease-in-out 0s;}',
					'.iex_ae_new_annotation_button:before{content:"";display:inline-block;vertical-align:middle;width:0;height:100%;}',
					'.iex_ae_new_annotation_button_inner{display:inline-block;vertical-align:middle;white-space:normal;line-height:normal;}',
					'select.iex_ae_selection{display:block;font-size:inherit !important;}',
					'.iex_ae_selection:disabled{opacity:0.5;}',
					'.iex_ae_selection_option{}',
					'.iex_ae_option_label{display:block;white-space:nowrap;}',
					'.iex_ae_option_checkbox{vertical-align:middle;margin:0;padding:0;}',
					'.iex_ae_option_checkbox+.riceCheck{vertical-align:middle;}',
					'.iex_ae_option_label_text{vertical-align:middle;}',
					'.iex_ae_option_checkbox:disabled,',
					'.iex_ae_option_checkbox:disabled+.riceCheck,',
					'.iex_ae_option_checkbox:disabled~.iex_ae_option_label_text{opacity:0.5;}',
					'.iex_ae_option_checkbox.iex_ae_option_checkbox_bold:checked+.iex_ae_option_label_text{font-weight:bold;}',
					'.iex_ae_option_checkbox.iex_ae_option_checkbox_italic:checked+.iex_ae_option_label_text{font-style:italic;}',
					'.iex_ae_option_label+.iex_ae_option_label,.iex_ae_selection+.iex_ae_selection{margin-top:0.25em;}',

					// Annotation text container
					'.iex_ae_t6c0{display:block;width:100%;height:100%;position:relative;}',
					'.iex_ae_t6c1{position:absolute;left:0;top:0;bottom:0;right:0;overflow-x:hidden;overflow-y:auto;white-space:0;line-height:0;}',
					'.iex_ae_t6c1:after{content:"";display:inline-block;vertical-align:bottom;width:0;height:100%;}',
					'.iex_ae_t6c2{display:inline-block;vertical-align:bottom;white-space:normal;box-sizing:border-box;-moz-box-sizing:border-box;line-height:normal;width:100%;padding:0 0.25em 0.25em;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t6c2{padding-top:0.25em;}',

					'.iex_ae_add_annotation_container_empty{text-align:center;}',
					'.iex_ae_add_annotation_container_empty:not(.iex_ae_add_annotation_container_empty_visible){display:none;}',
					'.iex_ae_add_annotation_container_empty_link{cursor:pointer;}',

					'.iex_ae_restore_annotations_container_empty{text-align:center;}',
					'.iex_ae_restore_annotations_container_empty:not(.iex_ae_restore_annotations_container_empty_visible){display:none;}',
					'.iex_ae_restore_annotations_container_empty_link{cursor:pointer;}',

					'.iex_ae_annotation_editor{}',
					'.iex_ae_annotation_editor+.iex_ae_annotation_editor{margin-top:0.5em;}',
					'.iex_ae_annotation_editor.iex_ae_annotation_editor_selected{}',
					'.iex_ae_annotation_editor_top{display:table;width:100%;font-size:0.8em;}',
					'.iex_ae_annotation_editor_top_row{display:table-row;height:100%;}',
					'.iex_ae_annotation_editor_top_cell{display:table-cell;height:100%;width:100%;white-space:nowrap;text-align:right;vertical-align:bottom;}',
					'.iex_ae_annotation_editor_top_cell:first-child{width:0;text-align:left;}',
					'.iex_ae_annotation_editor_number{display:inline-block;line-height:1em;opacity:0.8;}',
					'.iex_ae_annotation_button{position:relative;display:inline-block;cursor:pointer;width:1.5em;height:1.5em;margin-left:0.25em;background-color:#e5e5e5;color:#111111;border:1px solid #aaaaaa;border-bottom:none;text-align:center;line-height:0;vertical-align:bottom;}',
					'.iex_ae_annotation_button.iex_dark{color:#eeeeee;}',
					'.iex_ae_annotation_button.iex_dark{background-color:#1a1a1a;border-color:#555555;}',
					'.iex_ae_annotation_button:after{content:"";display:inline-block;vertical-align:middle;width:0;height:100%;}',
					'.iex_ae_annotation_button_inner{display:inline-block;vertical-align:middle;line-height:1em;height:1em;position:relative;}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_small_text>.iex_ae_annotation_button_inner{font-size:0.8em;line-height:1em;}',
					'.iex_ae_annotation_button>.iex_ae_annotation_button_inner_color{display:block;position:absolute;left:0;top:0;right:0;bottom:0;padding:0.25em;height:auto;}',
					'.iex_ae_annotation_button>.iex_ae_annotation_button_color_text{font-size:0.8em;text-shadow:1px 1px 0 #ffffff;}',
					'.iex_ae_annotation_button>.iex_ae_annotation_button_color_text.iex_dark{text-shadow:1px 1px 0 #000000;}',
					'.iex_ae_annotation_button_color{display:block;width:100%;height:100%;box-sizing:border-box;-moz-box-sizing:border-box;border:1px solid rgba(0,0,0,0.5);}',
					'.iex_ae_annotation_button_color.iex_dark{border-color:rgba(255,255,255,0.5);}',
					'.iex_ae_annotation_button_color:after{content:"";display:block;width:100%;height:100%;box-sizing:border-box;-moz-box-sizing:border-box;border:1px solid rgba(255,255,255,0.5);}',
					'.iex_ae_annotation_button_color.iex_dark:after{border-color:rgba(0,0,0,0.5);}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_align{position:relative;}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_align>.iex_ae_annotation_button_inner{position:absolute;width:33.33%;height:33.33%;background-color:#000000;opacity:0.5;}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_align>.iex_ae_annotation_button_inner.iex_dark{background-color:#ffffff;}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_align_left>.iex_ae_annotation_button_inner{left:0;}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_align_right>.iex_ae_annotation_button_inner{right:0;}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_align_center>.iex_ae_annotation_button_inner{left:50%;margin-left:-16.66%}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_align_justify>.iex_ae_annotation_button_inner{left:0;width:100%;}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_valign_top>.iex_ae_annotation_button_inner{top:0;}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_valign_bottom>.iex_ae_annotation_button_inner{bottom:0;}',
					'.iex_ae_annotation_button.iex_ae_annotation_button_valign_middle>.iex_ae_annotation_button_inner{top:50%;margin-top:-16.66%}',
					'.iex_ae_annotation_editor_bottom{position:relative;}',
					'.iex_ae_annotation_editor_bottom:after{content:"";display:block;position:absolute;left:0;top:0;bottom:0;right:0;border:0.125em dashed #c0c0c0;pointer-events:none;visibility:hidden;}',
					'input.iex_ae_annotation_editor_input_text{position:relative;font-size:inherit !important;font-family:inherit !important;padding:0.25em !important;border:1px solid #808080 !important;background-color:#dddddd !important;box-sizing:border-box;-moz-box-sizing:border-box;width:100%;background-color:#d0d0d0;}',
					'input.iex_ae_annotation_editor_input_text:hover{background-color:#c0c0c0 !important;}',
					'input.iex_ae_annotation_editor_input_text.iex_dark{background-color:#202020 !important;}',
					'input.iex_ae_annotation_editor_input_text.iex_dark:hover{background-color:#303030 !important;}',
					'input[type=text].iex_ae_annotation_editor_input_text:focus{border-color:#404040 !important;}',
					'.iex_ae_annotation_editor_input_text.iex_dark{background-color:#222222 !important;}',
					'input[type=text].iex_ae_annotation_editor_input_text.iex_dark:focus{border-color:#b0b0b0 !important;}',
					'.iex_ae_annotation_editor.iex_ae_annotation_editor_selected>.iex_ae_annotation_editor_bottom:after{visibility:visible;}',
					'.iex_ae_annotation_editor.iex_ae_annotation_editor_selected>.iex_ae_annotation_editor_bottom>input.iex_ae_annotation_editor_input_text[type=text],',
					'.iex_ae_annotation_editor.iex_ae_annotation_editor_selected>.iex_ae_annotation_editor_bottom>input.iex_ae_annotation_editor_input_text[type=text]:focus{border-color:rgba(0,0,0,0) !important;}',

					// Top links
					'.iex_ae_t7c0{font-size:0.8em;text-align:left;margin-bottom:0.375em;}',
					'.iex_ae_t7c1{display:inline-block;vertical-align:baseline;}',
					'.iex_ae_t7c1+.iex_ae_t7c1{margin-left:0.75em;}',
					'.iex_ae_top_color_link{cursor:pointer;border-bottom:0.125em solid rgba(0,0,0,0);}',
					'.iex_ae_top_color_link.iex_ae_top_color_link_selected{border-bottom-color:#000000;color:#000000;}',
					'.iex_ae_top_color_link.iex_ae_top_color_link_selected.iex_dark{border-bottom-color:#ffffff;color:#ffffff;}',
					'.iex_ae_top_label{font-weight: bold;}',
					'.iex_ae_top_hyphen{display:none;}',

					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_top_hyphen{display:inline;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t7c0{margin-bottom:0;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_t7c1{margin-left:0;margin-bottom:0.375em;display:block;text-align:center;}',
					'.iex_annotation_editor.iex_annotation_editor_vertical .iex_ae_top_label{display:block;}',

					// Preview
					'.iex_ae_preview_container{position:relative;width:100%;height:100%;}',
					'.iex_ae_preview_image{border:none;padding:0;margin:0;display:block;}',
					'.iex_ae_preview_image:not(.iex_ae_preview_image_visible){visibility:hidden;}',
					'.iex_ae_preview_image.iex_ae_preview_image_visible{width:100%;height:100%;}',
					'.iex_ae_preview_message{position:absolute;left:0;top:0;bottom:0;right:0;white-space:0;line-height:0;text-align:center;}',
					'.iex_ae_preview_message:before{content:"";display:inline-block;vertical-align:middle;width:0;height:100%;}',
					'.iex_ae_preview_message_inner{display:inline-block;vertical-align:middle;white-space:normal;line-height:normal;font-weight:bold;color:#000000;text-shadow:0 0 0.125em #ffffff;}',
					'.iex_ae_preview_message_inner.iex_dark{color:#ffffff;text-shadow:0 0 0.125em #000000;}',
					'.iex_annotation_overlay{position:absolute;left:0;top:0;bottom:0;right:0;text-align:left;}',
					'.iex_annotation_container{position:relative;width:100%;height:100%;transform-origin:0 0;-o-transform-origin:0 0;-moz-transform-origin:0 0;-webkit-transform-origin:0 0;}',

					'.iex_ae_preview_scroll_h{position:absolute;left:0;right:0;bottom:0;height:0.5em;pointer-events:none;}',
					'.iex_ae_preview_scroll_h_inner{height:100%;}',
					'.iex_ae_preview_scroll_v{position:absolute;top:0;bottom:0;right:0;width:0.5em;pointer-events:none;}',
					'.iex_ae_preview_scroll_v_inner{width:100%;}',
					'.iex_ae_preview_scroll_h:not(.iex_ae_preview_scroll_visible),',
					'.iex_ae_preview_scroll_v:not(.iex_ae_preview_scroll_visible),',
					'.iex_ae_preview_scroll_h:not(.iex_ae_preview_scroll_displayable),',
					'.iex_ae_preview_scroll_v:not(.iex_ae_preview_scroll_displayable){display:none;}',
					'.iex_ae_preview_scroll_h_inner,',
					'.iex_ae_preview_scroll_v_inner{position:absolute;border-radius:0.25em;background-color:#ffffff;box-sizing:border-box;-moz-box-sizing:border-box;border:1px solid #000000;opacity:0.25;}',
					'.iex_ae_preview_scroll_h_inner.iex_dark,',
					'.iex_ae_preview_scroll_v_inner.iex_dark{background-color:#000000;border-color:#ffffff;}',
					'.iex_ae_preview_scroll_h.iex_ae_preview_scroll_displayable.iex_ae_preview_scroll_visible+.iex_ae_preview_scroll_v{bottom:0.5em;}',
					/*</feature:annotation-editor>*/

					'.iex_annotation{position:absolute;z-index:0;pointer-events:auto;}',
					'.iex_annotation.iex_annotation_scaling_px{}',
					'.iex_annotation:hover{z-index:1}',
					'.iex_annotation.iex_annotation_selected{z-index:2;}',
					'.iex_annotation_borders{position:absolute;left:0;top:0;bottom:0;right:0;}',
					'.iex_annotation_border{position:absolute;}',
					'.iex_annotation_border_top_left{cursor:nwse-resize;left:-16px;top:-16px;width:32px;height:32px;}',
					'.iex_annotation_border_top_right{cursor:nesw-resize;right:-16px;top:-16px;width:32px;height:32px;}',
					'.iex_annotation_border_bottom_left{cursor:nesw-resize;left:-16px;bottom:-16px;width:32px;height:32px;}',
					'.iex_annotation_border_bottom_right{cursor:nwse-resize;right:-16px;bottom:-16px;width:32px;height:32px;}',
					'.iex_annotation_border_top{cursor:ns-resize;left:16px;right:16px;top:-16px;height:32px;}',
					'.iex_annotation_border_bottom{cursor:ns-resize;left:16px;right:16px;bottom:-16px;height:32px;}',
					'.iex_annotation_border_left{cursor:ew-resize;left:-16px;width:32px;top:16px;bottom:16px;}',
					'.iex_annotation_border_right{cursor:ew-resize;right:-16px;width:32px;top:16px;bottom:16px;}',
					'.iex_annotation_content{position:absolute;left:0;top:0;bottom:0;right:0;line-height:0;white-space:nowrap;text-align:center;}',
					'.iex_annotation.iex_annotation_editing>.iex_annotation_content{cursor:move;}',
					'.iex_annotation_content:before{content:"";display:inline-block;vertical-align:middle;width:0;height:100%;}',
					'.iex_annotation_content2{line-height:normal;white-space:normal;display:inline-block;width:100%;vertical-align:middle;position:relative;pointer-events:none;}',
					'.iex_annotation_content3{display:inline-block;line-height:1.2em;cursor:default;pointer-events:auto;}',
					'.iex_annotation.iex_annotation_editing .iex_annotation_content3{cursor:move;pointer-events:auto;}',
					'.iex_annotation_content3.iex_annotation_content_bold{font-weight:bold;}',
					'.iex_annotation_content3.iex_annotation_content_italic{font-style:italic;}',
					'.iex_annotation_format_bold{font-weight:bold;}',
					'.iex_annotation_content3.iex_annotation_content_bold>.iex_annotation_format_bold{font-weight:normal;}',
					'.iex_annotation_format_italic{font-style:italic;}',
					'.iex_annotation_content3.iex_annotation_content_italic>.iex_annotation_format_italic{font-style:normal;}',
					'.iex_annotation_background{position:absolute;left:0;top:0;bottom:0;right:0;background:#ffffff;opacity:0.25;}',
					'.iex_annotation_outline{position:absolute;left:0;top:0;bottom:0;right:0;border:2px solid #000000;opacity:0.25;}',
					'.iex_annotation.iex_annotation_selected>.iex_annotation_background{opacity:0.5;}',
					'.iex_annotation.iex_annotation_selected>.iex_annotation_outline{border-style:dashed;opacity:0.5;}',

					'.iex_annotation:not(.iex_annotation_editing)>.iex_annotation_background{opacity:0.5;transition:opacity 0.25s ease-in-out 0s;}',
					'.iex_annotation:not(.iex_annotation_editing):hover>.iex_annotation_background{opacity:0.8;}',
					'.iex_annotation:not(.iex_annotation_editing).iex_annotation_transparent>.iex_annotation_background{opacity:0.25;}',
					'.iex_annotation:not(.iex_annotation_editing).iex_annotation_transparent:hover>.iex_annotation_background{opacity:0.75;}',
					'.iex_annotation:not(.iex_annotation_editing)>.iex_annotation_outline{opacity:0.5;transition:opacity 0.25s ease-in-out 0s;}',
					'.iex_annotation:not(.iex_annotation_editing):hover>.iex_annotation_outline{opacity:0.5;}',
					'.iex_annotation:not(.iex_annotation_editing).iex_annotation_transparent>.iex_annotation_outline{opacity:0.25;}',
					'.iex_annotation:not(.iex_annotation_editing).iex_annotation_transparent:hover>.iex_annotation_outline{opacity:0.8;}',
					'.iex_annotation:not(.iex_annotation_editing)>.iex_annotation_content{opacity:1;transition:opacity 0.25s ease-in-out 0s;}',
					'.iex_annotation:not(.iex_annotation_editing):hover>.iex_annotation_content{opacity:1;}',
					'.iex_annotation:not(.iex_annotation_editing).iex_annotation_transparent>.iex_annotation_content{opacity:0.5;}',
					'.iex_annotation:not(.iex_annotation_editing).iex_annotation_transparent:hover>.iex_annotation_content{opacity:1;}',

					'.iex_annotation.iex_annotation_align_left>.iex_annotation_content{text-align:left;}',
					'.iex_annotation.iex_annotation_align_right>.iex_annotation_content{text-align:right;}',
					'.iex_annotation.iex_annotation_align_center>.iex_annotation_content{text-align:center;}',
					'.iex_annotation.iex_annotation_align_justify>.iex_annotation_content{text-align:justify;}',
					'.iex_annotation.iex_annotation_valign_top>.iex_annotation_content>.iex_annotation_content2{vertical-align:top;}',
					'.iex_annotation.iex_annotation_valign_middle>.iex_annotation_content>.iex_annotation_content2{vertical-align:middle;}',
					'.iex_annotation.iex_annotation_valign_bottom>.iex_annotation_content>.iex_annotation_content2{vertical-align:bottom;}',
					'.iex_annotation.iex_annotation_valign_x>.iex_annotation_content:before{content:none;}',
					'.iex_annotation.iex_annotation_align_x>.iex_annotation_content>.iex_annotation_content2,',
					'.iex_annotation.iex_annotation_valign_x>.iex_annotation_content>.iex_annotation_content2{position:absolute;display:inline-block;left:0;top:0;width:100%;}',
					'.iex_annotation.iex_annotation_valign_x.iex_annotation_valign_top>.iex_annotation_content>.iex_annotation_content2{top:0;}',
					'.iex_annotation.iex_annotation_valign_x.iex_annotation_valign_bottom>.iex_annotation_content>.iex_annotation_content2{bottom:0;top:auto;}',
					'.iex_annotation.iex_annotation_valign_x.iex_annotation_valign_middle>.iex_annotation_content>.iex_annotation_content2{top:50%;}',
					'.iex_annotation.iex_annotation_valign_x.iex_annotation_valign_middle>.iex_annotation_content>.iex_annotation_content2>.iex_annotation_content3{transform:translate(0,-50%);}',

					'.iex_annotation.iex_annotation_align_x.iex_annotation_align_left>.iex_annotation_content>.iex_annotation_content2{left:0;}',
					'.iex_annotation.iex_annotation_align_x.iex_annotation_align_right>.iex_annotation_content>.iex_annotation_content2{right:0;left:auto;}',
					'.iex_annotation.iex_annotation_align_x.iex_annotation_align_center>.iex_annotation_content>.iex_annotation_content2,',
					'.iex_annotation.iex_annotation_align_x.iex_annotation_align_justify>.iex_annotation_content>.iex_annotation_content2{left:50%;text-align:left;}',
					'.iex_annotation.iex_annotation_align_x.iex_annotation_align_center>.iex_annotation_content>.iex_annotation_content2>.iex_annotation_content3{transform:translate(-50%,0);text-align:center;}',
					'.iex_annotation.iex_annotation_align_x.iex_annotation_align_justify>.iex_annotation_content>.iex_annotation_content2>.iex_annotation_content3{transform:translate(-50%,0);text-align:justify;min-width:100%;}',
					'.iex_annotation.iex_annotation_align_x.iex_annotation_align_center.iex_annotation_valign_x.iex_annotation_valign_middle>.iex_annotation_content>.iex_annotation_content2>.iex_annotation_content3,',
					'.iex_annotation.iex_annotation_align_x.iex_annotation_align_justify.iex_annotation_valign_x.iex_annotation_valign_middle>.iex_annotation_content>.iex_annotation_content2>.iex_annotation_content3{transform:translate(-50%,-50%)}',

					'.iex_annotation_standalone_overlay{display:block;position:absolute;z-index:1;pointer-events:none;font-size:1px;}',

				].join(""); //}


				// Append style
				this.stylesheet_annotations = $("style");
				this.stylesheet_annotations.textContent = stylesheet_text;
				on_ready(on_insert_stylesheet.bind(this, this.stylesheet_annotations), on_insert_stylesheet_condition);
			},
			/*</feature:annotations>*/

			theme_detect: function () {
				// Theme detection
				var doc_el = document.documentElement,
					body = document.querySelector("body"),
					bg_colors, bg_color, e, i, j, a, a_inv;

				if (doc_el && body) {
					// Get background colors
					e = $("div");
					e.className = "post reply";

					bg_colors = [
						this.parse_css_color(this.get_true_style(doc_el, "backgroundColor")),
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
				var e = $(tag_name || "div"),
					s, v;

				// Set class
				e.className = class_name;

				// Add
				if (parent_node || (parent_node = document.querySelector("body"))) {
					parent_node.appendChild(e);
					v = get_true_style(e, style_name);
					parent_node.removeChild(e);
				}
				else {
					v = get_true_style(e, style_name);
				}

				// Return style
				return v;
			},
			get_true_style: get_true_style,

			parse_css_color: function (color) {
				if (/^transparent$/.test(color)) return [ 0 , 0 , 0 , 0 ];

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
				var doc_el = document.documentElement,
					left = (window.pageXOffset || doc_el.scrollLeft || 0) - (doc_el.clientLeft || 0),
					top = (window.pageYOffset || doc_el.scrollTop || 0)  - (doc_el.clientTop || 0);

				return {
					left: left,
					top: top,
					right: left + (window.innerWidth || doc_el.clientWidth || 0),
					bottom: top + (window.innerHeight || doc_el.clientHeight || 0),
				};
			},
			get_document_rect: function () {
				var doc_el = document.documentElement,
					left = (window.pageXOffset || doc_el.scrollLeft || 0) - (doc_el.clientLeft || 0),
					top = (window.pageYOffset || doc_el.scrollTop || 0)  - (doc_el.clientTop || 0);

				return {
					left: left,
					top: top,
					right: left + (doc_el.clientWidth || window.innerWidth || 0),
					bottom: top + (doc_el.clientHeight || window.innerHeight || 0),
				};
			},
			get_document_size: function () {
				var doc_el = document.documentElement;

				return {
					width: (doc_el.clientWidth || window.innerWidth || 0),
					height: (doc_el.clientHeight || window.innerHeight || 0),
				};
			},
			get_document_offset: function () {
				var doc_el = document.documentElement;

				return {
					left: (window.pageXOffset || doc_el.scrollLeft || 0) - (doc_el.clientLeft || 0),
					top: (window.pageYOffset || doc_el.scrollTop || 0)  - (doc_el.clientTop || 0),
				};
			},
			get_object_rect: function (obj) {
				var bounds = obj.getBoundingClientRect(),
					doc_el = document.documentElement,
					left = (window.pageXOffset || doc_el.scrollLeft || 0) - (doc_el.clientLeft || 0),
					top = (window.pageYOffset || doc_el.scrollTop || 0)  - (doc_el.clientTop || 0);

				return {
					left: left + bounds.left,
					top: top + bounds.top,
					right: left + bounds.right,
					bottom: top + bounds.bottom,
					width: bounds.width,
					height: bounds.height,
				};
			},
			get_object_rect_relative: function (obj) {
				return obj.getBoundingClientRect();
			},
			get_object_size: function (obj) {
				var bounds = obj.getBoundingClientRect();

				return {
					width: bounds.width,
					height: bounds.height,
				};
			},
			get_object_rect_inner: function (obj) {
				// Document scroll offset
				var doc_el = document.documentElement,
					left = (window.pageXOffset || doc_el.scrollLeft || 0) - (doc_el.clientLeft || 0),
					top = (window.pageYOffset || doc_el.scrollTop || 0)  - (doc_el.clientTop || 0),
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

			get_prefixed_style: function (name) {
				// Returns
				var e = $("div"),
					prefixes, prefixes2, name2, n, i;

				name2 = name.replace(/[A-Z]/g, function (match) {
					return "-" + match.toLowerCase();
				});
				name = name.replace(/-[a-z]/g, function (match) {
					return match[1].toUpperCase();
				});

				// Un-prefixed
				if (typeof(e.style[name]) === "string") {
					return [ name, name2 ];
				}

				// Check prefixes
				prefixes = [ "webkit" , "Moz" , "O" , "ms" ];
				prefixes2 = [ "-webkit-" , "-moz-" , "-o-" , "-ms-" ];
				name = name[0].toUpperCase() + name.substr(1);

				for (i = 0; i < prefixes.length; ++i) {
					n = prefixes[i] + name;
					if (typeof(e.style[n]) === "string") {
						return [ n, prefixes2[i] + name2 ];
					}
				}

				name = name[0].toLowerCase() + name.substr(1);
				return [ name, name2 ];
			},

			add_font: function (font_name, external_name, styles) {
				if (loaded_fonts !== null && font_name in loaded_fonts) return true;

				var styles_names = [ "r", "i", "b", "bi" ],
					styles_selected = [ false, false, false, false ],
					styles_count = 0,
					base_url = "https://dnsev.github.io/web/fonts/",
					src = "",
					url, i, j, f_weight, f_style, n, p;

				// Parent node
				if (!(p = doc.head || doc.body || doc_el)) return false;

				// External name
				base_url += (external_name ? external_name : font_name) + "/";

				// Styles to load
				if (styles) {
					for (i = 0; i < styles.length; ++i) {
						j = styles_names.indexOf(arguments[i]);
						if (j >= 0) {
							styles_selected[j] = true;
							++styles_count;
						}
					}
				}

				// Must load at least one
				if (styles_count === 0) styles_selected[0] = true;

				// Prepare source string
				for (i = 0; i < styles_names.length; ++i) {
					if (!styles_selected[i]) continue;

					url = base_url + styles_names[i] + "/webfont";
					f_weight = ((i < 2) ? "normal" : "bold");
					f_style = ((i % 2) === 0 ? "normal" : "italic");

					src += "@font-face{" +
						"font-family:'" + font_name + "';" +
						"src:url('" + url + ".eot');" +
						"src:url('" + url + ".eot?#iefix') format('embedded-opentype')," +
							"url('" + url + ".woff2') format('woff2')," +
							"url('" + url + ".woff') format('woff')," +
							"url('" + url + ".ttf') format('truetype')," +
							"url('" + url + ".svg#" + external_name + "') format('svg');" +
						"font-weight:" + f_weight + ";" +
						"font-style:" + f_style + ";" +
					"}";
				}

				// Create node
				n = document.createElement("style");
				n.textContent = src;

				// State
				if (loaded_fonts === null) loaded_fonts = {};
				loaded_fonts[font_name] = n;

				// Add to doc
				p.appendChild(n);
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
			this.modifiers = [];

			// Binds
			this.on_api_post_add_bind = on_api_post_add.bind(this);
			this.on_api_file_info_update_bind = on_api_file_info_update.bind(this);
		};



		var modify_href = function (node, filename) {
			var href = node.getAttribute("href"),
				i;

			if (href !== null) {
				href = href.replace(/#.*/, "") + "#!" + this.escape(filename);
				for (i = 0; i < this.modifiers.length; ++i) {
					href = this.modifiers[i].call(this, node, href);
				}
				node.setAttribute("href", href);
			}
		};

		var on_api_post_add = function (post_container) {
			// Queue add hooks
			this.post_queue.push(post_container);
		};
		var on_api_file_info_update = function (node) {
			var c = api.post_get_file_node_link_from_file_info(node),
				fn, n;

			if (
				c !== null &&
				(c.getAttribute("href") || "").indexOf("#") < 0 &&
				(n = api.post_get_file_container_from_file_info(node)) !== null &&
				(fn = api.post_get_file_info_from_file_info_container(n).name)
			) {
				modify_href.call(this, c, fn);
			}
		};

		var on_post_queue_callback = function (post_container) {
			// Find file
			var file_nodes = api.post_get_file_nodes(post_container),
				file_info;

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



		FileLink.prototype = {
			constructor: FileLink,

			destroy: function () {
				// Remove api events
				api.off("post_add", this.on_api_post_add_bind);
				api.off("file_info_update", this.on_api_file_info_update_bind);
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
				api.on("file_info_update", this.on_api_file_info_update_bind);
			},
			disable: function () {
				// Not enabled or already disabled
				if (!this.enabled || this.disabled) return;

				// Disable
				this.disabled = true;

				// Unbind post acquiring
				api.off("post_add", this.on_api_post_add_bind);
				api.off("file_info_update", this.on_api_file_info_update_bind);
			},

			escape: function (s) {
				return encodeURIComponent(s).replace(/\%20/g, "+");
			},
			unescape: function (s) {
				return decodeURIComponent(s.replace(/\+/g, "%20"));
			},

			register_modifier: function (modifier) {
				this.modifiers.push(modifier);
			},
		};



		return FileLink;

	})();

	// Class to manage files in a separate window
	var FileView = (function () {

		var FileView = function () {
			this.events = {
				"image": [],
				"video": [],
			};
		};



		var trigger_event = function (event, data) {
			var list = this.events[event],
				i;

			for (i = 0; i < list.length; ++i) {
				list[i].call(null, data);
			}
		};



		FileView.prototype = {
			constructor: FileView,

			start: function () {
				// Auto-loop .webm's
				var n = document.body.querySelector("video");

				if (n) {
					n.loop = true;
					trigger_event.call(this, "video", n);
				}
				else if ((n = document.body.querySelector("img")) !== null) {
					trigger_event.call(this, "image", n);
				}
			},

			on: function (event, callback) {
				if (event in this.events) {
					this.events[event].push(callback);
					return true;
				}
				return false;
			},
			off: function (event, callback) {
				if (event in this.events) {
					var list = this.events[event],
						i;

					for (i = 0; i < list.length; ++i) {
						if (callback === list[i]) {
							list.splice(i, 1);
							return true;
						}
					}
				}
				return false;
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
			var body = document.querySelector("body");

			// Parent
			if (body) {
				// Create floating container
				this.container = $.div("iex_floating_container");

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
				this.container = null;
			},

			start: function () {
				// Setup
				on_ready(on_asap.bind(this), on_asap_condition);
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

			// Events
			this.events = {
				"change": [],
			};

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
			if (image_container !== null) {
				// Add mouseover/mouseout/click listeners
				image_container.addEventListener("mouseover", this.on_image_mouseenter_bind, false);
				image_container.addEventListener("mouseout", this.on_image_mouseleave_bind, false);
				image_container.addEventListener("click", this.on_image_click_bind, false);
			}
		};
		var remove_post_container_callbacks = function (post_container) {
			// Find file
			var image_container = api.post_get_image_container(post_container);
			if (image_container !== null) {
				// Remove listeners
				image_container.removeEventListener("mouseover", this.on_image_mouseenter_bind, false);
				image_container.removeEventListener("mouseout", this.on_image_mouseleave_bind, false);
				image_container.removeEventListener("click", this.on_image_click_bind, false);
			}
		};

		var get_image_url_extension = function (url) {
			var ext = /(\.[^\.\?#]+)(?:[\?#]|$)/.exec(url);
			return (ext === null) ? "" : ext[1].toLowerCase();
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
			var ext = get_image_url_extension.call(this, post_info.url);
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
			var body = document.querySelector("body");

			// Parent
			if (body) {
				// Create connector
				this.connector = $.div("iex_floating_image_connector");
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
		// var on_preview_video_volume_change = function (event) {
			// Save volume changes
			// if (event.reason == "seek") {
				// settings.change_value(["image_expansion", "video", "volume"], event.volume);
				// settings.save_values();
			// }
		// };

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
				var expanded_node = null;
				if (this.settings.video.expand_state_save) {
					expanded_node = api.post_get_image_expanded_from_image_container(image_container);
					if (expanded_node !== null) {
						this.mpreview.transfer_video_state(expanded_node);
					}
				}

				// Close
				this.preview_close(true);

				// Observe expanded node
				if (expanded_node !== null && this.settings.video.expand_state_save) {
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
				return stop_event(event);
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

		var trigger_event = function (event, data) {
			var list = this.events[event],
				i;

			for (i = 0; i < list.length; ++i) {
				list[i].call(null, data);
			}
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
				on_ready(on_asap.bind(this), on_asap_condition);

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
				ext = get_image_url_extension.call(this, post_info.url);
				ext_info = this.extensions_valid[ext] || this.extensions_valid[""];
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

				// Trigger
				trigger_event.call(this, "change", {
					image_hover: this,
					image_container: image_container,
					type: ext_info.type,
				});
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

					// Trigger
					trigger_event.call(this, "change", {
						image_hover: this,
						image_container: null,
						type: null,
					});
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

			on: function (event, callback) {
				if (event in this.events) {
					this.events[event].push(callback);
					return true;
				}
				return false;
			},
			off: function (event, callback) {
				if (event in this.events) {
					var list = this.events[event],
						i;

					for (i = 0; i < list.length; ++i) {
						if (callback === list[i]) {
							list.splice(i, 1);
							return true;
						}
					}
				}
				return false;
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
				stat_sep;


			// Vars
			this.stats_zoom_controls_enabled = true;
			this.zoom_controls_hide_timer = null;
			this.mouse_in_stats = false;
			this.on_hide_zoom_controls_timeout_bind = hide_zoom_controls.bind(parent, true, false);


			// Background
			this.background = $.div("iex_mpreview_background"); // iex_mpreview_background_disabled iex_mpreview_background_visible iex_mpreview_background_fallback


			// Zoom borders
			this.zoom_borders = $.div("iex_mpreview_zoom_borders"); // iex_mpreview_zoom_borders_visible iex_mpreview_zoom_borders_vertical iex_mpreview_zoom_borders_horizontal

			zoom_border_inner = $.div("iex_mpreview_zoom_borders_inner");
			this.zoom_borders.appendChild(zoom_border_inner);


			// Stats container
			this.stats_container = $.div("iex_mpreview_stats_container");

			// Zoom controls
			this.zoom_controls = $.span("iex_mpreview_stat iex_mpreview_stat_zoom_controls"); // iex_mpreview_stat_zoom_controls_visible iex_mpreview_stat_zoom_controls_fixed
			this.stats_container.appendChild(this.zoom_controls);

			stat_zoom_inc = $.span("iex_mpreview_stat_zoom_control iex_mpreview_stat_zoom_control_increase");
			stat_zoom_inc.textContent = "+";
			this.zoom_controls.appendChild(stat_zoom_inc);

			stat_zoom_dec = $.span("iex_mpreview_stat_zoom_control iex_mpreview_stat_zoom_control_decrease");
			stat_zoom_dec.textContent = "\u2212";
			this.zoom_controls.appendChild(stat_zoom_dec);

			this.zoom_controls_offset = $.span("iex_mpreview_stat_zoom_controls_offset");
			this.stats_container.appendChild(this.zoom_controls_offset);



			// Stats items
			this.stat_zoom_container = $.span("iex_mpreview_stat");
			this.stats_container.appendChild(this.stat_zoom_container);

			this.stat_zoom = $.span("");
			this.stat_zoom_container.appendChild(this.stat_zoom);

			this.stat_zoom_fit = $.span("");
			this.stat_zoom_container.appendChild(this.stat_zoom_fit);

			stat_sep = $.span("iex_mpreview_stat_sep");
			stat_sep.textContent = ", ";
			this.stats_container.appendChild(stat_sep);

			this.stat_status = $.span("iex_mpreview_stat");
			this.stats_container.appendChild(this.stat_status);

			stat_sep = $.span("iex_mpreview_stat_sep");
			stat_sep.textContent = ", ";
			this.stats_container.appendChild(stat_sep);

			this.stat_resolution = $.span("iex_mpreview_stat");
			this.stats_container.appendChild(this.stat_resolution);

			stat_sep = $.span("iex_mpreview_stat_sep");
			stat_sep.textContent = ", ";
			this.stats_container.appendChild(stat_sep);

			this.stat_filesize = $.span("iex_mpreview_stat");
			this.stats_container.appendChild(this.stat_filesize);

			stat_sep = $.span("iex_mpreview_stat_sep");
			stat_sep.textContent = ", ";
			this.stats_container.appendChild(stat_sep);

			this.stat_filename = $.span("iex_mpreview_stat");
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
			// Image
			this.image = $.node("img", "iex_mpreview_image");
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
				c_inner,
				svg_e1, svg_e2,
				c_div1, c_div2, c_div3, c_div4, c_buttons_left, c_buttons_right,
				c_play_button, c_volume_button;

			// Vars
			this.interacted = false;

			this.seeking = false;
			this.seeking_paused = false;
			this.volume_modifying = false;

			this.mouse_capturing_rect = null;
			this.mouse_capturing_element = null;
			this.on_capture_mousemove = on_vcontrols_capture_mousemove.bind(parent);
			this.on_capture_mouseup = on_vcontrols_capture_mouseup.bind(parent);
			this.on_capture_window_resize = on_window_resize.bind(parent);
			this.on_capture_window_scroll = on_window_scroll.bind(parent);


			// Video
			this.video = $.node("video", "iex_mpreview_video");
			this.video.setAttribute("preload", "auto");



			// Controller overlay
			this.overlay = $.div("iex_mpreview_vcontrols_container");

			c_inner = $.div("iex_mpreview_vcontrols_container_inner");
			this.overlay.appendChild(c_inner);

			this.overlay_table = $.div("iex_mpreview_vcontrols_table"); // iex_mpreview_vcontrols_table_visible iex_mpreview_vcontrols_table_visible_important iex_mpreview_vcontrols_table_mini
			c_inner.appendChild(this.overlay_table);



			// Pause/play button
			c_buttons_left = $.div("iex_mpreview_vcontrols_button_container");
			this.overlay_table.appendChild(c_buttons_left);

			c_div1 = $.div("iex_mpreview_vcontrols_button_container_inner");
			c_buttons_left.appendChild(c_div1);

			c_div2 = $.div("iex_mpreview_vcontrols_button_container_inner2");
			c_div1.appendChild(c_div2);

			// Mouse event controller
			c_play_button = $.div("iex_mpreview_vcontrols_button_mouse_controller");
			c_div2.appendChild(c_play_button);

			// SVG image
			this.svg_play = $.node_ns(svgns, "svg", "iex_svg_play_button"); // iex_svg_play_button_playing iex_svg_play_button_looping
			this.svg_play.setAttribute("svgns", svgns);
			this.svg_play.setAttribute("width", "2em");
			this.svg_play.setAttribute("height", "2em");
			this.svg_play.setAttribute("viewBox", "0 0 1 1");
			c_div2.appendChild(this.svg_play);

			svg_e1 = $.node_ns(svgns, "g", "iex_svg_button_scale_group");
			svg_e1.setAttribute("transform", "translate(0.25,0.25) scale(0.5)");
			this.svg_play.appendChild(svg_e1);

			svg_e2 = $.node_ns(svgns, "polygon", "iex_svg_play_button_play_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0,0 0,1 1,0.5");
			svg_e1.appendChild(svg_e2);

			svg_e2 = $.node_ns(svgns, "polygon", "iex_svg_play_button_loop_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0.1,0.05 1,0.5 0.1,0.95");
			svg_e1.appendChild(svg_e2);

			svg_e2 = $.node_ns(svgns, "polygon", "iex_svg_play_button_loop_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0,0.7 0.4,0.5 0,0.3");
			svg_e1.appendChild(svg_e2);

			svg_e2 = $.node_ns(svgns, "polygon", "iex_svg_play_button_pause_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0.125,0 0.375,0 0.375,1 0.125,1");
			svg_e1.appendChild(svg_e2);

			svg_e2 = $.node_ns(svgns, "polygon", "iex_svg_play_button_pause_icon iex_svg_button_fill");
			svg_e2.setAttribute("points", "0.625,0 0.875,0 0.875,1 0.625,1");
			svg_e1.appendChild(svg_e2);



			// Seek bar
			c_div1 = $.div("iex_mpreview_vcontrols_seek_container");
			this.overlay_table.appendChild(c_div1);

			c_div2 = $.div("iex_mpreview_vcontrols_seek_container_inner");
			c_div1.appendChild(c_div2);

			this.seek_bar = $.div("iex_mpreview_vcontrols_seek_bar"); // iex_mpreview_vcontrols_no_border_radius
			c_div2.appendChild(this.seek_bar);

			c_div3 = $.div("iex_mpreview_vcontrols_seek_bar_bg");
			this.seek_bar.appendChild(c_div3);

			this.load_progress = $.div("iex_mpreview_vcontrols_seek_bar_loaded");
			c_div3.appendChild(this.load_progress);

			this.play_progress = $.div("iex_mpreview_vcontrols_seek_bar_played");
			c_div3.appendChild(this.play_progress);

			c_div4 = $.div("iex_mpreview_vcontrols_seek_time_table");
			c_div3.appendChild(c_div4);

			this.time_current = $.div("iex_mpreview_vcontrols_seek_time_current");
			c_div4.appendChild(this.time_current);

			this.time_duration = $.div("iex_mpreview_vcontrols_seek_time_duration");
			c_div4.appendChild(this.time_duration);



			// Volume bar/mute button
			c_buttons_right = $.div("iex_mpreview_vcontrols_button_container");
			this.overlay_table.appendChild(c_buttons_right);

			c_div1 = $.div("iex_mpreview_vcontrols_button_container_inner");
			c_buttons_right.appendChild(c_div1);

			c_div2 = $.div("iex_mpreview_vcontrols_button_container_inner2");
			c_div1.appendChild(c_div2);

			// Mouse event controller
			c_volume_button = $.div("iex_mpreview_vcontrols_button_mouse_controller");
			c_div2.appendChild(c_volume_button);

			// SVG image
			this.svg_volume = $.node_ns(svgns, "svg", "iex_svg_volume_button"); // iex_svg_volume_button_muted iex_svg_volume_button_high iex_svg_volume_button_medium iex_svg_volume_button_low
			this.svg_volume.setAttribute("svgns", svgns);
			this.svg_volume.setAttribute("width", "2em");
			this.svg_volume.setAttribute("height", "2em");
			this.svg_volume.setAttribute("viewBox", "0 0 1 1");
			c_div2.appendChild(this.svg_volume);

			svg_e1 = $.node_ns(svgns, "g", "iex_svg_button_scale_group");
			svg_e1.setAttribute("transform", "translate(0.25,0.25) scale(0.5)");
			this.svg_volume.appendChild(svg_e1);

			svg_e2 = $.node_ns(svgns, "polygon", "iex_svg_volume_button_speaker iex_svg_button_fill");
			svg_e2.setAttribute("points", "0,0.3 0.2,0.3 0.5,0 0.6,0 0.6,1 0.5,1 0.2,0.7 0,0.7");
			svg_e1.appendChild(svg_e2);

			svg_e2 = $.node_ns(svgns, "path", "iex_svg_volume_button_wave_big iex_svg_button_fill");
			svg_e2.setAttribute("d", "M 0.75,0.1 Q 1.3,0.5 0.75,0.9 L 0.75,0.75 Q 1.05,0.5 0.75,0.25 Z");
			svg_e1.appendChild(svg_e2);

			svg_e2 = $.node_ns(svgns, "path", "iex_svg_volume_button_wave_small iex_svg_button_fill");
			svg_e2.setAttribute("d", "M 0.75,0.75 Q 1.05,0.5 0.75,0.25 Z");
			svg_e1.appendChild(svg_e2);

			svg_e2 = $.node_ns(svgns, "g", "iex_svg_volume_button_wave_mute_icon");
			svg_e1.appendChild(svg_e2);
			svg_e1 = svg_e2;

			svg_e2 = $.node_ns(svgns, "polygon", "iex_svg_volume_button_wave_mute_icon_polygon");
			svg_e2.setAttribute("points", "0.7,0.3 1.0,0.6 0.9,0.7 0.6,0.4");
			svg_e1.appendChild(svg_e2);

			svg_e2 = $.node_ns(svgns, "polygon", "iex_svg_volume_button_wave_mute_icon_polygon");
			svg_e2.setAttribute("points", "0.7,0.7 1.0,0.4 0.9,0.3 0.6,0.6");
			svg_e1.appendChild(svg_e2);



			// Volume bar
			c_div2 = $.div("iex_mpreview_vcontrols_volume_container_position");
			c_div1.appendChild(c_div2);

			this.volume_container = $.div("iex_mpreview_vcontrols_volume_container"); // iex_mpreview_vcontrols_volume_container_visible iex_mpreview_vcontrols_volume_container_visible_important
			c_div2.appendChild(this.volume_container);

			this.volume_bar = $.div("iex_mpreview_vcontrols_volume_bar"); // iex_mpreview_vcontrols_no_border_radius
			this.volume_container.appendChild(this.volume_bar);

			c_div3 = $.div("iex_mpreview_vcontrols_volume_bar_bg");
			this.volume_bar.appendChild(c_div3);

			this.volume_progress = $.div("iex_mpreview_vcontrols_volume_bar_level");
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

				"resize": [],
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
				window.addEventListener("resize", this.nodes_video.on_capture_window_resize, false);
				window.addEventListener("scroll", this.nodes_video.on_capture_window_scroll, false);
				update_vcontrols_mouse_capture.call(this);
			}
		};
		var teardown_vcontrols_mouse_capture = function () {
			// Destroy mouse capturing events
			if (this.nodes_video.mouse_capturing_element !== null) {
				this.nodes_video.mouse_capturing_element.removeEventListener("mousemove", this.nodes_video.on_capture_mousemove, false);
				this.nodes_video.mouse_capturing_element.removeEventListener("mouseup", this.nodes_video.on_capture_mouseup, false);
				window.removeEventListener("resize", this.nodes_video.on_capture_window_resize, false);
				window.removeEventListener("scroll", this.nodes_video.on_capture_window_scroll, false);
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
			// Ignore if not left mb
			if (get_event_mouse_button(event) !== 1) return;

			// Stop event
			return stop_event(event);
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
			if (get_event_mouse_button(event) !== 1) return;

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
			return stop_event(event);
		};
		var on_vcontrols_volume_bar_mousedown = function (event) {
			// Get the mouse button
			if (get_event_mouse_button(event) !== 1) return;

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
			return stop_event(event);
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
			return stop_event(event);
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
			var button = get_event_mouse_button(event);

			// Activate close
			trigger.call(this, "mouse_down", {
				button: button
			});
			return stop_event(event);
		};
		var on_contextmenu = function (event) {
			// Stop
			return stop_event(event);
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
			return stop_event(event);
		};
		var on_stats_zoom_control_click = function (delta, event) {
			// Event
			trigger.call(this, "stats_zoom_control_click", {
				delta: delta
			});

			// Stop
			return stop_event(event);
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
				trigger.call(this, "resize", {});
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
				this.cpreview.set_size(this.size.width * scale, this.size.height * scale);
				trigger.call(this, "resize", {});
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

			get_size: function () {
				return this.size;
			},
		};



		return MediaPreview;

	})();

	// Content preview base
	var ContentPreview = (function () {

		var ContentPreviewNodes = function () {
			// Main container
			this.container = $.div("iex_cpreview_container iex_cpreview_container_visible");

			// Position/padding container
			this.padding = $.div("iex_cpreview_padding");
			this.container.appendChild(this.padding);

			// Overflow container
			this.overflow = $.div("iex_cpreview_overflow");
			this.padding.appendChild(this.overflow);

			// Offset container
			this.offset = $.div("iex_cpreview_offset");
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
			this.auto = false;
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
			set_auto_size: function (auto) {
				// No change
				if (this.auto == auto) return;

				var container = this.nodes.container;

				// Fixed position
				this.auto = auto;
				if (this.auto) {
					style.add_class(container, "iex_cpreview_container_auto");
				}
				else {
					style.remove_class(container, "iex_cpreview_container_auto");
				}

				// Position
				this.display.x = 0;
				this.display.y = 0;
			},
			update_auto_size: function () {
				// Get size
				var size = style.get_object_size(this.nodes.container);

				// Set
				this.size.width = size.width;
				this.size.height = size.height;
				this.display.width = size.width;
				this.display.height = size.height;
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

/*<feature:annotations>*/
	// Class for bit streaming to a string
	var BitStream = (function () {

		var BitStream = function () {
			this.value_pre = 0;
			this.value = 0;
			this.bits = 0;
			this.string = "";
			this.pos = 0;
			this.pos_bit = 0;
			this.value_pre_decode = 0;
		};

		BitStream.bits_per_char = 6;
		BitStream.bits_per_char_mask = (1 << BitStream.bits_per_char) - 1;
		BitStream.alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-";
		BitStream.re_alphabet = /^[a-zA-Z0-9\+\-]*/;
		BitStream.alphabet_map = (function (alphabet) {
			var length = alphabet.length,
				map = {},
				i;

			for (i = 0; i < length; ++i) map[alphabet[i]] = i;

			return map;
		})(BitStream.alphabet);

		BitStream.prototype = {
			constructor: BitStream,
			value_to_char: function (v) {
				return BitStream.alphabet[v];
			},
			pos_to_value: function (pos) {
				return (pos >= this.string.length) ? 0 : BitStream.alphabet_map[this.string[pos]];
			},
			encode_value: function (v) {
				return (v ^ ((this.value_pre + this.string.length) % BitStream.alphabet.length));
			},
			decode_value: function (v) {
				return (v ^ ((this.value_pre_decode + this.pos) % BitStream.alphabet.length));
			},
			add: function (value, bits) {
				var b;

				while (bits >= (b = BitStream.bits_per_char - this.bits)) {
					this.value |= (value << this.bits) & BitStream.bits_per_char_mask;
					this.value = this.encode_value(this.value);

					this.string += this.value_to_char(this.value);

					value >>>= b;
					bits -= b;
					this.bits = 0;
					this.value_pre = this.value;
					this.value = 0;
				}

				this.value |= (value & ((1 << bits) - 1)) << this.bits;
				this.bits += bits;
				if (this.bits<0)console.log("value=",value,bits);
			},
			get: function (bits) {
				if (bits === undefined) bits = 1;

				var value = 0,
					shift = 0,
					c, cr, b;

				while (bits >= (b = BitStream.bits_per_char - this.pos_bit)) {
					cr = this.pos_to_value(this.pos);
					c = this.decode_value(cr);
					//c = (cr ^ ((this.value_pre_decode + this.pos) % BitStream.alphabet.length));

					value |= ((c >>> this.pos_bit) & ((1 << b) - 1)) << shift;

					bits -= b;
					shift += b;
					this.pos_bit = 0;
					++this.pos;
					this.value_pre_decode = cr;
				}

				if (bits > 0) {
					//c = (this.pos_to_value(this.pos) ^ ((this.value_pre_decode + this.pos) % BitStream.alphabet.length));
					c = this.decode_value(this.pos_to_value(this.pos));
					value |= ((c >>> this.pos_bit) & ((1 << bits) - 1)) << shift;
					this.pos_bit += bits;
				}

				return value;
			},
			encode: function () {
				var s = this.string;
				if (this.bits > 0) s += this.value_to_char(this.encode_value(this.value));
				return s;
			},
			decode: function (string) {
				this.string = string;
				this.pos = 0;
				this.pos_bit = 0;
				this.value_pre_decode = 0;
			},
			to_encoded_string: function () {
				// Converts the content decoded thus far into a new encoded string
				var s = this.string.substr(0, this.pos),
					c;

				if (this.pos_bit === 0) return s;

				c = this.decode_value(this.pos_to_value(this.pos));
				c &= (1 << this.pos_bit) - 1; // mask off the end
				c = (c ^ ((this.value_pre_decode + this.pos) % BitStream.alphabet.length));
				s += this.value_to_char(c);

				return s;
			},
			remaining: function () {
				if (this.pos >= this.string.length) return 0;
				return (this.string.length - this.pos + 1) * BitStream.bits_per_char - this.pos_bit;
			},
			eof: function () {
				return (this.pos >= this.string.length);
			},
		};

		return BitStream;

	})();

	// Image annotation
	var Annotation = (function () {

		var Annotation = function (parent, settings) {
			this.parent = parent;

			this.selected = false;
			this.index = 0;
			this.font_index = 0;
			this.font_size_index = 8;
			this.font_size = 0;
			this.font_bold = false;
			this.font_italic = false;
			this.text_before = null;
			this.text = "";
			this.text_display = "";
			this.text_formatters = [];
			this.text_align = Annotation.AlignDefault;
			this.text_line_spacing = Annotation.line_spacing.to_index(0);
			this.text_char_spacing = Annotation.char_spacing.to_index(0);
			this.text_decoration = Annotation.TextDecorationNone;
			this.colors = [ 0, 1, 1 ]; // text, alt, background
			this.color_index_selected = 0;
			this.position = [ 32, 32 ];
			this.size = [ 100, 100 ];
			this.nodes = {
				edit: null,
				annotation: null,
			};
			this.events = [];
			this.edit_data = (settings && settings.edit) ? new Annotation.EditData() : null;

			if (settings !== null) {
				this.index = settings.index || 0;
				if ("font_size_index" in settings) {
					this.font_size_index = settings.font_size_index;
				}
				if ("x" in settings) this.position[0] = settings.x;
				if ("y" in settings) this.position[1] = settings.y;
				if ("width" in settings) this.size[0] = settings.width;
				if ("height" in settings) this.size[1] = settings.height;
				if ("text_before" in settings) this.text_before = settings.text_before;
				if ("font" in settings) this.font_index = Math.min(Math.max(0, settings.font), Annotation.fonts.length);
				if ("bold" in settings) this.font_bold = settings.bold;
				if ("italic" in settings) this.font_italic = settings.italic;
			}

			this.font_size = Annotation.font_size_index_to_size(this.font_size_index);

			this.create_nodes((settings && settings.edit) || false);
		};



		Annotation.EditData = function () {
			this.move_events = [];
			this.move_mode = 0;
			this.move_origin = [ 0, 0 ];
			this.move_position = [ 0, 0 ];
			this.move_size = [ 0, 0 ];
			this.double_click_ignore = false;
		};



		Annotation.prototype = {
			constructor: Annotation,

			set_annotation_rect: function (x, y, width, height) {
				this.position[0] = x;
				this.position[1] = y;
				this.size[0] = width;
				this.size[1] = height;

				this.update_annotation_rect();
			},
			update_annotation_rect: function () {
				var n1s = this.nodes.annotation.container.style,
					u = Annotation.scaling_mode_units;

				n1s.left = this.position[0] + u;
				n1s.top = this.position[1] + u;
				n1s.width = this.size[0] + u;
				n1s.height = this.size[1] + u;
			},
			auto_size: function () {
				var a_rect = style.get_object_rect_relative(this.nodes.annotation.container),
					scale = this.parent.get_image_scale(),
					image_size = this.parent.get_image_size(),
					rect, n, x, y, w, h;

				// Size
				n = this.nodes.annotation.text;
				n.style.display = "inline-block";
				n.style.width = "auto";
				rect = style.get_object_rect_relative(n);
				n.style.display = "";
				n.style.width = "";

				// Update
				x = Math.round(this.position[0] + (rect.left - a_rect.left) / scale);
				y = Math.round(this.position[1] + (rect.top - a_rect.top) / scale);
				w = Math.ceil(rect.width / scale);
				h = Math.ceil(rect.height / scale);

				// Limits
				if (x + w > image_size.width) {
					x = image_size.width - w;
				}
				if (y + h > image_size.height) {
					y = image_size.height - h;
				}

				if (x < 0) {
					x = 0;
					if (w > image_size.width) {
						w = image_size.width;
					}
				}
				if (y < 0) {
					y = 0;
					if (h > image_size.height) {
						h = image_size.height;
					}
				}

				// Set
				this.set_annotation_rect(x, y, w, h);
				this.trigger("rect_change");
			},

			set_index: function (index) {
				this.index = index;
				this.nodes.edit.index_text.textContent = "#" + (index + 1);
			},
			set_text_before: function (text) {
				this.text_before = text;
			},
			set_text: function (text, dont_set_input) {
				// Parse
				var tf = new TextFormatter();
				tf.parse(text);

				// Update values
				this.text = tf.raw_text;
				this.text_display = tf.text;
				this.text_formatters = tf.formatters;

				// Update input
				if (!dont_set_input && this.nodes.edit !== null) {
					this.nodes.edit.text.value = this.text;
				}

				// Apply
				this.apply_text();
			},
			set_font: function (index) {
				this.font_index = index;

				var f = Annotation.fonts[index],
					fn = f.css_name + "," + Annotation.fonts[0].css_name;

				if (f.external_name !== null) {
					// Load font
					style.add_font(f.css_name, f.external_name, f.external_settings);
				}

				this.nodes.annotation.content.style.fontFamily = fn;

				if (this.nodes.edit !== null) {
					this.nodes.edit.button_font.style.fontFamily = fn;
				}
			},
			set_font_size: function (index) {
				this.font_size_index = index;
				this.font_size = Annotation.font_size_index_to_size(this.font_size_index);

				this.nodes.annotation.content.style.fontSize = this.font_size + Annotation.scaling_mode_units;

				if (this.nodes.edit !== null) {
					this.nodes.edit.button_font_size_text.textContent = this.font_size;
				}
			},
			set_font_bold: function (bold) {
				this.font_bold = bold;

				if (bold) {
					style.add_class(this.nodes.annotation.text, "iex_annotation_content_bold");

					if (this.nodes.edit !== null) {
						this.nodes.edit.button_font.style.fontWeight = "bold";
					}
				}
				else {
					style.remove_class(this.nodes.annotation.text, "iex_annotation_content_bold");

					if (this.nodes.edit !== null) {
						this.nodes.edit.button_font.style.fontWeight = "";
					}
				}
			},
			set_font_italic: function (italic) {
				this.font_italic = italic;

				if (italic) {
					style.add_class(this.nodes.annotation.text, "iex_annotation_content_italic");

					if (this.nodes.edit !== null) {
						this.nodes.edit.button_font.style.fontStyle = "italic";
					}
				}
				else {
					style.remove_class(this.nodes.annotation.text, "iex_annotation_content_italic");

					if (this.nodes.edit !== null) {
						this.nodes.edit.button_font.style.fontStyle = "";
					}
				}
			},
			set_text_line_spacing: function (spacing) {
				this.text_line_spacing = spacing;

				this.nodes.annotation.content.style.lineHeight = (1 + Annotation.line_spacing.from_index(spacing)) + "em";
			},
			set_text_char_spacing: function (spacing) {
				this.text_char_spacing = spacing;

				this.nodes.annotation.content.style.letterSpacing = Annotation.char_spacing.from_index(spacing) + "em";
			},
			set_text_decoration: function (decoration) {
				this.text_decoration = decoration;

				this.nodes.annotation.text.style.textShadow = this.decoration_to_shadow_style(decoration, "#" + Annotation.colors[this.colors[1]]);

				if (this.text_formatters.length > 0) {
					this.apply_text(); // in case any formatting contains a decoration color modification
				}
			},
			set_align: function (align) {
				var classes_old = this.align_to_classes(this.text_align),
					temp = this.align_to_classes_and_strings(align),
					classes_new = temp[0],
					align_strs = temp[1],
					cl = this.nodes.annotation.container.classList,
					i;

				this.text_align = align;

				for (i = 0; i < classes_old.length; ++i) {
					cl.remove(classes_old[i]);
				}
				for (i = 0; i < classes_new.length; ++i) {
					cl.add(classes_new[i]);
				}

				if (this.nodes.edit !== null) {
					this.nodes.edit.button_align.className = "iex_ae_annotation_button iex_ae_annotation_button_align iex_ae_annotation_button_align_" + align_strs[0] + " iex_ae_annotation_button_valign_" + align_strs[1] + style.theme;
				}
			},
			set_color: function (index, color) {
				this.colors[index] = color;

				var c = "#" + Annotation.colors[color];

				if (this.nodes.edit !== null && index === this.color_index_selected) {
					this.nodes.edit.button_color_bg.style.backgroundColor = c;
				}

				if (index === 0) {
					this.nodes.annotation.text.style.color = c;
					this.nodes.annotation.border1.style.borderColor = c;
				}
				else if (index === 1) {
					if (this.text_decoration !== Annotation.TextDecorationNone) {
						this.set_text_decoration(this.text_decoration);
					}
					else if (this.text_formatters.length > 0) {
						this.apply_text(); // in case any formatting contains a decoration color modification
					}
				}
				else { // if (index === 2) {
					this.nodes.annotation.background.style.backgroundColor = c;
				}
			},
			set_color_index_selected: function (index) {
				this.color_index_selected = index;

				if (this.nodes.edit !== null) {
					this.nodes.edit.button_color_text.textContent =
						(index === 1 ? "alt" :
						(index === 2 ? "bg" :
							"txt"
						));


					this.nodes.edit.button_color_bg.style.backgroundColor = "#" + Annotation.colors[this.colors[this.color_index_selected]];
				}
			},
			set_selected: function (selected, dont_select_text) {
				if (selected === this.selected) return;

				this.selected = selected;

				if (selected) {
					style.add_class(this.nodes.annotation.container, "iex_annotation_selected");

					if (this.nodes.edit !== null) {
						style.add_class(this.nodes.edit.container, "iex_ae_annotation_editor_selected");
						if (!dont_select_text) {
							this.select_text(null, false);
						}
					}
				}
				else {
					style.remove_class(this.nodes.annotation.container, "iex_annotation_selected");

					if (this.nodes.edit !== null) {
						style.remove_class(this.nodes.edit.container, "iex_ae_annotation_editor_selected");
					}
				}
			},

			get_index: function () {
				return this.index;
			},
			get_text: function () {
				return this.text;
			},
			get_text_display: function () {
				return this.text_display;
			},
			get_text_formatters: function () {
				return this.text_formatters;
			},
			get_text_before: function () {
				return this.text_before;
			},
			get_font: function () {
				return this.font_index;
			},
			get_font_size: function () {
				return this.font_size_index;
			},
			get_font_bold: function () {
				return this.font_bold;
			},
			get_font_italic: function () {
				return this.font_italic;
			},
			get_align: function () {
				return this.text_align;
			},
			get_text_decoration: function () {
				return this.text_decoration;
			},
			get_text_line_spacing: function () {
				return this.text_line_spacing;
			},
			get_text_char_spacing: function () {
				return this.text_char_spacing;
			},
			get_color: function (index) {
				return this.colors[index];
			},
			get_color_count: function () {
				return this.colors.length;
			},
			get_color_index_selected: function () {
				return this.color_index_selected;
			},
			get_position: function () {
				return this.position;
			},
			get_size: function () {
				return this.size;
			},
			is_selected: function () {
				return this.selected;
			},

			get_formatter_text: function (text, formatters) {
				return TextFormatter.get_raw(text, formatters);
			},
			escape_text: function (text) {
				return text.trim().replace(/\\/g, "\\\\");
			},
			load_from_state: function (state, text) {
				this.set_annotation_rect(state.rect.x, state.rect.y, state.rect.width, state.rect.height);

				this.set_font(state.font);
				this.set_font_bold(state.bold);
				this.set_font_italic(state.italic);

				this.set_font_size(state.font_size);

				this.set_align(state.align);

				this.set_color(0, state.colors[0]);
				this.set_color(1, state.colors[1]);
				this.set_color(2, state.colors[2]);
				this.set_text_decoration(state.text_decoration);

				this.set_text_line_spacing(state.line_spacing);
				this.set_text_char_spacing(state.char_spacing);

				// Update text
				if (state.text !== null) text = state.text;
				//this.set_text(text);
				this.text_display = text;
				this.text_formatters = state.formatters;
				if (this.nodes.edit !== null) {
					this.text = this.get_formatter_text(this.text_display, this.text_formatters);
					this.nodes.edit.text.value = this.text;
				}
				this.apply_text();
			},

			align_to_classes: function (align) {
				var classes = [],
					s, a;

				a = (align & Annotation.AlignHorizontal);
				if (a === Annotation.AlignJustify) {
					s = "justify";
				}
				else if (a === Annotation.AlignLeft) {
					s = "left";
				}
				else if (a === Annotation.AlignRight) {
					s = "right";
				}
				else { // if (a === Annotation.AlignCenter) {
					s = "center";
				}
				classes.push("iex_annotation_align_" + s);

				a = (align & Annotation.AlignVertical);
				if (a === Annotation.AlignTop) {
					s = "top";
				}
				else if (a === Annotation.AlignBottom) {
					s = "bottom";
				}
				else { // if (a === Annotation.AlignMiddle) {
					s = "middle";
				}
				classes.push("iex_annotation_valign_" + s);

				if ((align & Annotation.AlignHOverflow) !== 0) {
					classes.push("iex_annotation_align_x");
				}
				if ((align & Annotation.AlignVOverflow) !== 0) {
					classes.push("iex_annotation_valign_x");
				}

				return classes;
			},
			align_to_classes_and_strings: function (align) {
				var classes = [],
					strings = [],
					s, a;

				a = (align & Annotation.AlignHorizontal);
				if (a === Annotation.AlignJustify) {
					s = "justify";
				}
				else if (a === Annotation.AlignLeft) {
					s = "left";
				}
				else if (a === Annotation.AlignRight) {
					s = "right";
				}
				else { // if (a === Annotation.AlignCenter) {
					s = "center";
				}
				strings.push(s);
				classes.push("iex_annotation_align_" + s);

				a = (align & Annotation.AlignVertical);
				if (a === Annotation.AlignTop) {
					s = "top";
				}
				else if (a === Annotation.AlignBottom) {
					s = "bottom";
				}
				else { // if (a === Annotation.AlignMiddle) {
					s = "middle";
				}
				strings.push(s);
				classes.push("iex_annotation_valign_" + s);

				if ((align & Annotation.AlignHOverflow) !== 0) {
					classes.push("iex_annotation_align_x");
				}
				if ((align & Annotation.AlignVOverflow) !== 0) {
					classes.push("iex_annotation_valign_x");
				}

				return [ classes , strings ];
			},
			decoration_to_shadow_style: function (decoration, color) {
				var s = "";

				if (decoration === Annotation.TextDecorationShadow) {
					s = "0.0625em 0.0625em 0 " + color;
				}
				else if (decoration === Annotation.TextDecorationShadowBlur) {
					s = "0 0 0.0625em " + color;
					s += "," + s;
				}
				else if (decoration === Annotation.TextDecorationShadowBlurStrong) {
					s = "0 0 0.125em " + color;
					s += "," + s;
					s += "," + s;
				}

				return s;
			},
			apply_text: function () {
				var container = this.nodes.annotation.text,
					pos = 0,
					pos_last = -1,
					bold = false,
					italic = false,
					decoration = -1,
					colors = [ -1, -1, -1 ],
					self = this,
					i, j, f, s, type, i_max;

				var add_node = function (text) {
					if (text.length === 0) return;

					var n = $("span"),
						c = "",
						d;

					n.textContent = text;
					if (bold) {
						c = "iex_annotation_format_bold";
						if (italic) c += " iex_annotation_format_italic";
						n.className = c;
					}
					else if (italic) {
						n.className = "iex_annotation_format_italic";
					}
					if (colors[0] >= 0) {
						n.style.color = "#" + Annotation.colors[colors[0]];
					}
					if (colors[2] >= 0) {
						n.style.backgroundColor = "#" + Annotation.colors[colors[2]];
					}
					if (colors[1] >= 0) {
						if ((d = decoration) >= 0 || (d = self.text_decoration) > 0) {
							c = self.decoration_to_shadow_style(d, "#" + Annotation.colors[colors[1]]);
							if (c.length === 0) c = "none";
							n.style.textShadow = c;
						}
					}
					else if (decoration >= 0) {
						c = self.decoration_to_shadow_style(decoration, "#" + Annotation.colors[self.colors[1]]);
						if (c.length === 0) c = "none";
						n.style.textShadow = c;
					}

					container.appendChild(n);
				};

				// Clear
				container.textContent = "";

				// Add content
				i_max = this.text_formatters.length;
				for (i = 0; i < i_max; ++i) {
					f = this.text_formatters[i];
					type = f[0];

					s = this.text_display.substr(pos, f[1] - pos);
					pos = f[1];

					if (type === Annotation.TextFormattingBold) {
						add_node(s);
						bold = !bold;
					}
					else if (type === Annotation.TextFormattingItalic) {
						add_node( s);
						italic = !italic;
					}
					else if (type === Annotation.TextFormattingNewline) {
						add_node(s);
						container.appendChild($("br"));
						++pos;
						pos_last = pos;
					}
					else if (type === Annotation.TextFormattingHyphen) {
						s += "-";
						add_node(s);
						container.appendChild($("br"));
					}
					else if (type === Annotation.TextFormattingColor) {
						add_node(s);
						j = f[2];
						if (j >= colors.length) {
							for (j = 0; j < colors.length; ++j) colors[j] = -1;
						}
						else {
							colors[j] = f[3];
						}
					}
					else if (type === Annotation.TextFormattingDecoration) {
						add_node(s);
						decoration = f[2];
					}
					else if (type === Annotation.TextFormattingDecorationReset) {
						add_node(s);
						decoration = -1;
					}
					else { // if (type === Annotation.TextFormattingReset) {
						add_node(s);
						for (j = 0; j < colors.length; ++j) colors[j] = -1;
						bold = false;
						italic = false;
						decoration = -1;
					}
				}

				// Last
				s = this.text_display.substr(pos);
				add_node(s);
			},

			destroy: function () {
				this.remove_nodes();

				remove_event_listeners(this.events);
				this.events = [];
			},
			remove_nodes: function () {
				var n;

				// Deselect
				if (this.is_selected()) this.set_selected(false);

				// Stop events
				if (this.edit_data !== null && this.edit_data.move_events.length > 0) {
					this.on_annotation_move_document_mouseup(null);
				}

				// Remove nodes
				if ((n = this.nodes.annotation.container).parentNode !== null) {
					n.parentNode.removeChild(n);
				}
				if (this.nodes.edit !== null) {
					if ((n = this.nodes.edit.container).parentNode !== null) {
						n.parentNode.removeChild(n);
					}
				}
			},
			insert_before: function (annotation) {
				var n = this.nodes.annotation.container,
					n_o = annotation.nodes.annotation.container;

				n_o.parentNode.insertBefore(n, n_o);

				if (this.nodes.edit !== null && annotation.nodes.edit !== null) {
					n = this.nodes.edit.container;
					n_o = annotation.nodes.edit.container;
					n_o.parentNode.insertBefore(n, n_o);
				}
			},
			add_to: function (annotation_container, edit_container) {
				var n = this.nodes.annotation.container;
				annotation_container.appendChild(n);

				if (this.nodes.edit !== null && edit_container !== undefined) {
					n = this.nodes.edit.container;
					edit_container.appendChild(n);
				}
			},

			create_nodes: function (edit) {
				// Edit
				if (edit) {
					this.nodes.edit = {};
					this.create_nodes_edit();
				}

				// Annotation
				this.nodes.annotation = {};
				this.create_nodes_annotation(edit);


				// Setup
				this.update_annotation_rect();
				this.set_align(this.text_align);
				this.set_color(0, this.colors[0]);
				this.set_color(1, this.colors[1]);
				this.set_color(2, this.colors[2]);
				this.set_font(this.font_index);
				this.set_font_size(this.font_size_index);
				this.set_text_line_spacing(this.text_line_spacing);
				this.set_text_char_spacing(this.text_char_spacing);
			},
			create_nodes_annotation: function (edit) {
				var n1, n2, n3, n4, borders, i;

				n1 = $.div("iex_annotation");
				this.nodes.annotation.container = n1;
				if (edit) {
					style.add_class(n1, "iex_annotation_editing");
					add_event_listener(this.events, n1, "mousedown", this.on_annotation_mousedown.bind(this), false);
					add_event_listener(this.events, n1, "mouseover", wrap_mouseenterleave_event(this, this.on_annotation_mouseover), false);
					add_event_listener(this.events, n1, "mouseout", wrap_mouseenterleave_event(this, this.on_annotation_mouseout), false);
				}
				else {
					add_event_listener(this.events, n1, "mousedown", this.on_annotation_mousedown_no_edit.bind(this), false);
				}

				if (Annotation.scaling_mode_px) {
					style.add_class(n1, "iex_annotation_scaling_px");
				}
				if (settings.values.annotations.transparent_until_hover) {
					style.add_class(n1, "iex_annotation_transparent");
				}

				n2 = $.div("iex_annotation_borders");
				n1.appendChild(n2);

				if (edit) {
					borders = [ "top", "bottom", "left", "right", "top_left", "top_right", "bottom_left", "bottom_right" ];
					for (i = 0; i < borders.length; ++i) {
						n3 = $.div("iex_annotation_border iex_annotation_border_" + borders[i]);
						n2.appendChild(n3);
						add_event_listener(this.events, n3, "mousedown", this.on_annotation_resize_mousedown.bind(this, i), false);
					}
				}

				n2 = $.div("iex_annotation_background");
				n1.appendChild(n2);
				this.nodes.annotation.background = n2;
				n2.style.borderColor = "#" + Annotation.colors[this.colors[2]];


				n2 = $.div("iex_annotation_outline");
				n1.appendChild(n2);
				this.nodes.annotation.border1 = n2;
				n2.style.borderColor = "#" + Annotation.colors[this.colors[0]];


				n2 = $.div("iex_annotation_content");
				n1.appendChild(n2);
				if (edit) {
					add_event_listener(this.events, n2, "mousedown", this.on_annotation_move_mousedown.bind(this), false);
					add_event_listener(this.events, n2, "contextmenu", this.on_annotation_contextmenu.bind(this), false);
					add_event_listener(this.events, n2, "dblclick", this.on_annotation_dblclick.bind(this), false);
				}
				this.nodes.annotation.content = n2;

				n3 = $.div("iex_annotation_content2");
				n2.appendChild(n3);

				n4 = $.div("iex_annotation_content3");
				n3.appendChild(n4);
				this.nodes.annotation.text = n4;
			},

			on_annotation_mousedown_no_edit: function (event) {
				//event.preventDefault();
			},
/*<feature:annotation-editor>*/
			create_nodes_edit: function () {
				var n1, n2, n3, n4, n5;

				n1 = $.div("iex_ae_annotation_editor");
				this.nodes.edit.container = n1;
				add_event_listener(this.events, n1, "mousedown", this.on_edit_region_mousedown.bind(this), false);


				// Info bar
				n2 = $.div("iex_ae_annotation_editor_top");
				n1.appendChild(n2);

				n3 = $.div("iex_ae_annotation_editor_top_row");
				n2.appendChild(n3);

				n4 = $.div("iex_ae_annotation_editor_top_cell");
				n3.appendChild(n4);

				n5 = $.div("iex_ae_annotation_editor_number");
				n4.appendChild(n5);
				n5.textContent = "#" + (this.index + 1);
				this.nodes.edit.index_text = n5;


				n4 = $.div("iex_ae_annotation_editor_top_cell");
				n3.appendChild(n4);

				n5 = this.create_button_alignment();
				n4.appendChild(n5);
				add_event_listener(this.events, n5, "click", this.on_edit_align_click.bind(this), false);
				add_event_listener(this.events, n5, "mousedown", this.on_edit_button_mousedown.bind(this), false);
				this.nodes.edit.button_align = n5;

				n5 = this.create_button_color();
				n4.appendChild(n5);
				add_event_listener(this.events, n5, "click", this.on_edit_color_click.bind(this), false);
				add_event_listener(this.events, n5, "mousedown", this.on_edit_button_mousedown.bind(this), false);
				this.nodes.edit.button_color = n5;

				n5 = this.create_button("A");
				n4.appendChild(n5);
				add_event_listener(this.events, n5, "click", this.on_edit_font_click.bind(this), false);
				add_event_listener(this.events, n5, "mousedown", this.on_edit_button_mousedown.bind(this), false);
				n5.setAttribute("title", "Font");
				this.nodes.edit.button_font = n5;

				n5 = this.create_button("", "iex_ae_annotation_button_small_text");
				n4.appendChild(n5);
				add_event_listener(this.events, n5, "click", this.on_edit_font_size_click.bind(this), false);
				add_event_listener(this.events, n5, "mousedown", this.on_edit_button_mousedown.bind(this), false);
				n5.setAttribute("title", "Font size");
				this.nodes.edit.button_font_size = n5;
				this.nodes.edit.button_font_size_text = n5.firstChild;

				n5 = this.create_button("\u2191");
				n4.appendChild(n5);
				add_event_listener(this.events, n5, "click", this.on_edit_move_up_click.bind(this), false);
				add_event_listener(this.events, n5, "mousedown", this.on_edit_button_mousedown.bind(this), false);
				n5.setAttribute("title", "Move up");
				this.nodes.edit.button_move_up = n5;

				n5 = this.create_button("\u2193");
				n4.appendChild(n5);
				add_event_listener(this.events, n5, "click", this.on_edit_move_down_click.bind(this), false);
				add_event_listener(this.events, n5, "mousedown", this.on_edit_button_mousedown.bind(this), false);
				n5.setAttribute("title", "Move down");
				this.nodes.edit.button_move_down = n5;

				n5 = this.create_button("\u00D7");
				n4.appendChild(n5);
				add_event_listener(this.events, n5, "click", this.on_edit_remove_click.bind(this), false);
				add_event_listener(this.events, n5, "mousedown", this.on_edit_button_mousedown.bind(this), false);
				n5.setAttribute("title", "Remove");
				this.nodes.edit.button_remove = n5;


				// Input
				n2 = $.div("iex_ae_annotation_editor_bottom");
				n1.appendChild(n2);

				n3 = $.input.text("iex_ae_annotation_editor_input_text");
				n2.appendChild(n3);
				n3.setAttribute("placeholder", "annotation");
				n3.style.width = "100%";
				n3.style.boxSizing = "border-box";
				add_event_listener(this.events, n3, "input", this.on_edit_text_input.bind(this), false);
				add_event_listener(this.events, n3, "change", this.on_edit_text_change.bind(this), false);
				add_event_listener(this.events, n3, "focus", this.on_edit_text_focus.bind(this), false);
				this.nodes.edit.text = n3;
			},
			create_button: function (text, extra_class) {
				var n1, n2, cls;

				cls = "iex_ae_annotation_button";
				if (extra_class) {
					cls += " ";
					cls += extra_class;
				}

				n1 = $.span(cls);
				n2 = $.span("iex_ae_annotation_button_inner");
				n1.appendChild(n2);
				n2.textContent = text;

				return n1;
			},
			create_button_color: function () {
				var n1, n2, n3;

				n1 = $.span("iex_ae_annotation_button iex_ae_annotation_button_small_text");
				n2 = $.span("iex_ae_annotation_button_inner iex_ae_annotation_button_inner_color");
				n1.appendChild(n2);
				n3 = $.span("iex_ae_annotation_button_color");
				n2.appendChild(n3);

				n2 = $.span("iex_ae_annotation_button_inner iex_ae_annotation_button_color_text");
				n2.textContent = "txt";
				n1.appendChild(n2);

				this.nodes.edit.button_color_bg = n3;
				this.nodes.edit.button_color_text = n2;
				n1.setAttribute("title", "Color");

				return n1;
			},
			create_button_alignment: function () {
				var n1, n2;

				n1 = $.span("iex_ae_annotation_button iex_ae_annotation_button_align");
				n2 = $.span("iex_ae_annotation_button_inner");
				n1.appendChild(n2);
				n1.setAttribute("title", "Alignment");

				return n1;
			},

			initialize_move: function (mode, event) {
				this.edit_data.move_mode = mode;
				this.edit_data.move_origin[0] = event.clientX;
				this.edit_data.move_origin[1] = event.clientY;
				this.edit_data.move_position[0] = this.position[0];
				this.edit_data.move_position[1] = this.position[1];
				this.edit_data.move_size[0] = this.size[0];
				this.edit_data.move_size[1] = this.size[1];

				remove_event_listeners(this.edit_data.move_events);
				this.edit_data.move_events = [];
				add_event_listener(this.edit_data.move_events, document, "mousemove", this.on_annotation_move_document_mousemove.bind(this), true);
				add_event_listener(this.edit_data.move_events, document, "mouseup", this.on_annotation_move_document_mouseup.bind(this), true);
			},

			scroll_to_editor: function () {
				var scroll_region = this.nodes.edit.container.parentNode,
					scroll_container = scroll_region.parentNode,
					check = this.nodes.edit.text,
					bound = this.nodes.edit.container,
					r1 = style.get_object_rect_relative(check),
					r2 = style.get_object_rect_relative(scroll_container);

				if (r1.top < r2.top) {
					r1 = style.get_object_rect_relative(bound);
					r2 = style.get_object_rect_relative(scroll_region);
					scroll_container.scrollTop = r1.top - r2.top;
				}
				else if (r1.bottom > r2.bottom) {
					r1 = style.get_object_rect_relative(bound);
					scroll_container.scrollTop = r1.bottom - style.get_object_rect_relative(scroll_region).top - r2.height;
				}
			},
			select_text: function (target, event) {
				this.scroll_to_editor();

				var ret = true,
					active_change = (document.activeElement !== this.nodes.edit.text);

				if (target !== this.nodes.edit.text) {
					if (active_change) {
						select_input(this.nodes.edit.text, this.nodes.edit.text.value.length || 0);
					}
					ret = false;
				}

				if (event && !this.is_selected()) {
					this.trigger("select");
				}
				return ret;
			},

			on_edit_button_mousedown: function (event) {
				return stop_event(event);
			},
			on_edit_align_click: function (event) {
				this.trigger("align");
			},
			on_edit_color_click: function (event) {
				this.trigger("color");
			},
			on_edit_font_click: function (event) {
				this.trigger("font");
			},
			on_edit_font_size_click: function (event) {
				this.trigger("font_size");
			},
			on_edit_move_up_click: function (event) {
				this.trigger("move_up");
			},
			on_edit_move_down_click: function (event) {
				this.trigger("move_down");
			},
			on_edit_remove_click: function (event) {
				this.trigger("remove");
			},
			on_edit_region_mousedown: function (event) {
				if (this.select_text(event.target, true)) return true;
				return true;//stop_event(event);
			},
			on_edit_text_input: function (event) {
				this.set_text(this.nodes.edit.text.value, true);
				this.trigger("text_input");
			},
			on_edit_text_change: function (event) {
				this.set_text(this.nodes.edit.text.value, false);
				this.trigger("text_change");
			},
			on_edit_text_focus: function (event) {
				if (!this.is_selected()) {
					this.trigger("select");
				}
			},

			on_annotation_mousedown: function (event) {
				this.edit_data.double_click_ignore = false;

				if (get_event_mouse_button(event) === 2) return;

				event.stopPropagation();
			},
			on_annotation_mouseover: function (event) {
			},
			on_annotation_mouseout: function (event) {
			},
			on_annotation_contextmenu: function (event) {
				event.stopPropagation();
			},
			on_annotation_resize_mousedown: function (index, event) {
				if (get_event_mouse_button(event) !== 1) return;

				var resize_dir;
				if (index < 4) {
					resize_dir = (1 << index);
				}
				else {
					resize_dir = (index < 6) ? Annotation.ResizeNorth : Annotation.ResizeSouth;
					resize_dir |= ((index % 2) === 0) ? Annotation.ResizeWest : Annotation.ResizeEast;
				}

				// Move
				this.initialize_move(resize_dir, event);
				return stop_event(event);
			},
			on_annotation_move_mousedown: function (event) {
				this.edit_data.double_click_ignore = false;

				var button = get_event_mouse_button(event);
				if (button === 2) return;
				if (button !== 1) return stop_event(event);

				// Move
				this.initialize_move(0, event);
				if (this.select_text(null, true)) return true;
				return stop_event(event);
			},
			on_annotation_dblclick: function (event) {
				if (!this.edit_data.double_click_ignore) {
					this.auto_size();
				}
				this.edit_data.double_click_ignore = false;

				return stop_event(event);
			},

			on_annotation_move_document_mousemove: function (event) {
				this.edit_data.double_click_ignore = true;

				var scale = this.parent.get_image_scale(),
					image_size = this.parent.get_image_size(),
					xo = (event.clientX - this.edit_data.move_origin[0]) / scale,
					yo = (event.clientY - this.edit_data.move_origin[1]) / scale,
					x = this.edit_data.move_position[0],
					y = this.edit_data.move_position[1],
					w = this.edit_data.move_size[0],
					h = this.edit_data.move_size[1];

				if (this.edit_data.move_mode === 0) {
					// Move
					x = Math.round(x + xo);
					y = Math.round(y + yo);

					// Limit
					if (x + w > image_size.width) {
						x = image_size.width - w;
					}
					if (y + h > image_size.height) {
						y = image_size.height - h;
					}

					if (x < 0) x = 0;
					if (y < 0) y = 0;
				}
				else {
					if ((this.edit_data.move_mode & Annotation.ResizeWest) !== 0) {
						// Change x and width
						x = Math.round(x + xo);
						w = Math.round(w + (this.edit_data.move_position[0] - x));
						if (x < 0) {
							w += x;
							x = 0;
						}
						if (w < 0) w = 0;
					}
					else if ((this.edit_data.move_mode & Annotation.ResizeEast) !== 0) {
						// Change width
						w = Math.round(w + xo);
						if (x + w > image_size.width) {
							w = image_size.width - x;
						}
						if (w < 0) w = 0;
					}

					if ((this.edit_data.move_mode & Annotation.ResizeNorth) !== 0) {
						// Change y and height
						y = Math.round(y + yo);
						h = Math.round(h + (this.edit_data.move_position[1] - y));
						if (y < 0) {
							h += y;
							y = 0;
						}
						if (h < 0) h = 0;
					}
					else if ((this.edit_data.move_mode & Annotation.ResizeSouth) !== 0) {
						// Change height
						h = Math.round(h + yo);
						if (y + h > image_size.height) {
							h = image_size.height - y;
						}
						if (h < 0) h = 0;
					}
				}

				// Update
				this.set_annotation_rect(x, y, w, h);
				this.trigger("rect_change");
			},
			on_annotation_move_document_mouseup: function (event) {
				remove_event_listeners(this.edit_data.move_events);
				this.edit_data.move_events = [];
				this.trigger("rect_changed");
			},

			trigger: function (event_name, data) {
				this.parent.on_annotation_event(this, event_name, data);
			},
/*</feature:annotation-editor>*/
		};



		Annotation.ResizeNorth = 0x1;
		Annotation.ResizeSouth = 0x2;
		Annotation.ResizeWest = 0x4;
		Annotation.ResizeEast = 0x8;

		Annotation.AlignCenter = 0x0;
		Annotation.AlignLeft = 0x1;
		Annotation.AlignRight = 0x2;
		Annotation.AlignJustify = 0x3;
		Annotation.AlignMiddle = 0x0;
		Annotation.AlignTop = 0x4;
		Annotation.AlignBottom = 0x8;
		Annotation.AlignHOverflow = 0x10;
		Annotation.AlignVOverflow = 0x20;
		Annotation.AlignHorizontal = 0x3;
		Annotation.AlignVertical = 0xC;
		Annotation.AlignDefault = Annotation.AlignCenter | Annotation.AlignMiddle | Annotation.AlignHOverflow | Annotation.AlignVOverflow;

		Annotation.TextDecorationNone = 0x0;
		Annotation.TextDecorationShadow = 0x1;
		Annotation.TextDecorationShadowBlur = 0x2;
		Annotation.TextDecorationShadowBlurStrong = 0x3;
		Annotation.TextDecorationCount = 0x4;

		Annotation.TextFormattingBold = 0x0;
		Annotation.TextFormattingItalic = 0x1;
		Annotation.TextFormattingNewline = 0x2;
		Annotation.TextFormattingHyphen = 0x3;
		Annotation.TextFormattingColor = 0x4;
		Annotation.TextFormattingDecoration = 0x5;
		Annotation.TextFormattingDecorationReset = 0x6;
		Annotation.TextFormattingReset = 0x7;

		Annotation.TextCharSpacingRange = {
			min: -0.5,
			range: 1.5,
			steps: 15,
		};
		Annotation.TextLineSpacingRange = {
			min: 0.0,
			range: 1.5,
			steps: 15,
		};



		Annotation.scaling_mode_px = true;
		Annotation.scaling_mode_units = (Annotation.scaling_mode_px ? "em" : "px");

		Annotation.colors = [ //{
			// dark,  normal,   light
			"000000",           "ffffff", // black and white
			"333333", "808080", "cccccc", // gray
			"5a0707", "e11212", "f3a0a0", // red
			"5a3807", "e18c12", "f3d1a0", // orange
			"544e07", "d4c412", "ede7a0", // yellow
			"2a560c", "6ad91f", "c3efa5", // green
			"0a5648", "19d7b6", "a3efe1", // teal
			"0a4356", "19a8d7", "a3dcef", // lt blue
			"141157", "342cdb", "adaaf0", // blue
			"340a56", "8419d7", "cda3ef", // purple
			"560a43", "d719a8", "efa3dc", // fuchsia
		]; //}
		Annotation.color_shades = 3;

		Annotation.fonts = [{
			name: "Arial",
			css_name: "arial",
			external_name: null,
			external_settings: null,
		}, {
			name: "Wild Words",
			css_name: "iex_wildwords",
			external_name: "ww",
			external_settings: [ "r", "b", "bi" ],
		}];

		Annotation.font_size_settings = {
			base: 8,
			base_step: 1,
			step_duration: 8,
			step_count: 5,
			step_multiplier: 2,
		};

		Annotation.font_size_index_to_size = function (index) {
			var fss = Annotation.font_size_settings;

			if (index < 0) {
				index = 0;
			}
			else if (index >= fss.step_duration * fss.step_count) {
				index = fss.step_duration * fss.step_count - 1;
			}

			var step = Math.floor(index / fss.step_duration),
				step_index = index % fss.step_duration,
				size = fss.base,
				step_size = fss.base_step,
				i;

			for (i = 0; i < step; ++i) {
				size += step_size * fss.step_duration;
				step_size *= fss.step_multiplier;
			}

			size += step_index * step_size;

			return size;
		};
		Annotation.font_size_to_size_info = function (size) {
			var fss = Annotation.font_size_settings,
				base = fss.base,
				step = fss.base_step,
				base_next,
				i, off;

			// Min
			if (size < base) return [ 0 , base ]; // [ index, size ]

			for (i = 0; i < fss.step_count; ++i) {
				base_next = base + step * fss.step_duration;

				if (size < base_next) {
					off = (fss.step_duration - Math.round((base_next - size) / step));
					return [
						i * fss.step_duration + off,
						base + off * step
					];
				}

				step *= fss.step_multiplier;
				base = base_next;
			}

			// Max
			return [ i * fss.step_duration - 1, base - step / fss.step_multiplier ];
		};

		Annotation.char_spacing = {
			from_index: function (index) {
				var index_limit = Annotation.TextCharSpacingRange.steps;

				if (index < 0) {
					index = 0;
				}
				else if (index > index_limit) {
					index = index_limit;
				}

				return Annotation.TextCharSpacingRange.min + Annotation.TextCharSpacingRange.range * (index / index_limit);
			},
			to_index: function (spacing) {
				if (spacing <= Annotation.TextCharSpacingRange.min) return 0;
				if (spacing >= Annotation.TextCharSpacingRange.min + Annotation.TextCharSpacingRange.range) return Annotation.TextCharSpacingRange.steps;

				return Math.round((spacing - Annotation.TextCharSpacingRange.min) / Annotation.TextCharSpacingRange.range * Annotation.TextCharSpacingRange.steps);
			},
		};
		Annotation.line_spacing = {
			from_index: function (index) {
				var index_limit = Annotation.TextLineSpacingRange.steps;

				if (index < 0) {
					index = 0;
				}
				else if (index > index_limit) {
					index = index_limit;
				}

				return Annotation.TextLineSpacingRange.min + Annotation.TextLineSpacingRange.range * (index / index_limit);
			},
			to_index: function (spacing) {
				if (spacing <= Annotation.TextLineSpacingRange.min) return 0;
				if (spacing >= Annotation.TextLineSpacingRange.min + Annotation.TextLineSpacingRange.range) return Annotation.TextLineSpacingRange.steps;

				return Math.round((spacing - Annotation.TextLineSpacingRange.min) / Annotation.TextLineSpacingRange.range * Annotation.TextLineSpacingRange.steps);
			},
		};



		var TextFormatter = function () {
			this.code = "";
			this.before = "";
			this.after = "";

			this.no_spaces = false;
			this.force_update = false;

			this.raw_text = "";
			this.text = "";
			this.formatters = [];

			this.match = null;
			this.match_length = 0;
		};
		TextFormatter.bind = function (fn, args) {
			return function () {
				return fn.apply(this, args);
			};
		};
		TextFormatter.code_simple = function (formatting_code, extra) {
			if (this.before.length > 0 || (this.force_update = (this.after.length > 0))) {
				this.before = " ";
				this.after = "";
				this.text += " ";
			}

			var f = [ formatting_code, this.text.length ];
			if (extra !== undefined) Array.prototype.push.apply(f, extra);
			this.formatters.push(f);

			return true;
		};
		TextFormatter.codes = {
			"\\": function () {
				this.no_spaces = false;

				this.text += this.before;
				this.text += this.code;
				this.text += this.after;

				return true;
			},
			"h": function () {
				this.before = "";
				this.after = "";
				this.formatters.push([ Annotation.TextFormattingHyphen, this.text.length ]);

				return true;
			},
			"n": function () {
				this.before = "";
				this.after = "";
				if (this.text.length > 0 && /^\s/.test(this.text[this.text.length - 1])) {
					// Sequential newlines
					this.text = this.text.substr(0, this.text.length - 1);
				}
				this.formatters.push([ Annotation.TextFormattingNewline, this.text.length ]);
				this.text += " ";

				return true;
			},
			"c": function () {
				var c = 0,
					i, m, p;

				// Invalid check
				if (
					this.after.length > 0 ||
					(m = TextFormatter.re_color.exec(this.raw_text.substr(this.match.index + this.match_length))) === null
				) {
					// Invalid
					return false;
				}

				// Move next
				this.match_length += m[0].length;
				p = this.match.index + this.match_length;

				// Whitespace
				if (this.before.length > 0) this.text += " ";

				// Color index
				if (m[1] !== undefined) {
					c = Math.min(parseInt(m[1], 10), 2);
					if (c > 0) {
						this.code += c;
						this.code += ".";
					}
				}

				// Color
				i = Math.min(parseInt(m[2], 10), Annotation.colors.length - 1);
				this.code += i;
				if (p < this.raw_text.length && TextFormatter.re_number.test(this.raw_text[p])) this.code += ":";

				// Formatting
				this.formatters.push([ Annotation.TextFormattingColor, this.text.length, c, i ]);
				this.force_update = true;
				return true;
			},
			"d": function () {
				var i, m;

				// Invalid check
				if (
					this.after.length > 0 ||
					(m = TextFormatter.re_number.exec(this.raw_text.substr(this.match.index + this.match_length))) === null
				) {
					// Invalid
					return false;
				}

				// Move next
				this.match_length += m[0].length;

				// Whitespace
				if (this.before.length > 0) this.text += " ";

				// Decoration
				i = Math.min(parseInt(m[0], 10), Annotation.TextDecorationCount - 1);
				this.code += i;

				// Formatting
				this.formatters.push([ Annotation.TextFormattingDecoration, this.text.length, i ]);
				this.force_update = true;
				return true;
			},
			"b": TextFormatter.bind(TextFormatter.code_simple, [ Annotation.TextFormattingBold ]),
			"i": TextFormatter.bind(TextFormatter.code_simple, [ Annotation.TextFormattingItalic ]),
			"C": TextFormatter.bind(TextFormatter.code_simple, [ Annotation.TextFormattingColor, [ 3 ] ]),
			"D": TextFormatter.bind(TextFormatter.code_simple, [ Annotation.TextFormattingDecorationReset ]),
			"R": TextFormatter.bind(TextFormatter.code_simple, [ Annotation.TextFormattingReset ]),
		};
		TextFormatter.re_formatter = /(?:(\s*)\\([\w\W])(\s*))/g;
		TextFormatter.re_color = /^(?:([0-9])\.)?([0-9]+):?/;
		TextFormatter.re_number = /^[0-9]/;
		TextFormatter.re_space = /^\s/;
		TextFormatter.MaxTextFormatters = 127; // (2^(2^3 - 1) - 1) where 3 is TagWriter.bits_per.formatter_count_bits

		TextFormatter.get_raw = function (text, formatters) {
			var raw_text = "",
				pos = 0,
				i, f, s, type;

			// Add content
			for (i = 0; i < formatters.length; ++i) {
				f = formatters[i];
				type = f[0];

				s = text.substr(pos, f[1] - pos);
				pos = f[1];

				raw_text += s.replace(/\\/g, "\\\\");
				if (type === Annotation.TextFormattingBold) {
					raw_text += "\\b";
				}
				else if (type === Annotation.TextFormattingItalic) {
					raw_text += "\\i";
				}
				else if (type === Annotation.TextFormattingNewline) {
					if (raw_text.length > 0 && TextFormatter.re_space.test(raw_text[raw_text.length - 1])) {
						raw_text = raw_text.substr(0, raw_text.length - 1); // multiple newlines
					}
					raw_text += "\\n";
					if (text.length > pos && TextFormatter.re_space.test(text[pos])) {
						++pos; // whitespace
					}
				}
				else if (type === Annotation.TextFormattingHyphen) {
					raw_text += "\\h";
				}
				else if (type === Annotation.TextFormattingColor) {
					if (f[2] >= 3) { // colors.length) {
						raw_text += "\\C";
					}
					else {
						raw_text += "\\c";
						if (f[2] > 0) {
							raw_text += f[2];
							raw_text += ".";
						}
						raw_text += f[3];
						if (text.length > pos && TextFormatter.re_number.test(text[pos])) {
							raw_text += ":"; // optional
						}
					}
				}
				else if (type === Annotation.TextFormattingDecoration) {
					raw_text += "\\d1";
				}
				else if (type === Annotation.TextFormattingDecorationReset) {
					raw_text += "\\D";
				}
				else { // if (type === Annotation.TextFormattingReset) {
					raw_text += "\\R";
				}
			}

			// Last
			raw_text += text.substr(pos).replace(/\\/g, "\\\\");
			return raw_text;
		};
		TextFormatter.normalize_text = function (text) {
			return text.trim().replace(/\t\s*| \s+/g, " ");
		};

		TextFormatter.prototype = {
			constructor: TextFormatter,

			parse: function (text) {
				var i = 0,
					fn, match_text;

				this.no_spaces = false;
				this.raw_text = TextFormatter.normalize_text(text);

				TextFormatter.re_formatter.lastIndex = 0;
				while ((this.match = TextFormatter.re_formatter.exec(this.raw_text)) !== null) {
					// Setup
					this.code = this.match[2]; // char
					this.before = this.match[1]; // before
					this.after = this.match[3]; // after

					this.text += this.raw_text.substr(i, this.match.index - i);

					this.match_length = this.match[0].length;


					// Process
					fn = TextFormatter.codes[this.code];
					if (fn === undefined || !fn.call(this)) {
						// Invalid
						this.no_spaces = false;
						this.text += this.match[0];
					}
					else {
						// Don't overflow
						if (this.formatters.length > TextFormatter.MaxTextFormatters) {
							this.formatters.splice(TextFormatter.MaxTextFormatters, this.formatters.length - TextFormatter.MaxTextFormatters);
						}
					}


					// Remove extra spaces between things like " \b \i \b \i " (turns into " \b\i\b\i")
					if (this.no_spaces && this.match.index === i) {
						this.before = "";
						this.after = "";
					}
					this.no_spaces = (this.match[1].length + this.match[3].length > 0);

					// Text update
					match_text = this.before + "\\" + this.code + this.after;
					if (this.force_update || match_text.length !== this.match_length) {
						this.raw_text = this.raw_text.substr(0, this.match.index) + match_text + this.raw_text.substr(this.match.index + this.match_length);
						this.force_update = false;
					}

					// Position update
					i = this.match.index + match_text.length;
					TextFormatter.re_formatter.lastIndex = i;
				}

				// Remainder
				if (i === 0) {
					this.text = this.raw_text;
				}
				else if (i < this.raw_text.length) {
					this.text += this.raw_text.substr(i);
				}
			},
		};

		Annotation.TextFormatter = TextFormatter;



		var State = function () {
			this.rect = {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			};

			this.font = 0;
			this.bold = false;
			this.italic = false;

			this.font_size = 0;

			this.align = 0;

			this.colors = [ 0, 0, 0 ];
			this.text_decoration = 0;

			this.line_spacing = 0;
			this.char_spacing = 0;

			this.formatters = [];

			this.text = null;
		};

		Annotation.State = State;



		return Annotation;

	})();

	// Image annotation control
	var Annotator = (function () {

		// Annotator class
		var Annotator = function () {
			// Get posts
			this.post_queue = null;
			this.post_id_current = -1;
			this.annotation_nodes = {
				container: null,
				overlay: null,
			};
			this.annotation_data = {};
			this.annotations = [];
			this.annotations_active = false;
		};



		// Public functions
		Annotator.prototype = {
			constructor: Annotator,
			start: function (image_hover, file_link) {
				// Get posts
				this.post_queue = Delay.queue(api.get("posts"), on_post_queue_callback.bind(this), 5, 0.125);

				// Bind post acquiring
				api.on("post_add", on_api_post_add.bind(this));
				api.on("post_remove", on_api_post_remove.bind(this));

				// Hover
				image_hover.on("change", on_image_hover_change.bind(this));
				this.on_preview_size_change_bind = null;
				this.on_preview_resize_bind = null;
				this.toggle_hotkey = null;

				// Links
				if (settings.values.annotations.modify_urls) {
					file_link.register_modifier(on_image_link_change.bind(this));
				}
			},
		};



		// Annotation data for a single image
		var AnnotationData = function (data) {
			this.datas = [ data ];
			this.current = 0;
		};



		// Private functions
		var re_annotation_texts = /^(?:|([\w\W]*?)(?:\r\n?|\n))[ \t]*>((?:[^>\r\n][^\r\n]*)?)(\r\n?|\n|$)/;
		var re_annotation = /([ \t]*)(\[iex:a\/([^\]]*)\])\s*$/g;
		var checked_attr = "data-iex-annotation-checked";

		var on_api_post_add = function (post_container) {
			if (post_container.getAttribute(checked_attr) === "true") {
				post_container.setAttribute(checked_attr, "false");
			}

			if (api.post_is_floating_or_embedded(post_container)) {
				// Immediate
				on_post_queue_callback.call(this, post_container);
			}
			else {
				this.post_queue.push(post_container);
			}
		};
		var on_api_post_remove = function (post_container) {
			if (post_container.getAttribute(checked_attr) === "false") {
				this.post_queue.pop(post_container);
			}
		};

		var on_post_queue_callback = function (post_container) {
			var not_processed = !post_container.getAttribute(checked_attr);

			post_container.setAttribute(checked_attr, "true");

			// Process container
			if (not_processed) {
				// Not processed yet
				var tag = null,
					tag_node = null;

				api.post_comment_scan(post_container,
					function (text, pos) {
						re_annotation.lastIndex = pos;
						var m = re_annotation.exec(text),
							i;

						if (m === null) return null;

						i = m.index + m[1].length;

						return [ i , i + m[2].length , m ];
					},
					"a",
					function (node, match) {
						node.className = "iex_annotation_tag";
						tag = match[2][3];
						tag_node = node;
					}
				);

				if (tag !== null) {
					setup_tag.call(this, post_container, tag, tag_node);
				}
			}
			/*else {
				// Already processed
				var tags = api.post_query_selector_all(post_container, "a.iex_annotation_tag"),
					i;
			}*/
		};

		var on_image_hover_change = function (data) {
			var n = data.image_container,
				p_id = (n === null || (n = api.post_get_post_container_from_image_container(n)) === null) ? -1 : api.post_get_id(n);

			if (p_id < 0) {
				if (this.post_id_current >= 0) {
					// Update
					set_current_post.call(this, data.image_hover, data.type, p_id);
				}
			}
			else if (p_id !== this.post_id_current) {
				// Update
				set_current_post.call(this, data.image_hover, data.type, p_id);
			}
		};
		var on_preview_resize = function (image_hover, annotation_container) {
			var mpreview = image_hover.mpreview,
				cpreview = mpreview.cpreview,
				w = mpreview.get_size().width,
				scale = (w > 0 ? (cpreview.size.width / w) : 1.0);

			annotation_container.style.fontSize = scale.toFixed(16) + "px";
		};
		var on_preview_size_change = function (image_hover, annotation_data) {
			var true_size = image_hover.mpreview.get_size(),
				current = annotation_data.datas[annotation_data.current],
				tag_size = current.image;

			if (true_size.width !== tag_size.width || true_size.height !== tag_size.height) {
				// Scale
				var xs = true_size.width / tag_size.width,
					ys = true_size.height / tag_size.height,
					i, r;

				for (i = 0; i < this.annotations.length; ++i) {
					r = current.annotations[i].rect;
					this.annotations[i].set_annotation_rect(
						Math.round(r.x * xs),
						Math.round(r.y * ys),
						Math.round(r.height * xs),
						Math.round(r.width * ys)
					);
				}
			}
		};

		var on_image_link_change = function (node, href) {
			var a = node.getAttribute("data-iex-annotations"),
				post_id, data;

			// Fast mode
			if (a) return href + "#" + a;

			// Get id
			post_id = api.post_get_id_from_node(node);
			data = this.annotation_data[post_id];
			if (data) {
				href += "#";
				href += get_url_extension.call(this, data);
			}
			return href;
		};

		var on_toggle_hotkey = function () {
			var post_id = this.post_id_current,
				annotation_data = this.annotation_data[post_id];

			// Change annotation
			annotation_data.current = ((annotation_data.current + 2) % (annotation_data.datas.length + 1)) - 1;

			// Clear and create
			clear_annotations.call(this, image_hover);
			create_annotations.call(this, image_hover, post_id, annotation_data);
		};

		var setup_tag = function (post_container, tag, tag_node) {
			var target_post_id = api.post_get_id(post_container),
				tr, post_info, file_nodes, post_id, data, texts, i, url_ex, url;

			// Validate tag
			tr = new TagReader();
			if (!tr.read(tag)) {
				return set_tag_error.call(this, tag_node, tr.get_error());
			}

			// Find post reference
			post_info = setup_tag_find_reference_post.call(this, post_container, tr);
			if (post_info[0] === null) {
				return set_tag_error.call(this, tag_node, post_info[2]);
			}

			// Find image
			if ((file_nodes = api.post_get_file_nodes(post_info[0])) === null) {
				// No image
				return set_tag_error.call(this, tag_node, "No image attached to post " + post_info[1]);
			}
			if (file_nodes.link === null || file_nodes.link_thumbnail === null) {
				// Invalid
				return set_tag_error.call(this, tag_node, "Image link and/or thumbnail missing for post " + post_info[1]);
			}

			// Find texts
			texts = setup_tag_find_annotation_texts.call(this, post_container);
			if (texts.length === 0) {
				// No text
				return set_tag_error.call(this, tag_node, "No annotation texts found");
			}

			// Set annotation texts
			if (tr.annotations.length === 0) return; // okay, but no need to do anything

			if (texts.length > tr.annotations.length) {
				texts.splice(tr.annotations.length, texts.length - tr.annotations.length);
			}
			else if (texts.length < tr.annotations.length) {
				tr.annotations.splice(texts.length, tr.annotations.length - texts.length);
			}
			for (i = 0; i < texts.length; ++i) {
				tr.annotations[i].text = texts[i];
			}

			// Set data
			tr.tag = tag;
			post_id = post_info[1];
			if (post_id in this.annotation_data) {
				data = this.annotation_data[post_id];
				data.datas.push(tr);
			}
			else {
				data = new AnnotationData(tr);
				this.annotation_data[post_id] = data;
			}

			// Update links
			url_ex = get_url_extension.call(this, data);
			url = (file_nodes.link.getAttribute("href") || "").replace(/#.*$/, "");

			tag_node.setAttribute("target", "_blank");
			tag_node.setAttribute("href", url + "#!" + url_ex);

			if (settings.values.annotations.modify_urls) {
				update_image_link.call(this, file_nodes.link, url_ex);
				update_image_link.call(this, file_nodes.link_thumbnail, url_ex);
			}

			// Apply annotations if open
			if (this.post_id_current === target_post_id && !this.annotations_active) {
				// Apply annotations
				create_annotations.call(this, image_hover, post_id, data);
			}

			return true;
		};
		var setup_tag_find_annotation_texts = function (post_container) {
			var post_text = api.post_get_comment_text(post_container),
				lines = [],
				m;

			// Find lines
			while ((m = re_annotation_texts.exec(post_text)) !== null) {
				post_text = post_text.substr(m.index + m[0].length);

				lines.push(Annotation.TextFormatter.normalize_text(m[2]));
			}

			// Done
			return lines;
		};
		var setup_tag_find_reference_post = function (post_container, tag_reader) {
			if (tag_reader.image.mode === "post") {
				var post_id = -1,
					comment, links, i, j, n, modval;

				if (
					(comment = api.post_get_comment_container(post_container)) !== null &&
					(links = api.post_get_quotelinks(comment)).length > 0
				) {
					// Find the post number
					if (tag_reader.image.post_number_suffix < 0) {
						for (i = 0; i < links.length; ++i) {
							post_id = api.get_quotelink_target(links[i]);
							n = api.get_post_container_from_id(post_id);
							if (n !== null && api.post_has_file(n)) {
								break;
							}
						}
						if (i >= links.length) {
							// Error
							return [ null, -1, "No post reference with an image found in the comment" ];
						}
					}
					else {
						modval = Math.pow(10, tag_reader.image.post_number_suffix_digits);
						for (i = 0; i < links.length; ++i) {
							j = api.get_quotelink_target(links[i]);
							if ((j % modval) === tag_reader.image.post_number_suffix) {
								post_id = j;
								break;
							}
						}

						if (post_id < 0) {
							// Error
							i = tag_reader.image.post_number_suffix.toString();
							while (i.length < tag_reader.image.post_number_suffix_digits) i = "0" + i;
							return [ null, -1, "No post reference ending in " + i + " found in the comment" ];
						}

						n = api.get_post_container_from_id(post_id);
					}

					// Find the post container from the post number
					if (n === null) {
						// Error
						return [ null, -1, "Post number " + post_id + " could not be found" ];
					}

					return [ n, post_id ];
				}
				else {
					return [ null, -1, "No post references found in the comment" ];
				}
			}

			// Else, assume it's the posted image
			return [ post_container, api.post_get_id(post_container) ];
		};
		var set_tag_error = function (tag_node, error) {
			style.add_class(tag_node, "iex_annotation_tag_error");
			tag_node.setAttribute("title", "Invalid annotation tag: " + error);
			return false;
		};
		var update_image_link = function (node, url_ex) {
			var url = node.getAttribute("href") || "";

			url += (url.indexOf("#") < 0) ? "#!" : "#";
			url += url_ex;

			node.setAttribute("data-iex-annotations", url_ex);
			node.setAttribute("href", url);
		};
		var get_url_extension = function (a_data) {
			var url_ex = "",
				i, j, d;

			for (i = 0; i < a_data.datas.length; ++i) {
				if (i > 0) url_ex += "#";

				d = a_data.datas[i];
				url_ex += "iex:a/" + d.tag;

				d = d.annotations;
				url_ex += "?" + encodeURIComponent(d[0].text);

				for (j = 1; j < d.length; ++j) {
					url_ex += "&";
					url_ex += encodeURIComponent(d[j].text);
				}
			}

			return url_ex;
		};

		var set_current_post = function (image_hover, type, post_id) {
			if (this.annotations_active) {
				clear_annotations.call(this, image_hover);
			}

			this.post_id_current = post_id;

			var d;
			if (type === "image" && (d = this.annotation_data[post_id])) {
				// Check if this post_id has any annotations
				create_annotations.call(this, image_hover, post_id, d);
			}
		};
		var clear_annotations = function (image_hover) {
			this.annotations_active = false;

			if (this.annotation_nodes.overlay !== null) {
				// Remove size event
				image_hover.mpreview.off("resize", this.on_preview_resize_bind);
				image_hover.mpreview.on("size_change", this.on_preview_size_change_bind);
				this.on_preview_resize_bind = null;
				this.on_preview_size_change_bind = null;

				// Remove overlay
				var n = this.annotation_nodes.overlay.parentNode;
				if (n !== null) n.removeChild(this.annotation_nodes.overlay);
				this.annotation_nodes.overlay = null;
				this.annotation_nodes.container = null;

				// Remove annotations
				for (var i = 0; i < this.annotations.length; ++i) {
					this.annotations[i].destroy();
				}
				this.annotations = [];
			}

			// Remove hotkeys
			hotkey_manager.unregister(this.toggle_hotkey);
			this.toggle_hotkey = null;
		};
		var create_annotations = function (image_hover, post_id, annotation_data) {
			var mpreview = image_hover.mpreview,
				cpreview = mpreview.cpreview;

			// Overlay
			this.annotations_active = true;

			if (annotation_data.current >= 0) {
				this.annotation_nodes.overlay = $.div("iex_annotation_overlay");

				this.annotation_nodes.container = $.div("iex_annotation_container");
				this.annotation_nodes.overlay.appendChild(this.annotation_nodes.container);

				this.annotation_nodes.overlay.style.pointerEvents = "none";

				// Create annotations
				create_annotations_from_list.call(this,
					annotation_data.datas[annotation_data.current].annotations,
					this.annotations,
					this.annotation_nodes.container
				);

				// Add
				cpreview.add_content(this.annotation_nodes.overlay);

				// Bind events
				this.on_preview_resize_bind = on_preview_resize.bind(this, image_hover, this.annotation_nodes.container);
				this.on_preview_size_change_bind = on_preview_size_change.bind(this, image_hover, annotation_data);
				mpreview.on("resize", this.on_preview_resize_bind);
				mpreview.on("size_change", this.on_preview_size_change_bind);

				// Trigger size update
				this.on_preview_resize_bind();
				this.on_preview_size_change_bind();
			}

			// Hotkey
			this.toggle_hotkey = hotkey_manager.register(settings.values.annotations.toggle_hotkey, HotkeyManager.MODIFIER_NONE, on_toggle_hotkey.bind(this));
		};

		var create_annotations_from_list = function (list, new_list, target) {
			var i, a;

			for (i = 0; i < list.length; ++i) {
				a = new Annotation(null, null);
				a.load_from_state(list[i], null);
				a.add_to(target, null);
				new_list.push(a);
			}
		};



		// Standalone annotator, for a single image
		var Standalone = function (image_node, annotation_data) {
			// Vars
			this.overlay = $.div("iex_annotation_standalone_overlay");
			this.overlay.style.display = "none";
			this.annotation_data = annotation_data;
			this.image_node = image_node;
			this.annotations = [];
			this.image_size = {
				width: 0,
				height: 0,
				acquired: false,
			};
			this.image_node_rect = null;
			this.secondary_timer = null;
			this.on_secondary_timer_bind = this.on_secondary_timer.bind(this);

			// Image events
			this.image_node.addEventListener("load", this.on_image_load.bind(this), false);
			this.image_node.addEventListener("error", this.on_image_error.bind(this), false);
			this.image_size_poll_interval = setInterval(this.on_image_poll.bind(this), 200);

			// Changes
			window.addEventListener("resize", this.on_window_resize.bind(this), false);
			var ob = new MutationObserver(this.on_image_attribute_change.bind(this));
			ob.observe(this.image_node, { attributes: true });

			// Create annotations
			this.create_annotations();

			// Insert overlay
			var rel = this.image_node.nextSibling;
			if (rel !== null) {
				this.image_node.parentNode.insertBefore(this.overlay, rel);
			}
			else {
				this.image_node.parentNode.appendChild(this.overlay);
			}

			// Start
			this.on_image_poll();
			this.update_position();

			// Hotkey
			this.toggle_hotkey = hotkey_manager.register(settings.values.annotations.toggle_hotkey, HotkeyManager.MODIFIER_NONE, this.toggle.bind(this));
		};
		Standalone.prototype = {
			constructor: Standalone,

			clear_annotations: function () {
				for (var i = 0; i < this.annotations.length; ++i) {
					this.annotations[i].destroy();
				}
				this.annotations = [];
			},
			create_annotations: function () {
				if (this.annotation_data.current < 0) return;

				// Create annotations
				create_annotations_from_list.call(this,
					this.annotation_data.datas[this.annotation_data.current].annotations,
					this.annotations,
					this.overlay
				);
			},
			toggle: function () {
				// Change annotation
				this.annotation_data.current = ((this.annotation_data.current + 2) % (this.annotation_data.datas.length + 1)) - 1;

				// Clear and create
				this.clear_annotations();
				this.create_annotations();
			},

			on_image_load: function () {
				if (!this.image_size.acquired) {
					this.acquire_size();
				}
			},
			on_image_error: function () {
				this.overlay.style.display = "none";
			},
			on_image_poll: function () {
				if (this.image_node.naturalWidth && this.image_node.naturalHeight) {
					this.acquire_size();
				}
			},
			on_window_resize: function () {
				this.update_position();
				if (this.secondary_timer !== null) clearTimeout(this.secondary_timer);
				this.secondary_timer = setTimeout(this.on_secondary_timer_bind, 10);
			},
			on_image_attribute_change: function () {
				this.update_position();
				if (this.secondary_timer !== null) clearTimeout(this.secondary_timer);
				this.secondary_timer = setTimeout(this.on_secondary_timer_bind, 10);
			},
			on_secondary_timer: function () {
				this.secondary_timer = null;
				this.update_position();
			},

			acquire_size: function () {
				this.image_size.width = this.image_node.naturalWidth;
				this.image_size.height = this.image_node.naturalHeight;
				this.image_size.acquired = true;

				this.overlay.style.display = "";

				clearInterval(this.image_size_poll_interval);
				this.image_size_poll_interval = null;

				if (this.image_node_size !== null) {
					this.update_position();
					if (this.secondary_timer !== null) clearTimeout(this.secondary_timer);
					this.secondary_timer = setTimeout(this.on_secondary_timer_bind, 10);
				}
			},
			update_position: function () {
				this.image_node_rect = style.get_object_rect(this.image_node);

				var s = this.overlay.style;
				s.left = (this.image_node_rect.left) + "px";
				s.top = (this.image_node_rect.top) + "px";
				s.width = this.image_node_rect.width + "px";
				s.height = this.image_node_rect.height + "px";

				if (this.image_size.acquired) this.update_size();
			},
			update_size: function () {
				var scale = this.image_node_rect.width / this.image_size.width;
				this.overlay.style.fontSize = scale.toFixed(16) + "px";
			},
		};



		// Annotation tag writer
		var TagWriter = function () {
			this.bit_stream = null;
			this.defaults = null;
			this.bits_per = {
				width: 0,
				height: 0,
				post_number: 0,
				formatter_count: 0,
				formatter_position: 0,
			};
		};

		TagWriter.prototype = {
			constructor: TagWriter,
			write: function (image, annotations, suffix_text) {
				// Setup
				this.bit_stream = new BitStream();
				this.bits_per.width = TagWriter.log2bits(image.size.width);
				this.bits_per.height = TagWriter.log2bits(image.size.height);

				// Header
				this.write_header(image, annotations, suffix_text);

				// Annotations
				if (annotations.length > 0) {
					// Default values
					this.write_annotations_header(annotations);

					// Annotations
					for (var i = 0; i < annotations.length; ++i) {
						this.write_annotation_info(annotations[i]);
					}

					// Clear
					this.defaults = null;
				}

				// CRC
				var crc = crc32(this.bit_stream.encode());
				this.bit_stream.add(crc, 32);

				// Clean
				var s = this.bit_stream.encode();
				this.bit_stream = null;
				return "[iex:a/" + s + "]";
			},
			write_header: function (image, annotations, suffix_text) {
				var bits_per = TagWriter.bits_per;

				this.bit_stream.add(TagWriter.version, bits_per.version); // version
				this.bit_stream.add(annotations.length, bits_per.annotation_count); // number of annotations
				this.bit_stream.add((image.mode === "file" ? 0 : (image.mode === "post" ? 1 : 2)), bits_per.image_mode); // image mode [0=file, 1=post, 2=url]
				if (image.mode === "post") {
					// Find how unique the post number is
					var s = image.extra.toString(),
						refs = TagWriter.get_all_post_references(annotations, suffix_text),
						unique_digits = TagWriter.get_longest_same_end(s, refs);

					if (refs.length <= 1) {
						this.bit_stream.add(0, bits_per.post_number_bits);
					}
					else {
						++unique_digits;
						this.bits_per.post_number = Math.ceil(Math.log(10) / TagWriter.ln2 * unique_digits);

						this.bit_stream.add(this.bits_per.post_number, bits_per.post_number_bits);
						this.bit_stream.add(parseInt(s.substr(s.length - unique_digits), 10), this.bits_per.post_number);
					}
				}
				this.bit_stream.add(this.bits_per.width, bits_per.width_bits); // bits for width
				this.bit_stream.add(this.bits_per.height, bits_per.height_bits); // bits for height
				this.bit_stream.add(image.size.width, this.bits_per.width); // width
				this.bit_stream.add(image.size.height, this.bits_per.height); // height
			},
			write_annotations_header: function (annotations) {
				// Default values
				var bits_per = TagWriter.bits_per,
					i, k, f, v;

				this.defaults = {};
				for (k in TagWriter.defaults_formatters) {
					f = TagWriter.defaults_formatters[k];
					this.defaults[k] = TagWriter.find_most_common(annotations, f[0], f[1]);
				}

				// Write defaults
				this.bit_stream.add(this.defaults.font[0], bits_per.font); // font
				this.bit_stream.add(this.defaults.font[1] ? 1 : 0, bits_per.font_bold); // bold
				this.bit_stream.add(this.defaults.font[2] ? 1 : 0, bits_per.font_italic); // italic

				this.bit_stream.add(this.defaults.font_size, bits_per.font_size); // font size

				this.bit_stream.add(this.defaults.align, bits_per.align); // align

				this.bit_stream.add(this.defaults.color_deco[0], bits_per.color); // color
				this.bit_stream.add(this.defaults.color_deco[1], bits_per.color); // color alt
				this.bit_stream.add(this.defaults.color_deco[2], bits_per.color); // color bg
				this.bit_stream.add(this.defaults.color_deco[3], bits_per.text_decoration); // text decoration

				this.bit_stream.add(this.defaults.spacing[0], bits_per.line_spacing); // line spacing
				this.bit_stream.add(this.defaults.spacing[1], bits_per.char_spacing); // char spacing

				// Bit ranges
				this.bits_per.formatter_count = 0;
				this.bits_per.formatter_position = 0;
				for (i = 0; i < annotations.length; ++i) {
					f = annotations[i].get_text_formatters();
					if (f.length > this.bits_per.formatter_count) this.bits_per.formatter_count = f.length;
					for (k = 0; k < f.length; ++k) {
						v = f[k][1];
						if (v > this.bits_per.formatter_position) this.bits_per.formatter_position = v;
					}
				}
				if (this.bits_per.formatter_count > 0) this.bits_per.formatter_count = TagWriter.log2bits(this.bits_per.formatter_count);
				if (this.bits_per.formatter_position > 0) this.bits_per.formatter_position = TagWriter.log2bits(this.bits_per.formatter_position);

				this.bit_stream.add(this.bits_per.formatter_count, bits_per.formatter_count_bits); // bits per formatter count number
				this.bit_stream.add(this.bits_per.formatter_position, bits_per.formatter_position_bits); // bits per formatter position number
			},
			write_annotation_info: function (annotation) {
				var pos = annotation.get_position(),
					size = annotation.get_size(),
					formatters = annotation.get_text_formatters(),
					bits_per = TagWriter.bits_per,
					i, f;

				// rect
				this.bit_stream.add(pos[0], this.bits_per.width); // x
				this.bit_stream.add(pos[1], this.bits_per.height); // y
				this.bit_stream.add(size[0], this.bits_per.width); // width
				this.bit_stream.add(size[1], this.bits_per.height); // height

				// font/bold/italic
				if (!this.is_default("font", annotation)) {
					this.bit_stream.add(annotation.get_font(), bits_per.font); // font
					this.bit_stream.add(annotation.get_font_bold() ? 1 : 0, bits_per.font_bold); // bold
					this.bit_stream.add(annotation.get_font_italic() ? 1 : 0, bits_per.font_italic); // italic
				}

				// font size
				if (!this.is_default("font_size", annotation)) {
					this.bit_stream.add(annotation.get_font_size(), bits_per.font_size); // font size
				}

				// text align
				if (!this.is_default("align", annotation)) {
					this.bit_stream.add(annotation.get_align(), bits_per.align); // align
				}

				// color / decoration
				if (!this.is_default("color_deco", annotation)) {
					this.bit_stream.add(annotation.get_color(0), bits_per.color); // color
					this.bit_stream.add(annotation.get_color(1), bits_per.color); // color alt
					this.bit_stream.add(annotation.get_color(2), bits_per.color); // color bg
					this.bit_stream.add(annotation.get_text_decoration(), bits_per.text_decoration); // text decoration
				}

				// spacing
				if (!this.is_default("spacing", annotation)) {
					this.bit_stream.add(annotation.get_text_char_spacing(), bits_per.line_spacing); // line spacing
					this.bit_stream.add(annotation.get_text_line_spacing(), bits_per.char_spacing); // char spacing
				}

				// Formatters
				this.bit_stream.add(formatters.length, this.bits_per.formatter_count);
				for (i = 0; i < formatters.length; ++i) {
					f = formatters[i];

					this.bit_stream.add(f[0], bits_per.formatter_type); // formatter
					this.bit_stream.add(f[1], this.bits_per.formatter_position); // position
					if (f[0] === Annotation.TextFormattingColor) {
						this.bit_stream.add(f[2], bits_per.color_index); // color index
						this.bit_stream.add(f[3], bits_per.color); // color
					}
					else if (f[0] === Annotation.TextFormattingDecoration) {
						this.bit_stream.add(f[2], bits_per.text_decoration); // decoration
					}
				}
			},
			is_default: function (key, annotation) {
				var formatter = TagWriter.defaults_formatters[key],
					value = formatter[1](this.defaults[key], formatter[0](annotation));

				this.bit_stream.add(value ? 1 : 0, 1);

				return value;
			},
		};

		TagWriter.get_all_post_references = function (annotations, suffix_text) {
			var posts = [],
				post_map = {},
				re_pattern = />>([1-9][0-9]*)/g,
				i, t;

			for (i = 0; i < annotations.length; ++i) {
				if ((t = annotations[i].get_text_before()) !== null) {
					TagWriter.get_post_references(t, re_pattern, posts, post_map);
				}

				TagWriter.get_post_references(annotations[i].get_text(), re_pattern, posts, post_map);
			}

			if (suffix_text !== null) {
				TagWriter.get_post_references(suffix_text, re_pattern, posts, post_map);
			}

			return posts;
		};
		TagWriter.get_post_references = function (text, re_pattern, posts, post_map) {
			var m;

			while ((m = re_pattern.exec(text)) !== null) {
				m = m[1];
				if (!(m in post_map)) {
					post_map[m] = true;
					posts.push(m);
				}
			}
		};
		TagWriter.get_longest_same_end = function (value, all_values) {
			var length = 0,
				i, j, k, v, j_end;

			for (i = 0; i < all_values.length; ++i) {
				v = all_values[i];
				if (value === v) continue;

				j_end = v.length - Math.min(v.length, value.length);
				j = v.length - 1;
				k = value.length - 1;
				while (j >= j_end && v[j] === value[k]) {
					--j;
					--k;
				}
				j = (v.length - 1) - j;
				if (j > length) length = j;
			}

			return length;
		};
		TagWriter.find_most_common = function (array, formatter, compare_same) {
			var best = [ formatter(array[0]), 1 ],
				values = [ best ],
				i, j, f, v;

			for (i = 1; i < array.length; ++i) {
				f = formatter(array[i]);

				for (j = 0; j < values.length; ++j) {
					v = values[j];
					if (compare_same(f, v[0])) {
						if (++v[1] > best[1]) best = v;
						break;
					}
				}

				if (j >= values.length) {
					values.push([ f , 1 ]);
				}
			}

			return best[0];
		};
		TagWriter.compare_same_arrays = function (a1, a2) {
			for (var i = 0; i < a1.length; ++i) {
				if (a1[i] !== a2[i]) return false;
			}
			return true;
		};
		TagWriter.compare_same_values = function (a1, a2) {
			return (a1 === a2);
		};
		TagWriter.log2bits = function (v) {
			if (v < 1) return 0;
			return Math.floor(Math.log(v) / TagWriter.ln2) + 1;
		};

		TagWriter.ln2 = Math.log(2);
		TagWriter.version = 1;
		TagWriter.version_min = 1;
		TagWriter.bits_per = {
			version: 4,
			annotation_count: 6,
			image_mode: 2,
			post_number_bits: 5,
			width_bits: 4,
			height_bits: 4,
			formatter_count_bits: 3,
			formatter_position_bits: 5,

			font: 2,
			font_size: 5,
			font_bold: 1,
			font_italic: 1,
			text_decoration: 2,
			align: 6,
			color: 5,
			formatter_type: 3,
			color_index: 2,
			line_spacing: 4,
			char_spacing: 4,
		};
		TagWriter.defaults_formatters = {
			font: [
				function (annotation) {
					return [
						annotation.get_font(),
						annotation.get_font_bold(),
						annotation.get_font_italic()
					];
				},
				TagWriter.compare_same_arrays
			],
			color_deco: [
				function (annotation) {
					return [
						annotation.get_color(0),
						annotation.get_color(1),
						annotation.get_color(2),
						annotation.get_text_decoration()
					];
				},
				TagWriter.compare_same_arrays
			],
			font_size: [
				function (annotation) {
					return annotation.get_font_size();
				},
				TagWriter.compare_same_values
			],
			align: [
				function (annotation) {
					return annotation.get_align();
				},
				TagWriter.compare_same_values
			],
			spacing: [
				function (annotation) {
					return [
						annotation.get_text_line_spacing(),
						annotation.get_text_char_spacing()
					];
				},
				TagWriter.compare_same_arrays
			],
		};



		// Annotation tag reader
		var TagReader = function () {
			this.annotation_count = 0;
			this.image = {
				mode: null,
				post_number_suffix: -1,
				post_number_suffix_digits: 0,
				width: 0,
				height: 0,
			};
			this.bits_per = {
				width: 0,
				height: 0,
				formatter_count: 0,
				formatter_position: 0,
			};
			this.annotations = null;

			this.tag = null;
			this.bit_stream = null;
			this.defaults = null;
			this.error_message = null;
		};

		TagReader.prototype = {
			constructor: TagReader,
			read: function (tag, header_validate) {
				this.bit_stream = new BitStream();
				this.bit_stream.decode(BitStream.re_alphabet.exec(tag)[0]);

				// Header
				if (!this.read_header()) return false;
				if (header_validate && !header_validate(this)) return this.error("Invalid header");

				// Annotations
				this.annotations = [];
				if (this.annotation_count > 0) {
					if (this.bit_stream.eof()) return this.error("Invalid stream");

					// Defaults
					if (!this.read_annotations_header()) return false;

					// End of stream
					if (this.bit_stream.eof()) return this.error("Invalid stream");

					// Annotations
					for (var i = 0; true; ) {
						if (!this.read_annotation()) return false;
						if (++i >= this.annotation_count) break;
						if (this.bit_stream.eof()) return this.error("Invalid stream");
					}
				}

				// Get crc
				if (this.bit_stream.remaining() < 32) return this.error("Missing CRC");
				var crc_true = crc32(this.bit_stream.to_encoded_string()),
					crc;

				crc = (this.bit_stream.get(32) >>> 0);
				if (crc_true !== crc) return this.error("CRC invalid");

				// Okay
				return true;
			},
			read_header: function () {
				var bits_per = TagWriter.bits_per,
					v, v2;

				// Version
				v = this.bit_stream.get(bits_per.version);
				if (v < TagWriter.version_min || v > TagWriter.version) return this.error("Invalid version");

				// Number of annotations
				this.annotation_count = this.bit_stream.get(bits_per.annotation_count);

				// Image mode
				v = this.bit_stream.get(bits_per.image_mode);
				if (v === 0) {
					this.image.mode = "file";
				}
				else if (v === 1) {
					// Post
					this.image.mode = "post";
					v = this.bit_stream.get(bits_per.post_number_bits);
					if (v > 0) {
						// Post number suffix
						this.image.post_number_suffix = this.bit_stream.get(v);
						this.image.post_number_suffix_digits = Math.floor(Math.log(v) / Math.log(10));
					}
				}
				else if (v === 2) {
					this.image.mode = "url";
				}
				else if (v > 2) {
					return this.error("Invalid image mode");
				}

				// Resolution
				v = this.bit_stream.get(bits_per.width_bits);
				v2 = this.bit_stream.get(bits_per.height_bits);
				this.bits_per.width = v;
				this.bits_per.height = v2;
				this.image.width = this.bit_stream.get(v);
				this.image.height = this.bit_stream.get(v2);

				return true;
			},
			read_annotations_header: function () {
				var bits_per = TagWriter.bits_per;

				this.defaults = new Annotation.State();

				this.defaults.font = this.bit_stream.get(bits_per.font); // font
				if (this.defaults.font >= Annotation.fonts.length) this.defaults.font = 0;
				this.defaults.bold = (this.bit_stream.get(bits_per.font_bold) === 1); // bold
				this.defaults.italic = (this.bit_stream.get(bits_per.font_italic) === 1); // italic

				this.defaults.font_size = this.bit_stream.get(bits_per.font_size); // font size

				this.defaults.align = this.bit_stream.get(bits_per.align); // align

				this.defaults.colors[0] = this.bit_stream.get(bits_per.color); // color[0]
				this.defaults.colors[1] = this.bit_stream.get(bits_per.color); // color[1]
				this.defaults.colors[2] = this.bit_stream.get(bits_per.color); // color[2]
				this.defaults.text_decoration = this.bit_stream.get(bits_per.text_decoration); // text_decoration

				this.defaults.line_spacing = this.bit_stream.get(bits_per.line_spacing); // line spacing
				this.defaults.char_spacing = this.bit_stream.get(bits_per.char_spacing); // char spacing

				this.bits_per.formatter_count = this.bit_stream.get(bits_per.formatter_count_bits); // bits per formatter count number
				this.bits_per.formatter_position = this.bit_stream.get(bits_per.formatter_position_bits); // bits per formatter position number

				return true;
			},
			read_annotation: function () {
				var bits_per = TagWriter.bits_per,
					annotation = new Annotation.State(),
					formatter_count, i, f;

				// rect
				annotation.rect.x = this.bit_stream.get(this.bits_per.width);
				annotation.rect.y = this.bit_stream.get(this.bits_per.height);
				annotation.rect.width = this.bit_stream.get(this.bits_per.width);
				annotation.rect.height = this.bit_stream.get(this.bits_per.height);
				if (annotation.rect.x > this.image.width) {
					annotation.rect.x = this.image.width;
					annotation.rect.width = 0;
				}
				else if (annotation.rect.x > this.image.width) {
					annotation.rect.width = this.image.width - annotation.rect.x;
				}
				if (annotation.rect.y > this.image.height) {
					annotation.rect.y = this.image.height;
					annotation.rect.height = 0;
				}
				else if (annotation.rect.y > this.image.height) {
					annotation.rect.height = this.image.height - annotation.rect.y;
				}

				// font/bold/italic
				if (this.is_default()) {
					// Default
					annotation.font = this.defaults.font;
					annotation.bold = this.defaults.bold;
					annotation.italic = this.defaults.italic;
				}
				else {
					annotation.font = this.bit_stream.get(bits_per.font);
					annotation.bold = (this.bit_stream.get(bits_per.font_bold) === 1);
					annotation.italic = (this.bit_stream.get(bits_per.font_italic) === 1);

					if (annotation.font >= Annotation.fonts.length) annotation.font = 0;
				}

				// font size
				if (this.is_default()) {
					// Default
					annotation.font_size = this.defaults.font_size;
				}
				else {
					annotation.font_size = this.bit_stream.get(bits_per.font_size);
				}

				// text align
				if (this.is_default()) {
					// Default
					annotation.align = this.defaults.align;
				}
				else {
					annotation.align = this.bit_stream.get(bits_per.align);
				}

				// color / decoration
				if (this.is_default()) {
					// Default
					annotation.colors[0] = this.defaults.colors[0];
					annotation.colors[1] = this.defaults.colors[1];
					annotation.colors[2] = this.defaults.colors[2];
					annotation.text_decoration = this.defaults.text_decoration;
				}
				else {
					annotation.colors[0] = this.bit_stream.get(bits_per.color);
					annotation.colors[1] = this.bit_stream.get(bits_per.color);
					annotation.colors[2] = this.bit_stream.get(bits_per.color);
					annotation.text_decoration = this.bit_stream.get(bits_per.text_decoration);
				}

				// spacing
				if (this.is_default()) {
					// Default
					annotation.line_spacing = this.defaults.line_spacing;
					annotation.char_spacing = this.defaults.char_spacing;
				}
				else {
					annotation.line_spacing = this.bit_stream.get(bits_per.line_spacing);
					annotation.char_spacing = this.bit_stream.get(bits_per.char_spacing);
				}

				// Formatters
				formatter_count = this.bit_stream.get(this.bits_per.formatter_count);
				for (i = 0; i < formatter_count; ++i) {
					f = [];
					f.push(this.bit_stream.get(bits_per.formatter_type));
					f.push(this.bit_stream.get(this.bits_per.formatter_position));
					if (f[0] === Annotation.TextFormattingColor) {
						f.push(this.bit_stream.get(bits_per.color_index));
						f.push(this.bit_stream.get(bits_per.color));
					}
					else if (f[0] === Annotation.TextFormattingDecoration) {
						f.push(this.bit_stream.get(bits_per.text_decoration));
					}
					annotation.formatters.push(f);
				}

				// Done
				this.annotations.push(annotation);
				return true;
			},
			is_default: function () {
				return (this.bit_stream.get(1) === 1);
			},
			error: function (message) {
				this.defaults = null;
				this.annotations = null;
				this.error_message = message;
				return false;
			},
			clear: function () {
				this.defaults = null;
				this.annotations = null;
				this.bit_stream = null;
				this.error_message = null;
			},
			get_error: function () {
				return this.error_message;
			},
		};



		// Static functions
		Annotator.create_image_overlay = function (image_node, annotation_data) {
			new Standalone(image_node, annotation_data);
		};
		Annotator.check_url = function () {
			var hash = window.location.href,
				p = hash.indexOf("#"),
				ret = null,
				re, m, i, tag, lines, tr;

			if (p < 0) return null;
			hash = hash.substr(p);

			re = /#!?iex:a\/([^?#]*)(?:\?([^#]*))?/g;
			while ((m = re.exec(hash)) !== null) {
				tag = m[1];
				if (m[2] === undefined) {
					lines = null;
				}
				else {
					lines = m[2].split("&");
					for (i = 0; i < lines.length; ++i) {
						lines[i] = decodeURIComponent(lines[i]);
					}
				}

				tr = new TagReader();
				if (lines.length !== null && tr.read(tag) && tr.annotations.length > 0) {
					if (ret === null) {
						ret = new AnnotationData(tr);
					}
					else {
						ret.datas.push(tr);
					}

					if (tr.annotations.length > lines.length) {
						tr.annotations.splice(lines.length, tr.annotations.length - lines.length);
					}

					for (i = 0; i < tr.annotations.length; ++i) {
						tr.annotations[i].text = lines[i];
					}
				}
			}

			return ret;
		};
		Annotator.process_tag = function (tag, header_validate) {
			var tr = new TagReader();
			if (tr.read(tag, header_validate)) {
				return tr;
			}
			return null;
		};
		Annotator.generate_tag = function (image, annotations, suffix_text) {
			return (new TagWriter()).write(image, annotations, suffix_text);
		};



		return Annotator;

	})();

/*<feature:annotation-editor>*/
	// Quick reply controller
	var QuickReplyController = (function () {

		var QuickReplyController = function () {
			api.on("quick_reply_add", on_quick_reply_add.bind(this));
			api.on("quick_reply_remove", on_quick_reply_remove.bind(this));
			api.on("quick_reply_show", on_quick_reply_show.bind(this));
			api.on("quick_reply_hide", on_quick_reply_hide.bind(this));
			document.addEventListener("QRFile", on_file_4chanx_poll.bind(this), false);
			document.addEventListener("QRPostSuccessful", on_file_post.bind(this), false);

			this.quick_reply_container = null;
			this.quick_reply_events = [];
			this.quick_reply_observers = [];
			this.quick_reply_file_input = null;
			this.quick_reply_comment = null;
			this.quick_reply_comment_text = "";
			this.quick_reply_comment_length = 0;
			this.quick_reply_comment_references = [];
			this.quick_reply_poll_interval = null;
			this.quick_reply_poll_input_timer = null;
			this.nodes = {
				extra_container: null,
				content_container: null,
				enabled_checkbox: null,
				input_file_button: null,
				input_url_button: null,
				input_post_number: null,
				error_message: null,
				fallback_file_input: null,
			};
			this.node_events = [];

			this.enabled = false;
			this.file = null;
			this.file_url = null;
			this.can_directly_use_files = false;
			this.file_poll_error_timeout = null;
			this.editor = null;
			this.force_change_to_file = false;
			this.file_n_submit = null;

			this.mode = "none";
			this.custom_url = null;
			this.post_reference_number = null;
			this.post_reference_number_image = null;
		};



		var on_quick_reply_add = function (node) {
			this.quick_reply_container = node;

			setup_qr_nodes.call(this, node);
			setup_qr_events.call(this, node);

			if (this.editor !== null) {
				this.editor.set_qr_container(node);
			}
		};
		var on_quick_reply_remove = function (node) {
			remove_qr_events.call(this);
			remove_qr_nodes.call(this);

			if (this.editor !== null) {
				this.editor.set_qr_container(null);
			}
		};
		var on_quick_reply_show = function (node) {
			this.set_enabled(settings.values.annotations.editor_always_enable);
			poll_file_4chanx.call(this);

			if (this.quick_reply_comment !== null) {
				if (this.quick_reply_poll_interval !== null) {
					clearInterval(this.quick_reply_poll_interval);
				}

				this.quick_reply_poll_interval = setInterval(on_comment_value_poll.bind(this), 2000);
				on_comment_value_poll.call(this);
			}
		};
		var on_quick_reply_hide = function (node) {
			this.set_enabled(false);

			if (this.quick_reply_poll_interval !== null) {
				clearInterval(this.quick_reply_poll_interval);
				this.quick_reply_poll_interval = null;
			}
			if (this.quick_reply_poll_input_timer !== null) {
				clearTimeout(this.quick_reply_poll_input_timer);
				this.quick_reply_poll_input_timer = null;
			}
			this.quick_reply_comment_length = 0;
			this.quick_reply_comment_text = "";
			update_available_post_references.call(this, []);
		};

		var on_file_post = function (event) {
			this.set_enabled(false);
			this.clear();
		};
		var on_file_4chanx_poll = function (event) {
			var file = null;
			if (event.detail && event.detail instanceof File) {
				file = event.detail;
			}
			change_file.call(this, file, false);

			if (
				file === null &&
				this.quick_reply_file_n_submit !== null &&
				style.has_class(this.quick_reply_file_n_submit, "has-file")
			) {
				setTimeout(on_file_poll_check_failure.bind(this), 10);
			}
			else {
				// Clear poll error timeout
				if (this.file_poll_error_timeout !== null) {
					clearTimeout(this.file_poll_error_timeout);
					this.file_poll_error_timeout = null;
				}
			}
		};
		var on_file_poll_check_failure = function () {
			if (style.has_class(this.quick_reply_file_n_submit, "has-file")) {
				// Clear poll error timeout
				if (this.file_poll_error_timeout === null) {
					on_file_poll_failure.call(this, null);
				}
			}
			else {
				// Clear poll error timeout
				if (this.file_poll_error_timeout !== null) {
					clearTimeout(this.file_poll_error_timeout);
					this.file_poll_error_timeout = null;
				}
			}
		};
		var on_file_poll_failure = function () {
			this.file_poll_error_timeout = null;

			show_error_message.call(this);
		};

		var on_enabled_check_change = function (event) {
			this.set_enabled(this.nodes.enabled_checkbox.checked);
			return stop_event(event);
		};
		var on_input_file_button_click = function (event) {
			// If there's an error, redirect this to the secondary file input
			if (this.mode !== "file" && this.mode !== "none" && this.file !== null) {
				// Switch mode to file
				set_mode.call(this, "file");
			}
			else if (this.quick_reply_file_input !== null && !is_showing_error_message.call(this)) {
				// Force change file
				this.force_change_to_file = true;
				var self = this,
					first = true;
				var click_fn = function (event) {
					if (event.target === self.quick_reply_file_input && first) {
						first = false;
						return;
					}
					self.force_change_to_file = false;
					document.removeEventListener("click", click_fn, true);
				};
				document.addEventListener("click", click_fn, true); // this is to account for clicking "cancel"

				// Activate
				this.quick_reply_file_input.click();
			}
			else {
				// Click custom file
				this.nodes.fallback_file_input.click();
			}
		};
		var on_input_url_button_click = function (event) {
			var v = null;
			try {
				v = prompt("Enter a URL:", this.custom_url || "");
				if (v === null) return;
			}
			catch (e) {
			}

			set_custom_url.call(this, v ? v : null);
		};
		var on_input_post_number_change = function (event) {
			// Must refer to a valid post with a valid image
			var v = this.nodes.input_post_number.options[this.nodes.input_post_number.selectedIndex];
			v = v ? parseInt(v.value, 10) || null : null;

			set_post_reference.call(this, v);
		};

		var on_file_n_submit_attr_change = function (records) {
			var i;

			for (i = 0; i < records.length; ++i) {
				if (records[i].attributeName == "class") {
					// "has-file" class probably changed
					if (style.has_class(records[i].target, "has-file")) {
						poll_file_4chanx_with_errors.call(this);
					}
					else {
						// Set file to null
						change_file.call(this, null, false);
					}
					break;
				}
			}
		};
		var on_qr_file_change = function (node, event) {
			if (this.can_directly_use_files || (node.files && node.files.length > 0)) {
				// Use file directly
				this.can_directly_use_files = true;
				change_file.call(this, (node.files.length > 0 ? node.files[0] : null), true);
			}
			else {
				poll_file_4chanx_with_errors.call(this);
			}
		};
		var on_qr_file_click = function (node, event) {
			if (event.shiftKey && event.which === 1) {
				setTimeout(update_qr_input_file_events.bind(this, this.quick_reply_container, node), 10);
			}
		};
		var on_input_file_fallback_change = function (event) {
			var file = null;
			if (this.nodes.fallback_file_input.files.length > 0) {
				file = this.nodes.fallback_file_input.files[0];
			}

			this.nodes.fallback_file_input.value = null;

			change_file.call(this, file, true);
		};

		var on_comment_change = function (event) {
			if (this.quick_reply_poll_input_timer !== null) {
				clearTimeout(this.quick_reply_poll_input_timer);
				this.quick_reply_poll_input_timer = null;
			}

			comment_value_update.call(this);
			update_editor_annotations.call(this);
		};
		var on_comment_input = function (event) {
			if (this.quick_reply_poll_input_timer !== null) {
				clearTimeout(this.quick_reply_poll_input_timer);
			}

			var self = this;
			this.quick_reply_poll_input_timer = setTimeout(function () {
				self.quick_reply_poll_input_timer = null;
				comment_value_update.call(self);
			}, 200);
		};
		var on_comment_value_poll = function () {
			if (
				this.quick_reply_poll_input_timer === null &&
				this.quick_reply_comment.value.length !== this.quick_reply_comment_length
			) {
				comment_value_update.call(this);
				update_editor_annotations.call(this);
			}
		};

		var update_qr_input_file_events = function (qr_container, old_node) {
			if (old_node !== null) {
				for (var i = 0; i < this.quick_reply_events.length; ++i) {
					if (this.quick_reply_events[i][0] === old_node) {
						this.quick_reply_events.splice(i, 1);
						continue;
					}
				}

				// Nullify
				change_file.call(this, null, true);
			}

			// Find new
			var n;
			if ((n = qr_container.querySelector("input[type=file]")) !== null) {
				// Watch for changes
				this.quick_reply_file_input = n;
				add_event_listener(this.quick_reply_events, n, "change", on_qr_file_change.bind(this, n), false);

				if (n.getAttribute("id") === "qrFile") {
					add_event_listener(this.quick_reply_events, n, "click", on_qr_file_click.bind(this, n), false);
				}
			}
		};

		var poll_file_4chanx = function () {
			document.dispatchEvent(new CustomEvent("QRGetFile", {
				bubbles: true,
				detail: null
			}));
		};
		var poll_file_4chanx_with_errors = function () {
			if (this.file_poll_error_timeout !== null) {
				clearTimeout(this.file_poll_error_timeout);
			}

			this.file_poll_error_timeout = setTimeout(on_file_poll_failure.bind(this), 1000);

			poll_file_4chanx.call(this);
		};

		var comment_value_update = function () {
			if (this.quick_reply_container !== null) {
				this.quick_reply_comment_length = this.quick_reply_comment.value.length;
				this.quick_reply_comment_text = this.quick_reply_comment.value;

				var re_number_matcher = />>([1-9][0-9]*)/g,
					references = [],
					already_used = {},
					number, number_key, image_info, m, pc;

				while ((m = re_number_matcher.exec(this.quick_reply_comment_text)) !== null) {
					number = parseInt(m[1], 10);
					number_key = number.toString();
					if (number_key in already_used) continue;

					if ((pc = api.get_post_container_from_post_number(number)) !== null) {
						already_used[number_key] = true;
						image_info = api.post_get_file_nodes(pc);
						references.push([ number, (image_info !== null && image_info.link !== null) ]);
					}
				}

				update_available_post_references.call(this, references);
			}
			else {
				this.quick_reply_comment_length = 0;
				this.quick_reply_comment_text = "";
				update_available_post_references.call(this, []);
			}
		};

		var change_file = function (file, forced) {
			if (this.file === null) {
				hide_error_message.call(this);

				if (file !== null) {
					set_file.call(this, file);
				}
				// else, both null
			}
			else {
				if (
					forced ||
					file === null ||
					this.file.size != file.size ||
					this.file.type != file.type ||
					this.file.name != file.name ||
					(
						file.lastModifiedDate instanceof Date &&
						this.file.lastModifiedDate instanceof Date &&
						this.file.lastModifiedDate.getTime() != file.lastModifiedDate.getTime()
					)
				) {
					hide_error_message.call(this);
					set_file.call(this, file);
				}
			}
		};

		var setup_qr_nodes = function (qr_container) {
			this.quick_reply_container = qr_container;

			var chan4x = (qr_container.getAttribute("id") == "qr");

			// Setup DOM nodes
			var n1, n2, n3, n4, n5, n6;
			n1 = $.div("iex_quick_reply_extra" + (chan4x ? " iex_quick_reply_extra_4chanx" : ""));
			this.nodes.extra_container = n1;



			n2 = $.div("iex_quick_reply_label_table");
			n1.appendChild(n2);

			n3 = $.div("iex_quick_reply_label_row");
			n2.appendChild(n3);

			n4 = $.div("iex_quick_reply_label_cell");
			n3.appendChild(n4);


			n5 = $.label("iex_quick_reply_label");
			n4.appendChild(n5);

			n6 = $.input.check("iex_quick_reply_label_check");
			n5.appendChild(n6);
			this.nodes.enabled_checkbox = n6;

			n6 = $.span("iex_quick_reply_label_text");
			n6.textContent = "iex image annotations";
			n5.appendChild(n6);


			n4 = $.div("iex_quick_reply_label_cell");
			n3.appendChild(n4);

			n5 = $.span("iex_quick_reply_help_link_container");
			n5.appendChild($.text("["));

			n6 = $.a("iex_quick_reply_help_link");
			n6.setAttribute("href", "https://dnsev.github.io/iex/annotations/help.html");
			n6.setAttribute("rel", "nofollow noreferrer");
			n6.setAttribute("target", "_blank");
			n6.textContent = "Help";
			n5.appendChild(n6);

			n5.appendChild($.text("]"));
			n4.appendChild(n5);



			n2 = $.div("iex_quick_reply_content");
			n1.appendChild(n2);
			this.nodes.content_container = n2;

			n3 = $.div("iex_quick_reply_info");
			n3.textContent = "Select an image to annotate:";
			n2.appendChild(n3);

			n3 = $.div("iex_quick_reply_source_selection");



			n4 = $.span("iex_quick_reply_source_selection_text");
			n4.textContent = "From ";
			n3.appendChild(n4);

			n4 = $.input.button("iex_quick_reply_source_selection_file");
			n4.value = "File";
			this.nodes.input_file_button = n4;
			n3.appendChild(n4);

			n4 = $.span("iex_quick_reply_source_selection_text");
			n4.textContent = " or ";
			n3.appendChild(n4);

			n4 = $.input.button("iex_quick_reply_source_selection_url");
			n4.value = "URL";
			this.nodes.input_url_button = n4;
			n3.appendChild(n4);

			n4 = $.span("iex_quick_reply_source_selection_text");
			n4.textContent = " or reference post ";
			n3.appendChild(n4);

			n4 = $.node("select", "iex_quick_reply_source_selection_post");
			n4.value = "";
			this.nodes.input_post_number = n4;

			n5 = $.node("option", "iex_quick_reply_source_selection_post_option_default");
			n5.value = "";
			n5.textContent = ">>number";
			n4.appendChild(n5);
			n3.appendChild(n4);
			n2.appendChild(n3);



			n3 = $.div("iex_quick_reply_error");
			n3.appendChild($.text("Warning: image not detected properly."));
			n3.appendChild($("br"));
			n3.appendChild($.text("Click \"Image\" to select for editing"));
			n3.setAttribute(
				"title",
				"This typically occurs due to an incompatability between scripts.\n" +
				"For example, appchan-x does not support sharing the post file.\n" +
				"Chrome may have similar issues."
			);
			this.nodes.error_message = n3;
			n2.appendChild(n3);



			n3 = $.input.file("iex_quick_reply_file_input");
			this.nodes.fallback_file_input = n3;
			n2.appendChild(n3);



			// Events
			add_event_listener(this.node_events, this.nodes.enabled_checkbox, "change", on_enabled_check_change.bind(this), false);
			add_event_listener(this.node_events, this.nodes.input_file_button, "click", on_input_file_button_click.bind(this), false);
			add_event_listener(this.node_events, this.nodes.input_url_button, "click", on_input_url_button_click.bind(this), false);
			add_event_listener(this.node_events, this.nodes.input_post_number, "change", on_input_post_number_change.bind(this), false);
			add_event_listener(this.node_events, this.nodes.fallback_file_input, "change", on_input_file_fallback_change.bind(this), false);

			// Add to QR
			qr_container.appendChild(n1);
		};
		var setup_qr_events = function (qr_container) {
			var n, ob;
			if ((n = qr_container.querySelector("#file-n-submit")) !== null) {
				// Watch for class changes
				this.quick_reply_file_n_submit = n;
				ob = new MutationObserver(on_file_n_submit_attr_change.bind(this));
				ob.observe(n, { attributes: true });
				this.quick_reply_observers.push(ob);
			}

			if ((n = qr_container.querySelector("textarea[name=com],textarea[data-name=com]")) !== null) {
				// Watch for changes
				this.quick_reply_comment = n;
				this.quick_reply_comment_length = 0;
				add_event_listener(this.quick_reply_events, n, "change", on_comment_change.bind(this), false);
				add_event_listener(this.quick_reply_events, n, "input", on_comment_input.bind(this), false);
			}

			update_qr_input_file_events.call(this, qr_container, null);
		};

		var remove_qr_nodes = function () {
			this.quick_reply_container = null;

			if (this.nodes.extra_container.parentNode !== null) {
				this.nodes.extra_container.parentNode.removeChild(this.nodes.extra_container);
			}

			for (var k in this.nodes) {
				this.nodes[k] = null;
			}
		};
		var remove_qr_events = function () {
			for (var i = 0; i < this.quick_reply_observers.length; ++i) {
				this.quick_reply_observers[i].disconnect();
			}
			this.quick_reply_observers = [];

			remove_event_listeners(this.quick_reply_events);
			remove_event_listeners(this.node_events);
			this.quick_reply_events = [];
			this.node_events = [];

			this.quick_reply_file_input = null;
			this.quick_reply_file_n_submit = null;

			this.quick_reply_comment = null;
			this.quick_reply_comment_text = "";
			this.quick_reply_comment_length = 0;
			this.quick_reply_comment_references = [];
		};

		var is_showing_error_message = function () {
			return (this.quick_reply_container !== null && style.has_class(this.nodes.error_message, "iex_quick_reply_error_visible"));
		};
		var show_error_message = function () {
			if (this.quick_reply_container !== null) {
				style.add_class(this.nodes.error_message, "iex_quick_reply_error_visible");
			}
		};
		var hide_error_message = function () {
			if (this.quick_reply_container !== null) {
				style.remove_class(this.nodes.error_message, "iex_quick_reply_error_visible");
			}
		};

		var update_editor = function () {
			if (this.mode === "file") {
				this.editor.set_file(this.file, this.file_url, this.mode);
				return;
			}
			else if (this.mode === "post") {
				if (this.post_reference_number_image !== null) {
					this.editor.set_file(null, this.post_reference_number_image, this.mode, this.post_reference_number);
					return;
				}
			}
			else if (this.mode === "url") {
				this.editor.set_file(null, this.custom_url, this.mode);
				return;
			}

			// "none" or invalid
			this.editor.hide();
			this.editor.set_file(null, null, "none");
		};
		var update_editor_annotations = function () {
			if (this.editor !== null) {
				this.editor.load_annotations_from_text(this.quick_reply_comment_text);
			}
		};

		var update_available_post_references = function (references) {
			// Only update this if the references are different
			var i, j;
			if (this.quick_reply_comment_references.length === references.length) {
				if (references.length === 0) return; // same

				var r1, r2;

				i = 0;
				while (true) {
					r1 = this.quick_reply_comment_references[i];
					r2 = references[i];
					if (r1[0] !== r2[0] || r1[1] !== r2[1]) break;

					if (++i >= references.length) return; // same
				}
			}

			// Update
			this.quick_reply_comment_references = references;

			var pn_select = this.nodes.input_post_number,
				selected_index = 0,
				first_selected_index = 0,
				first_selected = null,
				n, n2;

			// Remove
			j = 0;
			for (n = pn_select.firstChild; n !== null; n = n2) {
				n2 = n.nextSibling;
				if (n.value !== "") {
					pn_select.removeChild(n);
				}
				else {
					++j;
				}
			}

			// Add
			for (i = 0; i < references.length; ++i) {
				n = references[i][0];

				if (n === this.post_reference_number) {
					selected_index = i + j;
				}

				n2 = $.node("option", "iex_quick_reply_source_selection_post_option");
				n2.value = n.toString();
				n2.textContent = ">>" + n;
				if (!references[i][1]) {
					n2.disabled = true;
				}
				else if (first_selected === null) {
					first_selected = n2;
					first_selected_index = i;
				}
				pn_select.appendChild(n2);
			}

			// Select
			pn_select.selectedIndex = selected_index;

			// Select based on mode
			if (this.enabled && this.mode === "none" && first_selected !== null) {
				pn_select.selectedIndex = first_selected_index + j;
				set_post_reference.call(this, references[first_selected_index][0]);
			}
			else if (selected_index === 0) {
				// Deselect
				auto_detect_mode.call(this);
			}
		};

		var set_file = function (new_file) {
			if (this.file_url !== null) {
				window.URL.revokeObjectURL(this.file_url);
				this.file_url = null;
			}

			this.file = new_file;

			if (this.file === null) {
				if (this.mode === "file") set_mode.call(this, "none");
			}
			else {
				// Create url
				this.file_url = window.URL.createObjectURL(this.file);

				if ((this.mode === "none" && this.enabled) || this.force_change_to_file) {
					this.force_change_to_file = false;
					set_mode.call(this, "file");
				}
			}
		};
		var set_custom_url = function (url) {
			hide_error_message.call(this);

			if (url === null) {
				this.custom_url = null;
				auto_detect_mode.call(this);
			}
			else {
				this.custom_url = url;
				if (this.enabled) {
					if (!set_mode.call(this, "url")) {
						update_editor.call(this);
					}
				}
			}
		};
		var set_post_reference = function (number) {
			hide_error_message.call(this);

			if (number === null) {
				this.post_reference_number = null;
				auto_detect_mode.call(this);
			}
			else {
				this.post_reference_number = number;

				// Get the image
				var pc, image_info, href;
				if (
					(pc = api.get_post_container_from_post_number(this.post_reference_number)) !== null &&
					(image_info = api.post_get_file_nodes(pc)) !== null &&
					image_info.link !== null &&
					(href = image_info.link.getAttribute("href"))
				) {
					this.post_reference_number_image = href;
				}
				else {
					this.post_reference_number_image = null;
				}

				if (this.enabled) {
					if (!set_mode.call(this, "post")) {
						update_editor.call(this);
					}
				}
			}
		};
		var set_mode = function (mode) {
			if (this.mode === mode) return false;
			this.mode = mode;

			if (mode === "file") {
				style.add_class(this.nodes.input_file_button, "iex_quick_reply_source_selection_file_selected");
			}
			else {
				style.remove_class(this.nodes.input_file_button, "iex_quick_reply_source_selection_file_selected");
			}

			if (mode === "post") {
				style.add_class(this.nodes.input_post_number, "iex_quick_reply_source_selection_post_selected");
			}
			else {
				style.remove_class(this.nodes.input_post_number, "iex_quick_reply_source_selection_post_selected");
				this.post_reference_number = null;
				this.post_reference_number_image = null;

				this.nodes.input_post_number.selectedIndex = 0;
			}

			if (mode === "url") {
				style.add_class(this.nodes.input_url_button, "iex_quick_reply_source_selection_url_selected");
			}
			else {
				style.remove_class(this.nodes.input_url_button, "iex_quick_reply_source_selection_url_selected");
				this.custom_url = null;
			}

			// Editor
			if (mode === "none") {
				// Hide
				if (this.editor !== null) {
					update_editor.call(this);
					this.editor.hide();
				}
			}
			else {
				// Show
				if (this.enabled) {
					if (this.editor === null) {
						this.editor = new AnnotationEditor(this.quick_reply_container, this);
					}
					update_editor.call(this);
					if (!this.editor.is_visible()) {
						this.editor.show();
						update_editor_annotations.call(this);
					}
				}
			}
			return true;
		};
		var auto_detect_mode = function () {
			if (this.file !== null) {
				if (this.mode !== "file") {
					set_mode.call(this, "file");
					return;
				}
			}

			if (this.mode !== "post") {
				var pn_select = this.nodes.input_post_number,
					opts = pn_select.options,
					i, n;

				for (i = 0; i < opts.length; ++i) {
					if (!opts[i].disabled && opts[i].value && (n = parseInt(opts[i].value, 10))) {
						pn_select.selectedIndex = i;
						set_post_reference.call(this, n);
						return;
					}
				}
			}

			set_mode.call(this, "none");
		};



		QuickReplyController.prototype = {
			constructor: QuickReplyController,

			is_enabled: function () {
				return this.enabled;
			},
			set_enabled: function (enabled) {

				if (this.quick_reply_container === null || this.enabled === enabled) {
					if (this.nodes.enabled_checkbox !== null) {
						this.nodes.enabled_checkbox.checked = this.enabled;
					}
					return;
				}

				this.enabled = enabled;

				this.nodes.enabled_checkbox.checked = this.enabled;

				if (this.enabled) {
					style.add_class(this.nodes.extra_container, "iex_quick_reply_extra_enabled");

					poll_file_4chanx.call(this);
					auto_detect_mode.call(this);
				}
				else {
					style.remove_class(this.nodes.extra_container, "iex_quick_reply_extra_enabled");

					if (this.editor !== null) {
						this.editor.hide();
					}
					set_mode.call(this, "none");
				}
			},

			get_text: function () {
				return this.quick_reply_comment_text;
			},
			set_text: function (text) {
				this.quick_reply_comment_length = text.length;
				this.quick_reply_comment_text = text;
				this.quick_reply_comment.value = text;
			},

			clear: function () {
				// Clear statuses
				set_mode.call(this, "none");
			},
		};



		return QuickReplyController;

	})();

	// Image annotation editor
	var AnnotationEditor = (function () {

		var AnnotationEditor = function (qr_container, qr_controller) {
			this.qr_controller = qr_controller;

			this.style_transform = style.get_prefixed_style("transform")[0];
			this.visible = false;

			this.qr_container = null;
			this.qr_resize_timer = null;
			this.qr_resized_during_timer = false;

			this.qr_event_list = [];
			this.move_event_list = [];

			this.minimum_ratio_for_wide = 4.0 / 3.0;

			this.paddings = {
				left: 0,
				top: 0,
				right: 0,
				bottom: 0,
			};

			this.image = {
				url: null,
				mode: null,
				extra: null,
				size: {
					width: 0,
					height: 0,
				},
			};
			this.cpreview = null;
			this.cpreview_zoom = 1;
			this.nodes = {
				container: null,
				image: null,
				image_error: null,
				edit_container: null,
				edit_container_empty: null,
				edit_color_buttons: [],
				edit_color_selected: -1,
				edit_font_selector: null,
				edit_font_size_selector: null,
				edit_font_bold_check: null,
				edit_font_italic_check: null,
				annotation_container: null,
				annotation_scroll_h: null,
				annotation_scroll_v: null,
				annotation_scroll_h_size: null,
				annotation_scroll_v_size: null,
			};
			this.image_events = [];
			this.image_load_poll = null;
			this.preview_scale = 1.0;
			this.preview_move_events = [];
			this.preview_move_speed = [0, 0];
			this.preview_move_origin = [0, 0];
			this.preview_move_offset = [0, 0];
			this.preview_scroll_range = [0, 0];

			this.annotations = [];
			this.annotations_previous = this.annotations;
			this.annotation_text_suffix = null;
			this.annotation_text_suffix_previous = this.annotation_text_suffix;
			this.annotation_selected_index = -1;
			this.update_annotation_sizes_on_image_load = null;

			acquire_paddings.call(this);

			window.addEventListener("resize", on_window_resize.bind(this), false);

			this.set_qr_container(qr_container);
		};



		var re_load_annotations = /^(?:|([\w\W]*?)(?:\r\n?|\n))[ \t]*>((?:[^>\r\n][^\r\n]*)?)(\r\n?|\n|$)/,
			re_load_tag = /^(?:|([\w\W]*?)(?:\r\n?|\n))[ \t]*(\[iex:a\/([^\]]*)\])\s*$/;



		var acquire_paddings = function () {
			var n = $("div"),
				r1, r2;

			n.className = "iex_annotation_editor_outer_paddings";
			n.style.paddingRight = "0";
			n.style.paddingBottom = "0";
			n.style.display = "inline-block";
			n.style.width = "0";
			n.style.height = "0";

			document.body.appendChild(n);
			r1 = style.get_object_size(n);
			n.style.paddingTop = "0";
			n.style.paddingLeft = "0";
			n.style.paddingRight = "";
			n.style.paddingBottom = "";
			r2 = style.get_object_size(n);
			document.body.removeChild(n);

			this.paddings.left = r1.width;
			this.paddings.right = r2.width;
			this.paddings.top = r1.height;
			this.paddings.bottom = r2.height;
		};

		var create_nodes = function () {
			var n1, n2, n3, n4, n5;

			// Create
			n1 = $.div("iex_annotation_editor");
			this.nodes.container = n1;

			n2 = $.div("iex_ae_t1c1");
			n1.appendChild(n2);

			n3 = $.div("iex_ae_t1c2");
			n2.appendChild(n3);

			n4 = $.div("iex_ae_t1c3");
			n3.appendChild(n4);
			n5 = $.div("iex_ae_t1c4");
			n4.appendChild(n5);
			create_nodes_preview.call(this, n5);

			n4 = $.div("iex_ae_t1c3");
			n3.appendChild(n4);
			n5 = $.div("iex_ae_t1c4");
			n4.appendChild(n5);
			create_nodes_editing.call(this, n5);

			// Set size
			document.body.appendChild(n1);
			update_size.call(this);
		};
		var create_nodes_preview = function (container) {
			// Create preview
			var n1, n2, n3, event_bind;
			n1 = $.div("iex_ae_preview_container");
			container.appendChild(n1);


			// Message
			n2 = $.div("iex_ae_preview_message");
			n1.appendChild(n2);
			n3 = $.div("iex_ae_preview_message_inner");
			n2.appendChild(n3);
			this.nodes.image_error = n3;


			// Preview
			this.cpreview = new ContentPreview();
			this.cpreview.set_auto_size(true);
			this.cpreview.add_to(n1);


			// Image
			n2 = $.node("img", "iex_ae_preview_image");
			n2.setAttribute("alt", "");
			n2.setAttribute("title", "");
			this.nodes.image = n2;
			this.cpreview.add_content(n2);


			// Overlay
			n2 = $.div("iex_annotation_overlay");
			this.cpreview.add_content(n2);

			n3 = $.div("iex_annotation_container");
			n2.appendChild(n3);
			this.nodes.annotation_container = n3;


			// Events
			n2.addEventListener("mouseover", wrap_mouseenterleave_event(this, on_container_mouseover), false);
			n2.addEventListener("mouseout", wrap_mouseenterleave_event(this, on_container_mouseout), false);
			n2.addEventListener("mousewheel", (event_bind = on_container_mousewheel.bind(this)), false);
			n2.addEventListener("DOMMouseScroll", event_bind, false);
			n2.addEventListener("mousedown", on_container_mousedown.bind(this), false);
			n2.addEventListener("contextmenu", on_container_contextmenu.bind(this), false);


			// Scroll bars
			n2 = $.div("iex_ae_preview_scroll_h");
			n1.appendChild(n2);
			this.nodes.annotation_scroll_h = n2;

			n3 = $.div("iex_ae_preview_scroll_h_inner");
			n2.appendChild(n3);
			this.nodes.annotation_scroll_h_size = n3;


			n2 = $.div("iex_ae_preview_scroll_v");
			n1.appendChild(n2);
			this.nodes.annotation_scroll_v = n2;

			n3 = $.div("iex_ae_preview_scroll_v_inner");
			n2.appendChild(n3);
			this.nodes.annotation_scroll_v_size = n3;
		};
		var create_nodes_editing = function (container) {
			var n1, n2, n3, n4, n5;

			// Create
			n1 = $.div("iex_ae_t2c0");
			container.appendChild(n1);

			n2 = $.div("iex_ae_t2c1");
			n1.appendChild(n2);

			n3 = $.div("iex_ae_t2c2");
			n2.appendChild(n3);

			n4 = $.div("iex_ae_t2c3");
			n3.appendChild(n4);
			n5 = $.div("iex_ae_t2c4");
			n4.appendChild(n5);
			create_nodes_editing_tools.call(this, n5);

			n4 = $.div("iex_ae_t2c3");
			n3.appendChild(n4);
			n5 = $.div("iex_ae_t2c4");
			n4.appendChild(n5);
			create_nodes_editing_text.call(this, n5);
		};
		var create_nodes_editing_tools = function (container) {
			var n1, n2, n3, n4, n5, n6;

			// Create
			n1 = $.div("iex_ae_t3c0");
			container.appendChild(n1);

			n2 = $.div("iex_ae_t3c1");
			n1.appendChild(n2);

			n3 = $.div("iex_ae_t3c2");
			n2.appendChild(n3);

			n4 = $.div("iex_ae_t3c3");
			n3.appendChild(n4);

			// Top (colors)
			n5 = $.div("iex_ae_t3c4");
			n4.appendChild(n5);
			n6 = $.div("iex_ae_t3c5");
			n5.appendChild(n6);
			create_nodes_editing_tools_top.call(this, n6);

			// Top (colors)
			n5 = $.div("iex_ae_t3c4");
			n4.appendChild(n5);
			n6 = $.div("iex_ae_t3c5");
			n5.appendChild(n6);
			create_nodes_editing_tools_colors.call(this, n6);

			// Middle (fonts)
			n5 = $.div("iex_ae_t3c4");
			n4.appendChild(n5);
			n6 = $.div("iex_ae_t3c5");
			n5.appendChild(n6);
			create_nodes_editing_tools_fonts.call(this, n6);

			// Bottom (align)
			create_nodes_editing_tools_align.call(this, n6);
		};
		var create_nodes_editing_tools_top = function (container) {
			var n1, n2, n3;

			n1 = $.div("iex_ae_t7c0");


			this.nodes.edit_color_index_labels = [];


			n2 = $.span("iex_ae_t7c1 iex_ae_top_label");
			n2.textContent = "Color:";
			n1.appendChild(n2);


			n2 = $.span("iex_ae_t7c1 iex_ae_top_color_link");
			n2.textContent = "Text";
			n1.appendChild(n2);
			n2.addEventListener("click", on_color_index_select.bind(this, 0), false);
			this.nodes.edit_color_index_labels.push(n2);


			n2 = $.span("iex_ae_t7c1 iex_ae_top_color_link");
			n2.appendChild($.text("Deco"));
			n3 = $.span("iex_ae_top_hyphen");
			n3.textContent = "-";
			n3.appendChild($("br"));
			n2.appendChild(n3);
			n2.appendChild($.text("ration"));
			n1.appendChild(n2);
			n2.addEventListener("click", on_color_index_select.bind(this, 1), false);
			this.nodes.edit_color_index_labels.push(n2);


			n2 = $.span("iex_ae_t7c1 iex_ae_top_color_link");
			n2.appendChild($.text("Back"));
			n3 = $.span("iex_ae_top_hyphen");
			n3.textContent = "-";
			n3.appendChild($("br"));
			n2.appendChild(n3);
			n2.appendChild($.text("ground"));
			n1.appendChild(n2);
			n2.addEventListener("click", on_color_index_select.bind(this, 2), false);
			this.nodes.edit_color_index_labels.push(n2);


			container.appendChild(n1);
		};
		var create_nodes_editing_tools_colors = function (container) {
			var shades = Annotation.color_shades,
				i, j, n1, n2, n3, n4, n5;

			// Create
			n1 = $.div("iex_ae_t4c0");
			container.appendChild(n1);

			n2 = $.div("iex_ae_t4c1");
			n1.appendChild(n2);

			n3 = $.div("iex_ae_t4c2");
			n2.appendChild(n3);

			// Black and white
			n4 = $.div("iex_ae_t4c3");
			n3.appendChild(n4);
			n5 = $.div("iex_ae_t4c4");
			n4.appendChild(n5);
			n5.appendChild(create_nodes_color_selector.call(this, 0));
			n5.appendChild(create_nodes_color_selector.call(this, 1));

			for (i = 2; i < Annotation.colors.length; i += shades) {
				n4 = $.div("iex_ae_t4c3");
				n3.appendChild(n4);
				n5 = $.div("iex_ae_t4c4");
				n4.appendChild(n5);
				for (j = 0; j < shades; ++j) {
					n5.appendChild(create_nodes_color_selector.call(this, i + j));
				}
			}

		};
		var create_nodes_color_selector = function (color_index) {
			var n1, n2, n3, cls;
			n1 = $.div("iex_ae_color_selector iex_ae_color_selector_disabled");
			n1.setAttribute("title", "Color index: " + color_index);

			n2 = $.div("iex_ae_color_selector_inner");
			n2.style.backgroundColor = "#" + Annotation.colors[color_index];
			n1.appendChild(n2);

			n3 = $.div("iex_ae_color_selector_border");
			n2.appendChild(n3);

			cls = "iex_ae_color_selector_border2";
			if (color_index === 1) cls += " iex_ae_color_selector_border2_alt";
			n3 = $.div(cls);
			n2.appendChild(n3);

			n1.addEventListener("click", on_color_select.bind(this, color_index), false);

			this.nodes.edit_color_buttons.push(n1);
			return n1;
		};
		var create_nodes_editing_tools_fonts = function (container) {
			var n1, n2, n3, n4, n5;

			n1 = $.div("iex_ae_t5c1");
			container.appendChild(n1);

			n2 = $.div("iex_ae_t5c2");
			n1.appendChild(n2);


			// Column 1
			n3 = $.div("iex_ae_t5c3");
			n2.appendChild(n3);

			n4 = $.div("iex_ae_new_annotation_button");
			n3.appendChild(n4);
			n5 = $.div("iex_ae_new_annotation_button_inner");
			n4.appendChild(n5);
			n5.textContent = "New Note";
			n4.addEventListener("click", on_new_note_click.bind(this), false);


			// Column 2
			n3 = $.div("iex_ae_t5c3");
			n2.appendChild(n3);

			n4 = $.node("select", "iex_ae_selection");
			n4.addEventListener("change", on_font_select.bind(this, n4), false);
			n4.setAttribute("title", "Font to use for the annotation");
			n3.appendChild(n4);
			n4.disabled = true;
			this.nodes.edit_font_selector = n4;
			create_nodes_font_selection.call(this, n4);

			n4 = $.node("select", "iex_ae_selection");
			n4.addEventListener("change", on_font_scale_select.bind(this, n4), false);
			n4.setAttribute("title", "Font size to use for the annotation");
			n3.appendChild(n4);
			n4.disabled = true;
			this.nodes.edit_font_size_selector = n4;
			create_nodes_font_size_selection.call(this, n4);


			// Column 3
			n3 = $.div("iex_ae_t5c3");
			n2.appendChild(n3);

			n4 = $.label("iex_ae_option_label");
			n3.appendChild(n4);
			n5 = $.input.check("iex_ae_option_checkbox iex_ae_option_checkbox_bold");
			n5.addEventListener("change", on_font_bold_change.bind(this, n5), false);
			this.nodes.edit_font_bold_check = n5;
			n5.disabled = true;
			n4.appendChild(n5);
			n5 = $.span("iex_ae_option_label_text");
			n5.textContent = " Bold";
			n4.appendChild(n5);

			n4 = $.label("iex_ae_option_label");
			n3.appendChild(n4);
			n5 = $.input.check("iex_ae_option_checkbox iex_ae_option_checkbox_italic");
			n5.addEventListener("change", on_font_italic_change.bind(this, n5), false);
			this.nodes.edit_font_italic_check = n5;
			n5.disabled = true;
			n4.appendChild(n5);
			n5 = $.span("iex_ae_option_label_text");
			n5.textContent = " Italic";
			n4.appendChild(n5);
		};
		var create_nodes_editing_tools_align = function (container) {
			var n1, n2, n3, n4;

			var add_opt = function (par, text, value) {
				var n1 = $.node("option", "iex_ae_selection_option");
				n1.textContent = text;
				n1.value = value.toString();
				par.appendChild(n1);
				return n1;
			};

			n1 = $.div("iex_ae_t5c1");
			container.appendChild(n1);

			n2 = $.div("iex_ae_t5c2");
			n1.appendChild(n2);


			// Column 1
			n3 = $.div("iex_ae_t5c3 iex_ae_t5c3_small_space");
			n2.appendChild(n3);

			n4 = $.node("select", "iex_ae_selection");
			n4.addEventListener("change", on_halign_select.bind(this, n4), false);
			n4.setAttribute("title", "Horizontal alignment for the annotation text");
			n3.appendChild(n4);
			n4.disabled = true;
			this.nodes.edit_halign_selector = n4;
			add_opt(n4, "Center", Annotation.AlignCenter);
			add_opt(n4, "Left", Annotation.AlignLeft);
			add_opt(n4, "Right", Annotation.AlignRight);
			add_opt(n4, "Justify", Annotation.AlignJustify);

			// Column 2
			n3 = $.div("iex_ae_t5c3 iex_ae_t5c3_small_space");
			n2.appendChild(n3);

			n4 = $.node("select", "iex_ae_selection");
			n4.addEventListener("change", on_valign_select.bind(this, n4), false);
			n4.setAttribute("title", "Vertical alignment for the annotation text");
			n3.appendChild(n4);
			n4.disabled = true;
			this.nodes.edit_valign_selector = n4;
			add_opt(n4, "Middle", Annotation.AlignMiddle);
			add_opt(n4, "Top", Annotation.AlignTop);
			add_opt(n4, "Bottom", Annotation.AlignBottom);

			// Column 3
			n3 = $.div("iex_ae_t5c3 iex_ae_t5c3_small_space");
			n2.appendChild(n3);

			n4 = $.node("select", "iex_ae_selection");
			n4.addEventListener("change", on_text_decoration_select.bind(this, n4), false);
			n4.setAttribute("title", "Text decoration annotation text");
			n3.appendChild(n4);
			n4.disabled = true;
			this.nodes.edit_decoration_selector = n4;
			add_opt(n4, "Normal", Annotation.TextDecorationNone).setAttribute("title", "Decoration index: 0");
			add_opt(n4, "Shadow", Annotation.TextDecorationShadow).setAttribute("title", "Decoration index: 1");
			add_opt(n4, "Blur", Annotation.TextDecorationShadowBlur).setAttribute("title", "Decoration index: 2");
			add_opt(n4, "Strong Blur", Annotation.TextDecorationShadowBlurStrong).setAttribute("title", "Decoration index: 3");
		};
		var create_nodes_font_selection = function (container) {
			var i, n1;

			for (i = 0; i < Annotation.fonts.length; ++i) {
				n1 = $.node("option", "iex_ae_selection_option");
				n1.textContent = Annotation.fonts[i].name;
				n1.value = i.toString();

				container.appendChild(n1);
			}
		};
		var create_nodes_font_size_selection = function (container) {
			var size = Annotation.font_size_settings.base,
				size_incr = Annotation.font_size_settings.base_step,
				i, j, n1;

			for (i = 0; i < Annotation.font_size_settings.step_count; ++i) {
				for (j = 0; j < Annotation.font_size_settings.step_duration; ++j) {
					n1 = $.node("option", "iex_ae_selection_option");
					n1.textContent = "Size: " + size + "px";
					n1.value = (i * Annotation.font_size_settings.step_duration + j).toString();

					container.appendChild(n1);

					size += size_incr;
				}
				size_incr *= Annotation.font_size_settings.step_multiplier;
			}
		};
		var create_nodes_editing_text = function (container) {
			var n1, n2, n3, n4, n5;

			n1 = $.div("iex_ae_t6c0");
			container.appendChild(n1);

			n2 = $.div("iex_ae_t6c1");
			n1.appendChild(n2);

			n3 = $.div("iex_ae_t6c2");
			n2.appendChild(n3);
			this.nodes.edit_container = n3;

			n4 = $.div("iex_ae_add_annotation_container_empty");
			n3.appendChild(n4);
			this.nodes.edit_container_empty = n4;

			n5 = $.a("iex_ae_add_annotation_container_empty_link");
			n4.appendChild(n5);
			n5.textContent = "Add annotation";
			n5.addEventListener("click", on_new_note_empty_click.bind(this), false);

			n4 = $.div("iex_ae_restore_annotations_container_empty");
			n3.appendChild(n4);
			this.nodes.edit_container_empty_restore = n4;

			n5 = $.a("iex_ae_restore_annotations_container_empty_link");
			n4.appendChild(n5);
			n5.textContent = "Restore recent annotations";
			n5.addEventListener("click", on_restore_annotations_click.bind(this), false);

			set_empty_links_visible.call(this, true);
		};
		var remove_nodes = function () {
		};

		var setup_qr_events = function () {
			var movable_sections = this.qr_container.querySelectorAll(".move,.drag,textarea"),
				i;

			// Events
			for (i = 0; i < movable_sections.length; ++i) {
				add_event_listener(this.qr_event_list, movable_sections[i], "mousedown", on_movable_mousedown.bind(this), false);
			}
		};
		var remove_qr_events = function () {
			remove_event_listeners(this.qr_event_list);
			this.qr_event_list = [];
		};

		var update_size = function () {
			var max_rect = style.get_document_rect(),
				doc_left = max_rect.left,
				doc_top = max_rect.top,
				header_rect = api.get_header_rect(),
				qr_rect = style.get_object_rect(this.qr_container),
				container = this.nodes.container,
				x_mid, x, y, w, h;

			// Subtract header
			if (header_rect.top <= max_rect.top && header_rect.bottom > max_rect.top) {
				// It's on the top
				max_rect.top = header_rect.bottom;
			}
			else if (header_rect.bottom >= max_rect.bottom && header_rect.top < max_rect.bottom) {
				// It's on the bottom
				max_rect.bottom = header_rect.top;
			}

			// Subtract size of quick reply if it results in a large enough container
			x_mid = (doc_left + max_rect.right) / 2.0;
			if (qr_rect.left >= x_mid + this.paddings.left) {
				// On the right
				max_rect.right = qr_rect.left;
			}
			else if (qr_rect.right <= x_mid - this.paddings.right) {
				// On the left
				max_rect.left = qr_rect.right;
			}

			// Finalize position
			x = (max_rect.left + this.paddings.left);
			y = (max_rect.top + this.paddings.top);
			w = (max_rect.right - this.paddings.right) - x;
			h = (max_rect.bottom - this.paddings.bottom) - y;
			x -= doc_left;
			y -= doc_top;
			if (w < 16) w = 16;
			if (h < 16) h = 16;

			// Set size
			container.style.left = x + "px";
			container.style.top = y + "px";
			container.style.width = w + "px";
			container.style.height = h + "px";

			// Ratio
			if (w / h >= this.minimum_ratio_for_wide) {
				style.remove_class(container, "iex_annotation_editor_vertical");
			}
			else {
				style.add_class(container, "iex_annotation_editor_vertical");
			}

			// Preview size
			update_preview_size.call(this);
		};
		var update_preview_size = function (offset_x, offset_y) {
			var w, h, size, r;

			// Resize
			this.cpreview.update_auto_size();
			size = this.cpreview.size;

			// Get image size
			w = this.image.size.width;
			h = this.image.size.height;

			// Ratios
			r = w / h;
			if ((size.width / size.height) > r) {
				// fit width
				w = size.width;
				h = w / r;
			}
			else {
				// fit height
				h = size.height;
				w = h * r;
			}

			// Zoom
			w *= this.cpreview_zoom;
			h *= this.cpreview_zoom;

			this.cpreview.set_size(w, h, offset_x, offset_y);

			// Annotation scaling
			this.preview_scale = 1.0;
			if (this.image.size.width > 0) this.preview_scale = (this.cpreview.size.width / this.image.size.width);
			if (Annotation.scaling_mode_px) {
				this.nodes.annotation_container.style.fontSize = this.preview_scale.toFixed(4) + "px";
			}
			else {
				this.nodes.annotation_container.style[this.style_transform] = "scale(" + this.preview_scale.toFixed(4) + ")";
			}

			// Scrollbars
			update_preview_scrollbars.call(this);
			show_preview_scrollbars.call(this);
		};
		var update_preview_scrollbars = function () {
			var size = this.cpreview.size,
				display_size = this.cpreview.display,
				w, h;

			if (size.width > display_size.width + 0.001) {
				style.add_class(this.nodes.annotation_scroll_h, "iex_ae_preview_scroll_displayable");
				w = (size.width - display_size.width) / size.width;
				this.nodes.annotation_scroll_h_size.style.width = ((1 - w) * 100).toFixed(4) + "%";
			}
			else {
				style.remove_class(this.nodes.annotation_scroll_h, "iex_ae_preview_scroll_displayable");
				w = 0;
			}

			if (size.height > display_size.height + 0.001) {
				style.add_class(this.nodes.annotation_scroll_v, "iex_ae_preview_scroll_displayable");
				h = (size.height - display_size.height) / size.height;
				this.nodes.annotation_scroll_v_size.style.height = ((1 - h) * 100).toFixed(4) + "%";
			}
			else {
				style.remove_class(this.nodes.annotation_scroll_v, "iex_ae_preview_scroll_displayable");
				h = 0;
			}

			this.preview_scroll_range[0] = w * 100;
			this.preview_scroll_range[1] = h * 100;

			update_preview_scrollbar_positions.call(this);
		};
		var update_preview_scrollbar_positions = function () {
			this.nodes.annotation_scroll_h_size.style.left = (this.cpreview.offset_x * this.preview_scroll_range[0]).toFixed(4) + "%";
			this.nodes.annotation_scroll_v_size.style.top = (this.cpreview.offset_y * this.preview_scroll_range[1]).toFixed(4) + "%";
		};
		var show_preview_scrollbars = function () {
			style.add_class(this.nodes.annotation_scroll_h, "iex_ae_preview_scroll_visible");
			style.add_class(this.nodes.annotation_scroll_v, "iex_ae_preview_scroll_visible");
		};
		var hide_preview_scrollbars = function () {
			style.remove_class(this.nodes.annotation_scroll_h, "iex_ae_preview_scroll_visible");
			style.remove_class(this.nodes.annotation_scroll_v, "iex_ae_preview_scroll_visible");
		};

		var set_image = function (url, mode, extra) {
			// Events
			clear_image_events.call(this);

			this.image.url = url;
			this.image.mode = mode;
			this.image.extra = extra;
			this.image.size.width = 0;
			this.image.size.height = 0;

			var image = this.nodes.image;

			style.remove_class(image, "iex_ae_preview_image_visible");
			style.remove_class(image, "iex_ae_preview_image_loaded");
			style.remove_class(image, "iex_ae_preview_image_error");
			style.remove_class(this.nodes.annotation_scroll_h, "iex_ae_preview_scroll_visible");
			style.remove_class(this.nodes.annotation_scroll_v, "iex_ae_preview_scroll_visible");
			image.removeAttribute("src");

			if (url === null) {
				// Image not available
				this.nodes.image_error.textContent = "Image not available";
				return;
			}

			this.nodes.image_error.textContent = "";

			add_event_listener(this.image_events, image, "load", on_image_load.bind(this, image), false);
			add_event_listener(this.image_events, image, "error", on_image_error.bind(this, image), false);
			this.image_load_poll = setInterval(on_image_status_poll.bind(this, image), 200);

			update_preview_size.call(this);

			image.setAttribute("src", url);

			update_annotation_full_text.call(this, false);
		};
		var clear_image_events = function () {
			if (this.image_events.length > 0) {
				on_image_abort.call(this, this.nodes.image);

				remove_event_listeners(this.image_events);
				this.image_events = [];

				if (this.image_load_poll !== null) {
					clearInterval(this.image_load_poll);
					this.image_load_poll = null;
				}
			}
		};

		var change_zoom_level = function (new_zoom, update_offset, mx, my) {
			var left, top;

			if (update_offset) {
				var rect = style.get_object_rect_relative(this.cpreview.nodes.container),
					image_rect = style.get_object_rect_relative(this.nodes.image),
					scale = (this.cpreview_zoom / new_zoom),
					w = image_rect.width / scale,
					h = image_rect.height / scale,
					left_max = (w - rect.width) / w,
					top_max = (h - rect.height) / h;

				left = (((mx - rect.left) * (1 - scale)) + (rect.left - image_rect.left)) / image_rect.width;
				top = (((my - rect.top) * (1 - scale)) + (rect.top - image_rect.top)) / image_rect.height;

				if (left_max > 0) {
					if (left < 0) left = 0;
					else if (left > left_max) left = left_max;
					left /= left_max;
				}
				else {
					left = 0;
				}

				if (top_max > 0) {
					if (top < 0) top = 0;
					else if (top > top_max) top = top_max;
					top /= top_max;
				}
				else {
					top = 0;
				}
			}

			this.cpreview_zoom = new_zoom;
			update_preview_size.call(this, left, top);
		};

		var set_empty_links_visible = function (visible) {
			var s1 = "iex_ae_add_annotation_container_empty_visible",
				s2 = "iex_ae_restore_annotations_container_empty_visible";

			if (visible) {
				style.add_class(this.nodes.edit_container_empty, s1);
			}
			else {
				style.remove_class(this.nodes.edit_container_empty, s1);
			}

			if (visible && this.annotations_previous !== this.annotations && this.annotations_previous.length > 0) {
				style.add_class(this.nodes.edit_container_empty_restore, s2);
			}
			else {
				style.remove_class(this.nodes.edit_container_empty_restore, s2);
			}
		};

		var clear_previous_annotations = function () {
			// Clear previous
			if (this.annotations_previous !== this.annotations) {
				for (var i = 0; i < this.annotations_previous.length; ++i) {
					this.annotations_previous[i].destroy();
				}
				this.annotations_previous = this.annotations;
				this.annotation_text_suffix_previous = null;
			}
		};
		var set_no_annotations_selected = function () {
			var ns = this.nodes.edit_color_buttons,
				i;

			i = this.nodes.edit_color_selected;
			if (i >= 0) {
				style.remove_class(ns[i], "iex_ae_color_selector_selected");

				for (i = 0; i < ns.length; ++i) {
					style.add_class(ns[i], "iex_ae_color_selector_disabled");
				}

				this.nodes.edit_color_selected = -1;
			}

			ns = this.nodes.edit_color_index_labels;
			for (i = 0; i < ns.length; ++i) {
				style.remove_class(ns[i], "iex_ae_top_color_link_selected");
			}

			this.nodes.edit_font_selector.disabled = true;
			this.nodes.edit_font_selector.selectedIndex = 0;
			this.nodes.edit_font_size_selector.disabled = true;
			this.nodes.edit_font_size_selector.selectedIndex = 0;
			this.nodes.edit_halign_selector.disabled = true;
			this.nodes.edit_halign_selector.selectedIndex = 0;
			this.nodes.edit_valign_selector.disabled = true;
			this.nodes.edit_valign_selector.selectedIndex = 0;
			this.nodes.edit_decoration_selector.disabled = true;
			this.nodes.edit_decoration_selector.selectedIndex = 0;
			this.nodes.edit_font_bold_check.disabled = true;
			this.nodes.edit_font_bold_check.checked = false;
			this.nodes.edit_font_italic_check.disabled = true;
			this.nodes.edit_font_italic_check.checked = false;

			this.annotation_selected_index = -1;
		};
		var set_annotation_selected = function (annotation_index, select_text) {
			if (annotation_index === this.annotation_selected_index) return;

			// Update selection
			if (this.annotation_selected_index >= 0) {
				this.annotations[this.annotation_selected_index].set_selected(false);
			}
			this.annotation_selected_index = annotation_index;

			update_annotation_color_selected.call(this);
			update_annotation_color_index_selected.call(this);
			update_annotation_align_selected.call(this);
			update_annotation_font_selected.call(this);
			update_annotation_font_size_selected.call(this);
			update_annotation_text_decoration_selected.call(this);
			update_annotation_font_bold_selected.call(this);
			update_annotation_font_italic_selected.call(this);

			this.annotations[this.annotation_selected_index].set_selected(true, !select_text);
		};
		var add_new_annotation = function (text_before, simple_mode) {
			if (this.annotations_previous !== this.annotations) {
				clear_previous_annotations.call(this);
			}

			// Create new
			var index = this.annotations.length,
				sz = get_annotation_default_size.call(this, simple_mode),
				a, m, i;

			if (text_before === undefined) {
				if (this.annotation_text_suffix === null) {
					text_before = null;
					this.annotation_text_suffix = ""; // will add an additional newline before the tag
				}
				else {
					m = /\s*$/.exec(this.annotation_text_suffix)[0];
					i = this.annotation_text_suffix.length - m.length;

					text_before = this.annotation_text_suffix.substr(0, i);
					this.annotation_text_suffix = this.annotation_text_suffix.substr(i).replace(/^(?:\r\n?|\n)/, "");

					if (text_before.length === 0) text_before = null;
				}
			}

			a = new Annotation(this, {
				edit: true,
				index: index,
				font_size_index: sz.font_size_index,
				font: settings.values.annotations.defaults.font,
				bold: settings.values.annotations.defaults.bold,
				italic: settings.values.annotations.defaults.italic,
				x: sz.x,
				y: sz.y,
				width: sz.width,
				height: sz.height,
				text_before: text_before
			});

			this.annotations.push(a);
			a.add_to(this.nodes.annotation_container, this.nodes.edit_container);

			if (!simple_mode) {
				set_empty_links_visible.call(this, false);
				set_annotation_selected.call(this, index, true);

				update_annotation_full_text.call(this, false);
			}

			return a;
		};
		var remove_annotation = function (index, update) {
			var a = this.annotations[index],
				tb = a.get_text_before(),
				tb2, i;

			// Remove
			if (this.annotations.length === 1) {
				this.annotations = [];
				a.remove_nodes();
				this.annotation_text_suffix_previous = this.annotation_text_suffix;
			}
			else {
				this.annotations.splice(index, 1);
				a.destroy();
			}

			// Update indices
			for (i = index; i < this.annotations.length; ++i) {
				this.annotations[i].set_index(i);
			}

			// Update text before
			if (tb !== null) {
				if (index < this.annotations.length) {
					tb2 = this.annotations[index].get_text_before();
					tb2 = (tb2 === null) ? tb : (tb + "\n" + tb2);
					this.annotations[index].set_text_before(tb2);
				}
				else {
					tb2 = this.annotation_text_suffix;
					this.annotation_text_suffix = (tb2 === null) ? tb : (tb + "\n" + tb2);
				}
			}

			// Update selection
			if (this.annotation_selected_index === index) {
				i = this.annotation_selected_index;
				if (i > 0) --i;
				if (i < this.annotations.length) {
					this.annotation_selected_index = -1;
					set_annotation_selected.call(this, i, true);
				}
				else {
					set_no_annotations_selected.call(this);
				}
			}
			else if (this.annotation_selected_index > index) {
				--this.annotation_selected_index;
			}

			// Update text
			if (update) update_annotation_full_text.call(this, false);

			// Show links
			if (this.annotations.length === 0) {
				// Show
				set_empty_links_visible.call(this, true);
			}
		};
		var get_annotation_default_size = function (simple_mode) {
			// New size
			var x = 0,
				y = 0,
				w = 100,
				h = 100,
				font_size, s;

			if (this.image.size.width > 0 && this.image.size.height > 0 && !simple_mode) {
				// Font size
				s = Math.min(this.image.size.width, this.image.size.height) / 32;
				font_size = Annotation.font_size_to_size_info(s);
				w = Math.round(w * font_size[1] / 16);
				h = Math.round(h * font_size[1] / 16);

				// Size
				if (w > this.image.size.width) {
					w = this.image.size.width;
				}
				else {
					s = this.image.size.width / this.cpreview.size.width;
					x = (this.cpreview.size.width - this.cpreview.display.width) * s * this.cpreview.offset_x + (this.cpreview.display.width * s - w) / 2;
					x = Math.round(x);
				}

				if (h > this.image.size.height) {
					h = this.image.size.height;
				}
				else {
					s = this.image.size.height / this.cpreview.size.height;
					y = (this.cpreview.size.height - this.cpreview.display.height) * s * this.cpreview.offset_y + (this.cpreview.display.height * s - h) / 2;
					y = Math.round(y);
				}
			}
			else {
				font_size = Annotation.font_size_to_size_info(16);
			}

			return {
				font_size_index: font_size[0],
				x: x,
				y: y,
				width: w,
				height: h,
			};
		};
		var rebound_annotations = function () {
			if (this.image.size.width <= 0 || this.image.size.height <= 0) return;

			// Update annotation bounds
			var i, a, sz, pos, x, y, w, h, update;

			for (i = 0; i < this.annotations.length; ++i) {
				update = false;
				a = this.annotations[i];
				sz = a.get_size();
				pos = a.get_position();
				x = pos[0];
				y = pos[1];
				w = sz[0];
				h = sz[1];

				if (w > this.image.size.width) {
					x = 0;
					w = this.image.size.width;
					update = true;
				}
				else if (x + w > this.image.size.width) {
					x = this.image.size.width - w;
					update = true;
				}

				if (h > this.image.size.height) {
					y = 0;
					h = this.image.size.height;
					update = true;
				}
				else if (y + h > this.image.size.height) {
					y = this.image.size.height - h;
					update = true;
				}

				if (update) {
					a.set_annotation_rect(x, y, w, h);
				}
			}
		};
		var apply_default_size_to_annotations = function (annotations) {
			var sz = get_annotation_default_size.call(this, false),
				i, a;

			for (i = 0; i < annotations.length; ++i) {
				a = annotations[i];
				a.set_font_size(sz.font_size_index);
				a.set_annotation_rect(sz.x, sz.y, sz.width, sz.height);
			}
		};

		var update_annotation_color_selected = function () {
			var a = this.annotations[this.annotation_selected_index],
				ns = this.nodes.edit_color_buttons,
				i;

			if (this.nodes.edit_color_selected >= 0) {
				style.remove_class(ns[this.nodes.edit_color_selected], "iex_ae_color_selector_selected");
			}
			else {
				for (i = 0; i < ns.length; ++i) {
					style.remove_class(ns[i], "iex_ae_color_selector_disabled");
				}
			}
			this.nodes.edit_color_selected = a.get_color(a.get_color_index_selected());
			style.add_class(ns[this.nodes.edit_color_selected], "iex_ae_color_selector_selected");
		};
		var update_annotation_color_index_selected = function () {
			var sel = this.annotations[this.annotation_selected_index].get_color_index_selected(),
				cls = "iex_ae_top_color_link_selected",
				ns, i;


			ns = this.nodes.edit_color_index_labels;
			for (i = 0; i < ns.length; ++i) {
				if (i === sel) {
					style.add_class(ns[i], cls);
				}
				else {
					style.remove_class(ns[i], cls);
				}
			}
		};
		var update_annotation_align_selected = function () {
			var a = this.annotations[this.annotation_selected_index];

			this.nodes.edit_halign_selector.disabled = false;
			this.nodes.edit_halign_selector.selectedIndex = (a.get_align() & Annotation.AlignHorizontal);
			this.nodes.edit_valign_selector.disabled = false;
			this.nodes.edit_valign_selector.selectedIndex = (a.get_align() & Annotation.AlignVertical) >> 2;
		};
		var update_annotation_font_selected = function () {
			var a = this.annotations[this.annotation_selected_index];

			this.nodes.edit_font_selector.disabled = false;
			this.nodes.edit_font_selector.selectedIndex = a.get_font();
		};
		var update_annotation_font_size_selected = function () {
			var a = this.annotations[this.annotation_selected_index];

			this.nodes.edit_font_size_selector.disabled = false;
			this.nodes.edit_font_size_selector.selectedIndex = a.get_font_size();
		};
		var update_annotation_text_decoration_selected = function () {
			var a = this.annotations[this.annotation_selected_index];

			this.nodes.edit_decoration_selector.disabled = false;
			this.nodes.edit_decoration_selector.selectedIndex = a.get_text_decoration();
		};
		var update_annotation_font_bold_selected = function () {
			var a = this.annotations[this.annotation_selected_index];

			this.nodes.edit_font_bold_check.disabled = false;
			this.nodes.edit_font_bold_check.checked = a.get_font_bold();
		};
		var update_annotation_font_italic_selected = function () {
			var a = this.annotations[this.annotation_selected_index];

			this.nodes.edit_font_italic_check.disabled = false;
			this.nodes.edit_font_italic_check.checked = a.get_font_italic();
		};

		var clear_annotation_lines = function () {
			var i;

			// Clear, move into previous
			if (this.annotations.length > 0) {
				// Remove nodes of every annotation
				set_no_annotations_selected.call(this);
				for (i = 0; i < this.annotations.length; ++i) {
					this.annotations[i].remove_nodes();
				}
				this.annotations = [];
				this.annotation_text_suffix_previous = this.annotation_text_suffix;
			}

			// Show
			set_empty_links_visible.call(this, true);
		};
		var load_annotation_lines = function (lines, lines_before, remaining, tag) {
			if (!this.visible) return;

			var a_len_pre = this.annotations.length,
				sz = null,
				i, j, a, t, can_size;

			this.annotation_text_suffix = remaining;

			if (lines.length === 0) {
				clear_annotation_lines.call(this);
			}
			else {
				// Completely remove previous
				clear_previous_annotations.call(this);

				// Hide
				set_empty_links_visible.call(this, false);

				// Create new annotations
				for (i = 0; i < lines.length; ++i) {
					if (i < a_len_pre) {
						a = this.annotations[i];
						a.set_text_before(lines_before[i]);
					}
					else {
						a = add_new_annotation.call(this, lines_before[i], true);
					}
				}

				// Select
				if (this.annotation_selected_index < 0 || this.annotation_selected_index >= i) {
					set_annotation_selected.call(this, i - 1, true);
				}

				// Remove extras
				while (i < this.annotations.length) {
					remove_annotation.call(this, i, false);
				}

				// Tag and text
				i = 0;
				if (tag !== null && (t = Annotator.process_tag(tag)) !== null) {
					// Load from state
					j = Math.min(this.annotations.length, t.annotations.length);
					for (; i < j; ++i) {
						this.annotations[i].load_from_state(t.annotations[i], lines[i]);
					}
				}

				// Text and default size
				can_size = (this.image.size.width > 0 && this.image.size.height > 0);
				if (!can_size) this.update_annotation_sizes_on_image_load = [];
				for (; i < lines.length; ++i) {
					a = this.annotations[i];
					a.set_text(a.escape_text(lines[i]));
					if (i >= a_len_pre) {
						if (can_size) {
							// Default position
							if (sz === null) sz = get_annotation_default_size.call(this, false);

							a.set_font_size(sz.font_size_index);
							a.set_annotation_rect(sz.x, sz.y, sz.width, sz.height);
						}
						else {
							this.update_annotation_sizes_on_image_load.push(a);
						}
					}
				}

				// Re-bound
				rebound_annotations.call(this);
			}

			// Update
			update_annotation_full_text.call(this, false);
		};
		var update_annotation_full_text = function (omit_tag) {
			if (!omit_tag && (this.image.size.width <= 0 || this.image.size.height <= 0 || !this.visible)) return;

			var text = "",
				i, a, t;

			for (i = 0; i < this.annotations.length; ++i) {
				if (i > 0) text += "\n";
				a = this.annotations[i];
				if ((t = a.get_text_before()) !== null) {
					text += t;
					text += "\n";
				}
				text += ">";
				if (a.text_display.length > 0 && a.text_display[0] === ">") text += " ";
				text += a.text_display;
			}

			if (this.annotation_text_suffix !== null) {
				if (i > 0) text += "\n";
				text += this.annotation_text_suffix;
				++i;
			}

			// Tag
			if (this.annotations.length > 0 && !omit_tag) {
				if (i > 0) text += "\n";
				text += Annotator.generate_tag(this.image, this.annotations, this.annotation_text_suffix);
			}

			// Set text
			this.qr_controller.set_text(text);
		};

		var on_movable_mousedown = function (event) {
			if (this.move_event_list.length > 0) {
				remove_event_listeners(this.move_event_list);
				this.move_event_list = [];
			}
			add_event_listener(this.move_event_list, document, "mousemove", on_movable_document_mousemove.bind(this), true);
			add_event_listener(this.move_event_list, document, "mouseup", on_movable_document_mouseup.bind(this), true);
		};
		var on_movable_document_mousemove = function (event) {
			// Potentially moving
			if (this.qr_resize_timer === null) {
				this.qr_resize_timer = setTimeout(on_resize_delay_timeout.bind(this), 100);
				update_size.call(this);
			}
			else {
				this.qr_resized_during_timer = true;
			}
		};
		var on_movable_document_mouseup = function (event) {
			// Clear events
			if (this.qr_resize_timer !== null) {
				clearTimeout(this.qr_resize_timer);
				this.qr_resize_timer = null;
				this.qr_resized_during_timer = false;
			}

			remove_event_listeners(this.move_event_list);
			this.move_event_list = [];

			update_size.call(this);
		};
		var on_resize_delay_timeout = function () {
			this.qr_resize_timer = null;
			if (this.qr_resized_during_timer) {
				this.qr_resized_during_timer = false;
				update_size.call(this);
			}
		};
		var on_window_resize = function (event) {
			if (this.qr_container !== null) {
				if (this.qr_resize_timer === null) {
					this.qr_resize_timer = setTimeout(on_resize_delay_timeout.bind(this), 100);
					update_size.call(this);
				}
				else {
					this.qr_resized_during_timer = true;
				}
			}
		};

		var on_image_load = function (node, event) {
			if (this.image_load_poll !== null) {
				// Update image size
				this.image.size.width = node.naturalWidth;
				this.image.size.height = node.naturalHeight;
				style.add_class(node, "iex_ae_preview_image_visible");

				update_preview_size.call(this);
				rebound_annotations.call(this);

				if (this.update_annotation_sizes_on_image_load !== null) {
					apply_default_size_to_annotations.call(this, this.update_annotation_sizes_on_image_load);
					this.update_annotation_sizes_on_image_load = null;
				}

				update_annotation_full_text.call(this, false);
			}

			clear_image_events.call(this);

			style.add_class(node, "iex_ae_preview_image_loaded");
		};
		var on_image_error = function (node, event) {
			clear_image_events.call(this);

			style.remove_class(node, "iex_ae_preview_image_visible");
			style.remove_class(node, "iex_ae_preview_image_loaded");
			style.add_class(node, "iex_ae_preview_image_error");

			this.nodes.image_error.textContent = "Image failed to load";
		};
		var on_image_abort = function (node) {
		};
		var on_image_status_poll = function (node) {
			if (node.naturalWidth > 0 && node.naturalHeight > 0) {
				clearInterval(this.image_load_poll);
				this.image_load_poll = null;

				// Update image size
				this.image.size.width = node.naturalWidth;
				this.image.size.height = node.naturalHeight;
				style.add_class(node, "iex_ae_preview_image_visible");

				update_preview_size.call(this);
				rebound_annotations.call(this);

				if (this.update_annotation_sizes_on_image_load !== null) {
					apply_default_size_to_annotations.call(this, this.update_annotation_sizes_on_image_load);
					this.update_annotation_sizes_on_image_load = null;
				}

				update_annotation_full_text.call(this, false);
			}
		};

		var on_container_mouseover = function (event) {
			show_preview_scrollbars.call(this);
		};
		var on_container_mouseout = function (event) {
			hide_preview_scrollbars.call(this);
		};
		var on_container_mousewheel = function (event) {
			if (this.preview_move_events.length === 0) {
				// Get direction
				var delta = (event.wheelDelta || -event.detail || 0),
					new_zoom;

				if (delta > 0) {
					if (this.cpreview_zoom < 4) {
						new_zoom = this.cpreview_zoom + 0.5;
					}
					else {
						new_zoom = this.cpreview_zoom * 2;
					}
					if (new_zoom > 32) new_zoom = 32;
				}
				else {
					if (this.cpreview_zoom <= 4) {
						new_zoom = this.cpreview_zoom - 0.5;
					}
					else {
						new_zoom = this.cpreview_zoom / 2;
					}
					if (new_zoom < 1) new_zoom = 1;
				}

				if (new_zoom !== this.cpreview_zoom) {
					change_zoom_level.call(this, new_zoom, true, event.clientX, event.clientY);
				}
			}

			// Stop
			return stop_event(event);
		};
		var on_container_mousedown = function (event) {
			var button = get_event_mouse_button(event),
				display_size = this.cpreview.display,
				inner_size = this.cpreview.size,
				w, h;

			// Stop
			if (button !== 1 && button !== 2) {
				return stop_event(event);
			}

			// Else, start dragging
			w = (inner_size.width - display_size.width);
			h = (inner_size.height - display_size.height);
			if (w > 0) w = 1.0 / w;
			else w = 0;
			if (h > 0) h = 1.0 / h;
			else h = 0;

			this.preview_move_speed[0] = w;
			this.preview_move_speed[1] = h;
			this.preview_move_origin[0] = event.clientX;
			this.preview_move_origin[1] = event.clientY;
			this.preview_move_offset[0] = this.cpreview.offset_x;
			this.preview_move_offset[1] = this.cpreview.offset_y;
			remove_event_listeners(this.preview_move_events);
			this.preview_move_events = [];
			add_event_listener(this.preview_move_events, document, "mousemove", on_conatiner_move_document_mousemove.bind(this), true);
			add_event_listener(this.preview_move_events, document, "mouseup", on_conatiner_move_document_mouseup.bind(this), true);

			// Stop
			return stop_event(event);
		};
		var on_container_contextmenu = function (event) {
			return stop_event(event);
		};
		var on_conatiner_move_document_mousemove = function (event) {
			var xo, yo;

			xo = this.preview_move_offset[0] + (this.preview_move_origin[0] - event.clientX) * this.preview_move_speed[0];
			yo = this.preview_move_offset[1] + (this.preview_move_origin[1] - event.clientY) * this.preview_move_speed[1];

			if (xo < 0) xo = 0;
			else if (xo > 1) xo = 1;

			if (yo < 0) yo = 0;
			else if (yo > 1) yo = 1;

			this.cpreview.set_offset(xo, yo);

			update_preview_scrollbar_positions.call(this);
		};
		var on_conatiner_move_document_mouseup = function (event) {
			on_conatiner_move_document_mousemove.call(this, event);

			remove_event_listeners(this.preview_move_events);
			this.preview_move_events = [];
		};

		var on_color_index_select = function (index, event) {
			if (this.annotation_selected_index >= 0) {
				var a = this.annotations[this.annotation_selected_index];
				a.set_color_index_selected(index);
				update_annotation_color_index_selected.call(this);
				update_annotation_color_selected.call(this);
			}
		};
		var on_color_select = function (index, event) {
			if (this.annotation_selected_index >= 0) {
				var a = this.annotations[this.annotation_selected_index];
				a.set_color(a.get_color_index_selected(), index);
				update_annotation_color_selected.call(this);
				update_annotation_full_text.call(this, false);
			}
		};
		var on_new_note_empty_click = function (event) {
			on_new_note_click.call(this, event);
		};
		var on_new_note_click = function (event) {
			add_new_annotation.call(this);
		};
		var on_font_select = function (node, event) {
			if (this.annotation_selected_index >= 0) {
				var a = this.annotations[this.annotation_selected_index];
				a.set_font(parseInt(node.value, 10));
				update_annotation_full_text.call(this, false);
			}
		};
		var on_font_scale_select = function (node, event) {
			if (this.annotation_selected_index >= 0) {
				var a = this.annotations[this.annotation_selected_index];
				a.set_font_size(parseInt(node.value, 10));
				update_annotation_full_text.call(this, false);
			}
		};
		var on_font_bold_change = function (node, event) {
			if (this.annotation_selected_index >= 0) {
				var a = this.annotations[this.annotation_selected_index];
				a.set_font_bold(node.checked);
				update_annotation_full_text.call(this, false);
			}
		};
		var on_font_italic_change = function (node, event) {
			if (this.annotation_selected_index >= 0) {
				var a = this.annotations[this.annotation_selected_index];
				a.set_font_italic(node.checked);
				update_annotation_full_text.call(this, false);
			}
		};
		var on_halign_select = function (node, event) {
			if (this.annotation_selected_index >= 0) {
				var a = this.annotations[this.annotation_selected_index],
					align = a.get_align();

				align = (align & ~Annotation.AlignHorizontal) | parseInt(node.value, 10);

				a.set_align(align);
				update_annotation_full_text.call(this, false);
			}
		};
		var on_valign_select = function (node, event) {
			if (this.annotation_selected_index >= 0) {
				var a = this.annotations[this.annotation_selected_index],
					align = a.get_align();

				align = (align & ~Annotation.AlignVertical) | parseInt(node.value, 10);

				a.set_align(align);
				update_annotation_full_text.call(this, false);
			}
		};
		var on_text_decoration_select = function (node, event) {
			if (this.annotation_selected_index >= 0) {
				var a = this.annotations[this.annotation_selected_index];
				a.set_text_decoration(parseInt(node.value, 10));
				update_annotation_full_text.call(this, false);
			}
		};
		var on_restore_annotations_click = function (event) {
			if (this.annotations_previous !== this.annotations && this.annotations_previous.length > 0) {
				// Hide links
				set_empty_links_visible.call(this, false);

				// Clear
				var i;
				for (i = 0; i < this.annotations.length; ++i) {
					this.annotations[i].destroy();
				}

				// Restore
				this.annotations = this.annotations_previous;
				for (i = 0; i < this.annotations.length; ++i) {
					this.annotations[i].add_to(this.nodes.annotation_container, this.nodes.edit_container);
				}
				this.annotation_text_suffix = this.annotation_text_suffix_previous;
				this.annotation_text_suffix_previous = null;

				// Select
				set_annotation_selected.call(this, 0, true);

				// Update
				update_annotation_full_text.call(this, false);
			}
		};

		var on_annotation_event = {
			select: function (annotation) {
				if (!annotation.is_selected()) {
					set_annotation_selected.call(this, annotation.index, false);
				}
			},
			align: function (annotation) {
				var a = annotation.get_align(),
					ha = a & Annotation.AlignHorizontal;

				a &= ~Annotation.AlignHorizontal;

				if (ha === Annotation.AlignCenter) ha = Annotation.AlignRight;
				else if (ha === Annotation.AlignRight) ha = Annotation.AlignLeft;
				else if (ha === Annotation.AlignLeft) ha = Annotation.AlignJustify;
				else ha = Annotation.AlignCenter;

				annotation.set_align(a | ha);
				if (annotation.is_selected()) {
					update_annotation_align_selected.call(this);
				}

				update_annotation_full_text.call(this, false);
			},
			color: function (annotation) {
				annotation.set_color_index_selected((annotation.get_color_index_selected() + 1) % annotation.get_color_count());
				if (annotation.is_selected()) {
					update_annotation_color_index_selected.call(this);
					update_annotation_color_selected.call(this);
				}

				update_annotation_full_text.call(this, false);
			},
			font: function (annotation) {
				if (annotation.get_font_bold()) {
					if (annotation.get_font_italic()) {
						annotation.set_font_bold(false);
					}
					else {
						annotation.set_font_italic(true);
					}
				}
				else {
					if (annotation.get_font_italic()) {
						annotation.set_font_italic(false);
					}
					else {
						annotation.set_font_bold(true);
					}
				}

				if (annotation.is_selected()) {
					update_annotation_font_bold_selected.call(this);
					update_annotation_font_italic_selected.call(this);
				}

				update_annotation_full_text.call(this, false);
			},
			font_size: function (annotation) {
				var size = annotation.get_font_size();
				size = (size + 1) % (Annotation.font_size_settings.step_duration * Annotation.font_size_settings.step_count);

				annotation.set_font_size(size);

				if (annotation.is_selected()) {
					update_annotation_font_size_selected.call(this);
				}

				update_annotation_full_text.call(this, false);
			},
			move_up: function (annotation) {
				if (annotation.index > 0) {
					var annotation_index_old = annotation.index,
						annotation_index_new = annotation_index_old - 1,
						other = this.annotations[annotation_index_new],
						b = annotation.get_text_before();

					annotation.insert_before(other);

					annotation.set_index(annotation_index_new);
					other.set_index(annotation_index_old);
					this.annotations.splice(annotation_index_old, 1);
					this.annotations.splice(annotation_index_new, 0, annotation);

					annotation.set_text_before(other.get_text_before());
					other.set_text_before(b);

					if (this.annotation_selected_index === annotation_index_old) {
						this.annotation_selected_index = annotation_index_new;
					}
					else if (this.annotation_selected_index === annotation_index_new) {
						this.annotation_selected_index = annotation_index_old;
					}

					update_annotation_full_text.call(this, false);
				}
			},
			move_down: function (annotation) {
				var index_max = this.annotations.length - 1,
					other, annotation_index_new, annotation_index_old, b;

				if (annotation.index < index_max) {
					annotation_index_old = annotation.index;
					annotation_index_new = annotation_index_old + 1;
					other = this.annotations[annotation_index_new];
					b = annotation.get_text_before();

					if (annotation_index_old === index_max - 1) {
						annotation.add_to(this.nodes.annotation_container, this.nodes.edit_container);
					}
					else {
						annotation.insert_before(this.annotations[annotation_index_new + 1]);
					}

					annotation.set_index(annotation_index_new);
					other.set_index(annotation_index_old);
					this.annotations.splice(annotation_index_old, 1);
					this.annotations.splice(annotation_index_new, 0, annotation);

					annotation.set_text_before(other.get_text_before());
					other.set_text_before(b);

					if (this.annotation_selected_index === annotation_index_old) {
						this.annotation_selected_index = annotation_index_new;
					}
					else if (this.annotation_selected_index === annotation_index_new) {
						this.annotation_selected_index = annotation_index_old;
					}

					update_annotation_full_text.call(this, false);
				}
			},
			remove: function (annotation) {
				remove_annotation.call(this, annotation.index, true);
			},
			// text_input: function (annotation) {},
			text_change: function (/*annotation*/) {
				update_annotation_full_text.call(this, false);
			},
			rect_changed: function (/*annotation*/) {
				update_annotation_full_text.call(this, false);
			},
		};



		AnnotationEditor.prototype = {
			constructor: AnnotationEditor,

			set_qr_container: function (qr_container) {
				if (this.qr_container !== qr_container) {
					if (this.qr_container !== null) {
						remove_nodes.call(this);
						remove_qr_events.call(this);
					}

					this.qr_container = qr_container;

					if (this.qr_container !== null) {
						create_nodes.call(this);
						setup_qr_events.call(this);
					}
				}
			},
			set_file: function (file, url, mode, extra) {
				// Set image
				set_image.call(this, url, mode, extra);
			},
			show: function () {
				if (this.qr_container === null || this.visible) return;

				this.visible = true;
				style.add_class(this.nodes.container, "iex_annotation_editor_visible");
				update_size.call(this);
				//this.load_annotations_from_text(this.qr_controller.get_text());
			},
			hide: function () {
				if (this.qr_container === null || !this.visible) return;

				this.visible = false;
				style.remove_class(this.nodes.container, "iex_annotation_editor_visible");
				update_annotation_full_text.call(this, true);
				clear_annotation_lines.call(this);
			},
			is_visible: function () {
				return this.visible;
			},
			load_annotations_from_text: function (text) {
				var lines = [],
					lines_before = [],
					tag = null,
					m;

				// Find lines
				while ((m = re_load_annotations.exec(text)) !== null) {
					text = text.substr(m.index + m[0].length);

					lines.push(m[2].trim());
					lines_before.push(m[1] === undefined ? null : m[1]);

					if (m[3].length === 0) {
						text = null;
						break;
					}
				}

				// Find tag
				if (text !== null && (m = re_load_tag.exec(text)) !== null) {
					// Load tag
					text = (m[1] === undefined ? null : m[1]);
					tag = m[3];
				}

				// Load
				load_annotation_lines.call(this, lines, lines_before, text, tag);
			},

			get_image_scale: function () {
				return this.preview_scale;
			},
			get_image_size: function () {
				return this.image.size;
			},
			on_annotation_event: function (annotation, event_name) {
				var fn = on_annotation_event[event_name];
				if (fn !== undefined) {
					fn.call(this, annotation);
				}
			},
		};



		return AnnotationEditor;

	})();
/*</feature:annotation-editor>*/
/*</feature:annotations>*/

	// Setup objects
	style = new Style();
	api = new API();
	sync = new Sync();
	settings = new Settings();
	hotkey_manager = new HotkeyManager();

	// Execute once page type is detected
	api.on("page_type_detected", function (event) {
/*<debug>*/
		// End timing
		var timing_end = timing();
		console.log("iex start duration: " + (timing_end - timing_start).toFixed(3) + "ms");
/*</debug>*/
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

			/*<feature:annotations>*/
			settings.on_ready(function () {
				// Check if enabled
				if (settings.values.annotations.enabled) {
					// Insert stylesheet
					style.insert_stylesheet_annotations();

					// Annotator
					var annotator = new Annotator();
					settings.on_ready(annotator.start.bind(annotator, image_hover, file_link));

					/*<feature:annotation-editor>*/
					if (settings.values.annotations.editor) {
						// Quick reply controller
						new QuickReplyController();
					}
					/*</feature:annotation-editor>*/
				}
			});
			/*</feature:annotations>*/
		}
		else if (event.page_type == "image" || event.page_type == "video") {
			// Settings
			settings.setup();

			// File view
			file_view = new FileView();
			/*<feature:annotations>*/
			file_view.on("image", function (image) {
				// Check if enabled
				if (settings.values.annotations.enabled_standalone) {
					// Check url
					var d = Annotator.check_url();
					if (d !== null) {
						// Insert stylesheet
						style.insert_stylesheet_annotations();
						// Create overlay
						Annotator.create_image_overlay(image, d);
					}
				}
			});
			/*</feature:annotations>*/
			settings.on_ready(file_view.start.bind(file_view));
		}
/*<debug>*/
		// End timing
		var timing_end2 = timing();
		console.log("iex ready duration: " + (timing_end2 - timing_start).toFixed(3) + "ms (" + (timing_end2 - timing_end).toFixed(3) + "ms)");
/*</debug>*/
	});
	api.setup();

/*<debug>*/
	// End timing
	var timing_end = timing();
	console.log("iex init duration: " + (timing_end - timing_start).toFixed(3) + "ms");
/*</debug>*/

})();


