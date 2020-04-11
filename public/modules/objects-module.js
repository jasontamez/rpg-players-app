// Import query selectors
import { $q, $a } from "./dollar-sign-module.js";
// Import parsing and logging
import { logErrorText as logError } from "./parsing-logging.js";


////////////////////////////
/////// STAT OBJECTS ///////
////////////////////////////

// Each object much define a .toJSON method that 

// Basic object, parent of all that follow
export class ObjectWithAttributes {
	// new ObjectWithAttributes(attributesMap)
	constructor(atts) {
		this.atts = atts;
	}
	// handle Map() for JSON
	toJSON(key) {
		return {
			atts: Array.from(this.atts),
			parser: "ObjectWithAttributes"
		};
	}
	get(key) {
		return this.atts(key);
	}
	set(key, value) {
		return this.atts.set(key, value);
	}
}

// Define a class for Groups
export class GroupObject extends ObjectWithAttributes {
	// new GroupObject(idString, attributesMap)
	constructor(id, atts) {
		super(atts);
		this.id = id;
	}
	toJSON(key) {
		var o = super(key);
		o.id = this.id;
		o.parser = "Group";
		return o;
	}
}

// Defines a class for Stat objects
// - Stats inherit properties from their .groups
export class StatObject extends GroupObject {
	// new StatObject(idString, attributesMap, ?groupsArray)
	constructor(id, atts, groups = []) {
		super(id, atts, groups);
		this.groups = groups;
		this.defaultContext = id;
	}
	toJSON(key) {
		var o = super(key);
		o.defaultContext = this.defaultContext;
		o.groups = this.groups;
		o.parser = "StatObject";
		return o;
	}
}

// This class is designed to be a parent only to other parent classes
// - It lacks a .toJSON method and corresponding $RPG.objects.parser function
// Children of this should implement a .getValue method
export class SpecialGrabber extends ObjectWithAttributes {
	constructor(atts) {
		super(atts);
	}
	get() {
		var a = Array.from(arguments),
			v = a.length ? a.shift() : undefined;
		if(v === "value") {
			return this.getValue(...a);
		}
		return undefined;
	}
}

// A class for self-referencial values on a Stat
// - i.e. "look at .otherProp on this Stat"
export class ReferenceObject extends SpecialGrabber {
	// DO NOT USE new ReferenceObject()
	// ReferenceObject.makeReference(propString, ?attributesMap)
	constructor(prop, atts = new Map()) {
		super(atts);
		this.prop = prop;
		ReferenceObject.references.set(prop, this);
	}
	toJSON(key) {
		var o = super(key);
		o.prop = this.prop;
		o.parser = "Reference";
		return o;
	}
	getValue(context) {
		return context.get(this.prop, context);
	}
	static makeReference(prop, atts = new Map()) {
		if(this.references.has(prop)) {
			return this.references.get(prop);
		}
		return new ReferenceObject(prop, atts);
	}
}
ReferenceObject.references = new Map();

// A class for values that are merely references to other Stats
export class CrossReference extends ReferenceObject {
	// DO NOT USE new CrossReference()
	// CrossReference.makeReference(idString, propString, ?attributesMap)
	constructor(id, prop, atts = new Map()) {
		super(prop, atts);
		this.reference = id;
		CrossReference.references.set(id + " => " + prop, this);
	}
	toJSON(key) {
		var o = super(key);
		o.id = this.id;
		o.parser = "CrossReference";
		return o;
	}
	getValue() {
		var reference = $RPG.current.character.getTBD(this.reference),
			a = Array.from(arguments);
		if(reference === undefined) {
			logError("ERROR: unable to find \"" + this.reference + "\" when fetching CrossReference");
			return "";
		}
		return reference.get(this.property, ...a);
		// incomplete
	}
	static makeReference(id, prop, atts = new Map()) {
		var ref = id + " => " + prop;
		if(this.references.has(ref)) {
			return this.references.get(ref);
		}
		return new CrossReference(id, prop, atts);
	}
}
CrossReference.references = new Map();

