var $RPG = {
	log: [],
	ADD: function() {
		var args = Array.from(arguments),
			obj = this,
			prev = "$RPG",
			err = new Error(),
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
				this.log.push("Creating implicit property " + prev + " as a blank Object");
			}
			obj = obj[prop];
			if(!(obj instanceof Object)) {
				return new TypeError(prev + " is not an Object");
			}
		}
		obj[lastProp] = value;
		this.log.push(prev + "." + lastProp + " set :: " + (err.lineNumber
			? err.fileName + ':' + err.lineNumber + ":1" // add arbitrary column value for chrome linking
			: this.extractLineNumberFromStack(err.stack)
		));
	},
	PUSH: function() {
		var args = Array.from(arguments),
			obj = this,
			prev = "$RPG.",
			err = new Error(),
			strings;
		if(args.length < 2
			|| !((strings = args.shift()) instanceof Array)
			|| !strings.every(a => a.constructor === String)
		) {
			return new TypeError("The first argument of $RPG.PUSH must be an array of Strings");
		}
		while(strings.length > 0) {
			let prop = strings.shift();
			obj = obj[prop];
			prev += "." + prop;
			if(obj === undefined) {
				return new TypeError(prev + " does not exist");
			}
		}
		if(!(obj instanceof Array)) {
			return new TypeError(prev + " is not an Array");
		}
		obj.push(...args);
		this.log.push(prev + " pushed new value(s) :: " + (err.lineNumber
			? err.fileName + ':' + err.lineNumber + ":1" // add arbitrary column value for chrome linking
			: this.extractLineNumberFromStack(err.stack)
		));
	},
	extractLineNumberFromStack: function (stack) {
		/// <summary>
		/// Get the line/filename detail from a Webkit stack trace.  See https://stackoverflow.com/a/3806596/1037948
		/// </summary>
		/// <param name="stack" type="String">the stack string</param>
		if(!stack) return '?'; // fix undefined issue reported by @sigod
		// correct line number according to how Log().write implemented
		var line = stack.split('\n')[2];
		// fix for various display text
		line = (line.indexOf(' (') >= 0
			? line.split(' (')[1].substring(0, line.length - 1)
			: line.split('at ')[1]
		);
		return line;
	}
};

window["$RPG"] = $RPG;
