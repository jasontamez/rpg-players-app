// initialize global variables
var	statsProvided = true,
	singleLevelMode = 0,
	initialized = false,
	workingDoc,
	STR = {}, DEX = {}, CON = {}, INT = {}, WIS = {}, CHA = {},
	SPACE = String.fromCharCode(0x00A0),
	hps,goodSaves,
	favored = ["+1 hp","+1 skill point"],
	level,chosen,previous,current,anchor,hold,counter,
	AJAXstorage = new Map(),
	allGetters = [],
	numberWords=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];

function $i(id, doc = document) {
	return doc.getElementById(id);
}
function $q(query, doc = document) {
	return doc.querySelector(query);
}
function $a(query, doc = document) {
	return doc.querySelectorAll(query);
}
function $e(tag, c = [], text="") {
	var e = document.createElement(tag);
	e.textContent = text;
	e.classList.add(...c);
	return e;
}

var record = [];

// Define a class for XML tags
class BasicStatObject {
	constructor(parent, node, atts) {
		let a = new Map();
		this.parent = parent;
		this.node = node;
		this.kids = new Map();
		atts.forEach(function(prop) {
			a.set(prop[0], prop[1]);
		});
		this.atts = a;
		//if(parent instanceof BasicStatObject) {
			//console.log(parent);
			//parent.registerChild(id, this);
		//}
		record.push([this, this.constructor]);
	}
	get(prop, context = this) {
		var found = this.atts.get(prop),
			parent = this.parent, c = 1;
		// if found is undefined, check parents
		if(found === undefined && parent !== undefined) {
			found = parent.get(prop, context);
		}
		while(found instanceof BasicStatObject) {
			if (found instanceof SpecialGrabber) {
				found = found.grabValue(context);
			} else if (found instanceof BasicStatObject) {
				found = found.get("value", context);
			}			
		}
		return found;
	}
	set(prop, v) {
		return this.atts.set(prop, v);
	}
	registerChild(id, tag) {
		this.kids.set(id, tag);
		return this.kids;
	}
}


class BasicIdObject extends BasicStatObject {
	// ID of tag (or ""), parent of tag (or undefined), any other attributes of the tag
	constructor(id, parent, node, atts) {
		super(parent, node, atts);
		if(id === null) {
			id = "random unidentified group " + BasicIdObject.counter.toString();
			BasicIdObject.counter++;
		}
		this.id = id;
		BasicIdObject.allIDs.set(id, this);
	}
	static getById(id) {
		return BasicIdObject.allIDs.get(id);
	}
}
BasicIdObject.allIDs = new Map();
BasicIdObject.counter = 1;


class SpecialGrabber extends BasicStatObject {
	constructor(parent, node, atts) {
		// This is a dummy object that does nothing on its own, but its children will define their own grabValue function
		super(parent, node, atts);
	}
}


class Attribute extends BasicStatObject {
	constructor(parent, node, atts, name) {
		super(parent, node, atts);
		this.name = name;
	}
	//get(prop, context = this.parent) {
	//	var found = this.atts.get(prop);
	//	console.log(["ATTRIBUTE", found]);
	//	if (found instanceof SpecialGrabber) {
	//		found = found.grabValue(context);
	//	} else if (found instanceof BasicStatObject) {
	//		found = found.get("value");
	//	}
	//	return this.type.converter(found);
	//}
}

// Datum changes 
class Datum extends BasicIdObject {
	constructor(id, parent, node, atts) {
		var i;
		console.log("Making id-" + id);
		console.log(atts);
		super(id, parent, node, atts);
		i = this.atts;
		i.has("startingValue") || i.set("startingValue", null);
		i.has("value") || i.set("value", i.get("startingValue"));
	}
}
Datum.converter = function(input) { return input; }


class Formula extends Attribute {
	constructor(node, name, atts) {
		super(undefined, node, atts, name);
		this.node = node;
		Formula.formulae.set(name, this);
	}
	static getName(name) {
		return Formula.formulae.get(name);
	}
}
Formula.formulae = new Map();


class SelfReference extends SpecialGrabber {
	constructor(property, parent, node, atts) {
		super(parent, node, atts);
		if(property.constructor === Array) {
			SelfReference.refs.set(property.join("->"), this);
			property = property[1];
		} else {
			SelfReference.refs.set(property, this);
		}
		this.property = property;
	}
	grabValue(context) {
//		console.log(["SELF REFERENCE", context]);
		//console.log(["SR-this-context", this, context]);
		return context.get(this.property);
	}
	static getReference(property, parent, node, atts) {
		var test = SelfReference.refs.get(property);
		if(test !== undefined) {
			return test;
		}
		return new SelfReference(property, parent, node, atts);
	}
}
SelfReference.refs = new Map();

class DatumReference extends SelfReference {
	constructor(datumStr, property, parent, node, atts) {
		super([datumStr, property], parent, node, atts);
		this.reference = datumStr;
	}
	grabValue(context) {
		var reference = BasicIdObject.getById(this.reference);
//		console.log(["DATUM REFERENCE", context]);
		if(reference === undefined) {
			logError(this, "ERROR: unable to find Datum named \"" + this.reference + "\" when fetching property");
			return "";
		}
		return reference.get(this.property);
	}
	static getReference(datumStr, property, parent, node, atts) {
		var test = DatumReference.refs.get(datumStr + "->" + property);
		if(test !== undefined) {
			return test;
		}
		return new DatumReference(datumStr, property, parent, node, atts);
	}
}

