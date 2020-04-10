// Import query selectors
import { $q, $a } from "./dollar-sign-module.js";
// Import parsing and logging
import { logErrorText as logError } from "./parsing-logging.js";


////////////////////////////
/////// STAT OBJECTS ///////
////////////////////////////

// Each object much define a .toJSON method that 

// Define a class for Groups
export class GroupObject {
	// new GroupObject(nameString, attributesMap)
	constructor(nombre, atts) {
		this.name = nombre;
		this.atts = atts;
	}
	// handle Map() for JSON
	toJSON(key) {
		return {
			name: this.name,
			atts: Array.from(this.atts),
			parser: "Group"
		};
	}
}

export class StatObject extends GroupObject {
	constructor(nombre, atts, groups = []) {
		super(nombre, atts, groups);
		this.groups = groups;
	}
	toJSON(key) {
		var o = super(key);
		o.groups = this.groups;
		o.parser = "StatObject";
		return o;
	}
}

export class ReferenceObject extends StatObject {
	constructor(nombre, prop, atts = new Map(), groups = []) {
		super(nombre, atts, groups);
		this.prop = prop;
	}
	toJSON(key) {
		var o = super(key);
		o.prop = this.prop;
		o.parser = "Reference";
		return o;
	}
	static makeReference(nombre, prop, atts = new Map()) {
		var o = $RPG.current.character.getStatObject(nombre);
		if(o === undefined) {
			return null;
		}
		return new ReferenceObject(nombre, prop, atts);
	}
}

export class EquationObject extends ReferenceObject {
	constructor(nombre, atts, groups, instructions) {
		super(nombre, atts, groups);
		this.instructions = instructions;
	}
	toJSON(key) {
		var o = super(key);
		o.parser = "Equation";
		return o;
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
	static makeEquation(nombre, atts, groups, instructions) {
		var i = [], e;
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
		return new e(nombre, atts, groups, i);
	}
}


////////////////////////////
/////// STAT PARSERS ///////
////////////////////////////

// These are used by JSON.parse to reconstruct objects.

// Things will get tricky when we have to reconstruct arrays of other objects...

function restoreGroup(key, prop, flagged) {
	if(key === "atts") {
		return new Map(prop);
	} else if (key === "parser") {
		return undefined;
	} else if (key === "" && !flagged) {
		let g = $RPG.objects.stats.GroupObject;
		return new g(prop.name, prop.atts);
	}
	return prop;
}
function restoreStat(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let s = $RO.stats.ReferenceObject;
		return new s(prop.name, prop.prop, prop.atts);
	}
	return $RO.parser.Stat(key, prop, true);
}
function restoreReference(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let s = $RO.stats.StatObject;
		return new s(prop.name, prop.atts);
	}
	return $RO.parser.Group(key, prop, true);
}
function restoreEquation(key, prop, flagged) {
	// to-do
}


$RPG.ADD("objects", {
	stats: {
		Group: GroupObject,
		Stat: StatObject,
		Reference: ReferenceObject,
		Equation: EquationObject
	},
	parser: {
		Group: restoreGroup,
		StatObject: restoreStat,
		Reference: restoreReference,
		Equation: restoreEquation
	}
});