// 
export class EquationObject extends SpecialGrabber {
	// new EquationObject(attributesMap)
	// attributesMap must includes key "instructions" pointing to an Array
	// use EquationObject.makeEquation(instructionsArray, otherAttributesMap)
	//   to (mildly) test that instructions are valid
	constructor(atts) {
		super(atts);
	}
	toJSON(key) {
		var o = super(key);
		o.parser = "Equation";
		return o;
	}
	getValue(context) {
		var i = this.get("instructions"),
			reference = context,
			total = 0,
			instructions;
		if(reference && !(reference instanceof ($RPG.objects.stats.StatObject))) {
			reference = $RPG.current.character.getTBD(context);
		}
		if(!reference) {
			logError("ERROR: Cannot find a Stat named \"" + context + "\"");
			return undefined;
		} else if (!i || !(i instanceof Array)) {
			logError("ERROR: Invalid instructions on EquationObject");
			return undefined;
		}
		instructions = i.slice();
		while(instructions.length > 0) {
			let line = instructions.shift().slice(),
				method = line.shift(),
				value = line.shift();
			if(value instanceof Array) {
				let ref = value.slice(),
					stat = ref.shift(),
					prop;
				if(stat === null) {
					stat = reference;
				}
				if(ref.length > 0) {
					prop = ref.shift();
				} else {
					prop = "value";
				}
				value = stat.get(prop);
			} else if (value === null) {
				value = reference.get("value");
			}
			total = EquationObject[method](total, value);
		}
		return total;
		// incomplete
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
	static AtMost(total, n) {
		return Math.min(total, n);
	}
	static AtLeast(total, n) {
		return Math.max(total, n);
	}
	static makeEquation(instrc, otherAtts = new Map()) {
		var i = [],
			instructions = instrc.slice(),
			e;
		while(instructions.length > 0) {
			let test = i.shift(),
				t = test[0];
			if(this.hasOwnProperty(t) && t !== "makeEquation") {
				i.push(test);
			} else {
				return null;
			}
		}
		e = $RPG.objects.stats.Equation;
		otherAtts.set("instructions", i);
		return new e(otherAtts);
	}
}


////////////////////////////
/////// STAT PARSERS ///////
////////////////////////////

// These are used by JSON.parse to reconstruct objects.

// Things will get tricky when we have to reconstruct arrays of other objects...

function restoreAttributes(key, prop, flagged) {
	if(key === "atts") {
		return new Map(prop);
	} else if (key === "parser") {
		return undefined;
	} else if (key === "" && !flagged) {
		let o = $RPG.objects.stats.ObjectWithAttributes;
		return new o(prop.atts);
	}
	return prop;
}
function restoreGroup(key, prop, flagged) {
	if (key === "" && !flagged) {
		let g = $RPG.objects.stats.GroupObject;
		return new g(prop.name, prop.atts);
	}
	return prop;
}
function restoreStat(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let s = $RO.stats.StatObject;
		return new s(prop.name, prop.atts);
	}
	return $RO.parser.Group(key, prop, true);
}
function restoreReference(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let ro = $RO.stats.ReferenceObject;
		return ro.makeReference(prop.prop, prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}
function restoreCrossReference(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let cr = $RO.stats.CrossReference;
		return cr.makeReference(prop.id, prop.prop, prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}
function restoreEquation(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let e = $RO.stats.Equation;
		return new e(prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}


$RPG.ADD("objects", {
	stats: {
		ObjectWithAttributes: ObjectWithAttributes,
		Group: GroupObject,
		Stat: StatObject,
		Grabber: SpecialGrabber,
		Reference: ReferenceObject,
		CrossReference: CrossReference,
		Equation: EquationObject
	},
	parser: {
		ObjectWithAttributes: restoreAttributes,
		Group: restoreGroup,
		StatObject: restoreStat,
		Reference: restoreReference,
		CrossReference: restoreCrossReference,
		Equation: restoreEquation
	}
});