class MultiDatum extends BasicIdObject {
	constructor(id, parent, node, type, atts) {
		var i;
		super(id, parent, node, atts);
		i = this.atts;
		i.has("idPre") || i.set("idPre", "_");
		i.has("idPost") || i.set("idPost", "");
		this.inheritors = [];
		this.inhCount = 1;
		this.type = type;
		MultiDatum.allIDs.set(id, this);
	}
	makeDatum(node, atts) {
		var n = this.inhCount++,
			id = this.get("idPre") + n.toString() + this.get("idPost"),
			datum = new this.type(id, this, node, atts);
		this.inheritors.push(datum);
		return datum;
	}
}
MultiDatum.allIDs = new Map();

class Num extends Datum {
	constructor(id, parent, node, atts) {
		var i, t;
		super(id, parent, node, atts);
		i = this.atts;
		t = this;
		Num.numericProperties.forEach(function(nv) {
			var [n, v] = nv;
			if(i.has(n)) {
				//console.log("RESET "+ n + " with "+ i.get(n));
				t.set(n, i.get(n));
			} else {
				//console.log("SETTING "+ n + " with " + v);
				t.set(n, v);
			}
		});
		if(i.has("value")) {
			//console.log("RESET value with "+ i.get("value"));
			this.set("value", i.get("value"));
		} else {
			//console.log("SETTING value with " + i.get("startingValue"));
			this.set("value", i.get("startingValue"));
		}
		//console.log("VALUE " + this.get("value"));
	}
	set(prop, v) {
		var min, max, num;
		//console.log(this.id + " " + prop + " = " + v);
		switch(prop) {
			case "value":
				min = this.get("minValue");
				max = this.get("maxValue");
				num = Number(v);
				if(min === min && num < min) {
					num = min;
				} else if (max === max && num > max) {
					num = max;
				}
				v = num;
				break;
			case "minValue":
			case "maxValue":
			case "startingValue":
				v = Number(v);
				break;
		}
		return this.atts.set(prop, v);
	}
}
Num.converter = Number;
Num.numericProperties = [["startingValue", 0], ["minValue", NaN], ["maxValue", NaN]];

class Int extends Num {
	constructor(id, parent, node, atts) {
		super(id, parent, node, atts);
	}
	set(prop, v) {
		var min, max, num;
		//console.log(this.id + " " + prop + " = " + v);
		switch(prop) {
			case "value":
				min = this.get("minValue");
				max = this.get("maxValue");
				num = Math.round(Number(v));
				if(min === min && num < min) {
					num = min;
				} else if (max === max && num > max) {
					num = max;
				}
				v = num;
				break;
			case "minValue":
			case "maxValue":
			case "startingValue":
				v = Math.round(Number(v));
				break;
		}
		return this.atts.set(prop, v);
	}
}
Int.converter = parseInt;

class Str extends Datum {
	constructor(id, parent, node, atts) {
		var i;
		super(id, parent, node, atts);
		i = this.atts;
		if(i.has("value")) {
			//console.log("RESET value with "+ i.get("value"));
			this.set("value", i.get("value"));
		} else {
			//console.log("SETTING value with " + i.get("startingValue"));
			this.set("value", i.get("startingValue"));
		}
	}
	set(prop, v) {
		if(prop === "value" || prop === "startingValue") {
			return this.atts.set(prop, String(v));
		}
		return this.atts.set(prop, v);
	}
}
Str.converter = String;



Datum.type = {
	Num: Num,
	Int: Int,
	Str: Str,
	Typeless: Datum
};

Datum.converters = {
	userEditable: function(input) { return input === "true"; },
	type: Datum.getTypeObject
};

// A function to handle Type attributes
Datum.getTypeObject = function(type) {
	var c = Datum.type[type];
	// Is this a valid type?
	if(c !== undefined) {
		// If so, return it
		return c;
	}
	// Otherwise, return Str as default
	return Str;
};

Datum.DataTagHandlers = {
	Group: parseGroup,
	Datum: parseDatum,
	MultiDatum: parseMultiDatum,
	Math: parseMath,
	If: parseIf,
	Get: parseGet,
	While: parseWhile
};

BasicIdObject.preprocessTags = {
	Clone: parseClone
};

BasicIdObject.TagHandlers = {
	Attribute: parseAttribute,
	BasicIdObject: parseGroup
};


