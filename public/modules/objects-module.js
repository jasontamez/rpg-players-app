// Import parsing and logging
import { logErrorText as logError, copyArray } from "./parsing-logging.js";

var deferred = {
	//	contexts: [],
		multis: []
	},
	MathObject, LogicObject;

////////////////////////////
/////// DATA OBJECTS ///////
////////////////////////////

// Each object must define a .toJSON method that ?

// Define a class for player objects
//   TBD
class PlayerObject {
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
			//char, newChar, contexts, multis;
			char, newChar, multis;
		if(cur && (char = cur.character) && char.id === id && char.ruleset === ruleset) {
			logError("Attempting to load current character", new Error());
			return null;
		} else if ((newChar = this.getCharacter(ruleset, id)) === undefined) {
			logError("Cannot find character \"" + id + "\" in ruleset \"" + ruleset + "\"", new Error());
			return null;
		} else if (char) {
			// Save the old character
			$RPG.objects.saver.Character(char, this);
		}
		char = JSON.parse(newChar);
		newChar = $RPG.objects.parser[char.parser](char, this);
		cur.character = newChar;
		// Fix all default contexts
		//contexts = deferred.contexts;
		//while(contexts.length > 0) {
		//	let stat = contexts.shift();
		//	stat.defaultContext = newChar.getStat(stat);
		//}
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

// Define a class for Ruleset objects
//  o = new RulesetObject(TBD)
class RulesetObject {
	constructor(player, rulesetID, JSONinfo) {
		this.player = player;
		this.id = rulesetID;
		this.info = JSONinfo;
		this.pages = new Map();
		$RPG.objects.data.ruleset.addId(rulesetID, this);
	}
	static addId(id, ruleset) {
		this.IDs.set(id, ruleset);
	}
	static getById(id) {
		return this.IDs.get(id);
	}
	// a ruleset is never saved, because it contains only the basics from the master JSON
	toJSON(key) {
		return this.id;
	}
}
RulesetObject.IDs = new Map();

// Define a class for character objects
//   o = new CharacterObject(playerObject, rulesetObject)
//   o.set("property", value)
//   o.get("property") => value
class CharacterObject {
	// new CharacterObject(playerObject, rulesetObject, characterIdString)
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
			logError("Unable to find any bonuses labelled \"" + id + "\"", new Error());
			return null;
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
			ruleset: this.ruleset.id,
			data: this.data,
			groups: this.groups,
			stats: this.stats,
			multistats: this.multistats,
			pools: this.pools,
			references: this.references,
			crossreferences: this.crossreferences,
			bonuses: this.bonuses,
			parser: "Character"
		};
	}
		}


// Define a class for Page objects
//  o = new PageObject(TBD)
class PageObject {
	constructor(ruleset, id, atts, html = []) {
		let a = new Map();
		this.ruleset = ruleset;
		this.id = id;
		atts.forEach(function(prop) {
			a.set(prop[0], prop[1]);
		});
		this.atts = a;
		this.html = html;
	}
}

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

// Each object must define a .toJSON method

// This class is designed to be a parent only to other parent classes
// - It lacks a .toJSON method and corresponding $RPG.objects.parser function
// Children of this should implement a .getValue method
class SpecialGrabber {
	constructor(value) {
		this.value = value;
	}
	toJSON(key) {
		return {
			value: this.value
		};
	}
	getValue() {
		return this.value;
	}
}

// A class for self-referencial values on a Stat
// - i.e. "look at .otherProp on this Stat"
class ReferenceObject extends SpecialGrabber {
	// DO NOT USE new ReferenceObject()
	// ReferenceObject.makeReference(propString)
	constructor(prop) {
		super(prop);
	}
	toJSON(key) {
		var o = super.toJSON(key),
			v = o.value;
		if(v === undefined) {
			return [null];
		}
		return [null, v];
	}
	getValue(context) {
		var p = super.getValue();
		if(p) {
			return context.get(p);
		}
		return context.value();
	}
	static makeReference(prop) {
		var CHAR = $RPG.current.character,
			ref;
		if(CHAR.references.has(prop)) {
			return CHAR.getReference(prop);
		}
		ref = new ReferenceObject(prop);
		CHAR.addReference(prop, ref);
		return ref;
	}
}

