var $RPG = {
	UNDO: new Map(),
	LOG_UNDO: function() {
		if($RPG.current !== undefined) {
			let ruleset = this.current.ruleset.name,
				undo = this.UNDO.get(ruleset) || [],
				args = Array.from(arguments);
			undo.unshift(args);
			this.UNDO.set(ruleset, undo);
		}
	},
	UNDO_RULESET: function(ruleset) {
		var undo = this.UNDO.get(ruleset) || [];
		undo.forEach(function(u) {
			var n = u.shift(),
				o = u.shift(),
				p = u.shift();
			switch(n) {
				case "new":
					delete o[p];
					break;
				case "replace":
					o[p] = u[0];
					break;
				case "push":
					o[p] = o[p].slice(0, u[0]);
					break;
				default:
					return new Error("Unknown $RPG.UNDO method: " + n);
			}
		});
		this.UNDO.delete(ruleset);
	},
	LOG: [],
	ADD: function() {
		var args = Array.from(arguments),
			obj = this,
			prev = "$RPG",
			err = new Error(),
			undoDone = false,
			value, lastProp, stack;
		if(args.length < 2) {
			return new Error("Invalid format: $RPG.ADD(propertyName[s]..., value)");
		}
		value = args.pop();
		if(!args.every(a => a.constructor === String)) {
			return new TypeError("All arguments of $RPG.ADD, except for the last argument, must be Strings");
		}
		lastProp = args.pop();
		while(args.length > 0) {
			let prop = args.shift();
			prev += "." + prop;
			if(!obj.hasOwnProperty(prop)) {
				// Create a property as a blank object
				obj[prop] = {};
				this.LOG.push("Creating implicit property " + prev + " as a blank Object");
				if(!undoDone) {
					this.LOG_UNDO("new", obj, prop);
					undoDone = true;
				}
			}
			obj = obj[prop];
			if(!(obj instanceof Object)) {
				return new TypeError(prev + " is not an Object");
			}
		}
		if(!undoDone) {
			let test = obj[lastProp];
			if(test !== undefined) {
				this.LOG_UNDO("replace", obj, lastProp, test);
			} else {
				this.LOG_UNDO("new", obj, lastProp);
			}
		}
		obj[lastProp] = value;
		this.LOG.push(prev + "." + lastProp + " set :: " + err.stack);
	},
	PUSH: function() {
		var args = Array.from(arguments),
			obj = this,
			lastObj = this,
			prev = "$RPG",
			err = new Error(),
			prop, strings;
		if(args.length < 2
			|| !((strings = args.shift()) instanceof Array)
			|| strings.some(a => a.constructor !== String)
		) {
			return new TypeError("The first argument of $RPG.PUSH must be an Array of Strings");
		}
		while(strings.length > 0) {
			prop = strings.shift();
			lastObj = obj;
			obj = lastObj[prop];
			prev += "." + prop;
			if(obj === undefined) {
				return new TypeError(prev + " does not exist");
			}
		}
		if(!(obj instanceof Array)) {
			return new TypeError(prev + " is not an Array");
		}
		this.LOG_UNDO("push", lastObj, prop, obj.length);
		obj.push(...args);
		this.LOG.push(prev + " pushed new value(s) :: " + err.stack);
	}
};

window["$RPG"] = $RPG;
window["$IO"] = io();