class Equation extends SpecialGrabber {
	constructor(amount, parent, node, atts) {
		//console.log([amount, parent, node, atts]);
		super(parent, node, atts);
		this.math = [];
		//console.log([this, amount, parent, node, atts]);
		this.startingAmount = this.get("type").converter(amount);
	}
	static constructEquation(parent, node) {
		var atts = parseAttributesToObject(node),
			amount = atts.amount,
			type = atts.type,
			tag;
		if(amount === undefined) {
			amount = "";
		} else {
			delete atts.amount;
		}
		if(type === undefined) {
			type = parent.get("type") || Num;
		}
		if(typeof type === "string") {
			type = Datum.type[type] || Num;
		}
		if(type === Datum.type.Typeless) {
			type = Num;
		}
		atts.type = type;
		tag = atts;
		atts = [];
		Object.getOwnPropertyNames(tag).forEach(name => atts.push([name, tag[name]]));
		tag = new Equation(amount, parent, node, atts);
		[...node.children].forEach( step => tag.addStep(step) );
		return tag;
	}
	grabValue(context) {
		var value = this.startingAmount;
		this.math.forEach(function(unit) {
//			console.log(["MATH", value, ...unit]);
			var newVal, [name, literalFlag, amount] = unit;
			if(literalFlag) {
				// A literal value
				newVal = Equation[name](value, amount);
			} else {
				// A Reference as value
//				console.log(["->", amount, context]);
				Equation.tempV = amount;
				Equation.tempC = context;
				newVal = Equation[name](value, amount.grabValue(context));
			}
			value = newVal;
		});
		return value;
	}
	addStep(node) {
		var name = node.nodeName,
			amount = null,
			literalFlag = true,
			converter = this.get("type").converter;
		if(node.hasAttribute("value")) {
			// Element has value attribute
			amount = converter(node.getAttribute("value"));
		} else if (node.hasAttribute("fromId")) {
			// Element is referring to another element
			let property = node.getAttribute("attribute") || "value";
			amount = node.getAttribute("fromId");
			if(amount === "this") {
				amount = SelfReference.getReference(property, this, node, []);
			} else {
				amount = new DatumReference(amount, property);
			}
			literalFlag = false;
		} else {
			// Set the amount to the text content of the element
			amount = converter(node.textContent);
		}
		this.math.push([name, literalFlag, amount]);
	}
	static Add(total, n) {
		return total + n;
	}
	static Multiply(total, n) {
		return total * n;
	}
	static Divide(total, n) {
		return total / n;
	}
	static Remainder(total, n) {
		return total % n;
	}
	static Round(total, n) {
		return Math.round(total);
	}
	static Ceiling(total, n) {
		return Math.ceil(total);
	}
	static Floor(total, n) {
		return Math.floor(total);
	}
}

