// Log an error to the console
export function logErrorNode(node, msg) {
	console.log(msg);
	console.log(node);
	console.log(node.outerHTML);
}

export function logErrorText(msg) {
	console.log(msg);
}

// Returns the attributes of NODE as an {object}
export function parseAttributesToObject(node) {
	var a = node.attributes, c = 0, atts = {};
	while(c < a.length) {
		let att = a.item(c), key = att.name, value = att.value;
		atts[key] = value;
		c++;
	}
	return atts;
}

// Returns the attributes of NODE as a two-dimensional [array]
export function parseAttributesToArray(node) {
	var a = node.attributes, c = 0, atts = [];
	while(c < a.length) {
		let att = a.item(c), key = att.name, value = att.value;
		atts.push([key, value]);
		c++;
	}
	return atts;
}

// Returns the attributes of NODE as a two-dimensional [array],
//   except the first element, which is a STRING representing the ID
export function parseIdAndAttributesToArray(node) {
	let a = node.attributes, c = 0, atts = [], id = "";
	while(c < a.length) {
		let att = a.item(c), n = att.name, v = att.value;
		if(n === "id") {
			id = v;
		} else {
			atts.push([n, v]);
		}
		c++;
	}
	return [id, ...atts];
}

// Change an {object} into a two-dimensional [array]
export function parseObjectToArray(o) {
	var atts = [];
	Object.getOwnPropertyNames(o).forEach(nombre => atts.push([nombre, o[nombre]]));
	return atts;
}


// Checks an object for the specified properties (!== undefined)
// Returns array of unfound atts
// Return first unfound att (not in array) if anyFailure is provided and true
// Logs error unless errorHeader is false
export function checkObjProps(node, obj, props, errorHeader, anyFailure = false) {
	var bad1, bad2 = [];
	if(anyFailure) {
		props.every(function(test) {
			if(obj[test] === undefined) {
				bad1 = prop;
				return false;
			}
			return true;
		});
	} else {
		props.forEach(function(test) {
			if(obj[test] === undefined) {
				bad2.push(test);
			}
		});
	}
	if(bad1 === undefined && bad2.length === 0) {
		return bad2;
	} else if (errorHeader) {
		let msg = "";
		if(bad1) {
			msg = " \"" + bad1 + "\"";
		} else {
			let e = bad2.pop();
			if(bad2.length > 0) {
				msg += "s";
			}
			msg += " \"" + bad2.join("\", \"") + "\" and \"" + e + "\"";
		}
		// Set node to a falsy value to use text-only error handling
		if(node) {
			logError(node, errorHeader + ": missing required parameter" + msg);
		} else {
			logErrorText(errorHeader + ": missing required parameter" + msg);
		}
	}
	return bad1 || bad2;
}
