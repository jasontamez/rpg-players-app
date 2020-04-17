// Import parsing and logging
import { logErrorText as logError, copyArray } from "./parsing-logging.js";

var deferred = {
		contexts: [],
		multis: []
	},
	MathObject, LogicObject;

////////////////////////////
/////// DATA OBJECTS ///////
////////////////////////////

// Each object must define a .toJSON method that ?

// Define a class for player objects
//   TBD
export class PlayerObject {
	constructor(playerID) {
		// TBD
		this.rulesets = new Map;
		this.id = playerID;
		// .set(ruleset, characterID)
	}
	makeCharacter(ruleset) {
		// make an ID
		var id = "ID",
			char = new CharacterObject(this, ruleset, id);
		this.saveCharacter(ruleset, id, char);
		return char;
	}
	getCharacter(ruleset, id) {
		var rs = this.rulesets.get(ruleset);
		if(id === undefined) {
			return rs;
		}
		return rs.get(id);
	}
	loadCharacter(ruleset, id) {
		var cur = $RPG.current,
			char, newChar, contexts, multis;
		if(cur && (char = cur.character) && char.id === id && char.ruleset === ruleset) {
			return logError("Attempting to load current character.", new Error());
		} else if ((newChar = this.getCharacter(ruleset, id)) === undefined) {
			return logError("Cannot find character \"" + id + "\" in ruleset \"" + ruleset + "\"", new Error());
		} else if (char) {
			// Save the old character
			$RPG.objects.saver.Character(char, this);
		}
		char = JSON.parse(newChar);
		newChar = $RPG.objects.parser[char.parser](char, this);
		cur.character = newChar;
		// Fix all default contexts
		contexts = deferred.contexts;
		while(contexts.length > 0) {
			let stat = contexts.shift();
			stat.defaultContext = newChar.getStat(stat);
		}
		// Fix all multistats
		multis = deferred.multis;
		while(multis.length > 0) {
			let stat = multis.shift(),
				inh = stat.inheritors;
			stat.inheritors = inh.map(m => newChar.getStat(m));
		}
	}
	saveCharacter(ruleset, id, char) {
		var rs = this.rulesets.get(ruleset) || new Map();
		rs.set(id, char);
		return this.rulesets.set(ruleset, rs);
	}
	toJSON(key) {
		var rs = this.rulesets,
			rulesets = [];
		rs.forEach(function(ruleset, rsName) {
			rulesets.push([rsName, Array.from(ruleset.keys())]);
		});
		return {
			id: this.id,
			rulesets: rulesets,
			parser: "Player"
		};
	}
	//getById
}

// Define a class for character objects
//   o = new CharacterObject(objectPlayer, stringRuleset)
//   o.set("property", value)
//   o.get("property") => value
export class CharacterObject {
	// new CharacterObject(stringPlayerID, stringRuleset, stringCharacterID)
	constructor(player, ruleset, characterID) {
		this.player = player;
		this.id = characterID;
		this.ruleset = ruleset;
		this.data = new Map();
		this.groups = new Map();
		this.stats = new Map();
		this.multistats = new Map();
		this.pools = new Map();
		this.bonuses = new Map();
		this.references = new Map();
		this.crossreferences = new Map();
	}
	get(dataName) {
		return this.data.get(dataName);
	}
	set(dataName, data) {
		return this.data.set(dataName, data);
	}
	has(dataName) {
		return this.data.has(dataName);
	}
	addGroup(id, group) {
		return this.groups.set(id, group);
	}
	getGroup(id) {
		return this.groups.get(id);
	}
	addStat(id, stat) {
		return this.stats.set(id, stat);
	}
	getStat(id) {
		return this.stats.get(id);
	}
	addMultiStat(id, stat) {
		return this.multistats.set(id, stat);
	}
	getMultiStat(id) {
		return this.multistats.get(id);
	}
	addPool(id, pool) {
		return this.pools.set(id, pool);
	}
	getPool(id) {
		return this.pools.get(id);
	}
	getReference(id) {
		return this.references.get(id);
	}
	addReference(id, reference) {
		return this.references.set(id, reference);
	}
	addCrossReference(id, crossreference) {
		return this.crossreferences.set(id, crossreference);
	}
	getCrossReference(id) {
		return this.crossreferences.get(id);
	}
	getObject(id) {
		// TBD
	}
	// noteBonus(anyID, stringUndoBonusFunctionName, ...any number of arguments)
	noteBonus() {
		var args = Array.from(arguments),
			id = args.shift(),
			holder = this.bonuses.get(id) || [];
		holder.push(args);
		this.bonuses.set(id, holder);
		if(id === undefined) {
			console.log(undefined);
			console.trace();
		}
	}
	undoBonuses(id) {
		var bonuses = this.bonuses.get(id);
		if(bonuses === undefined) {
			return logErrorText("Unable to find any bonuses labelled \"" + id + "\"", new Error());
		}
		bonuses.forEach(function(arr) {
			var n = arr.shift(),
				undo = $RPG.data.undoBonusMethods[n];
			if(undo === undefined) {
				logError(n, "Cannot find undo operation \"" + n + "\"", new Error());
				return;
			}
			return undo(...arr);
		});
		this.bonuses.delete(id);
		return true;
	}
	toJSON(key) {
		return {
			player: this.player.id,
			id: this.id,
			ruleset: this.ruleset,
			data: this.data,
			groups: this.groups,
			stats: this.stats,
			multistats: this.multistats,
			pools: this.pools,
			references: this.references,
			crossreferences: this.crossreferences,
			bonuses: Array.from(this.bonuses),
			parser: "Character"
		};
	}
	//getById?
}
CharacterObject.JSONIncompatibles = [
	"data",
	"groups",
	"stats",
	"multistats",
	"pools",
	"references",
	"crossreferences"
];

