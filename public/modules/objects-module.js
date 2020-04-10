// Import query selectors
import { $q, $a } from "./dollar-sign-module.js";
// Import parsing and logging
import { logErrorText as logError } from "./parsing-logging.js";


////////////////////////////
/////// STAT OBJECTS ///////
////////////////////////////


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
	constructor(name, atts) {
		super(name, atts);
		this.groups = [];
	}
	toJSON(key) {
		var o = super(key);
		o.groups = this.groups;
		o.parser = "StatObject";
		return o;
	}
}

export class ReferenceObject extends StatObject {
	constructor(obj, prop, atts = new Map()) {
		super(obj.id, atts);
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
			return undefined;
		}
		return new ReferenceObject(o, prop, atts);
	}
}

export class EquationObject extends ReferenceObject {
	constructor(name, atts, instructions) {
		super(name, atts);
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
}


////////////////////////////
/////// STAT PARSERS ///////
////////////////////////////


function restoreGroup(o) {

}
function restoreStat(o) {

}
function restoreReference(o) {

}
function restoreEquation(o) {

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