class If extends SpecialGrabber {
	constructor(parent, node, atts, intype, outtype, operation) {
		super(parent, node, atts);
		this.inType = intype;
		this.outType = outtype;
		this.operation = operation || "AND";
		this.comparison = [];
		this.then = [];
		this.else = [];
	}
	static constructIfThenElse(parent, node) {
		var atts = parseAttributesToObject(node),
			intype = atts.inType,
			outtype = Datum.type[atts.outType || parent.get("outType") || parent.get("type") || "Str"],
			operation = (atts.operation || "AND"),
			tag;
		if(intype === undefined) {
			intype = Datum.type[parent.get("inType") || "Num"] || Num;
		} else {
			intype = Datum.type[intype] || Num;
			delete atts.inType;
		}
		if(outtype === undefined) {
			outtype = Datum.type[parent.get("inType") || parent.get("type") || "Str"] || Str;
		} else {
			outtype = Datum.type[outtype] || Str;
			delete atts.outType;
		}
		if(operation === undefined) {
			operation = "AND";
		} else {
			delete atts.operation;
		}
		tag = atts;
		atts = [];
		Object.getOwnPropertyNames(tag).forEach(name => atts.push([name, tag[name]]));
		tag = new If(parent, node, atts, intype, outtype, operation);
//		console.log("Constructing IF");
		[...node.children].forEach(function(step) {
//			console.log(step);
			var name = step.nodeName;
			switch(name) {
				case "Compare":
//					console.log("Compare");
					tag.addCompare(step, intype);
//					console.log(["COMPARE:", tag.startingAmount]);
					break;
				case "Then":
				case "Else":
//					console.log("Then/Else");
					tag.addThenElse(step, name, outtype, parent, node);
//					console.log([name.toUpperCase(), tag[name.toLowerCase()]]);
					break;
				default:
//					console.log("step");
					tag.addComparison(step, intype);
			}
		});
		return tag;
	}
	addCompare(node, intype) {
		var amount = null,
			converter = intype.converter;
		if(node.hasAttribute("value")) {
			// Element has value attribute
			amount = converter(node.getAttribute("value"));
		} else if (node.hasAttribute("fromId")) {
			// Element is referring to another element
			let property = node.getAttribute("attribute") || "value";
			amount = node.getAttribute("fromId");
			if(amount === "this") {
				amount = SelfReference.getReference(property, this, node, []);
			} else {
				amount = new DatumReference(amount, property);
			}
		} else {
			// Set the amount to the text content of the element
			amount = converter(node.textContent);
		}
		this.startingAmount = amount;
	}
	addComparison(node, intype) {
		var name = node.nodeName,
			amount = null,
			literalFlag = true,
			converter = intype.converter;
		if(node.hasAttribute("value")) {
			// Element has value attribute
			amount = converter(node.getAttribute("value"));
		} else if (node.hasAttribute("fromId")) {
			// Element is referring to another element
			let property = node.getAttribute("attribute") || "value";
			amount = node.getAttribute("fromId");
			if(amount === "this") {
				amount = SelfReference.getReference(property, this, node, []);
			} else {
				amount = new DatumReference(amount, property);
			}
			literalFlag = false;
		} else {
			// Set the amount to the text content of the element
			amount = converter(node.textContent);
		}
		this.comparison.push([name, literalFlag, amount]);
	}
	addThenElse(node, name, outtype, parent, pNode) {
		var amount = null,
			converter = outtype.converter;
		if(node.hasAttribute("value")) {
			// Element has value attribute
			amount = converter(node.getAttribute("value"));
		} else if (node.hasAttribute("fromId")) {
			// Element is referring to another element
			let property = node.getAttribute("attribute") || "value",
				obj = node.getAttribute("fromId");
			if(obj === "this") {
				amount = SelfReference.getReference(property);
			} else {
				amount = new DatumReference(obj, property);
			}
		//} else if (node.children.length > 0) {
		} else if (node.getAttribute("use") === "Math") {
			//amount = new Attribute(name, outtype);
			amount = Equation.constructEquation(parent, node, [["type", outtype]]);
			//amount = new BasicStatObject(parent, pNode, [["type", outtype]]);
			//console.log(["ATTRIBUTE", name, outtype]);
			//parseDataNodes(node, amount);
		} else {
			// Set the amount to the text content of the element
			amount = converter(node.textContent);
		}
		amount = [amount];
		if(node.hasAttribute("prepend")) {
			amount.unshift(converter(node.getAttribute("prepend")));
		}
		if(node.hasAttribute("append")) {
			amount.push(converter(node.getAttribute("append")));
		}
		this[name.toLowerCase()] = amount;
	}
	grabValue(context) {
		var value = this.startingAmount, results = [], operation = this.operation, converter = this.inType.converter;
//		console.log(["IF", this.type, this.outType, value]);
		if(value instanceof SpecialGrabber) {
			value = converter(value.grabValue(context));
		}
		this.comparison.forEach(function(unit) {
			var test, [name, literalFlag, amount] = unit, refObj = If;
			if(refObj[name] === undefined) {
				refObj = Equation;
			}
			if(literalFlag) {
				// A literal value
				test = refObj[name](value, converter(amount));
			} else {
				// A Reference as value
				test = refObj[name](value, converter(amount.grabValue(context)));
			}
			results.push(test);
		});
		switch (operation) {
			case "AND":
				value = results.every(v => v);
				break;
			case "OR":
				value = !results.every(v => !v);
				break;
			case "XOR":
				value = results.filter(v => v).length === 1;
		}
		if(value) {
			value = this.then;
		} else {
			value = this.else;
		}
		converter = this.outType.converter;
		if(value.length === 0) {
			value = converter("");
		} else {
			let v = [];
			value.forEach(function(item) {
				if(item instanceof SpecialGrabber) {
					v.push(converter(item.grabValue(context)));
				} else if (item instanceof BasicStatObject) {
					v.push(converter(item.get("value")));
				} else {
					v.push(item)
				}
			});
			value = converter("");
			v.forEach(x => value += x);
		}
		return value;
	}
	static GreaterThan(value, test) {
		return value > test;
	}
	static NotGreaterThan(value, test) {
		return value <= test;
	}
	static LessThan(value, test) {
		return value < test;
	}
	static NotLessThan(value, test) {
		return value >= test;
	}
	static EqualTo(value, test) {
		return value === test;
	}
	static NotEqualTo(value, test) {
		return value !== test;
	}
	static Contains(value, test) {
		return String(value).includes(String(test));
	}
	static NotContains(value, test) {
		return !String(value).includes(String(test));
	}
}



class Calculator {
	constructor() {
		// nada
	}
	static get(id, property) {
		var o = BasicIdObject.getById(id), v;
		//console.log(o);
		if(o === undefined) {
			return o;
		}
		v = o.get(property);
		if(v === undefined) {
			return v;
		} else if (v instanceof SpecialGrabber) {
			return v.grabValue(o);
		}
		return v;
	}
	static calculate(object, context) {
		
	}
}



function getValue(value, context) {
	if (value.constructor === Equation) {
		return value.calculateValue(context);
	}
	return value;
}
//Value

// Call function when ruleset drop-down list is changed
$i("rules").addEventListener("change", function(e) {
	// Save the ruleset selected
	const rules = e.currentTarget.value;
	// Create AJAX fetcher
	var getter = new XMLHttpRequest();
	if(rules === "x") {
		return;
	}
	// Call a parse function when the fetching is done
	getter.addEventListener("load", function() {
		AJAXstorage.set(rules, getter.responseXML);
		console.log("Info received");
	});
	getter.open("GET", "widgets/_" + rules + ".xml");
	getter.send();
});


// Load a ruleset.
$i("loadInfo").addEventListener("click", tryDisplayInfo);

