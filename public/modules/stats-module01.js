// Import query selectors
import { $q, $a } from "./dollar-sign-module.js";
// Import parsing and logging
import { parseObjectToArray, parseAttributesToObject, parseIdAndAttributesToArray, logErrorNode as logError, logErrorText } from "./parsing-logging.js";

// temp variable to log all objects created
export var record = [];

var InformationObject = {},
	FormulaeObject = {};

window.info = InformationObject;

// Parsing functions, specialized for this module instead of taken from parsing-logging.js
function paarseAttributesToObject(node) {
	var a = node.attributes, c = 0, atts = {};
	while(c < a.length) {
		let att = a.item(c), key = att.name, value = att.value, converter = InformationObject.converters[key];
		if (converter !== undefined) {
			atts[key] = converter(value);
		} else {
			atts[key] = value;
		}
		c++;
	}
	return atts;
}
function paarseIdAndAttributesToArray(node) {
	let a = node.attributes, c = 0, atts = [], id = "";
	while(c < a.length) {
		let att = a.item(c), n = att.name, v = att.value, converter = InformationObject.converters[n];
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


// Define a class for XML Stat tags
//   o = new BasicStatObject(parentTag || undefined, xmlNode, [attribute pairs])
//   o.set("property", value)
//   o.get("property") => value
export class BasicStatObject {
	constructor(parent, node, atts) {
		let a = new Map();
		this.parent = parent;
		this.node = node;
		atts.forEach(function(prop) {
			a.set(prop[0], prop[1]);
		});
		this.atts = a;
		this.defaultContext = this;
		record.push([this, this.constructor]);
	}
	get(prop, context = this.defaultContext) {
		var found = this.atts.get(prop),
			parent = this.parent, c = 1;
		// if found is undefined, check parents
		if(found === undefined && parent !== undefined) {
			found = parent.get(prop, context);
		}
		while(found instanceof BasicStatObject) {
			if (found instanceof SpecialGrabber) {
				found = found.grabValue(context);
			} else {
				found = found.get("value", context);
			}			
		}
		return found;
	}
	set(prop, v) {
		return this.atts.set(prop, v);
	}
}


// Stat objects with IDs
//   o = new BasicIdObject(stringID || null, parentTag || undefined, xmlNode, [attribute pairs])
//   o.set("property", value)
//   o.get("property") => value
//   BasicIdObject.getById("stringID") => o
export class BasicIdObject extends BasicStatObject {
	// ID of tag (or ""), parent of tag (or undefined), any other attributes of the tag
	constructor(id, parent, node, atts) {
		super(parent, node, atts);
		if(id === null) {
			id = "unidentified object " + BasicIdObject.counter.toString();
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


// Special objects with complex values
//   o = new SpecialGrabber(parentTag || undefined, xmlNode, [attribute pairs])
//   o.grabValue() => value
// This is a dummy object that does nothing on its own,
//   but its children will define their own grabValue function
export class SpecialGrabber extends BasicStatObject {
	constructor(parent, node, atts) {
		super(parent, node, atts);
	}
	grabValue() {
		return undefined;
	}
}


// Special objects with complex values
//   o = new Attribute(parentTag, xmlNode, [attribute pairs], stringName)
// <Attribute> tag
export class Attribute extends BasicStatObject {
	constructor(parent, node, atts, nombre) {
		super(parent, node, atts);
		this.name = nombre;
		this.defaultContext = parent;
	}
}


// Basic stat objects with IDs, containing simple values
//   o = new BasicIdObject(stringID || null, parentTag || undefined, xmlNode, [attribute pairs])
// BasicStat.converter(value) => value
export class BasicStat extends BasicIdObject {
	constructor(id, parent, node, atts) {
		var i;
		//console.log("Making id-" + id);
		//console.log(atts);
		super(id, parent, node, atts);
		i = this.atts;
		if(!i.has("startingValue") && this.get("startingValue") === undefined) {
			i.set("startingValue", null);
		}
		if(!i.has("value")) {
			i.set("value", this.get("startingValue"));
		}
	}
}
BasicStat.converter = function(input) { return input; }
BasicStat.prototype.type = BasicStat;


// SpecialGrabber instance representing a property in the same context
//   o = SelfReference.getReference(stringProperty, parentTag || undefined, xmlNode, [attribute pairs])
//   o.grabValue(context) => context.get("stringProperty")
export class SelfReference extends SpecialGrabber {
	constructor(property, parent, node, atts) {
		super(parent, node, atts);
		this.property = property;
		SelfReference.refs.set(property, this);
	}
	grabValue(context) {
		//console.log(["SELF REFERENCE", context]);
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


// SpecialGrabber instance representing a possibly-changing property on a different stat object
//   o = StatReference.getReference(stringIDofStat, stringProperty, parentTag || undefined, xmlNode, [attribute pairs])
//   o.grabValue() => BasicIdObject.getById("stringIdofStat").get("stringProperty")
export class StatReference extends SelfReference {
	constructor(statStr, property, parent, node, atts) {
		super(statStr + "->" + property, parent, node, atts);
		this.reference = statStr;
		this.property = property;
	}
	grabValue(context) {
		var reference = BasicIdObject.getById(this.reference);
		//console.log(["BasicStat REFERENCE", context]);
		if(reference === undefined) {
			logError(this, "ERROR: unable to find BasicStat named \"" + this.reference + "\" when fetching property");
			return "";
		}
		return reference.get(this.property);
	}
	static getReference(statStr, property, parent, node, atts) {
		var test = SelfReference.refs.get(statStr + "->" + property);
		if(test !== undefined) {
			return test;
		}
		return new StatReference(statStr, property, parent, node, atts);
	}
}


// Master object for a set of similar, related stat objects
//   o = new MultiStat(stringID, parentTag || undefined, xmlNode, statType, [attribute pairs])
//         (statType is a child of BasicStat)
//   o.makeStatFromNode(xmlNode, [attribute pairs]) => new statType(...)
//   o.makeStatBasic(name, title, description) => new statType(id_based_on_name, ...)
//   MultiStat.getById(stringID) => o
export class MultiStat extends BasicIdObject {
	constructor(id, parent, node, type, atts) {
		var i;
		super(id, parent, node, atts);
		i = this.atts;
		i.has("idPre") || i.set("idPre", "_");
		i.has("idPost") || i.set("idPost", "");
		this.inheritors = [];
		this.inhCount = 1;
		this.type = type;
		MultiStat.allIDs.set(id, this);
	}
	makeStatFromNode(node, atts) {
		var n = this.inhCount++,
			id = this.get("idPre") + n.toString() + this.get("idPost"),
			newStat;
		newStat = new this.type(id, this, node, atts);
		this.inheritors.push(newStat);
		return newStat;
	}
	makeStatBasic(name, title, description) {
		var n = this.inhCount++,
			pre = this.get("idPre"),
			post = this.get("idPost"),
			atts = [],
			i = this.atts,
			id, titlePre, titlePost, descPre, descPost, t, d,
			newStat,
			decrement = false;
		// Get id
		if(name) {
			id = pre + name.toString() + post;
		} else {
			id = pre + n.toString() + post;
			// flag in case we need to revert
			decrement = true;
		}
		// Make sure this isn't a duplicate
		if(BasicIdObject.getById(id) !== undefined) {
			// It is
			if(decrement) {
				this.inhCount--;
			}
			return logErrorText("ERROR INHERITING FROM MULTISTAT: id \"" + id + "\" already exists");
		}
		// Parse atts
		i.forEach(function(v, key) {
			switch(key) {
				case "idPre":
				case "idPost":
					// Do nothing
					break;
				case "titlePre":
					titlePre = v;
					break;
				case "titlePost":
					titlePost = v;
					break;
				case "descPre":
					descPre = v;
					break;
				case "descPost":
					descPost = v;
					break;
				case "title":
					t = v;
					break;
				case "description":
					d = v;
					break;
				default:
					atts.push([key, v]);
			}
		});
		// Check for title
		if(title === undefined) {
			if(t !== undefined) {
				atts.push(["title", t]);
			} else if (titlePre !== undefined && titlePost !== undefined) {
				atts.push(["title", String(titlePre) + String(titlePost)]);
			}
		} else if (titlePre !== undefined && titlePost !== undefined) {
			atts.push(["title", String(titlePre) + title + String(titlePost)]);
		}
		// Check for description
		if(description === undefined) {
			if(d !== undefined) {
				atts.push(["description", d]);
			} else if (descPre !== undefined && descPost !== undefined) {
				atts.push(["description", String(descPre) + String(descPost)]);
			}
		} else if (descPre !== undefined && descPost !== undefined) {
			atts.push(["description", String(descPre) + description + String(descPost)]);
		}
		// Make Stat
		newStat = new this.type(id, this, undefined, atts);
		this.inheritors.push(newStat);
		return newStat;
	}
	static getById(id) {
		return MultiStat.allIDs.get(id);
	}
}
MultiStat.allIDs = new Map();


// Stat with a numeric value
//   o = new Num(stringID, parentTag || undefined, xmlNode, [attribute pairs])
//         (attribute pairs may contain startingValue, minValue, maxValue, stepValue, stepAdjust)
//   Num.converter("123.5") => 123.5
export class Num extends BasicStat {
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
			} else if(t.get(n) === undefined) {
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
				num = this.type.converter(v);
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
				v = this.type.converter(v);
				break;
			case "stepValue":
				v = this.type.converter(v);
				if(v <= 0) {
					v = 1;
				}
				break;
		}
		return this.atts.set(prop, v);
	}
	get(prop, context = this.defaultContext) {
		var v = super.get(prop, context),
			step;
		if(prop === "value") {
			return this.getWithStep(v);
		}
		return v;
	}
	getWithStep(v) {
		var step = this.get("stepValue");
		if(step === step && (v / step) > 0) {
			switch(this.get("stepAdjust")) {
				case "ceil":
				case "ceiling":
					v = Math.ceil(v / step);
					break;
				case "round":
					v = Math.round(v / step);
					break;
				default:
					v = Math.floor(v / step);
			}
			v *= step;
			return this.type.converter(v);
		}
		return v;
	}
}
Num.converter = Number;
Num.numericProperties = [["startingValue", 0], ["minValue", NaN], ["maxValue", NaN], ["stepValue", NaN]];
Num.prototype.type = Num;


// Stat with an integer value
//   o = new Int(stringID, parentTag || undefined, xmlNode, [attribute pairs])
//         (attribute pairs may contain startingValue, minValue, maxValue, stepValue, stepAdjust)
//   Int.converter("123.4") => 123
//   Int.converter("123.5") => 124
export class Int extends Num {
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
				num = this.type.converter(v);
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
			case "stepValue":
				v = this.type.converter(v);
				break;
		}
		return this.atts.set(prop, v);
	}
}
Int.converter = function(x) { return Math.round(Number(x)) };
Int.prototype.type = Int;


// Stat with a string value
//   o = new Str(stringID, parentTag || undefined, xmlNode, [attribute pairs])
//         (attribute pairs may contain startingValue and validator)
//   Str.converter(12.3) => "12.3"
//   Str.converter(null) => "null"
//   validator is used as a regexp to 'validate' potential values:
//     o.set("value", "three") => (success)
//     o.get("value") => "three"
//     o.set("validator", "^[a-z]+$")
//     o.set("value", "4our") => false (did not change)
//     o.get("value") => "three"
//     o.set("value", "four") => (success)
//     o.get("value") => "four"
export class Str extends BasicStat {
	constructor(id, parent, node, atts) {
		var i;
		super(id, parent, node, atts);
		i = this.atts;
		if(i.has("validator")) {
			this.set("validator", i.get("validator"));
		}
		if(i.has("startingValue")) {
			i.set("startingValue", this.type.converter(i.get("startingValue")));
		}
		if(i.has("value")) {
			//console.log("RESET value with "+ i.get("value"));
			i.set("value", this.type.converter(i.get("value")));
		} else {
			//console.log("SETTING value with " + i.get("startingValue"));
			this.set("value", i.get("startingValue"));
		}
	}
	set(prop, v) {
		if(prop === "value" || prop === "startingValue") {
			let valid = this.get("validator");
			v = this.type.converter(v);
			if(valid !== undefined) {
				if(v.match(valid) == null) {
					return false;
				}
			}
		} else if (prop === "validator") {
			v = new RegExp(v);
		}
		return this.atts.set(prop, v);
	}
	get(prop, context = this.defaultContext) {
		var value = super.get(prop, context);
		// If validator is fetched from somewhere else, make sure it's a RegExp.
		if(prop === "validator" && value.constructor !== RegExp) {
			return new RegExp(value);
		}
		return value;
	}
}
Str.converter = String;
Str.prototype.type = Str;


// Stat with an integer value and extra methods for dealing with bonuses
//   o = new IntBonusable(stringID, parentTag || undefined, xmlNode, [attribute pairs])
//         (attribute pairs may contain startingValue, minValue, maxValue, stepValue, stepAdjust)
//   IntBonusable.converter("123.5") => 124
// Register bonuses:
//   o.registerBonusTag(stringUniqueName, stringStatID, stringAttribute, [attribute pairs])
//         (attribute pairs may contain type => stringTypeOfBonus)
//   o.addBonus(stringUniqueName, stringTypeOfBonus, integerBonus, ?stringNotation)
//         ('notation' describes the situation where the bonus applies)
//   o.removeBonus(stringUniqueName, stringTypeOfBonus, ?stringNotation)
//
// o.getModifiedValue(?context)
//   Each non-situation bonus is grouped by type
//   The highest positive and lowest negative values per type are added to the value
//     IF "insight" has bonuses (and penalties) equal to [1, 2, -2, 3, -1]
//     THEN only 3 and -2 are used, for a total of +1
//   HOWEVER if o.multistackable contains "insight", then
//     all the bonuses would be used, for a total of +3
export class IntBonusable extends Int {
	constructor(id, parent, node, atts) {
		super(id, parent, node, atts);
		this.bonuses = new Map();
		this.notes = new Map();
	}
	get(prop, context = this.defaultContext) {
		if(prop === "modifiedValue") {
			return this.getModifiedValue(context);
		}
		return super.get(prop, context);
	}
	getModifiedValue(context = this.defaultContext) {
		// get unmodified-by-step value
		var total = this.atts.get("value"),
			t = this;
		// go through all bonuses
		this.bonuses.forEach(function(type) {
			var bonuses = [0];
			type.forEach(function(value) {
				var v = value;
				if(value instanceof SpecialGrabber) {
					v = value.grabValue(context);
				}
				bonuses.push(v);
			});
			if(t.multistackable.indexOf(type) !== 1) {
				total += bonuses.reduce((acc, vv) => acc + vv, 0);
			} else {
				total += Math.max(...bonuses) + Math.min(...bonuses);
			}
		});
		total = this.getWithStep(total);
		return this.type.converter(total);
	}
	registerBonusTag(nombre, id, att, atts) {
		var tag,
			type = atts.type,
			notation = atts.note;
		if(id === "this") {
			tag = SelfReference.getReference(att, undefined, undefined, []);
		} else {
			tag = StatReference.getReference(id, att, undefined, undefined, []);
		}
		this.addBonus(nombre, type, tag, notation);
		return nombre;
	}
	addBonus(nombre, type, bonus, notation = undefined) {
		var prop, bonuses;
		if(notation !== undefined) {
			type = notation;
			prop = this.notes;
		} else {
			prop = this.bonuses;
		}
		if(!type || type.constructor !== String) {
			type = "";
		}
		bonuses = prop.get(type) || new Map();
		bonuses.set(nombre, bonus);
		prop.set(type, bonuses);
	}
	removeBonus(nombre, type, notation = false) {
		var prop, bonuses;
		if(notation !== false) {
			type = notation;
			prop = this.notes;
		} else {
			prop = this.bonuses;
		}
		bonuses = prop.get(type);
		if(bonuses !== undefined) {
			bonuses.delete(nombre);
			if(bonuses.size > 0) {
				prop.set(type, bonuses);
			} else {
				prop.delete(type);
			}
		}
	}
}
IntBonusable.converter = Int.converter;
IntBonusable.prototype.type = IntBonusable;
IntBonusable.prototype.multistackable = ["", "dodge"];


// Stat with a true/false value
//   o = new TF(stringID, parentTag || undefined, xmlNode, [attribute pairs])
//         (attribute pairs may contain startingValue, defaults to false)
//   TF.converter("123.5") => true
//   TF.converter("0") => false
export class TF extends IntBonusable {
	constructor(id, parent, node, atts) {
		super(id, parent, node, atts);
		this.bonuses = [];
		this.notes = new Map();
	}
	set(prop, v) {
		var min, max, num;
		//console.log(this.id + " " + prop + " = " + v);
		switch(prop) {
			case "value":
			case "startingValue":
				v = this.type.converter(v);
				break;
		}
		return this.atts.set(prop, v);
	}
	get(prop, context = this.defaultContext) {
		if(prop === "modifiedValue") {
			return this.getModifiedValue(context);
		}
		return this.atts.get(prop);
	}
	getModifiedValue(context = this.defaultContext) {
		// get unmodified-by-step value
		var base = this.atts.get("value"),
			list = this.bonuses;
		if(list.length === 0) {
			return base;
		}
		// only the final bonus counts
		base = list.slice().pop().pop();
		if(base instanceof SpecialGrabber) {
			base = base.grabValue(context);
		}
		return this.type.converter(base);
	}
	registerBonusTag(nombre, id, att, atts) {
		var tag,
			type = atts.type;
		if(id === "this") {
			tag = SelfReference.getReference(att, undefined, undefined, []);
		} else {
			tag = StatReference.getReference(id, att, undefined, undefined, []);
		}
		this.addBonus(nombre, type, tag);
		return nombre;
	}
	addBonus(nombre, type, bonus) {
		this.bonuses.every(function(pair, i) {
			var [n, v] = pair;
			if(n === nombre) {
				this.bonuses[i][1] = bonus;
				return false;
			}
			return true;
		});
	}
	removeBonus(nombre, type) {
		var toDelete = false;
		this.bonuses.every(function(pair, i) {
			var [n, v] = pair;
			if(n === nombre) {
				toDelete = i;
				return false;
			}
			return true;
		});
		if(toDelete !== false) {
			let b = this.bonuses.slice(0, toDelete),
				e = this.bonuses.slice(toDelete + 1);
			this.bonuses = b.concat(e);
			return true;
		}
		return false;
	}
}
TF.converter = function(v) {
	let test = parseInt(Number(v));
	if(Number.isNaN(test)) {
		switch (String(v).toLowerCase()) {
			case "false":
			case "fals":
			case "fal":
			case "fa":
			case "f":
				return false;
			case "true":
			case "tru":
			case "tr":
			case "t":
				return true;
		}
		return Boolean(v);
	}
	return Boolean(test);
};
TF.prototype.type = TF;


// This stat holds a pool of options and notes which options are selected
//   o = new Pool(stringID, parentTag || undefined, xmlNode, statType, [attribute pairs])
//     statType should be Str, Num or Int, describing the options in the pool itself
//     attributes may include minSelection and maxSelection denoting how many
//       selections can/must be made
//   o.get("startingValue") => undefined
//   o.addItem(stringID, value, ?booleanIsSelected) => adds item to pool
//   o.removeItem(stringID) => removes item
//   o.getItem(stringID) => {selected: boolean, value: <value>}
//   o.addSelection(stringID, stringID...) => marks items as selected
//   o.removeSelection(stringID, stringID...) => marks items as unselected
//   o.getSelection() => Set(stringID, stringID...)
//   o.getSelectionValues() => [value, value...]
//   Pool.converter([array]) => [array]
//   Pool.converter(value) => [value]
export class Pool extends BasicStat {
	constructor(id, parent, node, type, atts) {
		var i;
		super(id, parent, node, atts);
		i = this.atts;
		if(i.has("minSelection")) {
			this.set("minSelection", i.get("minSelection"));
		}
		if(i.has("maxSelection")) {
			this.set("maxSelection", i.get("maxSelection"));
		}
		this.itemType = type;
		this.values = new Map();
	}
	set(prop, v) {
		if(prop === "value" || prop === "startingValue") {
			return null;
		} else if (prop === "minSelection") {
			v = Math.max(0, Int.converter(v));
		} else if (prop === "maxSelection") {
			v = Math.max(1, Int.converter(v));
		}
		return this.atts.set(prop, v);
	}
	get(prop, context = this.defaultContext) {
		if(prop === "startingValue") {
			return undefined;
		} else if(prop === "value") {
			return this.getSelectionValues();
		}
		return super.get(prop, context);
	}
	addItem(title, value, selected = false) {
		var o = {
			value: value,
			title: title,
			selected: selected
		};
		this.values.set(title, o);
	}
	removeItem(title) {
		this.values.delete(title);
	}
	getItem(title) {
		// Returns an object with .selected and .value properties
		return this.values.get(title);
	}
	hasItem(title) {
		return this.values.get(title) !== undefined;
	}
	hasItemSelected(title) {
		var i = this.values.get(title);
		if(i === undefined) {
			return undefined;
		}
		return i.selected;
	}
	addSelection() {
		var args = [...arguments],
			values = this.values,
			selection = this.getSelection(),
			size = selection.size,
			max = this.get("maxSelection"),
			res;
		if(size >= max) {
			return false;
		}
		res = args.every(function(v) {
			var arg;
			if(size >= max) {
				return false;
			} else if(selection.has(v)) {
				return true;
			}
			arg = values.get(v);
			if(arg === undefined) {
				return true;
			}
			arg.selected = true;
			values.set(v, arg);
			size++;
			return true;
		});
		return res;
	}
	removeSelection() {
		var args = [...arguments],
			values = this.values,
			selection = this.getSelection(),
			size = selection.size,
			min = this.get("minSelection"),
			res;
		if(size <= min) {
			return false;
		}
		res = args.every(function(v) {
			var arg;
			if(size <= min) {
				return false;
			} else if(!selection.has(v)) {
				return true;
			}
			arg = values.get(v);
			if(arg === undefined) {
				return true;
			}
			arg.selected = false;
			values.set(v, arg);
			size--;
			return true;
		});
		return res;
	}
	getSelection() {
		var selection = new Set;
		this.values.forEach(function(v, title) {
			if(v.selected) {
				selection.add(title);
			}
		});
		return selection;
	}
	getSelectionValues() {
		var selection = [];
		this.values.forEach(function(v) {
			if(v.selected) {
				selection.push(v.value);
			}
		});
		return selection;
	}
}
Pool.converter = function(value, convObj = Str) {
	if(value.constructor !== Array) {
		value = [value];
	}
	return value.map(test => convObj.converter(test));
};
Pool.prototype.type = Pool;



// Stat that contains a mathematical equation
//   o = Equation.constructEquation(parentTag || undefined, xmlNode)
// Creating an Equation without a well-formed XML <Math> node is not recommended.
//
// o.grabValue(?context) => the result of the equation
export class Equation extends SpecialGrabber {
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
			type = InformationObject.getTypeObject(type, Num);
		}
		if(type === InformationObject.type.Typeless) {
			type = Num;
		}
		atts.type = type;
		tag = new Equation(amount, parent, node, parseObjectToArray(atts));
		[...node.children].forEach( step => tag.addStep(step) );
		return tag;
	}
	grabValue(context) {
		var value = this.startingAmount;
		this.math.forEach(function(unit) {
			//console.log(["MATH", value, ...unit]);
			var newVal, [nombre, literalFlag, amount] = unit;
			if(literalFlag) {
				// A literal value
				newVal = Equation[nombre](value, amount);
			} else {
				// A Reference as value
				//console.log(["->", amount, context]);
				Equation.tempV = amount;
				Equation.tempC = context;
				newVal = Equation[nombre](value, amount.grabValue(context));
			}
			value = newVal;
		});
		return value;
	}
	addStep(node) {
		var nombre = node.nodeName,
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
				amount = StatReference.getReference(amount, property, this, node, []);
			}
			literalFlag = false;
		} else {
			// Set the amount to the text content of the element
			amount = converter(node.textContent);
		}
		this.math.push([nombre, literalFlag, amount]);
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


// Stat that contains an if/then/else construction
//   o = If.constructIfThenElse(parentTag || undefined, xmlNode)
// Creating an If without a well-formed XML <If> node is not recommended.
//
//   o.grabValue(context) => the result of the if/then/else tree
//      NOTE that context is mandatory
export class If extends SpecialGrabber {
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
			outtype = atts.outType,
			operation = (atts.operation || "AND"),
			tag;
		if(intype === undefined) {
			intype = InformationObject.getTypeObject(parent.get("inType"), Num);
		} else {
			intype = InformationObject.getTypeObject(intype, Num);
			delete atts.inType;
		}
		if(outtype === undefined) {
			outtype = InformationObject.getTypeObject(parent.get("inType") || parent.get("type"), Str);
		} else {
			outtype = InformationObject.getTypeObject(outtype, Str);
			delete atts.outType;
		}
		if(operation === undefined) {
			operation = "AND";
		} else {
			delete atts.operation;
		}
		tag = new If(parent, node, parseObjectToArray(atts), intype, outtype, operation);
		//console.log("Constructing IF");
		[...node.children].forEach(function(step) {
			//console.log(step);
			var nombre = step.nodeName;
			switch(nombre) {
				case "Compare":
					//console.log("Compare");
					tag.addCompare(step, intype);
					//console.log(["COMPARE:", tag.startingAmount]);
					break;
				case "Then":
				case "Else":
					//console.log("Then/Else");
					tag.addThenElse(step, nombre, outtype, parent, node);
					//console.log([nombre.toUpperCase(), tag[nombre.toLowerCase()]]);
					break;
				default:
					//console.log("step");
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
				amount = StatReference.getReference(amount, property, this, node, []);
			}
		} else {
			// Set the amount to the text content of the element
			amount = converter(node.textContent);
		}
		this.startingAmount = amount;
	}
	addComparison(node, intype) {
		var nombre = node.nodeName,
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
				amount = StatReference.getReference(amount, property, this, node, []);
			}
			literalFlag = false;
		} else {
			// Set the amount to the text content of the element
			amount = converter(node.textContent);
		}
		this.comparison.push([nombre, literalFlag, amount]);
	}
	addThenElse(node, nombre, outtype, parent, pNode) {
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
				amount = SelfReference.getReference(property, this, node, []);
			} else {
				amount = StatReference.getReference(amount, property, this, node, []);
			}
		//} else if (node.children.length > 0) {
		} else if (node.getAttribute("use") === "Math") {
			//amount = new Attribute(nombre, outtype);
			amount = Equation.constructEquation(parent, node, [["type", outtype]]);
			//amount = new BasicStatObject(parent, pNode, [["type", outtype]]);
			//console.log(["ATTRIBUTE", nombre, outtype]);
			//parseStatNodes(node, amount);
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
		this[nombre.toLowerCase()] = amount;
	}
	grabValue(context) {
		var value = this.startingAmount, results = [], operation = this.operation, converter = this.inType.converter;
		//console.log(["IF", this.type, this.outType, value]);
		if(value instanceof SpecialGrabber) {
			value = converter(value.grabValue(context));
		}
		this.comparison.forEach(function(unit) {
			var test, [nombre, literalFlag, amount] = unit, refObj = If;
			if(refObj[nombre] === undefined) {
				refObj = Equation;
			}
			if(literalFlag) {
				// A literal value
				test = refObj[nombre](value, converter(amount));
			} else {
				// A Reference as value
				test = refObj[nombre](value, converter(amount.grabValue(context)));
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
	static Has(value, test) {
		return !value.every( item => item !== test );
	}
	static DoesNotHave(value, test) {
		return value.every( item => item !== test );
	}
}


// Stat that contains an do/while loop construction
//   o = Do.constructDo(parentTag || undefined, xmlNode)
// Creating an If without a well-formed XML <Do> node is not recommended.
//
//   o.grabValue(context) => the result of the do/while loop
//      NOTE that context is mandatory
export class Do extends SpecialGrabber {
	constructor(parent, node, atts, intype, outtype, input, output) {
		super(parent, node, atts);
		this.inType = intype;
		this.outType = outtype;
		this.input = intype.converter("");
		this.output = outtype.converter("");
		this.modInput = [];
		this.modOutput = [];
		this.operation = "AND";
		this.whiile = [];
	}
	static constructDo(parent, node) {
		var atts = parseAttributesToObject(node),
			intype = atts.inType,
			outtype = InformationObject.getTypeObject(atts.outType || parent.get("outType") || parent.get("type"), Str),
			input = atts.input,
			output = atts.output,
			modIn = $a("ModifyInput", node),
			modOut = $a("ModifyOutput", node),
			whiile = $q("While", node),
			inconv, outconv, tag, temp;
		if(modIn === null) {
			return logError(node, "WHILE: Missing required ModifyInput tag");
		} else if(modOut === null) {
			return logError(node, "WHILE: Missing required ModifyOutput tag");
		} else if(whiile === null) {
			return logError(node, "WHILE: Missing required ModifyOutput tag");
		}
		// Find intype
		if(intype === undefined) {
			intype = InformationObject.getTypeObject(parent.get("inType"), Num);
		} else {
			intype = InformationObject.getTypeObject(intype, Num);
			delete atts.inType;
		}
		inconv = intype.converter;
		// Find outtype
		if(outtype === undefined) {
			outtype = InformationObject.getTypeObject(parent.get("inType") || parent.get("type"), Str);
		} else {
			outtype = InformationObject.getTypeObject(outtype, Str);
			delete atts.outType;
		}
		outconv = outtype.converter;
		// Create Do tag
		tag = new Do(parent, node, [], intype, outtype);
		// Check Input
		if(input !== undefined) {
			input = intype.converter(input);
			delete atts.input;
		} else {
			let i = $q("Input", node);
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
						input = StatReference.getReference(target, property, tag, i, []);
					}
				} else {
					input = inconv(i.textContent);
				}
			}
		}
		tag.input = input;
		// Check Output
		if(output !== undefined) {
			output = outtype.converter(output);
			delete atts.output;
		} else {
			let i = $q("Output", node);
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
						output = StatReference.getReference(target, property, tag, i, []);
					}
				} else {
					output = outconv(i.textContent);
				}
			}
		}
		tag.output = output;
		// Set all attributes that still exist.
		parseObjectToArray(atts).forEach(function(arr) {
			var [prop, value] = arr;
			tag.set(prop, value);
		});
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
		tag.modifyInput = temp;
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
				temp.push([Do.ModOutWithIn, a.useInput]);
			}
		});
		tag.modifyOutput = temp;
		temp = parseAttributesToObject(whiile);
		if(temp.operation) {
			let op = "AND";
			if (temp.operation === "OR") {
				op = "OR";
			} else if (temp.operation === "XOR") {
				op = "XOR";
			}
			tag.operation = op;
		} else {
			tag.operation = "AND";
		}
		if(![...whiile.children].every(function(item) {
			var nombre = item.nodeName,
				amount = null,
				grabValueFlag = false;
			if(If[nombre] === undefined) {
				temp = nombre;
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
					amount = StatReference.getReference(amount, property, this, node, []);
				}
				grabValueFlag = true;
			} else {
				// Set the amount to the text content of the element
				amount = inconv(node.textContent);
			}
			tag.whiile.push([nombre, grabValueFlag, amount]);
			return true;
		})) {
			return logError(node, "WHILE: invalid tag \"" + temp + "\" inside its While tag.");
		} else if (tag.whiile.length === 0) {
			return logError(node, "WHILE: tag has no valid comparison tags inside its While tag.");
		}
		return tag;
	}
	grabValue(context) {
		var inconv = this.inType.converter,
			input = this.input,
			output = this.output,
			modIn = this.modifyInput,
			modOut = this.modifyOutput,
			whiile = this.whiile,
			operation = this.operation,
			mi = [],
			mo = [],
			check;
		// Get initial input and output
		if(input instanceof SpecialGrabber) {
			input = inconv(input.grabValue(context));
		}
		if(output instanceof SpecialGrabber) {
			output = this.outType.converter(output.grabValue(context));
		}
		modIn.forEach(function(mod) {
			var [func, value] = mod;
			if(value instanceof SpecialGrabber) {
				value = value.grabValue(context);
			}
			mi.push([func, value]);
		});
		modIn = mi;
		modOut.forEach(function(mod) {
			var [func, value] = mod;
			if(value instanceof SpecialGrabber) {
				value = value.grabValue(context);
			}
			mo.push([func, value]);
		});
		modOut = mo;
		check = Do.doWhile(input, inconv, whiile, operation, context);
		while(check) {
			modIn.forEach(function(mod) {
				var [func, value] = mod;
				input = func(input, value);
			});
			check = Do.doWhile(input, inconv, whiile, operation, context);
			if(check) {
				modOut.forEach(function(mod) {
					var [func, value] = mod;
					output = func(output, value, input);
				});
			}
		}
		return output;
	}
	static doWhile(input, inconv, whiile, operation, context) {
		var results = [], retVal = false;
		whiile.forEach(function(condition) {
			var [nombre, flag, value] = condition;
			if(flag) {
				value = inconv(value.grabValue(context));
			}
			results.push(If[nombre](input, value));
		});
		switch (operation) {
			case "AND":
				retVal = results.every(v => v);
				break;
			case "OR":
				retVal = !results.every(v => !v);
				break;
			case "XOR":
				retVal = results.filter(v => v).length === 1;
		}
		return retVal;
	}
	static ModOutWithIn(value, action, input) {
		switch (action) {
			case "add":
			case "append":
				return value + input;
			case "prepend":
				return input + value;
			case "multiply":
				return value * input;
			case "divideWith":
				return value / input;
			case "remainderWith":
				return value % input;
			case "divide":
				return input / value;
			case "remainder":
				return input % value;
		}
		return value;
	}
}


