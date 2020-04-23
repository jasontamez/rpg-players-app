// Import query selectors
import { $q, $a } from "./dollar-sign-module.js";
// Import parsing and logging
import { copyArray, parseObjectToArray, parseAttributesToObject, parseIdAndAttributesToArray, logErrorNode as logError, logErrorText } from "./parsing-logging.js";

// temp variable to log all objects created
export var record = [];

var $RPG = window["$RPG"];




//   MultiStat.getById(stringID) => o
export class MultiStat extends BasicIdObject {
	constructor(id, padre, type, atts) {
		var i;
		super(id, padre, atts);
		i = this.atts;
		i.has("idPre") || i.set("idPre", "_");
		i.has("idPost") || i.set("idPost", "");
		this.inheritors = new Map();
		this.inhCount = 0;
		this.type = type;
		MultiStat.allIDs.set(id, this);
	}
	makeAtt(att, n) {
		var pre = this.get(att + "Pre") || "",
			post = this.get(att + "Post") || "";
		return pre + n + post;
	}
	makeStatFromNode(node, atts, method = "parseStats") {
		var n = this.inhCount++,
			id = this.makeAtt("id", n.toString()),
			newStat;
		newStat = new this.type(id, this, node, atts);
		$RPG.current.character.addStat(method, id, newStat);
		this.inheritors.set(id, newStat);
		return newStat;
	}
	hasChild(n) {
		return this.inheritors.has(this.makeAtt("id", n.toString()));
	}
	getChild(n) {
		return this.inheritors.get(this.makeAtt("id", n.toString()));
	}
	makeStatBasic(nombre, title, description, method = "parseStats") {
		var n = ++this.inhCount,
			atts = [],
			i = this.atts,
			CHAR = $RPG.current.character,
			id, descPre, descPost, t, d,
			newStat;
		// Get id
		id = this.makeAtt("id", String(nombre || n));
		// Make sure this isn't a duplicate
		if((newStat = CHAR.getStat(id)) !== undefined) {
		//if(BasicIdObject.getById(id) !== undefined) {
			// It is
			this.inhCount--;
			logErrorText("ERROR INHERITING FROM MULTISTAT: id \"" + id + "\" already exists");
			return newStat;
		}
		// Parse atts
		i.forEach(function(v, key) {
			switch(key) {
				case "idPre":
				case "idPost":
				case "titlePre":
				case "titlePost":
				case "descPre":
				case "descPost":
					// Do nothing
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
		// Save title
		newStat = this.makeAtt("title", title || t || "");
		newStat && atts.push(["title", newStat]);
		// Save description
		newStat = this.makeAtt("desc", description || d || "");
		newStat && atts.push(["description", newStat]);
		// Make Stat
		newStat = new this.type(id, this, undefined, atts);
		CHAR.addStat(method, id, newStat);
		this.inheritors.set(id, newStat);
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
	constructor(id, padre, atts) {
		var i, t;
		super(id, padre, atts);
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
	constructor(id, padre, atts) {
		super(id, padre, atts);
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
Int.converter = function() { return Math.round(Number(...arguments)); };
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
	constructor(id, padre, atts) {
		var i;
		super(id, padre, atts);
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
		if(prop === "validator" && value !== undefined && value.constructor !== RegExp) {
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
//         (attribute pairs may contain type => stringTypeOfBonus, note => stringNotation)
//   o.addBonus(stringUniqueName, stringTypeOfBonus, integerBonus, ?stringNotation)
//   o.removeBonus(stringUniqueName, stringTypeOfBonus, ?stringNotation)
//         ('notation' describes the situation where the bonus applies)
//
// o.getModifiedValue(?context)
//   Each non-notated bonus is grouped by type
//   The highest positive and lowest negative values per type are added to the value
//     IF "insight" has bonuses (and penalties) equal to [1, 2, -2, 3, -1]
//     THEN only 3 and -2 are used, for a total of +1
//   HOWEVER if o.multistackable contains "insight", then
//     all the bonuses would be used, for a total of +3
//
// o.getModifiedValueByNotation(stringNotation, ?context)
//   As .getModifiedValue but also includes bonuses for stringNotation
//
// o.getAllModifiedValues(?context)
//   Returns an array of bonuses in the format [integerBonus, stringNotation]
//   Bonuses are calculated based on type as in .getModifiedValue above
export class IntBonusable extends Int {
	constructor(id, padre, atts) {
		super(id, padre, atts);
		this.bonuses = new Map();
		this.bonuses.set("", new Map());
	}
	get(prop, context = this.defaultContext) {
		if(prop === "modifiedValue") {
			return this.getModifiedValue(context);
		}
		return super.get(prop, context);
	}
	getModifiedValue(context = this.defaultContext) {
		// get unmodified-by-step value
		var t = this,
			total = t.atts.get("value"),
			bonuses = t.bonuses.get("") || new Map();
		// go through all bonuses
		bonuses.forEach(function(type) {
			var b = [0];
			type.forEach(function(value) {
				var v = value;
				if(value instanceof SpecialGrabber) {
					v = value.grabValue(context);
				}
				b.push(v);
			});
			if(t.multistackable.indexOf(type) !== 1) {
				total += b.reduce((acc, vv) => acc + vv, 0);
			} else {
				total += Math.max(...b) + Math.min(...b);
			}
		});
		total = t.getWithStep(total);
		return t.type.converter(total);
	}
	static getBonusesByType(stat, context, notation = "", all = new Map()) {
		// Internal method for getting a Map of type arrays
		var notemap = stat.bonuses.get(notation) || new Map();
		notemap.forEach(function(map, type) {
			var b = all.get(type) || [0];
			map.forEach(function(value) {
				var v = value;
				if(value instanceof SpecialGrabber) {
					v = value.grabValue(context);
				}
				b.push(v);
			});
			all.set(type, b);
		});
		return all;
	}
	getModifiedValueByNotation(
		notation,
		context = this.defaultContext,
		total = this.atts.get("value"),
		all = IntBonusable.getBonusesByType(this, context)
	) {
		var t = this;
		all = IntBonusable.getBonusesByType(t, context, notation, all);
		all.forEach(function(b, type) {
			if(t.multistackable.indexOf(type) !== 1) {
				total += b.reduce((acc, vv) => acc + vv, 0);
			} else {
				total += Math.max(...b) + Math.min(...b);
			}
		});
		total = t.getWithStep(total);
		return t.type.converter(total);
	}
	getAllModifiedValues(context = this.defaultContext) {
		var t = this,
			value = t.atts.get("value"),
			all = [["", t.getModifiedValue(context)]],
			basics = IntBonusable.getBonusesByType(t, context, ""),
			notes = Array.from(this.bonuses.values()).filter(v => v !== "");
		notes.forEach(function(note) {
			all.push([note, this.getModifiedValueByNotation(note, context, value, new Map(basics))]);
		});
		return all;
	}
	registerBonusTag(nombre, id, att, atts) {
		var type = atts.type,
			notation = atts.note,
			tag;
		if(id === "this") {
			tag = SelfReference.getReference(att, undefined, undefined, []);
		} else {
			tag = StatReference.getReference(id, att, undefined, undefined, []);
		}
		this.addBonus(nombre, type, tag, notation);
		return nombre;
	}
	addBonus(nombre, type, bonus, notation = undefined) {
		var noteGroup, typeGroup;
		// Blank notation should change into the empty string
		if(notation === undefined) {
			notation = "";
		}
		// Ditto for a blank type
		if(!type || type.constructor !== String) {
			type = "";
		}
		// Get noteGroup = everything previously saved that has the same notation
		noteGroup = this.bonuses.get(notation) || new Map();
		// Get typeGroup = everything within that notation with the same type
		typeGroup = noteGroup.get(type) || new Map();
		// Save this new bonus to typeGroup
		typeGroup.set(nombre, this.type.converter(bonus));
		// Save the altered typeGroup to noteGroup
		noteGroup.set(type, typeGroup);
		// Save noteGroup to the stat
		this.bonuses.set(notation, noteGroup);
	}
	removeBonus(nombre, type, notation = undefined) {
		var noteGroup, typeGroup;
		// Blank notation should change into the empty string
		if(notation === undefined) {
			notation = "";
		}
		// Ditto for a blank type
		if(!type || type.constructor !== String) {
			type = "";
		}
		// Get noteGroup = everything previously saved that has the same notation
		noteGroup = this.bonuses.get(notation);
		// Check that we actually have anything!
		if(noteGroup !== undefined) {
			// Get typeGroup = everything within that notation with the same type
			typeGroup = noteGroup.get(type);
			// Check that we actually have anything!
			if(typeGroup !== undefined) {
				// Delete given bonus
				typeGroup.delete(nombre);
				// See if anything's left in typeGroup
				if(typeGroup.size > 0) {
					// Save typeGroup to noteGroup
					noteGroup.set(notation, typeGroup);
				} else {
					// If nothing left in typeGroup, delete it from noteGroup
					noteGroup.delete(notation);
				}
			}
			// See if anything's left in noteGroup
			if(noteGroup.size > 0) {
				// Save noteGroup to stat
				this.bonuses.set(notation, noteGroup);
			} else {
				// If nothing left, delete noteGroup from stat
				this.bonuses.delete(notation);
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
	constructor(id, padre, atts) {
		super(id, padre, atts);
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
	//registerBonusTag(nombre, id, att, atts) {
	//	var tag,
	//		type = atts.type;
	//	if(id === "this") {
	//		tag = SelfReference.getReference(att, undefined, undefined, []);
	//	} else {
	//		tag = StatReference.getReference(id, att, undefined, undefined, []);
	//	}
	//	this.addBonus(nombre, type, tag);
	//	return nombre;
	//}
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
	constructor(id, padre, type, atts) {
		var i, vs;
		super(id, padre, atts);
		i = this.atts;
		if(i.has("minSelection")) {
			this.set("minSelection", i.get("minSelection"));
		}
		if(i.has("maxSelection")) {
			this.set("maxSelection", i.get("maxSelection"));
		}
		this.itemType = type;
		this.values = new Map();
		vs = this.atts.get("value");
		if(vs) {
			let sep = this.atts.get("separator") || Pool.defaultSeparator,
				t = this;
			this.atts.delete("value");
			vs.split(sep).forEach(function(v) {
				t.addItem(v, v, false);
			});
		}
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
			return (this.itemType || Str).converter.call();
		} else if (prop === "value") {
			return this.getSelectionValues();
		}
		return super.get(prop, context);
	}
	empty() {
		this.values = new Map();
	}
	addItem(title, value, selected = false) {
		var o = {
			value: this.itemType.converter(value),
			title: title,
			selected: TF.converter(selected)
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
		return this.values.has(title);
	}
	getItems() {
		// Returns an array of all objects
		var arr = [];
		this.values.forEach(o => arr.push(o));
		return arr;
		//return Array.from(this.values).map(o => o[1]);
	}
	hasItemSelected(title) {
		var i = this.values.get(title);
		if(i === undefined) {
			return undefined;
		}
		return i.selected;
	}
	addSelection() {
		var args = Array.from(arguments),
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
Pool.defaultSeparator = ",";
Pool.converter = function(value, convObj = Str) {
	if(value.constructor !== Array) {
		value = [value];
	}
	return value.map(test => convObj.converter(test));
};
Pool.prototype.type = Pool;


// nodeType 1 -> tag, 3 -> text, 2 -> attribute, 8 -> comment, 9 -> document
//parent, parentTag, node, id, atts, env, StatNodes

export function parseStats(groups, multiStats, stats, pools, Char) {
	// Parse groups
	groups.forEach( group => parseGroup(group, Char) );
	// Parse multistats
	multiStats.forEach( ms => parseMultiStat(ms, Char) );
	// Parse stats
	stats.forEach( stat => parseStat(stat, Char) );
	// Parse pools
	pools.forEach( pool => parsePool(pool, Char) );
	//nodelist.forEach( node => parseStatNodes(node, undefined) );
}

export function parseGroup(group, Char) {
	var n = group.name,
		a = group.attributes,
		atts = new Map(),
		tag;
	if(n === undefined) {
		logErrorText("GROUP missing \"name\" property", new Error());
		return null;
	} else if(a === undefined) {
		logErrorText("GROUP missing \"attributes\" property", new Error());
		return null;
	}
	a.forEach(function(prop, value) {
		// Need to set value to something else
		var v = parsePropertyValue(value);
		v !== undefined && atts.set(prop, v);
	});
	tag = new $RPG.objects.stats.Group(n, atts);
	tag !== undefined && Char.addGroup(n, Char);
}

export function parseMultiStat(ms, Char) {
	var id = ms.id,
		a = ms.attributes || [],
		groups = ms.groups || [],
		MS = $RPG.objects.stats.MultiStat,
		mandatory = copyArray(MS.mandatoryWraps)
		atts = new Map(),
		tag;
	if(id === undefined) {
		logErrorText("MULTISTAT missing \"id\" property", new Error());
		return null;
	}
	if(!(a instanceof Array)) {
		logErrorText("MULTISTAT \"attributes\" property must be an Array", new Error());
		return null;
	}
	a.forEach(function(pair) {
		atts.set(pair[0], pair[1]);
	});
	while(mandatory.length > 0) {
		wrap = mandatory.shift();
		if(atts.get(wrap) === undefined) {
			logError("MultiStat \"" + id + "\" is missing mandatory \"" + wrap + "\" parameter", new Error());
			return null;
		}
	}
	tag = new MS(id, atts, groups);
	tag !== undefined && Char.addMultiStat(id, tag);
}

export function parseStat(stat, Char) {

}

export function parsePool(pool, Char) {

}

export function parsePropertyValue(value, converter) {
	if(value === null || value === undefined) {
		return value;
	} else if (value.constructor === Array) {
		// Create copy of array
		let interpreter = $RPG.stats.infoHandler[value[0]];
		// If it matches a handler, run it. Otherwise return a copy of the array.
		if(interpreter === undefined) {
			return copyArray(value);
		}
		value = interpreter(copyArray(value, 1));
	}
	// Run converter if needed
	return converter === undefined ? value : converter(value);
}

function parseEquation() {

}

function parseIf() {

}

function parseDo() {

}

export function parseStatNodes(currentNode, currentTag, nodes = [...currentNode.children]) {
	var $RS = $RPG.stats;
	// Get kids of the parent
	// Go through each child
	while(nodes.length > 0) {
		let node = nodes.shift(),
			nombre = node.nodeName;
		if($RS.preprocessTags[nombre] !== undefined) {
			// This node will be changed by a preprocessor
			let info = $RS.preprocessTags[nombre](node, currentNode, currentTag);
			if(info === null) {
				// Something bad happened: skip this node
				continue;
			}
			// Use the returned value as the new node
			node = info;
		}
		if($RS.StatTagHandlers[nombre] !== undefined) {
			// This node has a special handler: use it
			$RS.StatTagHandlers[nombre](node, currentNode, currentTag);
		} else if ($RS.TagHandlers[nombre] !== undefined) {
			// This node has a special handler: use it
			$RS.TagHandlers[nombre](node, currentNode, currentTag);
		} else {
			// This is an unknown tag
			logError(node, "Unknown tag enountered: " + nombre);
		}
	}
	return currentTag;
}

// not sure if I need siblings... or all ancestors...

export function parseStat_OLD(node, parentNode, parentTag) {
	var atts = parseIdAndAttributesToArray(node),
		id = atts.shift(), tag, type;
	if(atts.slice().every(function(pair) {
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
	type = $RPG.stats.getTypeObject(type, Str);
	tag = new type(id, parentTag, node, atts);
	$RPG.current.character.addStat(id, tag);
	parseStatNodes(node, tag);
}

export function parseMultiStat_OLD(node, parentNode, parentTag) {
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
	type = $RPG.stats.getTypeObject(type, Str);
	tag = new MultiStat(id, parentTag, node, type, atts);
	$RPG.current.character.addMultiStat(id, tag);
	parseStatNodes(node, tag);
}

// these should probably set the Value property of their parent
// Math, If, and Get should only happen directly inside a tag that wants some content

export function parseEquation_OLD(node, parentNode, parentTag) {
	var eq = Equation.constructEquation(parentTag, node);
	parentTag.set("value", eq);
}


export function parseIf_OLD(node, parentNode, parentTag) {
	var ifthen = If.constructIfThenElse(parentTag, node);
	parentTag.set("value", ifthen);
}
//intype, outtype, compareTag, style
//parseStatNodes(currentNode, currentTag, ancestry, ancestorAtts)


export function parseDo_OLD(node, parentNode, parentTag) {
	var doWhile = Do.constructDo(parentTag, node);
	parentTag.set("value", doWhile);
}

export function parseGroup_OLD(node, parentNode, parentTag) {
	var atts = parseIdAndAttributesToArray(node),
		id = atts.shift(),
		tag = new BasicIdObject(id, parentTag, node, atts);
	$RPG.current.character.addStat(id, tag);
	parseStatNodes(node, tag);
}

export function parseAttribute(node, parentNode, parentTag) {
	var atts = parseAttributesToObject(node), tag, type,
		nombre = atts.name,
		fromID = atts.fromId,
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
	atts.type = $RPG.stats.getTypeObject(type, $RPG.stats.type.Typeless);
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
		tag.set("value", node.textContent.trim());
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
	fromID = atts.fromId;
	if(fromID === undefined && formula === undefined) {
		return logError(node, "BONUS: missing required \"fromId\" or \"formula\" parameter");
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
	$RPG.current.character.noteBonus("parseStats", "Bonus", parentTag, nombre, atts.type, atts.note);
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


export function parseNotation(node, parentNode, parentTag) {
	var atts, fromID, att, note, formula;
	if(!(parentTag instanceof BasicStat)) {
		return logError(node, "NOTATION used within a non-Stat type");
	}
	atts = parseAttributesToObject(node);
	note = atts.value;
	if(note === undefined) {
		// If no note as a value, use the inner text as the note, instead
		note = node.textContent.trim();
	}
	if(!note) {
		return logError(node, "NOTATION missing \"value\" parameter or inner text content");
	}
	$RPG.current.character.noteBonus("parseStats", "Notation", parentTag, note);
	parentTag.addNotation(note);
}


//<BonusChoice>


export function parsePool_OLD(node, parentNode, parentTag) {
 	var atts = parseAttributesToObject(node),
		type = atts.type,
		id = atts.id,
		tag;
	if(id === undefined) {
		return logError(node, "POOL: missing required \"id\" property");
	}
	if(type === undefined) {
		if(parentTag === undefined) {
			console.log([node, parentNode, parentTag]);
			type = Str;
		} else {
			type = $RPG.stats.getTypeObject(parentTag.get("type"), Str);
		}
	} else {
		type = $RPG.stats.getTypeObject(type, Str);
	}
	tag = new Pool(id, parentTag, node, type, parseObjectToArray(atts));
	$RPG.current.character.addStat(id, tag);
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
	$RPG.current.character.noteBonus("parseStats", "PoolItem", parentTag, title);
	parentTag.addItem(title, value, selected);
}









// Formula object with ability to find any formula by name
//   o = new Formula(xmlNode, stringName, [attribute pairs])
// Formula.getName("stringName") => o
export class Formula extends SpecialGrabber {
	constructor(nombre, atts) {
		super(undefined, atts, nombre);
		this.name = nombre;
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


export function parseFormulae(formulae) {
	// Parse nodes
	formulae.forEach( f => parseFormula(f) );
}


export function parseFormula(f) {
	var nombre = f.name,
		overwrite = TF.converter(f.overwrite),
		atts = [],
		getTO = $RPG.stats.getTypeObject,
		inType, outType;
	if(nombre === undefined) {
		return logErrorText("FORMULA: missing required \"name\" parameter");
	}
	if(Formula.getName(nombre) !== undefined && !overwrite) {
		return logErrorText("FORMULA: cannot overwrite existing \"" + nombre + "\" formula without an explicit \"overwrite\" parameter");
	}
	Object.getOwnPropertyNames(f).forEach(function(att) {
		switch (att) {
			case "name":
			case "overwrite":
				// Ignore
				break;
			case "inType":
				inType = getTO(f[att]);
				break;
			case "outType":
				outType = getTO(f[att]);
				break;
			default:
				atts[att] = f[att];
		}
	});
	return new Formula(nombre, atts);
}


$RPG.ADD("formulae", {});
$RPG.ADD("stats", {
	type: {
		Typeless: BasicStat,
		Num: Num,
		Int: Int,
		Str: Str,
		IntBonusable: IntBonusable,
		Pool: Pool,
		TF: TF
	},
	// A function to handle Type attributes
	getTypeObject: function(type, fallback) {
		var c = $RPG.stats.type[type];
		// Is this a valid type?
		if(c !== undefined) {
			// If so, return it
			return c;
		}
		// Otherwise, return Str or other specified default
		return fallback || $RPG.stats.defaultTypeObject;
	},
	defaultTypeObject: Str,
	formula: Formula,
	preprocessTags: {},
	infoHandler: {
		Equation: parseEquation,
		If: parseIf,
		Do: parseDo,
	},
	StatTagHandlers: {
		Stat: parseStat,
		MultiStat: parseMultiStat,
		Bonus: parseBonus,
		Notation: parseNotation,
		Pool: parsePool,
		Item: parsePoolItem
	},
	TagHandlers: {
		Attribute: parseAttribute,
		BasicIdObject: parseGroup
	},
	comparators: {
		If: If
	}
});


