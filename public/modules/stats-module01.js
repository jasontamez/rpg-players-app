// Import query selectors
import { $q, $a } from "./dollar-sign-module.js";
// Import parsing and logging
import { copyArray, parseObjectToArray, parseAttributesToObject, logErrorNode, logErrorText as logError } from "./parsing-logging.js";

// temp variable to log all objects created
export var record = [];

var $RPG = window["$RPG"];



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
export class IntBonusable /* extends Int */ {
	constructor(id, padre, atts) {
		//super(id, padre, atts);
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
//IntBonusable.converter = Int.converter;
IntBonusable.prototype.type = IntBonusable;
IntBonusable.prototype.multistackable = ["", "dodge"];


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
export class Pool /* extends BasicStat */ {
	constructor(id, padre, type, atts) {
		var i, vs;
		//super(id, padre, atts);
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
	var n = group.id,
		a = group.attributes,
		atts = new Map(),
		tag;
	if(n === undefined) {
		logError("GROUP missing \"id\" property", new Error());
		return null;
	} else if(a === undefined) {
		logError("GROUP missing \"attributes\" property", new Error());
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
		mandatory = copyArray(MS.mandatoryWraps),
		atts = new Map(),
		tag;
	if(id === undefined) {
		logError("MULTISTAT missing \"id\" property", new Error());
		return null;
	}
	if(!(a instanceof Array)) {
		logError("MULTISTAT \"attributes\" property must be an Array", new Error());
		return null;
	}
	// Create attribute map
	a.forEach(function(pair) {
		atts.set(pair[0], pair[1]);
	});
	// Check if there are mandatory "wraps"
	if(mandatory.length > 0) {
		let wraps = atts.get("wraps"),
			found = {};
		// See if the multistat defines a correctly-formed wraps array
		if(wraps === undefined || wraps.constructor !== Array) {
			logError("MultiStat \"" + id + "\" is missing a \"wraps\" Array", new Error());
			return null;
		}
		// Turn the wraps into a simple object
		wraps.forEach(function(w) {
			found[w[0]] = true;
		});
		// Check each mandatory wrap against the object
		while(mandatory.length > 0) {
			let wrap = mandatory.shift();
			if(!found[wrap]) {
				logError("MultiStat \"" + id + "\" is missing mandatory \"" + wrap + "\" parameter", new Error());
				return null;
			}
		}
	}
	tag = new MS(id, atts, groups);
	tag !== undefined && Char.addMultiStat(id, tag);
}

export function parseStat(stat, Char) {
	var id = stat.id,
		a = stat.attributes || [],
		groups = stat.groups || [],
		atts = new Map(),
		tag;
	if(id === undefined) {
		logError("STAT missing \"id\" property", new Error());
		return null;
	}
	if(!(a instanceof Array)) {
		logError("STAT \"attributes\" property must be an Array", new Error());
		return null;
	}
	a.forEach(function(pair) {
		atts.set(pair[0], pair[1]);
	});
	tag = new ($RPG.objects.stats.Stat)(id, atts, groups);
	tag !== undefined && Char.addStat(id, tag);
}

export function parsePool(pool, Char) {
	var id = pool.id,
		a = pool.attributes || [],
		groups = pool.groups || [],
		atts = new Map(),
		tag;
	if(id === undefined) {
		logError("POOL missing \"id\" property", new Error());
		return null;
	}
	if(!(a instanceof Array)) {
		logError("POOL \"attributes\" property must be an Array", new Error());
		return null;
	}
	a.forEach(function(pair) {
		atts.set(pair[0], pair[1]);
	});
	tag = new ($RPG.objects.stats.Pool)(id, atts, groups);
	tag !== undefined && Char.addPool(id, tag);
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
			logErrorNode(node, "Unknown tag enountered: " + nombre);
		}
	}
	return currentTag;
}

// not sure if I need siblings... or all ancestors...

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

export function parseAttribute(node, parentNode, parentTag) {
	var atts = parseAttributesToObject(node), tag, type,
		nombre = atts.name,
		fromID = atts.fromId,
		formula = atts.formula,
		att = atts.attribute;
	if(nombre === undefined) {
		return logErrorNode(node, "ATTRIBUTE: missing required \"name\" parameter");
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
			return logErrorNode(node, "ATTRIBUTE: formula \"" + formula + "\" does not exist");
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
		return logErrorNode(node, "BONUS used within a non-Bonus-accepting type");
	}
	atts = parseAttributesToObject(node);
	formula = atts.formula;
	fromID = atts.fromId;
	if(fromID === undefined && formula === undefined) {
		return logErrorNode(node, "BONUS: missing required \"fromId\" or \"formula\" parameter");
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
			return logErrorNode(node, "BONUS: formula \"" + formula + "\" is not defined");
		}
		return parentTag.addBonus(nombre, atts.type, f, atts.note); //redo Formula
	}
	delete atts.fromId;
	parentTag.registerBonusTag(nombre, fromID, att, parseObjectToArray(atts));
}


export function parseNotation(node, parentNode, parentTag) {
	var atts, fromID, att, note, formula;
	if(!(parentTag instanceof BasicStat)) {
		return logErrorNode(node, "NOTATION used within a non-Stat type");
	}
	atts = parseAttributesToObject(node);
	note = atts.value;
	if(note === undefined) {
		// If no note as a value, use the inner text as the note, instead
		note = node.textContent.trim();
	}
	if(!note) {
		return logErrorNode(node, "NOTATION missing \"value\" parameter or inner text content");
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
		return logErrorNode(node, "POOL: missing required \"id\" property");
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
		return logErrorNode(node, "ITEM can only be used directly inside a POOL");
	}
	atts = parseAttributesToObject(node);
	value = atts.value;
	if(value === undefined) {
		return logErrorNode(node, "ITEM: missing required \"value\" parameter");
	}
	title = atts.title;
	if(title === undefined) {
		title = value;
	}
	selected = atts.selected || false;
	$RPG.current.character.noteBonus("parseStats", "PoolItem", parentTag, title);
	parentTag.addItem(title, value, selected);
}









$RPG.ADD("stats", {
//	type: {
//		Typeless: BasicStat,
//		Num: Num,
//		Int: Int,
//		Str: Str,
//		IntBonusable: IntBonusable,
//		Pool: Pool,
//		TF: TF
//	},
//	// A function to handle Type attributes
//	getTypeObject: function(type, fallback) {
//		var c = $RPG.stats.type[type];
//		// Is this a valid type?
//		if(c !== undefined) {
//			// If so, return it
//			return c;
//		}
//		// Otherwise, return Str or other specified default
//		return fallback || $RPG.stats.defaultTypeObject;
//	},
//	defaultTypeObject: Str,
//	formula: Formula,
//	preprocessTags: {},
//	infoHandler: {
//		Equation: parseEquation,
//		If: parseIf,
//		Do: parseDo,
//	},
//	StatTagHandlers: {
//		Stat: parseStat,
//		MultiStat: parseMultiStat,
//		Bonus: parseBonus,
//		Notation: parseNotation,
//		Pool: parsePool,
//		Item: parsePoolItem
//	},
//	TagHandlers: {
//		Attribute: parseAttribute,
//		BasicIdObject: parseGroup
//	},
//	comparators: {
//		If: If
//	}
});