InformationObject.type = {
	Typeless: BasicStat,
	Num: Num,
	Int: Int,
	Str: Str,
	IntBonusable: IntBonusable,
	Pool: Pool,
	TF: TF
};

// A function to handle Type attributes
InformationObject.getTypeObject = function(type, fallback) {
	var c = InformationObject.type[type];
	// Is this a valid type?
	if(c !== undefined) {
		// If so, return it
		return c;
	}
	// Otherwise, return Str or other specified default
	return fallback || InformationObject.defaultTypeObject;
};
InformationObject.defaultTypeObject = Str;

//
//
//
//
//
//
// Probably don't need this any more
InformationObject.converters = {
	userEditable: function(input) { return input === "true"; },
	type: InformationObject.getTypeObject
};
//
//
//
//


// nodeType 1 -> tag, 3 -> text, 2 -> attribute, 8 -> comment, 9 -> document
//parent, parentTag, node, id, atts, env, StatNodes


export function parseStats(nodelist, sharedObject) {
	// Add in any additional properties
	Object.getOwnPropertyNames(sharedObject).forEach(function(prop) {
		if(InformationObject[prop] === undefined) {
			// New property.
			InformationObject[prop] = sharedObject[prop];
		} else {
			// Add to existing property.
			let Iprop = InformationObject[prop], sprop = sharedObject[prop];
			Object.getOwnPropertyNames(sprop).forEach(function(p) {
				Iprop[p] = sprop[p];
			});
		}
	});
	// Parse nodes
	nodelist.forEach( node => parseStatNodes(node, undefined) );
}