MathObject = {
	// STRING FUNCTIONS
	// total + n
	Append: function (total, n) {
		if(total === null) {
			return n;
		}
		return total + n;
	},
	// n + total
	Prepend: function (total, n) {
		if(total === null) {
			return n;
		}
		return n + total;
	},
	//
	// NUMBER FUNCTIONS
	// total + n
	Add: function (total, n) {
		if(total === null) {
			return n;
		}
		return total + n;
	},
	// total - n
	//   If possible, use Add(total, -n) instead
	Subtract: function(total, n) {
		if(total === null) {
			return 0 - n;
		}
		return total - n;
	},
	// total * n
	Multiply: function (total, n) {
		return total * n;
	},
	// total / n
	Divide: function (total, n) {
		return total / n;
	},
	// n / total
	DivideThis: function (total, n) {
		return n / total;
	},
	// remainder of (total / n)
	Remainder: function (total, n) {
		return total % n;
	},
	// remainder of (n / total)
	RemainderOfThis: function (total, n) {
		return n % total;
	},
	// round total to nearest integer
	//   1.2 = 1
	//   1.5 = 2
	Round: function (total, n) {
		return Math.round(total);
	},
	// round total to next higher integer
	//   1.4 = 2
	//  -1.4 = -1
	Ceiling: function (total, n) {
		return Math.ceil(total);
	},
	// round total to next lower integer
	//   1.7 = 1
	//  -1.7 = -2
	Floor: function (total, n) {
		return Math.floor(total);
	},
	// return the lower value: total or n
	AtMost: function (total, n) {
		return Math.min(total, n);
	},
	// return the higher value: total or n
	AtLeast: function (total, n) {
		return Math.max(total, n);
	}
}

LogicObject = {
	// NUMBER FUNCTIONS
	// value > test
	GreaterThan: function (value, test) {
		return value > test;
	},
	// value <= test
	NotGreaterThan: function (value, test) {
		return value <= test;
	},
	// value < test
	LessThan: function (value, test) {
		return value < test;
	},
	// value >= test
	NotLessThan: function (value, test) {
		return value >= test;
	},
	// NUMBER and STRING FUNCTIONS
	// value === test
	EqualTo: function (value, test) {
		return value === test;
	},
	// value !== test
	NotEqualTo: function (value, test) {
		return value !== test;
	},
	// STRING FUNCTIONS
	// returns true if string 'test' can be found inside string 'value'
	Contains: function (value, test) {
		return String(value).includes(String(test));
	},
	// returns true if string 'test' cannot be found inside string 'value'
	DoesNotContain: function (value, test) {
		return !String(value).includes(String(test));
	},
	// ARRAY (pool) FUNCTIONS
	// returns true if an element of 'value' is strictly equal to 'test'
	Has: function (value, test) {
		return value.some( item => item === test );
	},
	// returns true if no elements of 'value' strictly equal 'test'
	DoesNotHave: function (value, test) {
		return value.every( item => item !== test );
	},
	// COMPARATOR	
	//   Functions that evaluate arrays of boolean values
	//     AND => all values are true
	//      OR => at least one value is true
	//     XOR => ONLY one value is true
	comparator: {
		AND: function(arr) { return arr.every(v => v); },
		OR: function(arr) { return arr.some(v => v); },
		XOR: function(arr) { return arr.filter(v => v).length === 1; }
	},
};