// When the button is pressed...
function tryDisplayInfo(event, x = 0) {
	var asyncF,
		cls = $i("rules").value;
	const button = $i("loadInfo");

	// what class are we using?
	// Check to see if we've selected an actual class
	if(cls === "x") {
		// Nope. Just stop everything.
		return alert("Please select a ruleset before attempting to Load Info.");
	}

	// Check if we have data
	if(x >= 10) {
		// We've waited 5 seconds
		// Set the class drop-down to null
		$i("rules").value = "x";
		// Restore the button
		button.textContent = "Load Info";
		button.disabled = false;
		// Send an alert
		return alert("Ruleset information was not loaded. Please select your ruleset again, then attempt to Load Info.");
	} else if(!AJAXstorage.has(cls)) {
		if(x === 0) {
			button.textContent = "...Loading...";
			button.disabled = true;
		}
		// Suspend for half a second to wait for it
		setTimeout(tryDisplayInfo.bind(null, event, x + 1), 500);
		return;
	}

	// Show "loading" screen
	document.body.classList.add("loading");

	asyncF = new Promise(function(resolve, reject) {
		// disable class/race choice and indicate we can recalculate at will
		$i("rules").disabled = true;
		button.textContent = "Recalculate!";
		button.disabled = false;
		// Run the meat of the program, giving it a pause to wait for the transition to play
		setTimeout(loadAndAssembleInfo.bind(null, cls), 100);
		resolve();
	});
	asyncF.then(function() {
		// Anything?
	}).catch(function(error) {
		console.log(error.name + " :: " + error.message + " :: " + error.fileName + "\n" + error.stack);
		alert(error.name + " :: " + error.message + " :: " + error.fileName + "\n\nPlease inform the webmaster. Or, reload the page and try again.");
	}).finally(function() {
		setTimeout(() => document.body.classList.remove("loading"), 250);
	});
}

function loadAndAssembleInfo(cls) {
	var doc = AJAXstorage.get(cls),
		body = doc.documentElement,
		data = [],
		ul = $e("ul");
	const main = $i("mainGrid");
	//console.log(doc);
	//console.log(body);
	console.log("Begin");
	[...body.querySelectorAll("Formulae Formula")].forEach(function(node) {
		parseFormulae(node);
	});
	[...body.getElementsByTagName("Data")].forEach(function(node) {
		//recurseNodes(bit, undefined);
		parseDataNodes(node, undefined);
	});
	//recurseNodes(body, ul);
	//main.append(ul);
	console.log("End");
}

function recurseNodes(parent, parentTag) {
	var nodes = [...parent.childNodes];
	while(nodes.length > 0) {
		let node = nodes.shift(), text;
		if(node.nodeType === 3) {
			text = node.nodeValue.trim();
			if(parentTag === undefined) {
				// Skip!
			} else if(text !== "") {
				parentTag.set("text", text);
			}
		} else {
			let a = node.attributes, c = 0, atts = [], tag, name = node.nodeName, id = "";
 			while(c < a.length) {
				let att = a.item(c), n = att.name, v = att.value;
				if(n=== "ID") {
					id = v;
				} else {
					atts.push([a.name, a.value])
				}
				c++;
 			}
			if(name === "Datum") {
				tag = new Datum(id, parentTag, node, atts);
			} else {
				tag = new BasicIdObject(name, parentTag, node, atts);
			}
			//console.log(tag);
			recurseNodes(node, tag);
		}
	}
}

// nodeType 1 -> tag, 3 -> text, 2 -> attribute, 8 -> comment, 9 -> document
//parent, parentTag, node, id, atts, env, DatumNodes


function findNodeIdAndAtts(node) {
	let a = node.attributes, c = 0, atts = [], id = "";
	while(c < a.length) {
		let att = a.item(c), n = att.name, v = att.value, converter = Datum.converters[n];
		if(n === "id") {
			id = v;
		} else if (converter !== undefined) {
			atts.push([n, converter(v)]);
		} else {
			atts.push([n, v]);
		}
		c++;
	}
	return [id, ...atts];
}

function parseDataNodes(currentNode, currentTag, nodes = [...currentNode.children]) {
	// Get kids of the parent
	// Go through each child
	while(nodes.length > 0) {
		let node = nodes.shift(),
			name = node.nodeName;
		if(BasicIdObject.preprocessTags[name] !== undefined) {
			// This node will be changed by a preprocessor
			let info = BasicIdObject.preprocessTags[name](node, currentNode, currentTag);
			if(info === null) {
				// Something bad happened: skip this node
				continue;
			}
			// Use the returned value as the new node
			node = info;
		}
		if(Datum.DataTagHandlers[name] !== undefined) {
			// This node has a special handler: use it
			Datum.DataTagHandlers[name](node, currentNode, currentTag);
		} else if (BasicIdObject.TagHandlers[name] !== undefined) {
			// This node has a special handler: use it
			BasicIdObject.TagHandlers[name](node, currentNode, currentTag);
		//} else if (node.children.length > 0) {
		//	// This node has children: create a BasicIdObject for it and parse recursively
		//	let atts = findNodeIdAndAtts(node),
		//		id = atts.shift(),
		//		allAtts = ancestorAtts.concat(atts),
		//		tag = new BasicIdObject(name, id, parent, node, allAtts),
		//		newAncestry = ancestry.slice();
		//	// Add ancestry if needed
		//	if(currentTag !== undefined) {
		//		newAncestry.push([currentNode, currentTag]);
		//	}
		//	siblings.push(tag);
		//	parseDataNodes(node, tag, newAncestry, allAtts);
		//} else {
		//	// This is a simple text node: it will become a property of this node
		//	props.push([name, node.textContent]);
		} else {
			// This is an unknown tag
			logError(node, "Unknown tag enountered: " + name);
		}
	}
	return currentTag;
}

// not sure if I need siblings... or all ancestors...