export function parseStatNodes(currentNode, currentTag, nodes = [...currentNode.children]) {
	// Get kids of the parent
	// Go through each child
	while(nodes.length > 0) {
		let node = nodes.shift(),
			nombre = node.nodeName;
		if(InformationObject.preprocessTags[nombre] !== undefined) {
			// This node will be changed by a preprocessor
			let info = InformationObject.preprocessTags[nombre](node, currentNode, currentTag);
			if(info === null) {
				// Something bad happened: skip this node
				continue;
			}
			// Use the returned value as the new node
			node = info;
		}
		if(InformationObject.StatTagHandlers[nombre] !== undefined) {
			// This node has a special handler: use it
			InformationObject.StatTagHandlers[nombre](node, currentNode, currentTag);
		} else if (InformationObject.TagHandlers[nombre] !== undefined) {
			// This node has a special handler: use it
			InformationObject.TagHandlers[nombre](node, currentNode, currentTag);
		//} else if (node.children.length > 0) {
		//  // This node has children: create a BasicIdObject for it and parse recursively
		//  let atts = parseIdAndAttributesToArray(node),
		//    id = atts.shift(),
		//    allAtts = ancestorAtts.concat(atts),
		//    tag = new BasicIdObject(nombre, id, parent, node, allAtts),
		//    newAncestry = ancestry.slice();
		//  // Add ancestry if needed
		//  if(currentTag !== undefined) {
		//    newAncestry.push([currentNode, currentTag]);
		//  }
		//  siblings.push(tag);
		//  parseStatNodes(node, tag, newAncestry, allAtts);
		//} else {
		//  // This is a simple text node: it will become a property of this node
		//  props.push([nombre, node.textContent]);
		} else {
			// This is an unknown tag
			logError(node, "Unknown tag enountered: " + nombre);
		}
	}
	return currentTag;
}