// A class for values that are merely references to other Stats
class CrossReference extends ReferenceObject {
	// DO NOT USE new CrossReference()
	// CrossReference.makeReference(idString, propString)
	constructor(stat, prop) {
		super(prop);
		this.reference = stat;
	}
	toJSON(key) {
		var arr = super.toJSON(key);
		arr[0] = this.reference.id;
		return arr;
	}
	getValue() {
		// context argument is to be ignored
		var reference = this.reference;
		if(!(reference instanceof $RPG.objects.stats.Stat)) {
			logError("ERROR: invalid or missing Stat when fetching CrossReference", new Error());
			return undefined;
		}
		return super.getValue(reference);
	}
	static makeReference(id, prop) {
		var CHAR = $RPG.current.character,
			stat = CHAR.getObject(id),
			ref;
		id = id + " => " + prop;
		if(CHAR.crossreferences.has(id)) {
			return CHAR.getCrossReference(id);
		}
		ref = new CrossReference(stat, prop);
		CHAR.addCrossReference(id, ref);
	}
}

// Basic object, parent of all that follow
class ObjectWithAttributes {
	// new ObjectWithAttributes(attributesMap, ?noParseBoolean)
	// If noParse is not provided or is false, the attributes Map will be scanned for special Values
	constructor(atts, noParse) {
		if(!noParse) {
			let	newAtts = new Map(),
				parseForSpecialValue = $RPG.objects.stats.func.parseValue;
			atts.forEach(function(value, key) {
				newAtts.set(key, parseForSpecialValue(value));
			});
			this.atts = newAtts;
		} else {
			this.atts = atts;
		}
	}
	toJSON(key) {
		return {
			atts: this.atts,
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

// Function to scan a Value and possibly transform it into a special object
// These Values are left as-is:
//   any Number
//   any String
//   true or false (Boolean)
//   undefined
// These Values (all of which are Arrays) are transformed into a different object:
//   [null]
//     - transforms into a ReferenceObject returning .value
//   [null, attributeString]
//     - transforms into a ReferenceObject returning .get(attributeString)
//   [*specialObjectString, ...<any>]
//     - looks for a method $RPG.objects.special[*specialObjectString]
//       - if found, transforms it into the return value of method([...<any>])
//       - if not found, is left as the original Array
//     - These methods should begin with "*"
//   [statIdString]
//     - looks for a Stat whose .id === statIdString
//       - if found, transforms into a CrossReference returning Stat.value
//       - if not found, is left as the original Array
//     - Stats should not be given ids that begin with "*"
//   [statIdString, attributeString]
//     - looks for a Stat whose .id === statIdString
//       - if found, transforms into a CrossReference returning Stat.get(attributeString)
//       - if not found, is left as the original Array
//     - Stats should not be given ids that begin with "*"
function parseForSpecialValue(value) {
	const RO = $RPG.objects,
		ROS = RO.stats;
	// Check for Array-based Values
	if(value instanceof Array) {
		let v = copyArray(value),
			test = v.shift();
		if(test === null) {
			// make a self-reference object
			// NOTE: [].shift() => undefined
			value = ROS.Reference.makeReference(v.shift());
		} else {
			let specialObject = RO.special[test];
			if(specialObject) {
				// Found a special value
				let newValue = specialObject.construct(v);
				if(newValue !== null) {
					// Change this value IF AND ONLY IF we get a successful result
					value = newValue;
				}
			} else {
				// Should be a string that matches a Stat
				let stat = $RPG.current.character.getStat(test);
				if(stat !== undefined) {
					// Stat found
					// Make a cross-reference object
					value = ROS.CrossReference.makeReference(v.shift());
				}
			}
		}
	}
	return value;
}


// Define a class for Groups
class GroupObject extends ObjectWithAttributes {
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
class StatObject extends GroupObject {
	// new StatObject(idString, attributesMap, ?groupsArray)
	constructor(id, atts, groups = []) {
		super(id, atts);
		if((typeof groups) === "string") {
			this.groups = [groups];
		} else {
			this.groups = groups;
		}
		this.updateType();
		this.setupValue();
	}
	get(prop) {
		var value = super.get(prop);
		if(value === undefined) {
			let CHAR = $RPG.current.character;
			// Check groups until we find a match (if any)
			this.groups.some(function(g) {
				var group = CHAR.getGroup(g);
				if(group) {
					value = group.get(prop);
				}
				return value !== undefined;
			});
		}
		//if(value instanceof SpecialGrabber) {
		//	value = value.getValue(this);
		//}
		return value;
	}
	updateType() {
		var type = this.get("type");
		if(type === undefined || $RPG.objects.stats.Stat.types[type] === undefined) {
			type = "default";
		}
		this.type = type;
	}
	setupValue() {
		var value = this.get("value");
		if(value === undefined) {
			value = this.get("startingValue");
		}
		this.set("value", $RPG.objects.stats.Stat.types[this.type](value, this));
	}
	value() {
		var v = this.get("value"),
			ROS = $RPG.objects.stats,
			value = ROS.func.findValue(v, this);
		return ROS.Stat.types[this.type](value, this);
	}
	addGroup(group, first = false) {
		if(typeof group !== "string") {
			return false;
		} else if(first) {
			this.groups.unshift(group);
		} else {
			this.groups.push(group);
		}
		this.updateType();
		return this.groups;
	}
	toJSON(key) {
		var o = super.toJSON(key);
		o.groups = this.groups;
		o.type = this.type;
		o.parser = "StatObject";
		return o;
	}
}
StatObject.types = {
	Num: function(v, stat) {
		var min = stat.get("minValue") || -Infinity,
			max = stat.get("maxValue") || Infinity;
		if(v === undefined) {
			v = stat.get("startingValue");
		}
		v = Number(v) || 0;
		return Math.max(Math.min(max, v), min);
	},
	Int: function(v, stat) {
		var min = stat.get("minValue") || -Infinity,
			max = stat.get("maxValue") || Infinity,
			step = stat.get("stepValue") || 1;
		if(v === undefined) {
			v = stat.get("startingValue");
		}
		v = Number(v) || 0;
		v = Math.round(v);
		v = Math.max(Math.min(max, v), min);
		if((v % step) > 0) {
			v = Math.floor(v / step);
		}
		return v;
	},
	Str: function(v, stat) {
		if(v === undefined) {
			v = stat.get("startingValue");
		}
		return String(v);
	},
	TF: function(v, stat) {
		var test;
		if(v === undefined) {
			v = stat.get("startingValue");
		}
		test = Number(v);
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
	}
};
StatObject.types.default = StatObject.types.Int;

// Defines a class for MultiStat objects
class MultiStatObject extends StatObject {
	// new MultiStatObject(idString, attributesMap, ?groupsArray)
	// attributesMap must include:
	//   idWrap => [string, ?string]
	// attributesMap may include:
	//   titleWrap => [string, ?string]
	//   descriptionWrap => [string, ?string]
	constructor(id, atts, groups = []) {
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
		o.inheritors = this.inheritors.map(stat => stat.id);
		o.parser = "MultiStat";
		return o;
	}
}
MultiStatObject.mandatoryWraps = ["id"];
MultiStatObject.optionalWraps = ["title", "description"];

class Pool extends StatObject {
	// new Pool(idString, attributesMap, ?groupsArray)
	constructor(id, atts, groups = []) {
		var autoSelect;
		super(id, atts, groups);
		// super will call setupValue, which will set up this.pool
		// set up autoSelect into a true/false boolean, always
		autoSelect = this.get("autoSelect");
		this.set("autoSelect", $RPG.objects.converter.TF(autoSelect));
	}
	updateType() {
		var type = this.get("type");
		if(type === undefined || $RPG.objects.stats.Stat.types[type] === undefined) {
			type = "default";
		}
		this.type = type;
	}
	setupValue() {
		// Only run this once.
		if(this.pool === undefined) {
			let c = 0,
				start  = this.get("startingPool") || [],
				autoSelect = this.get("autoSelect"),
				max = this.get("maxSelectable") || Infinity,
				pool = new Map();
			start = copyArray(start);
			while(c < max && start.length > 0) {
				let item = start.shift();
				pool.set(item, autoSelect);
				c++;
			}
			this.pool = pool;
		}
	}
	// value => Array of selected items
	value() {
		return this.selection();
	}
	// selection => Array of selected items
	selection() {
		var sel = [],
			ROS = $RPG.objects.stats,
			findValue = ROS.func.findValue,
			type = ROS.Stat.types[this.type];
		this.pool.forEach(function(selected, value) {
			if(selected) {
				let v = findValue(value, this);
				sel.push(type(v, this));
			}
		});
		return sel;
	}
	// items => Array of all items
	items() {
		var sel = [],
			ROS = $RPG.objects.stats,
			findValue = ROS.func.findValue,
			type = ROS.Stat.types[this.type];
		this.pool.forEach(function(selected, value) {
			let v = findValue(value, this);
			sel.push(type(v, this));
		});
		return sel;
	}
	// getPool => Array of Arrays in the format [item, selectedBoolean]
	getPool() {
		var sel = [],
			ROS = $RPG.objects.stats,
			findValue = ROS.func.findValue,
			type = ROS.Stat.types[this.type];
		this.pool.forEach(function(selected, value) {
			let v = findValue(value, this);
			sel.push([type(v, this), selected]);
		});
		return sel;
	}
	addItem(item, selected = this.get("autoSelect")) {
		// Can also be used to select/deselect an item
		this.pool.set(item, selected);
	}
	removeItem(item) {
		this.pool.delete(item);
	}
	toJSON(key) {
		var o = super.toJSON(key);
		o.pool = this.pool;
		o.parser = "Pool";
		return o;
	}
}

// 
class EquationObject extends SpecialGrabber {
	// new EquationObject(attributesMap)
	// attributesMap must includes key "instructions" pointing to an Array
	// use EquationObject.makeEquation(instructionsArray, otherAttributesMap)
	//   to (mildly) test that instructions are valid
	constructor(atts) {
		super(atts);
	}
	toJSON(key) {
		var arr = this.get("instructions");
		return [this.constructor.specialName, ...arr];
	}
	getValue(context) {
		var instructions = copyArray(this.get("instructions")),
			total = null,
			RO = $RPG.objects,
			MATH = RO.data.MathObject,
			FIND = RO.stats.func.findValue;
		while(instructions.length > 0) {
			let instruction = instructions.shift(),
				method = instruction.shift(),
				value = FIND(instruction.shift(), context);
			total = MATH[method](total, value);
		}
		return total;
	}
	static construct(arr) {
		var i = [],
			MATH = $RPG.objects.data.MathObject,
			parseForSpecialValue = $RPG.objects.stats.func.parseValue,
			instructions = copyArray(arr),
			e, map;
		while(instructions.length > 0) {
			let test = instructions.shift(),
				t = test[0];
			if(MATH.hasOwnProperty(t)) {
				i.push(parseForSpecialValue(test));
			} else {
				logError("EQUATION: Invalid Equation parameter \"" + t + "\" (ignored)", new Error());
			}
		}
		if(i.size === 0) {
			logError("EQUATION: No instructions provided", new Error());
			return null;
		}
		e = $RPG.objects.special["*Equation"];
		map = new Map([["instructions", i]]);
		return new e(map);
	}
}
EquationObject.specialName = "*Equation";

// findValue(valueAny, contextStatObject, ?typeString)
function findValue(value, context, type) {
	// If we're a SpecialGrabber object, call its .getValue method with the current context
	if(value instanceof $RPG.objects.stats.Grabber) {
		value = value.getValue(context);
	}
	// If a type is specified, cast the value to that type
	if(type) {
		let converter = $RPG.objects.converter[type];
		if(converter) {
			value = converter(value);
		} else {
			logError("Invalid type \"" + type + "\" sent to findValue", new Error());
		}
	}
	return value;
}


// Object that contains an if/then/else construction
class IfObject extends SpecialGrabber {
	// new IfObject(attributesMap)
	// attributesMap must include these keys:
	//   inType => string matching a method on $RPG.objects.converter
	//   outType => string matching a method on $RPG.objects.converter
	//   value => any Value
	//   comparator => string matching a method on $RPG.objects.data.LogicObject.comparator
	//   comparisons => array in the format of [string, any Value], where the string matches a
	//                    method on $RPG.objects.data.LogicObject
	//   then => any Value
	//   else => any Value
	// use IfObject.construct(array in a Map-like format)
	//   to (mildly) test that instructions are valid
	constructor(atts) {
		super(atts);
	}
	toJSON(key) {
		var arr = Array.from(this.atts);
		return [this.constructor.specialName, ...arr];
	}
	static construct(arr) {
		var RO = $RPG.objects,
			ROC = RO.converter,
			parseForSpecialValue = RO.stats.func.parseValue,
			inType = "Any",
			outType = "Any",
			value = 0,
			comparator, comparisons, then, otherwise, i;
		arr.forEach(function(pair) {
			var [op, v] = pair;
			switch(op) {
				case "inType":
					inType = parseForSpecialValue(v);
					if(ROC[v] === undefined) {
						logError("IF: invalid inType \"" + v + "\"", new Error());
						inType = "Any";
					}
					break;
				case "outType":
					outType = parseForSpecialValue(v);
					if(ROC[v] === undefined) {
						logError("IF: invalid outType \"" + v + "\"", new Error());
						outType = "Any";
					}
					break;
				case "Start":
					value = parseForSpecialValue(v);
					break;
				case "Compare":
					let compConditions = copyArray(v),
						ROP = RO.data.LogicObject.comparator,
						compString = compConditions.shift(),
						parsed = [],
						compMethod;
					if (compString instanceof Array) {
						// No compartor was provided. Assume AND, return this to the conditions.
						compString = "AND";
						compConditions.unshift(compString);
					}
					compMethod = ROP[compString];
					if(compMethod === undefined) {
						logError("IF: invalid comparator \"" + compString + "\"", new Error());
						comparator = ROP.AND;
					} else {
						comparator = compMethod;
					}
					while(compConditions.length > 0) {
						let pair = compConditions.shift(),
							key = pair.shift();
						parsed.push([key, parseForSpecialValue(pair.shift())]);
					}
					comparisons = parsed;
					break;
				case "Then":
					//then = parseForSpecialValue(v);
					if(v instanceof Array) {
						then = copyArray(v);
					} else {
						then = v;
					}
					break;
				case "Else":
					//otherwise = parseForSpecialValue(v);
					if(v instanceof Array) {
						otherwise = copyArray(v);
					} else {
						otherwise = v;
					}
					break;
				default:
					logError("IF: invalid parameter \"" + op + "\" (ignored)", new Error());
			}
		});
		if(comparisons == undefined) {
			logError("IF: missing required Compare parameter", new Error(), arr);
			return null;
		} else if (then === undefined) {
			logError("IF: missing required Then parameter", new Error(), arr);
			return null;
		} else if (otherwise === undefined) {
			logError("IF: missing required Else parameter", new Error(), arr);
			return null;
		}
		i = RO.special["*If"];
		return new i(new Map([
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
			FIND = $RPG.objects.stats.func.findValue,
			result;
		// Get the value we start with
		value = FIND(value, context, inT);
		// Run comparisons
		while(comparisons.length) {
			let [func, test] = comparisons.shift();
			results.push(LOGIC[func][value, FIND(test, context, inT)]);
		}
		// Run results through comparator to get a final value
		value = $RPG.comparator[this.get("comparator")](results);
		// Get results - parsed
		results = parseForSpecialValue(this.get(value ? "then" : "else"));
		// Return results if value is true (then) or false (else)
		return FIND(result, context, this.get("outType"));
	}
}
IfObject.specialName = "*If";

// Object that contains an do/while loop construction:
//   1) Input is modified by given instructions
//   2) Input is checked against given conditions - if it fails, the loop ends: go to step 5
//   3) Output is modified by given instructions
//   4) Loop back to step 1
//   5) Return Output
class DoObject extends SpecialGrabber {
	// new DoObject(attributesMap)
	// attributesMap must include these keys:
	//   inType => string matching a property on $RPG.objects.converter
	//   outType => string matching a property on $RPG.objects.converter
	//   input => any Value
	//   output => any Value
	//   modifyInput => an array of Equation instructions arrays
	//     - the array may include these plain strings:
	//       - "AddOutput", "AppendOutput" (input = input + output)
	//       - "PrependOutput" (input = output + input)
	//   modifyOutput => an array of Equation instructions arrays
	//     - the array may include these plain strings:
	//       - "AddInput", "AppendInput" (output = output + input)
	//       - "PrependInput" (output = input + output)
	//   comparator => string matching a property on $RPG.objects.data.LogicObject.comparator
	//   comparisons => array of arrays in the format of [MethodString, any Value]
	//     - MethodString is a method on $RPG.objects.data.LogicObject
	//
	// use DoObject.construct(array in a Map-like format)
	//   to (mildly) test that instructions are valid
	constructor(atts) {
		super(atts);
	}
	toJSON(key) {
		var arr = Array.from(this.atts);
		return [this.constructor.specialName, ...arr];
	}
	static construct(arr) {
		var RO = $RPG.objects,
			parseForSpecialValue = RO.stats.func.parseValue,
			ROC = RO.converter,
			inType = "Any",
			outType = "Any",
			instructions = copyArray(arr),
			input, output, modIn, modOut, comparator, comparisons, d;
		while(instructions.length > 0) {
			let info = instructions.shift(),
				op = info.shift(),
				v = info.shift(),
				ROP, first, c, parsed;
			switch(op) {
				case "While":
					// ["While", ?COMPARATOR, [LogicOperatorString, Value], ...]
					// If "COMPARATOR" is not provided, it defaults to "AND"
					// COMPARATORs are found as properties of LogicObject.comparator
					ROP = RO.data.LogicObject.comparator;
					first = v.shift();
					c = ROP[first];
					parsed = [];
					if (first instanceof Array) {
						// No comparator provided. Default to AND.
						comparator = "AND";
						v.unshift(first);
					} else if(c === undefined) {
						// Invalid comparator provided.
						logError("DO: WHILE: invalid comparator \"" + first + "\"", new Error());
						comparator = "AND";
					} else {
						// Valid comparator provided.
						comparator = first;
					}
					// Everything else becomes the comparisons
					while(v.length > 0) {
						let pair = v.shift(),
							key = pair.shift();
						parsed.push([key, parseForSpecialValue(pair.shift())])
					}
					comparisons = parsed;
					break;
				case "inType":
					// ["inType", TypeString]
					// Type is a property of $RPG.objects.converter
					// If not provided, this defaults to "Any"
					inType = parseForSpecialValue(v);
					if(ROC[v] === undefined) {
						logError("IF: invalid inType \"" + v + "\"", new Error());
						inType = "Any";
					}
					break;
				case "outType":
					// ["outType", TypeString]
					// Type is a property of $RPG.objects.converter
					// If not provided, this defaults to "Any"
					outType = parseForSpecialValue(v);
					if(ROC[v] === undefined) {
						logError("IF: invalid outType \"" + v + "\"", new Error());
						outType = "Any";
					}
					break;
				case "Input":
					// ["Input", Value]
					// The initial value we start with
					input = parseForSpecialValue(v);
					break;
				case "Output":
					// ["Output", Value]
					// The initial output value we start with
					output = parseForSpecialValue(v);
					break;
				case "ModifyInput":
					// ["ModifyInput", ...]
					// Equation-style instructions on how to modify the Input
					//   each time the "While" conditions are fulfilled
					parsed = [];
					while(v.length > 0) {
						let pair = v.shift();
						if((typeof pair) === "string") {
							// AppendInput, etc
							parsed.push(pair);
						} else {
							let key = pair.shift();
							parsed.push([key, parseForSpecialValue(pair.shift())]);
						}
					}
					modIn = parsed;
					break;
				case "ModifyOutput":
					// ["ModifyOutnput", ...]
					// Equation-style instructions on how to modify the Output
					//   each time the "While" conditions are fulfilled
					parsed = [];
					while(v.length > 0) {
						let pair = v.shift();
						if((typeof pair) === "string") {
							// AppendInput, etc
							parsed.push(pair);
						} else {
							let key = pair.shift();
							parsed.push([key, parseForSpecialValue(pair.shift())]);
						}
					}
					modOut = parsed;
					break;
				default:
					logError("DO: invalid parameter \"" + op + "\" (ignored)", new Error());
			}
		}
		if(modIn === undefined) {
			logError(node, "DO: Missing required ModifyInput parameter", arr)
			return null;
		} else if(modOut === undefined) {
			logError(node, "DO: Missing required ModifyOutput parameter", arr)
			return null;
		} else if(comparisons === undefined) {
			logError(node, "DO: Missing required While parameter", arr)
			return null;
		} else if(input === undefined) {
			logError(node, "DO: Missing required Input parameter", arr)
			return null;
		} else if(output === undefined) {
			logError(node, "DO: Missing required Output parameter", arr)
			return null;
		}
		// Create Do tag
		d = RO.special["*Do"];
		return new d(new Map([
			["inType", inType],
			["outType", outType],
			["input", input],
			["output", output],
			["modIn", modIn],
			["modOut", modOut],
			["comparator", comparator],
			["comparisons", comparisons]
		]));
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
		input = FIND(input, context, inT);
		output = FIND(output, context, outT);
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
			results.push(LOGIC[func][input, FIND(test, context, inT)]);
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
				value = MATH[method](value, FIND(mod, context, type));
			}
		});
		return value;
	}
}
DoObject.specialName = "*Do";

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
		rs = character.ruleset,
		char = JSON.stringify(character);
	// save back to player
	player.saveCharacter(rs, id, char);
}
function savePlayer() {

}

// Searches an array and all nested arrays for objects with a .parser property
//   that has a corresponding restoreFunction on $RPG.objects.parser
// Can be destructive to input arrays
function restoreFromJSON(arr) {
	var output = [],
		ROP = $RPG.objects.parser;
	while(arr.length > 0) {
		let test = arr.shift(),
			parser = test.parser;
		if(parser !== undefined) {
			parser = ROP[parser];
			if(parser) {
				output.push(parser(test));
				continue;
			}
		}
		if (test instanceof Array) {
			output.push(restoreFromJSON(test));
		} else {
			output.push(test);
		}
	}
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
function restorePlayer(o) {
	// TBD
}
function restorePlayer_OLD_reviver_method(key, prop, flagged) {
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

function restoreAttributes(o, flagged) {
	var atts = o.atts;
	atts = restoreFromJSON(atts);
	if(flagged) {
		o.atts = new Map(atts);
		return o;
	}
	return new $RPG.objects.stats.ObjectWithAttributes(new Map(atts));
}
function restoreAttributes_OLD_reviver_method(key, prop, flagged) {
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
function restoreGroup(o, flagged) {
	o = $RPG.objects.parser.ObjectWithAttributes(o, true);
	if(flagged) {
		return o;
	}
	return new $RPG.objects.stats.GroupObject(o.id, o.atts);
}
function restoreGroup_OLD_reviver_method(key, prop, flagged) {
	if (key === "" && !flagged) {
		let g = $RPG.objects.stats.GroupObject;
		return new g(prop.id, prop.atts);
	}
	return prop;
}
function restoreStat(o, flagged) {
	var stat;
	o = $RPG.objects.parser.Group(o, true);
	if(flagged) {
		return o;
	}
	stat = new $RPG.objects.stats.Stat(o.id, o.atts, o.groups);
	stat.type = o.type;
	return stat;
}
function restoreStat_OLD_reviver_method(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let s = $RO.stats.StatObject,
			stat = new s(prop.id, prop.atts, prop.groups);
		stat.type = prop.type;
		return stat;
	}
	return $RO.parser.Group(key, prop, true);
}
function restoreMultiStat(o, flagged) {
	var ms;
	o = $RPG.objects.parser.StatObject(o, true);
	if(flagged) {
		return o;
	}
	ms = new $RPG.objects.stats.MultiStat(o.id, o.atts, o.groups);
	ms.type = o.type;
	// Leave .inheritors as strings for now, but save the multistat.
	// It will be fixed in Player.loadCharacter.
	deferred.multis.push(ms);
	ms.inheritors = o.inheritors;
	return ms;
}
function restoreMultiStat_OLD_reviver_method(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let m = $RO.stats.MultiStat,
			stat = new m(prop.id, prop.atts, prop.groups);
		// Leave .inheritors as strings for now, but save the multistat.
		deferred.multis.push(stat);
		stat.inheritors = prop.inheritors;
		// It will be fixed in Player.loadCharacter.
		return stat;
	}
	return $RO.parser.Stat(key, prop, true);
}
function restorePool(o, flagged) {
	var pool;
	o = $RPG.objects.parser.StatObject(o, true);
	pool = restoreFromJSON(o.pool);
	o.pool = new Map(pool);
	if(flagged) {
		return o;
	}
	pool = new $RPG.objects.stats.Pool(o.id, o.atts, o.groups);
	pool.pool = o.pool;
	return pool;
}
function restorePool_OLD_reviver_method(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let p = $RO.stats.Pool,
			pool = new p(prop.id, prop.atts, prop.groups);
		pool.pool = prop.pool;
		return pool;
	} else if (key === "pool") {
		return new Map(prop);
	}
	return $RO.parser.Stat(key, prop, true);
}
function restoreReference(o) {

}
function restoreReference_OLD_reviver_method(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let ro = $RO.stats.ReferenceObject;
		return ro.makeReference(prop.prop, prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}
function restoreCrossReference(o) {

}
function restoreCrossReference_OLD_reviver_method(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let cr = $RO.stats.CrossReference;
		return cr.makeReference(prop.id, prop.prop, prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}
function restoreEquation(o, flagged) {
	o = $RPG.objects.parser.ObjectWithAttributes(o, true);
	if(flagged) {
		return o;
	}
	return new $RPG.objects.special["*Equation"](o.atts);
}
function restoreEquation_OLD_reviver_method(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let e = $RO.special["*Equation"];
		return new e(prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}
function restoreIf(o, flagged) {
	o = $RPG.objects.parser.ObjectWithAttributes(o, true);
	if(flagged) {
		return o;
	}
	return new $RPG.objects.special["*If"](o.atts);
}
function restoreIf_OLD_reviver_method(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let e = $RO.special["*If"];
		return new e(prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}
function restoreDo(o, flagged) {
	o = $RPG.objects.parser.ObjectWithAttributes(o, true);
	if(flagged) {
		return o;
	}
	return new $RPG.objects.special["*Do"](o.atts);
}
function restoreDo_OLD_reviver_method(key, prop, flagged) {
	var $RO = $RPG.objects;
	if(key === "" && !flagged) {
		let e = $RO.special["*Do"];
		return new e(prop.atts);
	}
	return $RO.parser.ObjectWithAttributes(key, prop, true);
}


$RPG.ADD("objects", {
	data: {
		player: PlayerObject,
		ruleset: RulesetObject,
		character: CharacterObject,
		page: PageObject,
		MathObject: MathObject,
		LogicObject: LogicObject
	},
	stats: {
		ObjectWithAttributes: ObjectWithAttributes,
		Group: GroupObject,
		Stat: StatObject,
		MultiStat: MultiStatObject,
		Pool: Pool,
		Grabber: SpecialGrabber,
		Reference: ReferenceObject,
		CrossReference: CrossReference,
		func: {
			findValue: findValue,
			parseValue: parseForSpecialValue
		},
	},
	special: {
		"*Equation": EquationObject,
		"*If": IfObject,
		"*Do": DoObject
	},
	converter: {
		// Any/all values are possible - it's better to not specify a type than to use this
		Any: (x => x),
		// Integer (0 if NaN)
		Int: function(x) {
			var y = Math.floor(Number(x));
			return y === y ? y : 0;
		},
		// Number (0 if NaN)
		Num: function(x) {
			var y = Number(x);
			return y === y ? y : 0;
		},
		// String
		Str: (x => String(x)),
		// True or False (aka Boolean)
		TF: function(x) {
			var test = Number(x);
			if(Number.isNaN(test)) {
				// If value isn't numeric, test against some true/false strings
				switch (String(x).toLowerCase()) {
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
				// If none found, just use Boolean
				return Boolean(x);
			}
			// Numeric value: transform to Boolean
			return Boolean(test);
		}
	},
	saver: {
		Character: saveCharacter,
		Player: savePlayer
	},
	parser: {
		doRestore: restoreFromJSON,
		Player: restorePlayer,
		Character: restoreCharacter,
		ObjectWithAttributes: restoreAttributes,
		Group: restoreGroup,
		StatObject: restoreStat,
		MultiStat: restoreMultiStat,
		Pool: restorePool,
		Reference: restoreReference,
		CrossReference: restoreCrossReference,
		Equation: restoreEquation,
		If: restoreIf,
		Do: restoreDo
	}
});