function parseDatum(node, parentNode, parentTag) {
	var atts = findNodeIdAndAtts(node),
		id = atts.shift(), tag, type;
	if(atts.slice().reverse().every(function(pair) {
		var [n, v] = pair;
		if(n === "type") {
			type = v;
			return false;
		}
		return true;
	})) {
		// Did NOT find a type
		if(parentTag !== undefined) {
			type = parentTag.get("type");
		}
	}
	if(type === undefined || Datum.type[type] === undefined) {
		type = Str;
	} else {
		type = Datum.type[type];
	}
	tag = new type(id, parentTag, node, atts);
	parseDataNodes(node, tag);
}

function parseMultiDatum(node, parentNode, parentTag) {
	var atts = findNodeIdAndAtts(node),
		id = atts.shift(),
		checkAtts = atts.slice(),
		tag, type = undefined;
	if(parentTag !== undefined) {
		 type = parentTag.get("type");
	}
	checkAtts.reverse().every(function(pair) {
		var [key, value] = pair;
		if(key === "type") {
			type = value;
			return false;
		}
		return true;
	});
	if(type === undefined || Datum.type[type] === undefined) {
		type = Str;
	} else {
		type = Datum.type[type];
	}
	tag = new MultiDatum(id, parentTag, node, type, atts);
	parseDataNodes(node, tag);
}

// these should probably set the Value property of their parent
// Math, If, and Get should only happen directly inside a tag that wants some content

function parseMath(node, parentNode, parentTag) {
	var eq = Equation.constructEquation(parentTag, node);
	parentTag.set("value", eq);
}

//<If inType="Int" outType="Str">
//	<Compare><modifier /></Compare>
//	<GreaterThan amount="-1" />
//	<Then>+<modifier /></Then>
//	<Else><modifier /></Else>
//</If>

function parseIf(node, parentNode, parentTag) {
	var ifthen = If.constructIfThenElse(parentTag, node);
	parentTag.set("value", ifthen);
}
//intype, outtype, compareTag, style
//parseDataNodes(currentNode, currentTag, ancestry, ancestorAtts)

function parseGet(node, parentNode, parentTag, ancestors) {
	var tag;

}


// Should attempt to clone a node into this parent
function parseClone(node, parentNode, parentTag) {
	var atts = findNodeIdAndAtts(node), from = null, target = null, newatts = [], parent, toClone;
	atts.forEach(function(pair) {
		var [n, v] = pair;
		if(n === "From") {
			from = v;
		} else if (n === "Target") {
			target = v;
		} else {
			newatts.push(pair);
		}
	});
	if(from === null || target === null) {
		logError(node, "CLONE: missing From and/or Target parameter, cannot parse");
		return null;;
	}
	parent = BasicIdObject.findTagByName(from);
	toClone = parent.findChild(target);
	if(parent === null) {
		logError(node, "CLONE: could not find a BasicIdObject named \"" + from + "\"");
		return null;;
	} else if(toClone === null) {
		logError(node, "CLONE: could not find a BasicIdObject named \"" + target + "\" from within the given BasicIdObject named \"" + from + "\"");
		return null;
	}
	// Clone the target node
	target = toClone.node.cloneNode(true);
	// Add remaining attributes to the clone
	newatts.forEach( pair => target.setAttribute(pair[0], pair[1]) );
	// Insert the clone just before the current node
	node.parentNode.insertBefore(target, node);
	// Delete the current node
	node.remove();
	// Return the now-current cloned node
	return target;
}

//<While inType="Int" outType="Str">
//	<InitialInputValue fromID="this" attribute="value" />
//	<InitialOutputValue formula="convert_value_to_string" />
//	<GreaterThan value="5" />
//	<Then>
//		<ModifyInputValue><Add value="-5" /></ModifyInputValue>
//		<ModifyOutputValue><OutputValue />/+<InputValue /></ModifyOutputValue>
//	</Then>
//</While>

function parseWhile(node, parentNode, parentTag) {
	var awhile = While.constructWhile(parentTag, node);
	parentTag.set("value", awhile);
}

function parseGroup(node, parentNode, parentTag) {
	var atts = findNodeIdAndAtts(node),
		id = atts.shift(),
		tag = new BasicIdObject(id, parentTag, node, atts);
	parseDataNodes(node, tag);
}