// not sure if I need siblings... or all ancestors...

export function parseStat(node, parentNode, parentTag) {
	var atts = parseIdAndAttributesToArray(node),
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
	type = InformationObject.getTypeObject(type, Str);
	tag = new type(id, parentTag, node, atts);
	parseStatNodes(node, tag);
}

export function parseMultiStat(node, parentNode, parentTag) {
	var atts = parseIdAndAttributesToArray(node),
		id = atts.shift(),
		checkAtts = atts.slice(),
		tag, type = undefined;
	if(parentTag !== undefined) {
		 type = parentTag.get("type");
	}
	if(checkAtts.reverse().every(function(pair) {
		var [key, value] = pair;
		if(key === "type") {
			type = value;
			return false;
		}
		return true;
	})) {
		// Did not find a type att inline
		// Use inherited value
		type = parentTag.get("type");
	}
	type = InformationObject.getTypeObject(type, Str);
	tag = new MultiStat(id, parentTag, node, type, atts);
	parseStatNodes(node, tag);
}

// these should probably set the Value property of their parent
// Math, If, and Get should only happen directly inside a tag that wants some content

export function parseMath(node, parentNode, parentTag) {
	var eq = Equation.constructEquation(parentTag, node);
	parentTag.set("value", eq);
}


export function parseIf(node, parentNode, parentTag) {
	var ifthen = If.constructIfThenElse(parentTag, node);
	parentTag.set("value", ifthen);
}
//intype, outtype, compareTag, style
//parseStatNodes(currentNode, currentTag, ancestry, ancestorAtts)


