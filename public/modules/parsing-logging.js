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