////////////////////////////
/////// STAT OBJECTS ///////
////////////////////////////

// Each object must define a .toJSON method that 

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
		return this.atts.get(key);
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
		var o = super.toJSON(key);
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
		super(id, atts);
		if((typeof e) === "string") {
			this.groups = [groups];
		} else {
			this.groups = groups;
		}
		this.defaultContext = this;
	}
	get(prop, context = this.defaultContext) {
		var value = super.get(prop);
		if(value === undefined) {
			// Check groups until we find a match (if any)
			this.groups.some(function(g) {
				var group = CHAR.getGroup(g);
				if(group) {
					value = group.get(prop);
				}
				return value;
			});
		}
		if(value instanceof SpecialGrabber) {
			value = value.getValue(context);
		}
		return value;
	}
	toJSON(key) {
		var o = super.toJSON(key);
		o.defaultContext = this.defaultContext.id;
		o.groups = this.groups;
		o.parser = "StatObject";
		return o;
	}
}

// Defines a class for MultiStat objects
export class MultiStatObject extends StatObject {
	// new MultiStatObject(idString, attributesMap, ?groupsArray)
	// attributesMap must include:
	//   idWrap => [string, ?string]
	// attributesMap may include:
	//   titleWrap => [string, ?string]
	//   descriptionWrap => [string, ?string]
	constructor(id, atts, groups = []) {
		if(atts.get("idWrap") === undefined) {
			throw new Error("MultiStat \"" + id + "\" is missing \"idWrap\" parameter");
		}
		super(id, atts, groups);
		this.inheritors = [];
	}
	makeStat(id, templateAtts, extraGroups = []) {
		var atts = new Map(),
			inheritable = this.get("inheritableAtts"),
			idWrap = wraps.get("id"),
			groups = this.groups,
			wraps = new Map(this.get("wraps")),
			stat;
		// Remove id-wrap
		wraps.delete("id");
		// Check for any other inheritable attributes
		if(inheritable.length > 0) {
			// Add each one to the atts map
			// (They can be overridden by the templateAtts)
			inheritable.forEach(function(pair) {
				let [att, value] = pair;
				atts.set(att, value);
			});
		}
		// Go through the attributes provided
		templateAtts.forEach(function(att, value) {
			if(wraps.has(att)) {
				let wrapAtt = wrap.get(att);
				// wrap the value
				value = wrapAtt.shift() + value;
				if(wrapAtt.length > 0) {
					value = value + wrapAtt.shift();
				}
			}
			// save value
			atts.set(att, value);
		});
		// Make the new ID
		if(!id) {
			id = "substat #" + String(this.inheritors.length + 1);
		}
		id = idWrap.shift() + id;
		if(idWrap.length > 0) {
			id = id + idWrap.shift();
		}
		// Consolidate groups
		groups = Array.from(new Set(extraGroups.concat(groups)));
		// Make the new stat
		stat = new MS(id, a, groups);
		// Save it
		this.inheritors.push(stat);
		return stat;
	}
	toJSON(key) {
		var o = super.toJSON(key);
		o.defaultContext = this.defaultContext.id;
		o.inheritors = this.inheritors.map(stat => stat.id);
		o.parser = "MultiStat";
		return o;
	}
}
MultiStatObject.mandatoryWraps = ["idWrap"];
MultiStatObject.optionalWraps = ["titleWrap", "descriptionWrap"];

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
		$RPG.current.character.addReference(prop, this);
	}
	toJSON(key) {
		var o = super.toJSON(key);
		o.prop = this.prop;
		o.parser = "Reference";
		return o;
	}
	getValue(context) {
		return context.get(this.prop, context);
	}
	static makeReference(prop, atts = new Map()) {
		var CHAR = $RPG.current.character;
		if(CHAR.references.has(prop)) {
			return CHAR.getReference(prop);
		}
		return new ReferenceObject(prop, atts);
	}
}

