

(function () {
	"use strict";



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



	// Variables
	var homepage = null, style = null, navigation = null, navigation_history = null;



	// Module for performing actions as soon as possible
	var ASAP = (function () {

		// Variables
		var state = 0;
		var callbacks_asap = [];
		var callbacks_ready = [];
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

		// Trigger callbacks
		var trigger_callbacks = function (callback_list) {
			for (var i = 0, j = callback_list.length; i < j; ++i) {
				callback_list[i].call(window);
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
					The call is formatted as such:
						callback.call(window);
			*/
			asap: function (callback) {
				if (callbacks_asap === null) {
					// Call
					callback.call(window);
				}
				else {
					// Add
					callbacks_asap.push(callback);
				}
			},
			/**
				Call a function as soon as possible when the DOM is fully loaded
				(document.readyState == "complete")

				@param callback
					The callback to be called
					The call is formatted as such:
						callback.call(window);
			*/
			ready: function (callback) {
				if (callbacks_ready === null) {
					// Call
					callback.call(window);
				}
				else {
					// Add
					callbacks_ready.push(callback);
				}
			},

		};

	})();



	// Class to manage page styling
	var Style = (function () {

		var Style = function () {
		};



		Style.prototype = {
			constructor: Style,

			get_true_style: function (element, style_name) {
				var s = window.getComputedStyle(element);
				return style_name ? s[style_name] : s;
			},
			has_class: function (element, classname) {
				return (new RegExp("(\\s|^)" + classname + "(\\s|$)")).test(element.className)
			},
			add_class: function (element, classname) {
				if (element.classList) {
					element.classList.add(classname);
				}
				else {
					element.className = (element.className + " " + classname).trim();
				}
			},
			remove_class: function (element, classname) {
				if (element.classList) {
					element.classList.remove(classname);
				}
				else {
					var reg = new RegExp("(\\s|^)" + classname + "(\\s|$)");
					var newCls = element.className.replace(reg, "").trim();
					if (newCls != element.className) element.className = newCls;
				}
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

		};



		return Style;

	})();

	// Class to manage URL navigation
	var Navigation = (function () {


		var Navigation = function () {
			this.page_type = "";
			this.page_data = {};

			// Get location data
			var loc_data = this.get_location_data(window.location);
			this.path = loc_data.path;
			this.search = loc_data.search;
			this.hash = loc_data.hash;

			// Events
			window.addEventListener("popstate", (this.on_window_popstate_bind = on_window_popstate.bind(this)), false);
			this.events = {
				"change": []
			};

			// Page type detection
			if (this.path[0] == "") {
				this.page_type = "search";
			}
			else if (this.path[0] == "g") {
				if (this.path.length >= 3) {
					this.page_type = "gallery";
					this.page_data.gallery_id1 = this.path[1];
					this.page_data.gallery_id2 = this.path[2];
				}
			}
			else if (this.path[0] == "s") {
				if (this.path.length >= 3) {
					var m = /^(.+)-(.+)$/.exec(this.path[2]);
					if (m) {
						this.page_type = "view";
						this.page_data.gallery_key = this.path[1];
						this.page_data.gallery_id1 = m[1];
						this.page_data.gallery_page = (parseInt(m[2], 10) || 0) - 1;
					}
				}
			}
			else if (this.path[0] == "favorites.php") {
				this.page_type = "favorites";
				// Decode vars
				var vars = this.decode_vars(window.location.search.substr(1));
				if ("favcat" in vars) {
					this.page_data.category = parseInt(vars.favcat, 10) || 0;
					if (this.page_data.category < 0) this.page_data.category = 0;
					else if (this.page_data.category >= 10) this.page_data.category = 9;
				}
				else {
					this.page_data.category = -1;
				}
			}
		};



		Navigation.instance = null;



		var on_window_popstate = function (event) {
			// Update
			var loc_data = this.get_location_data(window.location);
			this.path = loc_data.path;
			this.search = loc_data.search;
			this.hash = loc_data.hash;

			// Trigger change
			trigger.call(this, "change", {
				navigation: this,
				auto: true,
				init: false
			});
		};

		var trigger = function (event, data) {
			// Add callback
			if (event in this.events) {
				var e_list = this.events[event];
				for (var i = 0; i < e_list.length; ++i) {
					e_list[i].call(this, data);
				}
			}
			else {
				log_error("Invalid Navigation event triggered");
			}
		};



		Navigation.prototype = {
			constructor: Navigation,

			destroy: function () {
				// Remove events
				if (this.on_window_popstate_bind !== null) {
					window.removeEventListener("popstate", this.on_window_popstate_bind, false);
					this.on_window_popstate_bind = null;
				}
			},

			escape_var: function (s) {
				return encodeURIComponent().replace(/\%20/g, "+");
			},
			unescape_var: function (s) {
				return decodeURIComponent(s.replace(/\+/g, "%20"));
			},
			encode_vars: function (vars) {
				var str = [];

				for (var v in vars) {
					if (vars[v] == null) {
						str.push(this.escape_var(v));
					}
					else {
						str.push(this.escape_var(v) + "=" + this.escape_var(vars[v]));
					}
				}

				return str.join("&");
			},
			decode_vars: function (str) {
				var vars = {};
				var s_split = str.split("&");
				var pattern = /^(.*?)(?:=(.*))?$/;
				var m;

				for (var i = 0; i < s_split.length; ++i) {
					// Get the match
					if (s_split[i].length == 0) continue;
					m = pattern.exec(s_split[i]);

					// Set the var
					vars[this.unescape_var(m[1])] = (m[2] == null) ? null : this.unescape_var(m[2]);
				}

				// Return the vars
				return vars;
			},
			encode_path: function (path) {
				return path.join("/");
			},
			decode_path: function (path) {
				return path.split("/");
			},
			encode: function (path, search, hash) {
				if (search) path += "?" + search;
				if (hash) path += "#!" + hash;
				return path;
			},

			get_location: function (url) {
				var match = /^(?:(.+?):)?(?:\/\/([^\/]+))?(.*?)(\?.+?)?(#.+)?$/.exec(url),
					data = {
						protocol: "",
						hostname: "",
						pathname: "",
						search: "",
						hash: ""
					};

				if (match) {
					data.protocol = match[1] || "";
					data.hostname = match[2] || "";
					data.pathname = match[3];
					data.search = match[4] || "";
					data.hash = match[5] || "";
				}

				return data;
			},
			get_location_data: function (loc) {
				var start = (loc.hash[1] == "!") ? 2 : 1;
				var hash = loc.hash.substr(start);
				var match = /^([^\?]*)(?:\?(.*))?$/.exec(hash);

				var path = loc.pathname.replace(/^\/+|\/+$/g, "").split("/");
				var search = this.decode_vars(loc.search.substr(1));

				var hash_path = match[1].replace(/^\/+|\/+$/g, "").split("/");
				var hash_search = this.decode_vars(match[2] || "");

				return {
					path: path,
					search: search,
					hash: {
						path: hash_path,
						search: hash_search
					}
				};
			},

			go_to: function (target) {
				// Change url
				window.location = target;
			},
			go_to_in_new: function (target) {
				// Change url
				var new_window;
				try {
					new_window = GM_openInTab(target);
				}
				catch (e) {
					new_window = window.open(target, "_blank");
				}
			},
			replace: function (target, overwrite) {
				if (overwrite) {
					// Passive url change and overwrite
					window.history.replaceState({}, "replace.overwrite", target);
				}
				else {
					// Passive url change
					window.history.pushState({}, "replace.overwrite", target);
				}

				// Update
				var loc_data = this.get_location_data(window.location);
				this.path = loc_data.path;
				this.search = loc_data.search;
				this.hash = loc_data.hash;

				// Trigger change
				trigger.call(this, "change", {
					navigation: this,
					auto: false,
					init: false
				});
			},

			trigger_init_change: function () {
				// Trigger change
				trigger.call(this, "change", {
					navigation: this,
					auto: false,
					init: true
				});
			},

			on: function (event, callback) {
				// Add callback
				if (event in this.events) {
					this.events[event].push(callback);
				}
				else {
					log_error("Invalid Navigation event");
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
				else {
					log_error("Invalid Navigation event");
				}

				return false;
			},

		};



		return Navigation;

	})();

	// Class to manage navigation history
	var NavigationHistory = (function () {
		var NavigationHistory = function (navigation) {
			this.navigation = navigation;

			this.history = {};

			this.events = {
				"change": []
			};

			this.navigation.on("change", this.on_navigation_change_bind = on_navigation_change.bind(this));
		};



		var on_navigation_change = function (data) {
			var key = data.navigation.hash.path.join("/");
			var first = !(key in this.history);
			if (first) {
				this.history[key] = true;
			}

			// Trigger
			trigger.call(this, "change", {
				navigation: data.navigation,
				auto: data.auto,
				init: data.init,
				first: first
			});
		};

		var trigger = function (event, data) {
			// Add callback
			if (event in this.events) {
				var e_list = this.events[event];
				for (var i = 0; i < e_list.length; ++i) {
					e_list[i].call(this, data);
				}
			}
			else {
				log_error("Invalid NavigationHistory event triggered");
			}
		};



		NavigationHistory.prototype = {
			constructor: NavigationHistory,

			destroy: function () {
				if (this.on_navigation_change_bind !== null) {
					this.navigation.off("change", this.on_navigation_change_bind);
					this.on_navigation_change_bind = null;
				}
			},

			on: function (event, callback) {
				// Add callback
				if (event in this.events) {
					this.events[event].push(callback);
				}
				else {
					log_error("Invalid NavigationHistory event");
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
				else {
					log_error("Invalid NavigationHistory event");
				}

				return false;
			},

		};



		return NavigationHistory;

	})();

	// Basic homepage management
	var Homepage = (function () {

		var Homepage = function () {
			// Events
			navigation_history.on("change", this.on_navigation_change_bind = on_navigation_change.bind(this));

			// Pages
			this.page_data = {
				aliases: {},
				pages: {
					"": {}
				}
			};
			this.page_default = [ "" ];
			this.page_current = null;
			this.page_events = {
				"open": [],
				"close": [],
			};

		};



		var on_navigation_change = function (data) {
			// Vars
			var path = data.navigation.hash.path;

			// Close
			if (this.page_current !== null) {
				trigger_page_event.call(this, "close", this.page_current, {});
			}

			// Update page location
			var pd = this.page_data, pk, reason = "okay";
			this.page_current = [];
			for (var i = 0; i < path.length; ++i) {
				if (path[i] in pd.pages) {
					pk = path[i];
				}
				else if ("aliases" in pd && path[i] in pd.aliases) {
					pk = pd.aliases[path[i]];
				}
				else {
					// Default
					reason = "404";
					this.page_current = this.page_default.slice(0);
					break;
				}

				// Continue
				this.page_current.push(pk);
				pd = pd.pages[pk];
			}

			// Open
			trigger_page_event.call(this, "open", this.page_current, {
				change_data: data,
				reason: reason,
				path: this.page_current
			});
		};

		var compare_paths = function (path1, path2) {
			if (path1.length != path2.length) return false;

			for (j = 0; j < path1.length; ++j) {
				if (path1[j] != path2[j]) return false;
			}

			return true;
		};

		var trigger_page_event = function (event, path, data) {
			// Add callback
			if (event in this.page_events) {
				var e_list = this.page_events[event],
					i, j, okay, e_path;

				for (i = 0; i < e_list.length; ++i) {
					// Match check
					e_path = e_list[i].path;
					okay = (e_list[i].exact) ? (path.length == e_path.length) : (path.length >= e_path.length);
					if (okay) {
						for (j = 0; j < e_path.length; ++j) {
							if (e_path[j] != path[j]) {
								okay = false;
								break;
							}
						}

						if (okay) {
							// Callback
							e_list[i].callback.call(this, data);
						}
					}
				}
			}
			else {
				log_error("Invalid NavigationHistory event triggered");
			}
		};



		Homepage.prototype = {
			constructor: Homepage,

			destroy: function () {
				if (this.on_navigation_change_bind !== null) {
					navigation_history.off("change", this.on_navigation_change_bind);
					this.on_navigation_change_bind = null;
				}

				this.page_events = {};
			},

			setup: function (page_data, page_default) {
				this.page_data = page_data;
				this.page_default = page_default;
			},

			on_page: function (event, path, exact, callback) {
				// Add callback
				if (event in this.page_events) {
					this.page_events[event].push({
						path: path,
						callback: callback,
						exact: exact
					});
				}
				else {
					log_error("Invalid Homepage event");
				}
			},
			off_page: function (event, path, exact, callback) {
				// Add callback
				if (event in this.page_events) {
					var e_list = this.page_events[event];
					for (var i = 0; i < e_list.length; ++i) {
						if (e_list[i].callback === callback && e_list[i].exact == exact && compare_paths.call(this, e_list[i].path, path)) {
							// Remove
							e_list.splice(i, 1);
							return true;
						}
					}
				}
				else {
					log_error("Invalid Homepage event");
				}

				return false;
			},

		};



		return Homepage;

	})();

	// ChangeLog
	var ChangeLog = (function () {

		var ChangeLog = function (repo_user, repo_name, target_container, target_error_container, target_version_container) {
			this.acquired = false;
			this.status = true;

			this.repo_user = repo_user;
			this.repo_name = repo_name;

			this.cl_data = null;
			this.changelog = null;

			this.target_container = target_container;
			this.target_error_container = target_error_container;
			this.target_version_container = target_version_container;

			this.xhr = new XMLHttpRequest();

			// Open
			var url ="https://api.github.com/repos/" + repo_user + "/" + repo_name + "/commits";

			this.xhr.open("GET", url, true);
			this.xhr.responseType = "json";

			this.xhr.addEventListener("load", on_ajax_load.bind(this), false);
			this.xhr.addEventListener("loadend", on_ajax_complete.bind(this), false);

			this.xhr.send();
		};



		// Date formatting
		var date = (function () {

			var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
			var months_short = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
			var days_short = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
			var ordinal = ["st", "nd", "rd", "th", "th", "th", "th", "th", "th", "th", "th", "th", "th", "th", "th", "th", "th", "th", "th", "th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th", "th", "st"];

			var format_value = function (date, format) {
				var s = "";
				if (format == 'd') { // Day of the month, 2 digits with leading zeros
					s += date.getDate();
					if (s.length < 2) s = "0" + s;
				}
				else if (format == 'j') { // Day of the month without leading zeros
					s += date.getDate();
				}
				else if (format == 'l') { // A full textual representation of the day of the week
					s += days[date.getDay()];
				}
				else if (format == 'D') { // A textual representation of a day, three letters
					s += days_short[date.getDay()];
				}
				else if (format == 'S') { // English ordinal suffix for the day of the month, 2 characters
					s +=ordinal[date.getDate() - 1];
				}
				else if (format == 'w') { // Numeric representation of the day of the week
					s += date.getDay();
				}
				else if (format == 'F') { // A full textual representation of a month, such as January or March
					s += months[date.getMonth()];
				}
				else if (format == 'M') { // A short textual representation of a month, three letters
					s += months_short[date.getMonth()];
				}
				else if (format == 'm') { // Numeric representation of a month, with leading zeros
					s += (date.getMonth() + 1);
					if (s.length < 2) s = "0" + s;
				}
				else if (format == 'n') { // Numeric representation of a month, without leading zeros
					s += (date.getMonth() + 1);
				}
				else if (format == 'y') { // Year, 2 digits
					s += date.getFullYear().toString().substr(2);
				}
				else if (format == 'Y') { // A full numeric representation of a year, 4 digits
					s += date.getFullYear();
				}
				else if (format == 'a') { // Lowercase Ante meridiem and Post meridiem
					s += (date.getHours() >= 11 && date.getHours() <= 22 ? "pm" : "am");
				}
				else if (format == 'A') { // Uppercase Ante meridiem and Post meridiem
					s += (date.getHours() >= 11 && date.getHours() <= 22 ? "PM" : "AM");
				}
				else if (format == 'g') { // 12-hour format of an hour without leading zeros
					s += (date.getHours() % 12) + 1;
				}
				else if (format == 'h') { // 12-hour format of an hour with leading zeros
					s += (date.getHours() % 12) + 1;
					if (s.length < 2) s = "0" + s;
				}
				else if (format == 'G') { // 24-hour format of an hour without leading zeros
					s += date.getHours();
				}
				else if (format == 'H') { // 24-hour format of an hour with leading zeros
					s += date.getHours();
					if (s.length < 2) s = "0" + s;
				}
				else if (format == 'i') { // Minutes with leading zeros
					s += date.getMinutes();
					if (s.length < 2) s = "0" + s;
				}
				else if (format == 's') { // Seconds with leading zeros
					s += date.getSeconds();
					if (s.length < 2) s = "0" + s;
				}
				else if (format == 'u') { // Microseconds
					s += date.getMilliseconds();
				}
				else { // Unknown
					s += format;
				}
				return s;
			}

			return {

				format: function (timestamp, format) {
					// Based on: http://php.net/manual/en/function.date.php
					var date = new Date(timestamp);

					return format.replace(/(\\*)([a-zA-Z])/g, function (match, esc, fmt) {
						if (esc.length > 0) {
							if ((esc.length % 2) == 1) {
								// Escaped
								return esc.substr(1, (esc.length - 1) / 2) + fmt;
							}
							// Remove slashes
							return esc.substr(0, esc.length / 2) + format_value(date, fmt);
						}
						return format_value(date, fmt);
					});
				}

			};

		})();
		var title_is_relevant = function (title) {
			return /^\s*[0-9\.]+\s*$/.test(title);
		};
		var parse = function () {
			var changelog = [],
				cl_data = this.cl_data;

			for (var i = 0; i < cl_data.length; ++i) {
				var title = cl_data[i].commit.message.replace(/\s*\n\s*(0|[^0])*$/g, "");

				if (title_is_relevant.call(this, title)) {
					var entry = {
						sha: cl_data[i].sha,
						title: title,
						comment: cl_data[i].commit.message.replace(/^[^\r\n]*\r?\n?\r?\n?/g, ""),
						timestamp: 0,
						url: cl_data[i].html_url,
					};

					var date = /^([0-9]+)-([0-9]+)-([0-9]+)T([0-9]+):([0-9]+):([0-9]+)Z$/.exec(cl_data[i].commit.committer.date);
					if (date) {
						entry.timestamp = (new Date(
							parseInt(date[1]),
							parseInt(date[2]) - 1,
							parseInt(date[3]),
							parseInt(date[4]),
							parseInt(date[5]),
							parseInt(date[6])
						)).getTime();
					}

					changelog.push(entry);
				}
			}

			// Set
			this.changelog = changelog;
		};

		var display = function () {
			if (!this.changelog) return;

			var timezone_offset = -(new Date()).getTimezoneOffset() * 60 * 1000,
				changelog = this.changelog;

			if (this.target_container) {
				var i, j, c, n, item, title, content, changes;

				for (i = 0; i < changelog.length; ++i) {
					c = changelog[i];

					item = document.createElement("div");
					item.className = "changelog_item";

					// Title
					title = document.createElement("div");
					title.className = "changelog_item_title";
					item.appendChild(title);

					n = document.createElement("a");
					n.className = "changelog_item_title_link";
					n.setAttribute("target", "_blank");
					n.setAttribute("href", c.url);
					n.textContent = c.title;
					title.appendChild(n);

					n = document.createElement("span");
					n.className = "changelog_item_title_date";
					n.textContent = date.format(c.timestamp + timezone_offset, "F jS, Y @ G:i");
					title.appendChild(n);

					// Content
					content = document.createElement("ul");
					content.className = "changelog_item_content";
					item.appendChild(content);

					// Fix back into a single line if necessary (lines must begin with "- " to be correct)
					changes = c.comment.split("\n");
					for (j = 0; j < changes.length; ++j) {
						if (!/^-\s/.test(changes[j]) && j > 0) {
							changes[j - 1] = changes[j - 1].replace(/\s+$/g, "") + " " + changes[j].replace(/^\s+/g, "");
							changes.splice(j, 1);
							--j;
						}
					}
					for (j = 0; j < changes.length; ++j) {
						changes[j] = changes[j].replace(/^-\s*|\s+$/g, "");
					}
					// Add change
					for (j = 0; j < changes.length; ++j) {
						n = document.createElement("li");
						n.className = "changelog_item_change";
						n.textContent = changes[j];
						content.appendChild(n);
					}

					// Add
					this.target_container.appendChild(item);
				}

				// Show
				style.add_class(this.target_container, "changelog_visible");
			}

			if (this.target_version_container) {
				// Display?
				if (changelog.length > 0) {
					// Show
					style.add_class(this.target_version_container, "changelog_version_visible");
					this.target_version_container.textContent = changelog[0].title;
				}
			}
		};
		var display_error = function () {

			if (this.target_error_container) {
				// Show
				style.add_class(this.target_error_container, "changelog_error_visible");
			}

		};

		var on_ajax_load = function (event) {
			// Status code
			if (this.xhr.status == 200) {
				// Get
				this.acquired = true;
				this.status = true;

				this.cl_data = this.xhr.response;
				parse.call(this);
				display.call(this);
			}
			// else, error
		};
		var on_ajax_complete = function (event) {
			if (this.acquired) return;
			this.acquired = true;

			// Some sort of error
			this.status = false;
			display_error.call(this);
		};



		ChangeLog.prototype = {
			constructor: ChangeLog,

		};



		return ChangeLog;


	})();

	// Pop up preview
	var PreviewImagePopUp = (function () {

		var active_instances = [];
		var transition_events = [ "transitionend" , "webkitTransitionEnd" , "oTransitionEnd" , "otransitionend" ];



		var PreviewImagePopUp = function (container, data) {
			var n, i, t_str;


			// Images
			this.images = data.image_urls;
			this.image_nodes = [];
			this.image_loaded = [];
			this.image_id = 0;
			this.timings = data.image_timings;
			this.switch_timer = null;
			this.preview = data.preview;
			this.target_width = data.image_res[0];
			this.target_height = data.image_res[1];
			//this.closing = false;
			this.closing_state = 0;
			this.closing_timer = null;
			this.transitions = data.transitions;
			this.container = container;

			this.on_expansion_transition_end_bind = on_expansion_transition_end.bind(this);
			this.on_image_load_bind = wrap_callback(on_image_load, [ this ]);
			this.on_image_error_bind = wrap_callback(on_image_error, [ this ]);
			this.on_switch_timeout_bind = on_switch_timeout.bind(this);
			this.on_close_timeout_bind = on_close_timeout.bind(this);


			// Create new
			t_str = (this.transitions ? " transitions" : "");

			style.add_class(this.preview, "demo_image_preview_expanded");

			this.expansion = document.createElement("div");
			this.expansion.className = "demo_image_preview_expansion" + t_str;
			for (i = 0; i < transition_events.length; ++i) {
				this.expansion.addEventListener(transition_events[i], this.on_expansion_transition_end_bind, false);
			}

			this.expansion_size = document.createElement("div");
			this.expansion_size.className = "demo_image_preview_expansion_size" + t_str;
			this.expansion.appendChild(this.expansion_size);

			this.expansion_image_container = document.createElement("div");
			this.expansion_image_container.className = "demo_image_preview_expansion_image_container" + t_str;
			this.expansion_size.appendChild(this.expansion_image_container);

			/*
			// Spawning a new thumbnail causes flashing on Chrome
			this.expansion_thumbnail_class = null;
			this.expansion_thumbnail = document.createElement("div");
			this.expansion_thumbnail.className = "demo_image_preview_expansion_image_thumbnail";
			this.expansion_thumbnail.style.backgroundImage = "url('" + data.thumb_url + "')";
			this.expansion_image_container.appendChild(this.expansion_thumbnail);
			*/

			this.expansion_thumbnail = this.preview.querySelector(".demo_image_preview_background_image");
			this.expansion_thumbnail_class = null;
			if (this.expansion_thumbnail) {
				this.expansion_thumbnail_class =  this.expansion_thumbnail.className;
				this.expansion_thumbnail.className = "demo_image_preview_expansion_image_thumbnail";
				this.expansion_image_container.appendChild(this.expansion_thumbnail);
			}

			this.expansion_border = document.createElement("div");
			this.expansion_border.className = "demo_image_preview_expansion_border";
			this.expansion_size.appendChild(this.expansion_border);

			for (i = 0; i < this.images.length; ++i) {
				n = document.createElement("img");
				this.image_nodes.push(n);
				this.image_loaded.push(false);

				n.className = "demo_image_preview_expansion_image demo_image_preview_expansion_image_hidden demo_image_preview_expansion_image_not_loaded" + t_str;
				n.addEventListener("load", this.on_image_load_bind, false);
				n.addEventListener("error", this.on_image_error_bind, false);
				n.setAttribute("src", this.images[i]);
				this.expansion_image_container.appendChild(n);
			}


			// Set size
			if (this.transitions) {
				change_to_small_size.call(this, true);
				setTimeout(change_to_full_size.bind(this), 10);
			}
			else {
				change_to_full_size.call(this);
			}


			// Set and add
			this.container.appendChild(this.expansion);

			// Update container
			style.add_class(this.container, "demo_image_preview_expansion_container");

			// Update
			active_instances.push(this);
		};



		PreviewImagePopUp.open = function (container, data) {
			for (var i = 0; i < active_instances.length; ++i) {
				if (active_instances[i].container === container) {
					// Old
					active_instances[i].show(data);
					return active_instances[i];
				}
			}

			// New
			return new PreviewImagePopUp(container, data);
		};
		PreviewImagePopUp.close = function (container) {
			// Get
			for (var i = 0; i < active_instances.length; ++i) {
				if (active_instances[i].container === container) {
					// Old
					active_instances[i].close();
					return true;
				}
			}

			// Not found
			return false;
		};



		var on_image_load = function (self, event) {
			// Unhide
			style.remove_class(this, "demo_image_preview_expansion_image_not_loaded");

			// Find id
			var i, n;
			for (i = 0; i < self.image_nodes.length; ++i) {
				n = self.image_nodes[i];
				if (n === this) {
					// Loaded
					self.image_loaded[i] = true;
					display_update.call(self, i);
					break;
				}
			}
		};
		var on_image_error = function (self, event) {
			// Remove from list
			var i, n;
			for (i = 0; i < self.image_nodes.length; ++i) {
				n = self.image_nodes[i];
				if (n === this) {
					// Remove
					remove_image_events.call(self, n);
					self.image_nodes.splice(i, 1);
					self.image_loaded.splice(i, 1);
					if (self.image_id > i) --self.image_id;

					// Load check
					display_update.call(self, i);

					// Done
					break;
				}
			}
		};
		var on_switch_timeout = function () {
			// No timer
			this.switch_timer = null;

			// Change image
			display_hide.call(this, this.image_id);
			this.image_id = get_next_image_id.call(this, this.image_id);
			display_update.call(this, this.image_id);
		};
		var on_close_timeout = function () {
			this.closing_timer = null;

			if (this.closing_state == 1) {
				var c_rect = get_object_rect(this.container),
					t_rect = get_object_rect(this.expansion);

				// Change positioning
				this.closing_state = 2;
				style.add_class(this.expansion, "demo_image_preview_expansion_absolute");

				// Change position
				this.expansion.style.left = (t_rect.left - c_rect.left) + "px";
				this.expansion.style.top = (t_rect.top - c_rect.top) + "px";

				// Next
				this.closing_timer = setTimeout(this.on_close_timeout_bind, 20);
			}
			else if (this.closing_state == 2) {
				// Change size to default
				this.closing_state = 3;
				style.add_class(this.expansion, "demo_image_preview_expansion_absolute_closing");

				// Hide main image
				display_hide.call(this, this.image_id);

				// Change position
				change_to_small_size.call(this, false);

				// Final (fallback)
				this.closing_timer = setTimeout(this.on_close_timeout_bind, 500);
			}
			else {
				// Complete close
				this.remove();
			}
		};

		var get_next_image_id = function (current_id) {
			return (current_id + 1) % this.image_nodes.length;
		};

		var display_show = function (id) {
			// Show
			style.remove_class(this.image_nodes[id], "demo_image_preview_expansion_image_hidden");
		};
		var display_hide = function (id) {
			// Hide
			style.add_class(this.image_nodes[id], "demo_image_preview_expansion_image_hidden");
		};
		var display_update = function (id) {
			// Update display
			if (id == this.image_id && this.image_loaded[id]) {
				// Show new
				display_show.call(this, id);
			}

			// Switch test
			start_switching.call(this);
		};

		var start_switching = function () {
			// Timer check
			var id_next = get_next_image_id.call(this, this.image_id);
			if (
				this.image_nodes.length > 1 &&
				this.timings &&
				this.image_loaded[this.image_id] &&
				this.image_loaded[id_next] &&
				this.switch_timer === null
			) {
				// Timeout
				var time_id = Math.min(this.image_id, this.timings.length - 1);
				this.switch_timer = setTimeout(this.on_switch_timeout_bind, this.timings[time_id] * 1000);
			}
		};
		var stop_switching = function () {
			// Stop
			if (this.switch_timer !== null) {
				clearTimeout(this.switch_timer);
				this.switch_timer = null;
			}
		};

		var remove_image_events = function (image) {
			image.removeEventListener("load", this.on_image_load_bind, false);
			image.removeEventListener("error", this.on_image_error_bind, false);
		};

		var change_to_small_size = function (fixed) {
			if (!this.expansion) return;

			// Change position
			var doc_rect = fixed ? get_document_rect() : get_object_rect(this.container),
				obj_rect = get_object_rect(this.preview),
				w = (obj_rect.right - obj_rect.left),
				h = (obj_rect.bottom - obj_rect.top);

			// Change position
			this.expansion.style.left = ((obj_rect.left + obj_rect.right) / 2.0 - doc_rect.left) + "px";
			this.expansion.style.top = ((obj_rect.top + obj_rect.bottom) / 2.0 - doc_rect.top) + "px";

			// Change size
			this.expansion_size.style.width = w + "px";
			this.expansion_size.style.height = h + "px";
			this.expansion_size.style.left = (w / -2.0) + "px";
			this.expansion_size.style.top = (h / -2.0) + "px";

			// Change opacity
			style.add_class(this.expansion_image_container, "demo_image_preview_expansion_image_container_unready");
		};
		var change_to_full_size = function () {
			if (!this.expansion) return;

			// Revert to centered
			this.expansion.style.left = "";
			this.expansion.style.top = "";

			// Change size
			this.expansion_size.style.width = this.target_width + "px";
			this.expansion_size.style.height = this.target_height + "px";
			this.expansion_size.style.left = (this.target_width / -2.0) + "px";
			this.expansion_size.style.top = (this.target_height / -2.0) + "px";

			// Change opacity
			style.remove_class(this.expansion_image_container, "demo_image_preview_expansion_image_container_unready");
		};

		var on_expansion_transition_end = function (event) {
			if (this.closing_state >= 3 && event.target == this.expansion) {
				// Remove
				this.remove();
			}
		};



		PreviewImagePopUp.prototype = {
			constructor: PreviewImagePopUp,

			show: function (data) {
				if (this.closing_state == 0) return;

				// Not closing
				this.closing_state = 0;
				if (this.closing_timer !== null) {
					clearTimeout(this.closing_timer);
					this.closing_timer = null;
				}

				style.remove_class(this.expansion, "demo_image_preview_expansion_closing");
				style.remove_class(this.expansion, "demo_image_preview_expansion_absolute");
				style.remove_class(this.expansion, "demo_image_preview_expansion_absolute_closing");

				// Change main image
				if (this.image_id != 0) {
					display_hide.call(this, this.image_id);
					this.image_id = 0;
				}

				// Display
				display_update.call(this, this.image_id);

				// Show
				change_to_full_size.call(this);
			},

			remove: function () {
				if (this.expansion === null) return;

				// Remove timers
				if (this.closing_timer !== null) {
					clearTimeout(this.closing_timer);
					this.closing_timer = null;
				}

				// Stop switching
				stop_switching.call(this);

				// Update container
				style.remove_class(this.container, "demo_image_preview_expansion_container");
				style.remove_class(this.preview, "demo_image_preview_expanded");

				// Move thumbnail
				var par, c;
				if (this.expansion_thumbnail && this.expansion_thumbnail_class !== null && (par = this.preview.querySelector(".demo_image_preview_background"))) {
					c = par.firstChild;
					if (c) par.insertBefore(this.expansion_thumbnail, c);
					else par.appendChild(this.expansion_thumbnail);
					this.expansion_thumbnail.className = this.expansion_thumbnail_class;
				}

				// Remove events
				for (i = 0; i < this.image_nodes.length; ++i) {
					remove_image_events.call(this, this.image_nodes[i]);
				}
				for (i = 0; i < transition_events.length; ++i) {
					this.expansion.removeEventListener(transition_events[i], this.on_expansion_transition_end_bind, false);
				}

				// Remove nodes
				par = this.expansion.parentNode;
				if (par) {
					par.removeChild(this.expansion);
				}

				this.images = null;
				this.image_nodes = null;
				this.image_loaded = null;
				this.container = null;
				this.expansion = null;
				this.expansion_size = null;
				this.expansion_image_container = null;
				this.expansion_thumbnail = null;

				// Remove from list
				for (var i = 0; i < active_instances.length; ++i) {
					if (active_instances[i].container === this.container) {
						// Remove
						active_instances.splice(i, 1);
						break;
					}
				}
			},
			close: function () {
				if (this.closing_state > 0) return;

				// Remove when no transitions are enabled
				if (this.transitions) {
					// Change tate
					this.closing_state = 1;
					style.add_class(this.expansion, "demo_image_preview_expansion_closing");

					// Stop switching
					stop_switching.call(this);

					// Hide
					//display_hide.call(this, this.image_id);

					// Change position
					//change_to_small_size.call(this, false);

					// Close timer
					if (this.closing_timer !== null) {
						clearTimeout(this.closing_timer);
					}
					this.closing_timer = setTimeout(this.on_close_timeout_bind, 10);
				}
				else {
					// Remove
					this.closing_state = 3;
					this.remove();
				}
			},

		};



		return PreviewImagePopUp;

	})();



	// Functions
	var wrap_callback = function (callback, args) {
		return function () {
			callback.apply(this, args.concat(Array.prototype.slice.call(arguments, 0)));
		};
	};
	var on_mouseenterleave_prehandle = function (callback, event) {
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
				return callback.call(this, event);
			}
		}
		catch (e) {
		}
	};
	var get_document_rect = function () {
		var doc = document.documentElement;

		var left = (window.pageXOffset || doc.scrollLeft || 0) - (doc.clientLeft || 0);
		var top = (window.pageYOffset || doc.scrollTop || 0)  - (doc.clientTop || 0);

		return {
			left: left,
			top: top,
			right: left + (doc.clientWidth || window.innerWidth || 0),
			bottom: top + (doc.clientHeight || window.innerHeight || 0),
		};
	};
	var get_object_rect = function (obj) {
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
	};

	var on_ready = function () {
		// Start navigation
		navigation.trigger_init_change();

		// Setup event links
		var event_links = document.querySelectorAll(".event_link");
		for (var i = 0; i < event_links.length; ++i) {
			event_links[i].addEventListener("click", on_event_link_click, false);
		}

		// Change log
		var cl_target = document.querySelector(".changelog");
		var cl_target_error = document.querySelector(".changelog_error");
		var cl_version = document.querySelector(".changelog_version");
		var cl = new ChangeLog("dnsev", "iex", cl_target, cl_target_error, cl_version);
	};
	var on_page_change = function (data) {
		// Update navigation and sections
		var nav_links = document.querySelectorAll(".navigation_link"),
			sections = document.querySelectorAll(".section"),
			path_name = data.path.join("/"),
			hl_path, n, i;

		// Navigation
		for (i = 0; i < nav_links.length; ++i) {
			n = nav_links[i];
			hl_path = n.getAttribute("data-navigation-path-highlight") || "";

			if (hl_path == data.path[0]) {
				style.add_class(n, "navigation_link_selected");
			}
			else {
				style.remove_class(n, "navigation_link_selected");
			}
		}

		// Sections
		for (i = 0; i < sections.length; ++i) {
			n = sections[i];
			hl_path = n.getAttribute("data-section-name") || "";

			if (hl_path == path_name) {
				style.add_class(n, "section_selected");
			}
			else {
				style.remove_class(n, "section_selected");
			}
		}

		// Scroll to top
		if (!data.change_data.init) {
			window.scrollTo(0, 0);
		}
	};
	var on_demo_open = function (data) {
		if (!data.change_data.first) return;

		// Setup
		var previews = document.querySelectorAll(".demo_image_preview"),
			on_mouseenter = wrap_callback(on_mouseenterleave_prehandle, [ on_preview_mouseenter ]),
			on_mouseleave = wrap_callback(on_mouseenterleave_prehandle, [ on_preview_mouseleave ]),
			thumb_url, thumb_res, bg, overlay,
			p, i, j;

		for (i = 0; i < previews.length; ++i) {
			p = previews[i];

			// Get data
			thumb_url = p.getAttribute("data-preview-thumbnail") || "";
			thumb_res = /^([0-9]+)x([0-9]+)$/i.exec(p.getAttribute("data-preview-thumbnail-resoultion") || "");
			if (thumb_res) {
				thumb_res = [ parseInt(thumb_res[1], 10) , parseInt(thumb_res[2], 10) ];
			}
			else {
				thumb_res = [ 0 , 0 ];
			}

			// Update
			p.style.width = thumb_res[0] + "px";
			p.style.height = thumb_res[1] + "px";
			if ((bg = p.querySelector(".demo_image_preview_background_image"))) {
				bg.style.backgroundImage = "url('" + thumb_url + "')";
			}

			// Hover event
			overlay = p.querySelector(".demo_image_preview_overlay");
			if (overlay) {
				overlay.addEventListener("click", on_preview_mouseenter, false);
				//overlay.addEventListener("mouseover", on_mouseenter, false);
				overlay.addEventListener("mouseout", on_mouseleave, false);
			}
		}
	};
	var on_event_link_click = function (event) {
		// Parse href
		var cur_path = homepage.page_current,
			allow = false;

		if (cur_path) {
			// Data
			var href = this.getAttribute("data-event-link-href") || "",
				allow_if_no_change = (this.getAttribute("data-event-link-allow-if-no-change") == "true"),
				href_hash_data = navigation.get_location_data(navigation.get_location(href)).hash,
				path = href_hash_data.path,
				new_url_hash = "",
				new_url = "",
				i;

			// Compare
			if (allow_if_no_change && path.length == cur_path.length) {
				for (i = 0; i < path.length && path[i] == cur_path[i]; ++i);
				allow = (i == path.length);
			}

			// Change
			new_url = window.location.pathname + window.location.search;
			new_url_hash = navigation.encode_path(path);
			if (new_url_hash) new_url += "#!" + new_url_hash;
			navigation.replace(new_url, false);
		}

		// Allow
		if (allow) return true;

		// Stop
		event.preventDefault();
		event.stopPropagation();
		return false;
	};
	var on_preview_mouseenter = function (event) {
		var p = this.parentNode,
			container = p.querySelector(".demo_image_preview_background");

		if (container) {
			var image_res, image_urls, thumb_url, image_timings = null, i;

			// Get data
			thumb_url = p.getAttribute("data-preview-thumbnail") || "";
			image_res = /^([0-9]+)x([0-9]+)$/i.exec(p.getAttribute("data-preview-image-resoultion") || "");
			if (image_res) {
				image_res = [ parseInt(image_res[1], 10) , parseInt(image_res[2], 10) ];
			}
			else {
				image_res = [ 0 , 0 ];
			}

			if ((image_urls = p.getAttribute("data-preview-image"))) {
				image_urls = [ image_urls ];
			}
			else if ((image_urls = p.getAttribute("data-preview-images"))) {
				image_urls = image_urls.split(",");

				if ((image_timings = p.getAttribute("data-preview-images-change-time"))) {
					image_timings = image_timings.split(",");
					for (i = 0; i < image_timings.length; ++i) {
						image_timings[i] = parseFloat(image_timings[i]) || 0.0;
						if (image_timings[i] <= 0.0) image_timings[i] = 1.0;
					}
				}
				else {
					image_timings = null;
				}
			}

			// Create a new pop up
			PreviewImagePopUp.open(container, {
				image_res: image_res,
				image_urls: image_urls,
				image_timings: image_timings,
				thumb_url: thumb_url,
				preview: p,
				transitions: style.has_class(p, "transitions")
			});
		}
	};
	var on_preview_mouseleave = function (event) {
		var p = this.parentNode,
			container = p.querySelector(".demo_image_preview_background");

		if (container) {
			PreviewImagePopUp.close(container);
		}
	};



	// Start
	style = new Style();
	navigation = new Navigation();
	navigation_history = new NavigationHistory(navigation);
	homepage = new Homepage();
	homepage.setup(
		{
			aliases: {
				"": "home"
			},
			pages: {
				"home": {
					aliases: {},
					pages: {
						"install": {}
					}
				},
				"about": {
					aliases: {},
					pages: {
						"demo": {}
					}
				},
				"changes": {},
				"github": {}
			}
		},
		[ "home" ]
	);
	homepage.on_page("open", [], false, on_page_change);
	homepage.on_page("open", [ "about" , "demo" ], true, on_demo_open);

	// DOM start
	ASAP.asap(on_ready);

})();

