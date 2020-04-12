// Import query selectors
import { $q, $a } from "./dollar-sign-module.js";
// Import parsing and logging
import { logErrorText as logError } from "./parsing-logging.js";


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
			char, newChar;
		if(cur && (char = cur.character) && char.id === id && char.ruleset === ruleset) {
			return logError("Attempting to load current character.");
		} else if ((newChar = this.getCharacter(ruleset, id)) === undefined) {
			return logError("Cannot find character \"" + id + "\" in ruleset \"" + ruleset + "\"");
		} else if (char) {
			// Save the old character
			$RPG.objects.saver.Character(char, this);
		}
		char = JSON.parse(newChar);
		newChar = $RPG.objects.parser[char.parser](char);
		cur.character = newChar;
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
		this.formulae = new Map();
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
	addFormula(id, formula) {
		return this.formulae.set(id, formula);
	}
	getFormula(id) {
		return this.formulae.get(id);
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
			return logErrorText("Unable to find any bonuses labelled \"" + id + "\"");
		}
		bonuses.forEach(function(arr) {
			var n = arr.shift(),
				undo = $RPG.data.undoBonusMethods[n];
			if(undo === undefined) {
				logError(n, "Cannot find undo operation \"" + n + "\"");
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
			formulae: this.formulae,
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
	"formulae",
	"references",
	"crossreferences"
];

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
		super(id, atts, groups);
		this.groups = groups;
		this.defaultContext = id;
	}
	toJSON(key) {
		var o = super.toJSON(key);
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
			logError("ERROR: unable to find \"" + this.reference + "\" when fetching CrossReference");
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


///////////////////////////
///////// PARSERS /////////
///////////////////////////

// These are used by JSON.parse to reconstruct objects.

// Note: parse in this order:
//   * Groups
//   * MultiStats
//   * Stats
//   * Pools
//   * References
//   * CrossReferences
//   * Equations
//   * If
//   * Do/While
//   * Formulae
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
//function restoreMultiStat(key, prop, flagged) {
//}
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
//function restoreIf(key, prop, flagged) 
//}
//function restoreDo(key, prop, flagged) {
//}
//function restoreFormula(key, prop, flagged) {
//}


$RPG.ADD("objects", {
	data: {
		player: PlayerObject,
		character: CharacterObject
	},
	stats: {
		ObjectWithAttributes: ObjectWithAttributes,
		Group: GroupObject,
		Stat: StatObject,
		Grabber: SpecialGrabber,
		Reference: ReferenceObject,
		CrossReference: CrossReference,
		Equation: EquationObject
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
		Reference: restoreReference,
		CrossReference: restoreCrossReference,
		Equation: restoreEquation
	}
});