// A class for values that are merely references to other Stats
export class CrossReference extends ReferenceObject {
	// DO NOT USE new CrossReference()
	// CrossReference.makeReference(idString, propString, ?attributesMap)
	constructor(id, prop, atts = new Map()) {
		super(prop, atts);
		this.reference = id;
		$RPG.current.character.addCrossReference(id + " => " + prop, this);
	}
	toJSON(key) {
		var o = super.toJSON(key);
		o.id = this.id;
		o.parser = "CrossReference";
		return o;
	}
	getValue() {
		var reference = $RPG.current.character.getTBD(this.reference),
			a = Array.from(arguments);
		if(reference === undefined) {
			logError("ERROR: unable to find \"" + this.reference + "\" when fetching CrossReference", new Error());
			return "";
		}
		return reference.get(this.property, ...a);
		// incomplete
	}
	static makeReference(id, prop, atts = new Map()) {
		var ref = id + " => " + prop,
			CHAR = $RPG.current.character;
		if(CHAR.crossreferences.has(ref)) {
			return CHAR.getCrossReference(ref);
		}
		return new CrossReference(id, prop, atts);
	}
}

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
		var o = super.toJSON(key);
		o.parser = "Equation";
		return o;
	}
	getValue(context) {
		var instructions = copyArray(this.get("instructions")),
			total = null,
			RO = $RPG.objects,
			MATH = RO.data.MathObject,
			FIND = RO.stats.func.findValue;
		while(instructions.length > 0) {
			let value = FIND(instructions.shift(), "Any", context);
			total = MATH[method](total, value);
		}
		return total;
		// incomplete
	}
	static makeEquation(instrc, otherAtts = new Map()) {
		var i = [],
			MATH = $RPG.objects.data.MathObject,
			instructions = copyArray(instrc),
			e;
		while(instructions.length > 0) {
			let test = i.shift(),
				t = test[0];
			if(MATH.hasOwnProperty(t)) {
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

export function findValue(value, type, context) {
	// Values may come in different forms
	//   null = use context.get("value")
	//   string/number/boolean = use as-is
	//   array is one of three formats:
	//     [null, string] = use context.get(string)
	//     [string] = find a Stat 'string' and .get("value")
	//     [string, string2] = find a Stat 'string' and .get(string2)
	if(value === null) {
		value = context;
		if(value === undefined) {
			logError("Invalid or missing context provided for a null value", new Error());
			value = 0;
		} else {
			value = context.get("value");
		}
	} else if(value instanceof Array) {
		// [stat, ?property]
		let a = copyArray(value),
			s = a.shift(),
			s = $RPG.current.character.getObject(a.shift());
		if(s === null) {
			s = context;
		}
		if(s === undefined) {
			logError("Invalid object: \"" + value[0] + "\"", new Error());
			value = 0;
		} else {
			s = $RPG.current.character.getObject(a.shift());
			if (a.length) {
				value = s.get(s);
			} else {
				value = s.get("value");
			}
		}
	}
	if(type) {
		value = $RPG.objects.converter[type](value);
	}
	return value;
}


// Object that contains an if/then/else construction
export class IfObject extends SpecialGrabber {
	// new IfObject(attributesMap)
	// attributesMap must includes these keys:
	//   inType => string matching a property on $RPG.objects.converter
	//   outType => string matching a property on $RPG.objects.converter
	//   value => any Value
	//   comparator => string matching a property on $RPG.objects.data.LogicObject.comparator
	//   comparisons => array in the format of [verbOnIfObjectString, any Value]
	//   then => any Value
	//   else => any Value
	// A Value is either:
	//   a number
	//   a string
	//   null, representing the calling object.get("value")
	//   an array in the format [object, ?property]:
	//     object: string equalling the ID of a Stat object, or null to represent the calling object
	//     property: string representing property (if omitted, defaults to "value")
	// use IfObject.makeIfThenElse(array in a Map-like format)
	//   to (mildly) test that instructions are valid
	constructor(atts) {
		super(atts);
	}
	toJSON(key) {
		var o = super.toJSON(key);
		o.parser = "If";
		return o;
	}
	static makeIfThenElse(arr) {
		var RO = $RPG.objects,
			ROC = RO.converter;
			inType = "Any",
			outType = "Any",
			value = 0,
			comparator, comparisons, then, otherwise;
		arr.forEach(function(pair) {
			var [op, v] = pair;
			switch(op) {
				case "inType":
					inType = v;
					if(ROC[v] === undefined) {
						logError("IF: invalid inType \"" + v + "\"", new Error());
						inType = "Any";
					}
					break;
				case "outType":
					outType = v;
					if(ROC[v] === undefined) {
						logError("IF: invalid outType \"" + v + "\"", new Error());
						outType = "Any";
					}
					break;
				case "Start":
					if(v instanceof Array) {
						value = copyArray(v);
					} else {
						value = v;
					}
					break;
				case "Compare":
					let a = copyArray(v),
						ROP = RO.data.LogicObject.comparator,
						b = a.shift(),
						c = ROP[b];
					if (v instanceof Array) {
						comparator = "AND";
						a.unshift(v);
					} else if(c === undefined) {
						logError("IF: invalid comparator \"" + b + "\"", new Error());
						comparator = "AND";
					} else {
						comparator = c;
					}
					comparisons = a;
					break;
				case "Then":
					then = v;
					break;
				case "Else":
					otherwise = v;
					break;
				default:
					logError("IF: invalid parameter \"" + op + "\"", new Error());
			}
		});
		if(comparisons == undefined) {
			logError("IF: missing required Compare parameter", new Error());
			return undefined;
		} else if (then === undefined) {
			logError("IF: missing required Then parameter", new Error());
			return undefined;
		} else if (otherwise === undefined) {
			logError("IF: missing required Else parameter", new Error());
			return undefined;
		}
		return new If(new Map([
			["inType", inType],
			["outType", outType],
			["start", value],
			["comparator", comparator],
			["comparisons", comparisons],
			["then", then],
			["else", otherwise]
		]));
	}
	getValue(context) {
		var value = this.get("start"),
			inT = this.get("inType"),
			LOGIC = $RPG.objects.data.LogicObject,
			comparisons = copyArray(this.get("comparisons")),
			results = [],
			FIND = $RPG.objects.stats.func.findValue;
		// Get the value we start with
		value = FIND(value, inT, context);
		// Run comparisons
		while(comparisons.length) {
			let [func, test] = comparisons.shift();
			results.push(LOGIC[func][value, FIND(test, inT, context)]);
		}
		// Run results through comparator to get a final value
		value = $RPG.comparator[this.get("comparator")](results);
		// Return results if value is true (then) or false (else)
		return FIND(this.get(value ? "then" : "else"), this.get("outType"), context);
	}
}

// Object that contains an do/while loop construction
//   An "input" is modified by instructions
//   Each time the "input" is modified and passes a check, an "output" is modified, too
//   The "input" is modified again and the check is attempted again, looping as needed
//   Once the check fails, the "output" is returned
export class DoObject extends SpecialGrabber {
	// new DoObject(attributesMap)
	// attributesMap must includes these keys:
	//   inType => string matching a property on $RPG.objects.converter
	//   outType => string matching a property on $RPG.objects.converter
	//   input => any Value
	//   output => any Value
	//   modIn => an array of Equation instructions arrays
	//    - the array may include plain strings:
	//      - "AddOutput", "AppendOutput" (value + output)
	//      - "PrependOutput" (output + value)
	//   modOut => an array of Equation instructions arrays
	//    - the array may include plain strings:
	//       - "AddInput", "AppendInput" (value + input)
	//       - "PrependInput" (input + value)
	//   comparator => string matching a property on $RPG.objects.data.LogicObject.comparator
	//   comparisons => array in the format of [verbOnIfObjectString, any Value]
	// A Value is either:
	//   a number
	//   a string
	//   null, representing the calling object.get("value")
	//   an array in the format [object, ?property]:
	//     object: string equalling the ID of a Stat object, or null to represent the calling object
	//     property: string representing property (if omitted, defaults to "value")
	//
	// use DoObject.makeDoWhile(array in a Map-like format)
	//   to (mildly) test that instructions are valid
	constructor(atts) {
		super(atts);
	}
	toJSON(key) {
		var o = super.toJSON(key);
		o.parser = "Do";
		return o;
	}
	static makeDoWhile(arr) {
		var RO = $RPG.objects,
			ROC = RO.converter;
			inType = "Any",
			outType = "Any",
			input, output, modIn, modOut, comparator, comparisons;
		copyArray(arr).forEach(function(info) {
			let op = info.shift(),
				v = info.shift();
			switch(op) {
				case "While":
					let ROP = RO.data.LogicObject.comparator,
						first = v.shift(),
						c = ROP[first];
					if (first instanceof Array) {
						comparator = "AND";
						v.unshift(first);
					} else if(c === undefined) {
						logError("DO: WHILE: invalid comparator \"" + first + "\"", new Error());
						comparator = "AND";
					} else {
						comparator = c;
					}
					comparisons = first;
					break;
				case "inType":
					inType = v;
					if(ROC[v] === undefined) {
						logError("IF: invalid inType \"" + v + "\"", new Error());
						inType = "Any";
					}
					break;
				case "outType":
					outType = v;
					if(ROC[v] === undefined) {
						logError("IF: invalid outType \"" + v + "\"", new Error());
						outType = "Any";
					}
					break;
				case "Input":
					input = v;
					break;
				case "Output":
					output = v;
					break;
				case "ModIn":
					modIn = v;
					break;
				case "ModOut":
					modOut = v;
					break;
				default:
					logError("DO: invalid parameter \"" + op + "\"", new Error());
			}
		});
		if(modIn === undefined) {
			logError(node, "DO: Missing required ModifyInput parameter")
			return undefined;
		} else if(modOut === undefined) {
			logError(node, "DO: Missing required ModifyOutput parameter")
			return undefined;
		} else if(comparisons === undefined) {
			logError(node, "DO: Missing required While parameter")
			return undefined;
		} else if(input === undefined) {
			logError(node, "DO: Missing required Input parameter")
			return undefined;
		} else if(output === undefined) {
			logError(node, "DO: Missing required Output parameter")
			return undefined;
		}
		// Create Do tag
		tag = new Do(new Map([
			["inType", inType],
			["outType", outType],
			["input", input],
			["output", output],
			["modIn", modIn],
			["modOut", modOut],
			["comparator", comparator],
			["comparisons", comparisons]
		]));
		return tag;
	}
	getValue(context) {
		var input = this.get("input"),
			output = this.get("output"),
			inT = this.get("inType"),
			outT = this.get("outType"),
			modIn = this.get("modIn"),
			modOut = this.get("modOut"),
			ROD = $RPG.objects.data,
			LOGIC = ROD.LogicObject,
			comparator = ROD.LogicObject.comparator[this.get("comparator")],
			comparisons = copyArray(this.get("comparisons")),
			FIND = $RPG.objects.stats.func.findValue,
			TryWhile = DoObject.tryWhile,
			DoMod = DoObject.doMod,
			check;
		// Get the values we start with
		input = FIND(input, inT, context);
		output = FIND(output, outT, context);
		// Check if input matches the conditions
		check = TryWhile(input, LOGIC, comparator, comparisons, FIND, inT, context);
		while(check) {
			// Modify input
			input = DoMod(input, modIn, FIND, inT, context, output);
			// Check if input still matches the conditions
			if(check = TryWhile(input, LOGIC, comparator, comparisons, FIND, inT, context)) {
				// Modify output
				output = DoMod(output, modOut, FIND, outT, context, input);
			}
		}
		return output;
	}
	static tryWhile(input, LOGIC, comparator, comparisons, FIND, inT, context) {
		var results = [];
		comparisons.forEach(function(pair) {
			let [func, test] = pair;
			results.push(LOGIC[func][input, FIND(test, inT, context)]);
		});
		return comparator(tests);
	}
	static doMod(value, mods, FIND, type, context, othervalue) {
		const MATH = $RPG.objects.data.MathObject;
		mods.forEach(function(mod) {
			if((typeof mod) === "string") {
				let conv = $RPG.converter[type];
				switch(mod) {
					case "AddInput":
					case "AddOutput":
						value = conv(MATH.Add(value, otherValue));
						break;
					case "AppendInput":
					case "AppendOutput":
						value = conv(MATH.Append(value, othervalue));
						break;
					case "PrependInput":
					case "PrependOutput":
						value = conv(MATH.Prepend(value, othervalue));
						break;
					default:
						// error?
				}
			} else {
				value = MATH[method](value, FIND(mod, type, context));
			}
		});
		return value;
	}
}



///////////////////////////
///////// PARSERS /////////
///////////////////////////

// These are used by JSON.parse to reconstruct objects.

// Note: parse in this order:
//   * Groups
//   * Stats
//   * MultiStats
//   * Pools
//   * References
//   * CrossReferences
//   * Equations
//   * If
//   * Do/While
//   * Characters
//   * Players

function saveCharacter(character, player) {
	var id = character.id,
		rs = character.ruleset;
	$RPG.objects.data.character.JSONIncompatibles.forEach(function(prop) {
		var hold = [];
		// go through each element of the map
		character[prop].forEach(function(arr, id) {
			// save to an array
			hold.push([id, JSON.stringify(arr)]);
		});
		// save back to character object
		character[prop] = hold;
	});
	// save back to player
	player.saveCharacter(rs, id, JSON.stringify(character));
}
function savePlayer() {

}
function restoreCharacter(c, player) {
	var id = c.id,
		rs = c.ruleset,
		char = new CharacterObject(player, c.rs, c.id);
	// Restore Maps from Arrays
	char.bonuses = new Map(char.bonuses);
	$RPG.objects.data.character.JSONIncompatibles.forEach(function(prop) {
		var hold = new Map();
		c[prop].forEach(function(arr) {
			var key = arr[0],
				o = arr[1];
			if(o) {
				let parser;
				if(o instanceof Array) {
					let deep = [];
					o.forEach(function(o2) {
						if(parser = o2.parser) {
							o2 = $RPG.objects.parser[parser](o2);
						}
						deep.push(o2);
					});
				} else {
					if(parser = o.parser) {
						o = $RPG.objects.parser[parser](o);
					}
				}
			}
			hold.set(key, o);
		});
		char[prop] = hold;
	});
	player.saveCharacter(rs, id, char);
}
function restorePlayer(key, prop, flagged) {
	if(key === "rulesets") {
		let rs = new Map();
		prop.forEach(function(item) {
			var [ruleset, arr] = item,
				chars = new Map();
			arr.forEach();
		});
		return new Map(prop);
	} else if (key === "parser") {
		return undefined;
	} else if (key === "" && !flagged) {
		let o = $RPG.objects.stats.ObjectWithAttributes;
		return new o(prop.atts);
	}
	return prop;
}

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
function restoreMultiStat(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let m = $RO.stats.MultiStat,
			stat = new m(prop.id, prop.atts, prop.groups);
		// Leave .inheritors as strings for now, but save the multistat.
		deferred.multis.push(stat);
		// It will be fixed in Player.loadCharacter.
		return stat;
	}
	return $RO.parser.Stat(key, prop, true);
}
function restoreStat(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let s = $RO.stats.StatObject,
			stat = new s(prop.name, prop.atts, prop.groups);
		// Leave .defaultContext as a string for now, but save the stat.
		deferred.contexts.push(stat);
		// It will be fixed in Player.loadCharacter.
		return stat;
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
function restoreIf(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let e = $RO.stats.If;
		return new e(prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}
function restoreDo(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let e = $RO.stats.Do;
		return new e(prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}


$RPG.ADD("objects", {
	data: {
		player: PlayerObject,
		character: CharacterObject,
		MathObject: MathObject,
		LogicObject: LogicObject
	},
	stats: {
		ObjectWithAttributes: ObjectWithAttributes,
		Group: GroupObject,
		Stat: StatObject,
		MultiStat: MultiStatObject,
		Grabber: SpecialGrabber,
		Reference: ReferenceObject,
		CrossReference: CrossReference,
		Equation: EquationObject,
		If: IfObject,
		Do: DoObject,
		func: {
			findValue: findValue,
		},
	},
	converter: {
		Any: function(x) { return x; },
		Int: function(x) {
			var y = Math.round(Number(x));
			return y === y ? y : 0;
		},
		Str: function(x) { return String(x); },
		TF: function(x) { return x ? true : false; }
	},
	saver: {
		Character: saveCharacter,
		Player: savePlayer
	},
	parser: {
		Player: restorePlayer,
		Character: restoreCharacter,
		ObjectWithAttributes: restoreAttributes,
		Group: restoreGroup,
		StatObject: restoreStat,
		MultiStat: restoreMultiStat,
		Reference: restoreReference,
		CrossReference: restoreCrossReference,
		Equation: restoreEquation,
		If: restoreIf,
		Do: restoreDo
	}
});