export function parseDo(node, parentNode, parentTag) {
	var doWhile = Do.constructDo(parentTag, node);
	parentTag.set("value", doWhile);
}

export function parseGroup(node, parentNode, parentTag) {
	var atts = parseIdAndAttributesToArray(node),
		id = atts.shift(),
		tag = new BasicIdObject(id, parentTag, node, atts);
	parseStatNodes(node, tag);
}

export function parseAttribute(node, parentNode, parentTag) {
	var atts = parseAttributesToObject(node), tag, type,
		nombre = atts.name,
		fromID = atts.getFromId,
		formula = atts.formula,
		att = atts.attribute;
	if(nombre === undefined) {
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
	atts.type = InformationObject.getTypeObject(type, InformationObject.type.Typeless);
	tag = new Attribute(parentTag, node, parseObjectToArray(atts), nombre);
	if(fromID !== undefined) {
		// Copy from other attribute
		//tag.set(fromID, att || nombre);
		let ref = StatReference.getReference(fromID, att || nombre, tag, node, []);
		tag.set("value", ref);
	} else if (formula !== undefined) {
		// Clone info from formula
		let target = Formula.getName(formula), clone;
		if(target === undefined) {
			return logError(node, "ATTRIBUTE: formula \"" + formula + "\" does not exist");
			// Returning here prevents the tag from being saved into memory
		}
		clone = target.node.cloneNode(true);
		while(clone.firstChild !== null) {
			node.appendChild(clone.firstChild);
		}
		parseStatNodes(node, tag);
	} else if(node.children.length > 0) {
		// Node contains information that must be set as our value
		parseStatNodes(node, tag);
	} else {
		// Node contains text that must be set as our value
		tag.set("value", node.textContent);
	}
	// Save this attribute node
	//console.log([nombre, tag]);
	parentTag.set(nombre, tag);
}

export function parseBonus(node, parentNode, parentTag) {
	var atts, fromID, att, nombre, formula;
	if(!(parentTag instanceof IntBonusable)) {
		console.log(parentTag);
		return logError(node, "BONUS used within a non-Bonus-accepting type");
	}
	atts = parseAttributesToObject(node);
	formula = atts.formula;
	fromID = atts.getFromId;
	if(fromID === undefined && formula === undefined) {
		return logError(node, "BONUS: missing required \"getFromId\" or \"formula\" parameter");
	}
 	att = atts.attribute;
	if(att === undefined) {
		att = "value";
	} else {
		delete atts.attribute;
	}
	nombre = atts.id;
	if(nombre === undefined) {
		nombre = "Bonus from " + fromID + "." + att;
	} else {
		delete atts.id;  
	}
	if (formula !== undefined) {
		//addBonus(nombre, type, bonus, notation = undefined)
		let f = Formula.getName(formula);
		if(f === undefined) {
			return logError(node, "BONUS: formula \"" + formula + "\" is not defined");
		}
		return parentTag.addBonus(nombre, atts.type, f, atts.note); //redo Formula
	}
	delete atts.fromId;
	parentTag.registerBonusTag(nombre, fromID, att, parseObjectToArray(atts));
}


//<BonusChoice>


export function parsePool(node, parentNode, parentTag) {
 	var atts = parseAttributesToObject(node),
		type = atts.type,
		id = atts.id,
		tag;
	if(id === undefined) {
		return logError(node, "POOL: missing required \"id\" property");
	}
	if(type === undefined) {
		type = parentTag.get("type");
	}
	type = InformationObject.getTypeObject(type, Str);
	tag = new Pool(id, parentTag, node, type, parseObjectToArray(atts));
	parseStatNodes(node, tag);
}


function parsePoolItem(node, parentNode, parentTag) {
	var atts, value, title, selected;
	if(!(parentTag instanceof Pool)) {
		return logError(node, "ITEM can only be used directly inside a POOL");
	}
	atts = parseAttributesToObject(node);
	value = atts.value;
	if(value === undefined) {
		return logError(node, "ITEM: missing required \"value\" parameter");
	}
	title = atts.title;
	if(title === undefined) {
		title = value;
	}
	selected = atts.selected || false;
	parentTag.addItem(title, value, selected);
}


//<PoolBonus>
//<PoolBonusSelect>
//<PoolBonusChoice>
//<PoolBonusChoice to="combatEffects" title="Choose a breath weapon">


InformationObject.StatTagHandlers = {
	Group: parseGroup,
	Stat: parseStat,
	MultiStat: parseMultiStat,
	Math: parseMath,
	If: parseIf,
	Do: parseDo,
	Bonus: parseBonus,
	Pool: parsePool,
	Item: parsePoolItem
};

InformationObject.preprocessTags = {};

InformationObject.TagHandlers = {
	Attribute: parseAttribute,
	BasicIdObject: parseGroup
};




//separate script?
//separate script?
//separate script?
//separate script?
InformationObject.BundleTagHandlers = {
	Bonus: parseBonusBundle
};
export function parseBonusBundle() {
	
}
//separate script?
//separate script?
//separate script?
//separate script?







// Formula object with ability to find any formula by name
//   o = new Formula(xmlNode, stringName, [attribute pairs])
// Formula.getName("stringName") => o
export class Formula extends SpecialGrabber {
	constructor(node, nombre, atts) {
		super(undefined, node, atts, nombre);
		this.name = nombre;
		this.node = node;
		Formula.formulae.set(nombre, this);
	}
	grabValue(context) {
		var found = this.get("value", context);
		while(found instanceof BasicStatObject) {
			if (found instanceof SpecialGrabber) {
				found = found.grabValue(context);
			} else {
				found = found.get("value", context);
			}			
		}
		return found;
	}
	static getName(nombre) {
		return Formula.formulae.get(nombre);
	}
}
Formula.formulae = new Map();


export function parseFormulae(nodelist, sharedObject) {
	// Add in any additional properties
	Object.getOwnPropertyNames(sharedObject).forEach(function(prop) {
		if(FormulaeObject[prop] === undefined) {
			// New property.
			FormulaeObject[prop] = sharedObject[prop];
		} else {
			// Add to existing property.
			let Iprop = FormulaeObject[prop], sprop = sharedObject[prop];
			Object.getOwnPropertyNames(sprop).forEach(function(p) {
				Iprop[p] = sprop[p];
			});
		}
	});
	// Parse nodes
	nodelist.forEach( node => parseFormula(node) );
}


export function parseFormula(node) {
	var atts = parseAttributesToObject(node),
		nombre = atts.name,
		type = atts.type,
		overwrite = TF.converter(atts.overwrite),
		tag;
	if(nombre === undefined) {
		return logError(node, "FORMULA: missing required \"name\" parameter");
	}
	delete atts.name;
	if(Formula.getName(nombre) !== undefined && !overwrite) {
		return logError(node, "FORMULA: cannot overwrite existing \"" + nombre + "\" formula without an explicit \"overwrite\" parameter");
	}
	if(overwrite) {
		delete atts.overwrite;
	}
	atts.type = InformationObject.getTypeObject(type, InformationObject.type.Typeless);
	tag = new Formula(node, nombre, parseObjectToArray(atts));
	parseStatNodes(node, tag);
}

InformationObject.formula = Formula;