function parseAttribute(node, parentNode, parentTag) {
	var atts = parseAttributesToObject(node), tag, type,
		name = atts.name,
		fromID = atts.getFromId,
		formula = atts.formula,
		att = atts.attribute;
	if(name === undefined) {
		return logError(node, "ATTRIBUTE: missing required \"name\" parameter");
	} else {
		delete atts.name;
	}
	if(fromID !== undefined) {
		delete atts.getFromID;
	}
	if(formula !== undefined) {
		delete atts.formula;
	}
	if(att !== undefined) {
		delete atts.attribute;
	}
	type = atts.type;
	if(type === undefined || Datum.type[type] === undefined) {
		atts.type = Datum.type.Typeless;
	} else {
		atts.type = Datum.type[type] || Datum.type.Typeless;
	}
	atts.type = type;
	tag = atts;
	atts = [];
	Object.getOwnPropertyNames(tag).forEach(name => atts.push([name, tag[name]]));
	tag = new Attribute(parentTag, node, atts, name, type);
	if(fromID !== undefined) {
		// Copy from other attribute
		//tag.set(fromID, att || name);
		let ref = DatumReference.getReference(fromID, att || name, tag, node, []);
		tag.set("value", ref);
	} else if (formula !== undefined) {
		// Clone info from formula
		let target = Formula.getName(formula), clone;
		if(target === undefined) {
			return logError(node, "ATTRIBUTE: formula does not exist");
			// Returning here prevents the tag from being saved into memory
		}
		clone = target.node.cloneNode(true);
		while(clone.firstChild !== null) {
			node.appendChild(clone.firstChild);
		}
		parseDataNodes(node, tag);
	} else if(node.children.length > 0) {
		// Node contains information that must be set as our value
		parseDataNodes(node, tag);
	} else {
		// Node contains text that must be set as our value
		tag.set("value", node.textContent);
	}
	// Save this attribute node
	console.log([name, tag]);
	parentTag.set(name, tag);
}

function logError(node, msg) {
	console.log(msg);
	console.log(node);
	console.log(node.outerHTML);
}

function parseAttributesToObject(node) {
	var a = node.attributes, c = 0, atts = {};
	while(c < a.length) {
		let att = a.item(c), key = att.name, value = att.value, converter = Datum.converters[key];
		if (converter !== undefined) {
			atts[key] = converter(value);
		} else {
			atts[key] = value;
		}
		c++;
	}
	return atts;
}

function parseFormulae(node) {
	var atts = parseAttributesToObject(node),
		name = atts.name,
		type = atts.type,
		overwrite = atts.overwrite,
		tag;
	if(name === undefined) {
		return logError(node, "FORMULA: missing required \"name\" parameter");
	}
	delete atts.name;
	if(Formula.getName(name) !== undefined && overwrite) {
		return logError(node, "FORMULA: cannot overwrite existing \"" + name + "\" formula without an explicit \"overwrite\" parameter");
	}
	if(overwrite) {
		delete atts.overwrite;
	}
	if(type === undefined) {
		type = Datum.type.Typeless;
	} else {
		type = Datum.type[node.getAttribute("type")] || Datum.type.Typeless;
	}
	atts.type = type;
	tag = atts;
	atts = [];
	Object.getOwnPropertyNames(tag).forEach(name => atts.push([name, tag[name]]));
	tag = new Formula(node, name, atts);
	parseDataNodes(node, tag);
}












class While extends SpecialGrabber {
	constructor(parent, node, atts, intype, outtype, input, output) {
		super(parent, node, atts);
		this.inType = intype;
		this.outType = outtype;
		this.until = [];
	}
	static constructWhile(parent, node) {
		var atts = parseAttributesToObject(node),
			intype = atts.inType,
			outtype = Datum.type[atts.outType || parent.get("outType") || parent.get("type") || "Str"],
			input = atts.input,
			output = atts.output,
			modIn = node.querySelectorAll("ModifyInput"),
			modOut = node.querySelectorAll("ModifyOutput"),
			until = node.querySelector("Until"),
			inconv, outconv, tag, temp;
		if(modIn === null) {
			return logError(node, "WHILE: Missing required ModifyInput tag");
		} else if(modOut === null) {
			return logError(node, "WHILE: Missing required ModifyOutput tag");
		} else if(until === null) {
			return logError(node, "WHILE: Missing required ModifyOutput tag");
		}
		// Find intype
		if(intype === undefined) {
			intype = Datum.type[parent.get("inType") || "Num"] || Num;
		} else {
			intype = Datum.type[intype] || Num;
			delete atts.inType;
		}
		inconv = intype.converter;
		// Find outtype
		if(outtype === undefined) {
			outtype = Datum.type[parent.get("inType") || parent.get("type") || "Str"] || Str;
		} else {
			outtype = Datum.type[outtype] || Str;
			delete atts.outType;
		}
		outconv = outtype.converter;
		// Create While tag
		tag = atts;
		atts = [];
		Object.getOwnPropertyNames(tag).forEach(name => atts.push([name, tag[name]]));
		tag = new While(parent, node, atts, intype, outtype);
		// Check Input
		if(input !== undefined) {
			input = intype.converter(input);
			delete atts.input;
		} else {
			let i = node.querySelector("Input");
			if(i === null) {
				input = inconv("");
			} else {
				let a = parseAttributesToObject(i);
				if(a.value !== undefined) {
					input = inconv(a.value);
				} else if (a.fromId !== undefined) {
					let property = a.attribute || "value",
						target = a.fromId;
					if(target === "this") {
						input = SelfReference.getReference(property, tag, i, []);
					} else {
						input = DatumReference.getReference(target, property, tag, node, atts);
					}
				} else {
					input = inconv(i.textContent);
				}
			}
		}
		tag.set("input", input);
		// Check Output
		if(output !== undefined) {
			output = outtype.converter(output);
			delete atts.output;
		} else {
			let i = node.querySelector("Output");
			if(i === null) {
				output = outconv("");
			} else {
				let a = parseAttributesToObject(i);
				if(a.value !== undefined) {
					output = outconv(a.value);
				} else if (a.fromId !== undefined) {
					let property = a.attribute || "value",
						target = a.fromId;
					if(target === "this") {
						output = SelfReference.getReference(property, tag, i, []);
					} else {
						output = DatumReference.getReference(target, property, tag, node, atts);
					}
				} else {
					output = outconv(i.textContent);
				}
			}
		}
		tag.set("output", output);
		// Check ModifyInput
		temp = [];
		modIn.forEach(function(mi) {
			var a = parseAttributesToObject(mi);
			if(a.mult) {
				temp.push([Equation.Multiply, inconv(a.mult)]);
			}
			if(a.div) {
				temp.push([Equation.Divide, inconv(a.div)]);
			}
			if(a.rem) {
				temp.push([Equation.Remainder, inconv(a.rem)]);
			}
			if(a.add) {
				temp.push([Equation.Add, inconv(a.add)]);
			}
			if(a.floor) {
				temp.push([Equation.Floor, null]);
			}
			if(a.ceil) {
				temp.push([Equation.Ceil, null]);
			}
			if(a.round) {
				temp.push([Equation.Round, null]);
			}
		});
		tag.set("modifyInput", temp);
		// Check ModifyOutput
		temp = [];
		modOut.forEach(function(mo) {
			var a = parseAttributesToObject(mo);
			if(a.mult) {
				temp.push([Equation.Multiply, outconv(a.mult)]);
			}
			if(a.div) {
				temp.push([Equation.Divide, outconv(a.div)]);
			}
			if(a.rem) {
				temp.push([Equation.Remainder, outconv(a.rem)]);
			}
			if(a.add) {
				temp.push([Equation.Add, outconv(a.add)]);
			}
			if(a.floor) {
				temp.push([Equation.Floor, null]);
			}
			if(a.ceil) {
				temp.push([Equation.Ceil, null]);
			}
			if(a.round) {
				temp.push([Equation.Round, null]);
			}
			if(a.useInput) {
				temp.push([While.ModOutWithIn, a.useInput]);
			}
		});
		tag.set("modifyOutput", temp);
		// Need to handle UNTIL, then GRABVALUE
		// Check Until
		temp = parseAttributesToObject(until);
		if(temp.operation) {
			let op = "AND";
			if (temp.operation === "OR") {
				op = "OR";
			} else if (temp.operation === "XOR") {
				op = "XOR";
			}
			tag.set("operation", op);
		} else {
			tag.set("operation", "AND");
		}
		if(![...until.children].every(function(item) {
			var name = item.nodeName,
				amount = null,
				literalFlag = true;
			if(If[name] === undefined) {
				temp = name;
				return false;
			}
			if(node.hasAttribute("value")) {
				// Element has value attribute
				amount = inconv(node.getAttribute("value"));
			} else if (node.hasAttribute("fromId")) {
				// Element is referring to another element
				let property = node.getAttribute("attribute") || "value";
				amount = node.getAttribute("fromId");
				if(amount === "this") {
					amount = SelfReference.getReference(property, this, node, []);
				} else {
					amount = new DatumReference(amount, property);
				}
				literalFlag = false;
			} else {
				// Set the amount to the text content of the element
				amount = inconv(node.textContent);
			}
			this.until.push([name, literalFlag, amount]);
			return true;
		})) {
			return logError(node, "WHILE: invalid tag \"" + temp + "\" inside its Until tag.");
		} else if (this.until.length === 0) {
			return logError(node, "WHILE: tag has no valid comparison tags inside its Until tag.");
		}
		return tag;
	}
//<While inType="Int" outType="Str">
//	<Until>
//		<GreaterThan value="5" />
//	</Until>
//	<Input fromID="this" attribute="value" />
//	<Output formula="convert_value_to_string" />
//	<ModifyInput add="-5" />
//	<ModifyOutput add="/+" useInput="add" />
//</While>
	grabValue(context) {
		var value = this.startingAmount, results = [], operation = this.operation, converter = this.inType.converter;
//		console.log(["IF", this.type, this.outType, value]);
		if(value instanceof SpecialGrabber) {
			value = converter(value.grabValue(context));
		}
		this.comparison.forEach(function(unit) {
			var test, [name, literalFlag, amount] = unit, refObj = If;
			if(refObj[name] === undefined) {
				refObj = Equation;
			}
			if(literalFlag) {
				// A literal value
				test = refObj[name](value, converter(amount));
			} else {
				// A Reference as value
				test = refObj[name](value, converter(amount.grabValue(context)));
			}
			results.push(test);
		});
		switch (operation) {
			case "AND":
				value = results.every(v => v);
				break;
			case "OR":
				value = !results.every(v => !v);
				break;
			case "XOR":
				value = results.filter(v => v).length === 1;
		}
		if(value) {
			value = this.then;
		} else {
			value = this.else;
		}
		converter = this.outType.converter;
		if(value.length === 0) {
			value = converter("");
		} else {
			let v = [];
			value.forEach(function(item) {
				if(item instanceof SpecialGrabber) {
					v.push(converter(item.grabValue(context)));
				} else if (item instanceof BasicStatObject) {
					v.push(converter(item.get("value")));
				} else {
					v.push(item)
				}
			});
			value = converter("");
			v.forEach(x => value += x);
		}
		return value;
	}
	static ModOutWithIn(value, test) {
		return value > test;
	}
}

