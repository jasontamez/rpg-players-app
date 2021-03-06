// Import query selectors
import { $a, $ec, $e, $ea } from "./dollar-sign-module.js";
// Import parsing and logging
import { parseObjectToArray, parseAttributesToObject, logErrorNode as logError } from "./parsing-logging.js";
import { MultiStat, Pool, Formula, Int } from "./stats-module01.js";

var $RPG = window["$RPG"];


// parseBundlesInfo(arrayNodes) => arrayObjects
// Sets $RPG.bundles.previousBonuses with any applied bonuses, then returns choice objects
export function parseBundledInfo(nodelist, method = "parseBundles") {
	// Parse nodes
	var bonuses = $RPG.bundles.previousBonuses, choices = [];
	nodelist.forEach(function(node) {
		var b = [];
		parseBundleNode(method, node).forEach(function(o) {
			if(o.isChoice) {
				choices.push(o);
			} else {
				b = b.concat(o);
			}
		});
		bonuses.set(node.id, b);
	});
	$RPG.bundles.previousBonuses = bonuses;
	$RPG.bundles.choicesToBeMade = choices;
	return choices.length;
}


// parseBundleNode(objectCurrentNode, ?arrayChildNodes) => arrayObjects
// Goes through children, applies bonuses found, returns any objects given
// Non-object return values are ignored
// Logs error if a child node doesn't have a registerd handler
export function parseBundleNode(method, currentNode, nodes = [...currentNode.children]) {
	var $RBT = $RPG.bundles.TagHandlers,
		output = [];
	// Get kids of the parent
	// Go through each child 
	while(nodes.length > 0) {
		let node = nodes.shift(),
			nombre = node.nodeName,
			handler = $RBT[nombre];
		if(handler !== undefined) {
			// This node has a special handler: use it
			let result = handler(node, currentNode, method);
			// Ignore result unless it has special information
			if(result instanceof Object) {
				output.push(result);
			}
		} else {
			// This is an unknown tag
			logError(node, "Unknown tag enountered: " + nombre);
		}
	}
	return output;
}


//<Bonus to="Swim" value="2" type="racial" />
//<Bonus to="Profession (sailor)" multi="profession_skills" sub="sailor" value="2" type="racial" />
// parseBonus(objectNode, objectParentNode) => false || object
// Logs error and returns false if parameters missing, stat not found, etc
// Otherwise, adds bonus to stat, returns either object:
//  o.type = "Bonus" or "BonusTag"
//  o.stat = objectStat
//  o.bonus = array of arguments for addBonus or registerBonusTag
//  o.isChoice = false
export function parseBonus(node, parentNode, method) {
	var atts = parseAttributesToObject(node),
		formula = atts.formula,
		fromID = atts.fromId,
		att = atts.fromAtt || "value",
		toStat = atts.to,
		value = atts.value,
		multi = atts.multi,
		nombre = parentNode.id,
		CHAR = $RPG.current.character,
		undo = "Bonus",
		stat, bonus;
	if(toStat === undefined) {
		logError(node, "BONUS: missing required \"to\" parameter");
		return false;
	} else if ((stat = CHAR.getStat(toStat)) === undefined) {
	//} else if ((stat = BasicIdObject.getById(toStat)) === undefined) {
		if(multi === undefined) {
			logError(node, "BONUS: Stat \"" + toStat + "\" not found");
			return false;
		}
		let sub = atts.sub;
		stat = CHAR.getMultiStat(multi);
		//stat = MultiStat.getById(multi);
		if(stat === undefined || !(stat instanceof MultiStat)) {
			logError(node, "BONUS: Stat \"" + toStat + "\" not found and \"" + multi + "\" not found, or not a MultiStat");
			return false;
		} else if (sub === undefined) {
			logError(node, "BONUS: missing \"sub\" parameter for MultiStat \"" + multi + "\"");
			return false;
		}
		stat = stat.makeStatBasic(sub, atts.title, atts.description, method);
	}
	if(fromID === undefined && formula === undefined && value === undefined) {
		logError(node, "BONUS: missing required \"fromId\", \"formula\" or \"value\" parameter");
		return false;
	}
	if (formula !== undefined) {
		//addBonus(nombre, type, bonus, notation = undefined)
		let f = Formula.getName(formula);
		if(f === undefined) {
			logError(node, "BONUS: formula \"" + formula + "\" is not defined");
			return false;
		}
		bonus = [nombre, atts.type, f, atts.note];
		stat.addBonus(...bonus);
		CHAR.noteBonus(method, undo, stat, nombre, atts.type, atts.note);
		return {
			type: undo,
			stat: stat,
			bonus: bonus,
			isChoice: false
		};
	}
	if (fromID !== undefined) {
		delete atts.fromId;
		delete atts.fromAtt;
		delete atts.to;
		if (nombre === undefined) {
			nombre = "Bonus via " + fromID + "." + att;
		}
		let a = parseObjectToArray(atts);
		bonus = [nombre, fromID, att, a];
		stat.registerBonusTag(...bonus);
		CHAR.noteBonus(method, undo, stat, nombre, a.type, a.note);
		return {
			type: undo,
			stat: stat,
			bonus: bonus,
			isChoice: false
		};
	}
	if(nombre === undefined) {
		nombre = "Bonus via " + parentNode.nodeName;
	}
	bonus = [nombre, atts.type, value, atts.note];
	stat.addBonus(...bonus);
	CHAR.noteBonus(method, undo, stat, nombre, atts.type, atts.note);
	return {
		type: undo,
		stat: stat,
		bonus: bonus,
		isChoice: false
	};
}


//<Notation to="Swim" value="At 16th level, you can always take 10 on Swim checks, even when threatened or distracted" />
// parseNotation(objectNode, objectParentNode) => false || object
// Logs error and returns false if parameters missing, stat not found, etc
// Otherwise, adds notation to stat, returns object:
//  o.type = "Notation"
//  o.stat = objectStat
//  o.note = stringNote
//  o.isChoice = false
export function parseNotation(node, parentNode, method) {
	var atts = parseAttributesToObject(node),
		note = atts.value,
		toStat = atts.to,
		undo = "Notation",
		stat;
	if (toStat === undefined) {
		logError(node, "NOTATION: missing required \"to\" parameter");
		return false;
	} else if ((stat = $RPG.current.character.getStat(toStat)) === undefined) {
	//} else if ((stat = BasicIdObject.getById(toStat)) === undefined) {
		logError(node, "NOTATION: Stat \"" + toStat + "\" not found");
		return false;
	} else if (note === undefined) {
		// If no note as a value, use the inner text as the note, instead
		note = node.textContent.trim();
	}
	if(!note) {
		logError(node, "NOTATION: missing \"value\" parameter or inner text content");
		return false;
	}
	stat.addNotation(note);
	$RPG.current.character.noteBonus(method, undo, stat, note);
	return {
		type: undo,
		stat: stat,
		note: note,
		isChoice: false
	};
}


//<BonusChoice to="STR,DEX,CON,INT,WIS,CHA" value="2" choices="1" title="Choose two stats to receive +2 bonuses" />
// parseBonus(objectNode, objectParentNode) => false || object
// Logs error and returns false if parameters missing, stat not found, etc
// Otherwise, adds bonus to stat, returns either object:
//  o.type = "BonusChoice"
//  o.id = id property of node or parentNode
//  o.stats = array of objectStats
//  o.title = string describing the choice(s) presented, such as "Choose a stat for a +2 bonus"
//  o.value = string representing the bonus to be awarded to chosen option(s)
//  o.choices = string representing the number of options that need to be selected
//  o.isChoice = true
export function parseBonusChoice(node, parentNode, method) {
	var atts = parseAttributesToObject(node),
		value = atts.value,
		choices = atts.choices,
		toStats = atts.to,
		title = atts.title,
		id = atts.id,
		values = [value, choices, toStats],
		stats = [];
	if (values.some(z => z === undefined)) {
		logError(node, "BONUSCHOICE: missing \"value\", \"choices\" and/or \"to\" parameter(s)");
		return false;
	}
	values = toStats.split(atts.separator || ",").some(function(v) {
		let stat = $RPG.current.character.getStat(v);
		//let stat = BasicIdObject.getById(v);
		if(stat === undefined) {
			logError(node, "BONUSCHOICE: cannot find a Stat named \"" + v + "\"")
			return false;
		}
		stats.push(stat);
		return false;
	});
	if (values) {
		return false;
	} else if (id === undefined) {
		id = parentNode.id;
	}
	return {
		type: "BonusChoice",
		id: id,
		stats: stats,
		title: title,
		value: value,
		choices: choices,
		method: method,
		isChoice: true
	};
}


//<PoolBonus to="combatEffects">
//  <Item title="Orcish Ferocity" value="Once per day, when you're brought below 0 hit points but not killed, you can fight on for 1 more round as if disabled. At the end of his next turn, unless brought to above 0 hit points, you immediately fall unconscious and begin dying" />
//</PoolBonus>
//<PoolBonus to="combatEffects" value="You can hold your breath for twice as long as a normal human can" />
// parsePoolBonus(objectNode, objectParentNode) => false || object
// Logs error and returns false if parameters missing, stat not found, etc
// Otherwise, adds items to pool, returns object:
//  o.type = "PoolBonus"
//  o.pool = objectPool
//  o.values = array of values, each an array of "title" and "value"
//  o.isChoice = false
//
export function parsePoolBonus(node, parentNode, method) {
	var atts = parseAttributesToObject(node),
		value = atts.value,
		toPool = atts.to,
		fromID = atts.fromId,
		undo = "PoolItem",
		pool, values;
	if (toPool === undefined) {
		logError(node, "POOLBONUS: missing required \"to\" parameter");
		return false;
	} else if ((pool = $RPG.current.character.getStat(toPool)) === undefined || !(pool instanceof Pool)) {
	//} else if ((pool = BasicIdObject.getById(toPool)) === undefined || !(pool instanceof Pool)) {
		logError(node, "POOLBONUS: \"" + toPool + "\" is not the name of a stat, or else isn't a Pool");
		return false;
	} else if (fromID !== undefined) {
		let otherPool = $RPG.current.character.getStat(fromID);
		//let otherPool = BasicIdObject.getById(fromID);
		if(otherPool === undefined || !(otherPool instanceof Pool)) {
			logError(node, "POOLBONUS: \"" + fromID + "\" is not the name of a stat, or else isn't a Pool");
			return false;
		}
		values = otherPool.getItems().map(o => [o.title, o.value]);
	} else if (value === undefined) {
		let Items = Array.from($a("Item", node));
		values = [];
		if(!Items.every(function(item) {
			var atts = parseAttributesToObject(node),
				title = atts.title,
				value = atts.value;
			if(value === undefined) {
				value = item.textContent.trim();
			}
			if(!value) {
				logError(node, "POOLBONUS: Item has no value parameter or text content");
				return false;
			}
			values.push([title, value]);
			return true;
		})) {
			return false;
		}
	} else {
		let sep = atts.separator || pool.get("separator") || ",";
		values = value.split(sep).map(v => [v, v]);
	}
	if(values.length === 0) {
		logError(node, "POOLBONUS: No valid values found");
		return false;
	}
	values.forEach(function(vs) {
		var id = vs[0] || vs[1],
			v = vs[1];
		pool.addItem(id, v, false);
		$RPG.current.character.noteBonus(method, undo, pool, id);
	});
	return {
		type: undo,
		pool: pool,
		values: values,
		isChoice: false
	};
}


//<PoolBonusChoice to="miscEffects" title="Choose an environment">
//  <Item title="hot climates" value="You treat hot climates as one step less severe" />
//  <Item title="cold climates" value="You treat cold climates as one step less severe" />
//</PoolBonusChoice>
//<PoolBonusChoice to="creatureSubtypes" value="human,elf" choices="1" title="Choose your primary heritage" />
// parsePoolBonusChoice(objectNode, objectParentNode) => false || object
// Logs error and returns false if parameters missing, stat not found, etc
// Otherwise, returns object:
//  o.type = "PoolBonusChice"
//  o.pool = objectPool
//  o.title = string describing the choice(s) presented, such as "Choose two of the skills below to learn"
//  o.values = array of possible values, each an array of "title" and "value"
//  o.choices = undefined || string representing the number of options that need to be selected
//  o.isChoice = true
export function parsePoolBonusChoice(node, parentNode, method) {
	var atts = parseAttributesToObject(node),
		value = atts.value,
		toPool = atts.to,
		title = atts.title,
		choices = atts.choices,
		pool, values;
	if (toPool === undefined || choices === undefined) {
		logError(node, "POOLBONUSCHOICE: missing required \"to\" and/or \"choices\" parameter");
		return false;
	} else if ((pool = $RPG.current.character.getStat(toPool)) === undefined || !(pool instanceof Pool)) {
	//} else if ((pool = BasicIdObject.getById(toPool)) === undefined || !(pool instanceof Pool)) {
		logError(node, "POOLBONUSCHOICE: \"" + toPool + "\" is not the name of a stat, or else isn't a Pool");
		return false;
	} else if (value === undefined) {
		let Items = Array.from($a("Item", node));
		values = [];
		if(!Items.every(function(item) {
			var atts = parseAttributesToObject(item),
				title = atts.title,
				value = atts.value;
			if(value === undefined) {
				value = item.textContent.trim();
			}
			if(!value) {
				logError(node, "POOLBONUSCHOICE: Item has no value parameter or text content");
				return false;
			}
			values.push([title || value, value]);
			return true;
		})) {
			return false;
		}
	} else {
		let sep = atts.separator || pool.get("separator") || ",";
		values = value.split(sep).map(v => [v, v]);
	}
	if(values.length === 0) {
		logError(node, "POOLBONUSCHOICE: No valid values found");
		return false;
	}
	return {
		type: "PoolBonusChoice",
		pool: pool,
		title: title,
		values: values,
		choices: choices,
		method: method,
		isChoice: true
	};
}


//<PoolBonusSelect to="languages" value="Common,Dwarven" />
// parsePoolBonusSelect(objectNode, objectParentNode) => false || object
// Logs error and returns false if parameters missing, stat not found, etc
// Otherwise, adds selection to pool, returns object:
//  o.type = "PoolBonusSelect"
//  o.pool = objectPool
//  o.values = array of stringTitles
//  o.isChoice = false
export function parsePoolBonusSelect(node, parentNode, method) {
	var atts = parseAttributesToObject(node),
		value = atts.value,
		toPool = atts.to,
		map = new Map(),
		undo = "PoolSelection",
		values, pool;
	if (toPool === undefined) {
		logError(node, "POOLBONUSSELECT: missing required \"to\" parameter");
		return false;
	} else if ((pool = $RPG.current.character.getStat(toPool)) === undefined || !(pool instanceof Pool)) {
	//} else if ((pool = BasicIdObject.getById(toPool)) === undefined || !(pool instanceof Pool)) {
		logError(node, "POOLBONUSSELECT: \"" + toPool + "\" is not the name of a stat, or else isn't a Pool");
		return false;
	} else if (value === undefined) {
		logError(node, "POOLBONUSSELECT: missing required \"to\" parameter");
		return false;
	} else {
		let sep = atts.separator || pool.get("separator") || ",";
		values = value.split(sep);
	}
	if(values.length === 0) {
		logError(node, "POOLBONUSSELECT: No valid values found");
		return false;
	} else if (!values.every(function(item) {
		var v = pool.getItem(item);
		if(v === undefined) {
			logError(node, "POOLBONUSSELECT ITEM: Could not find an item titled \"" + item + "\"");
			return false;
		}
		map.set(item, v.selected);
		return true;
	})) {
		return false;
	}
	map.forEach(function(sel, val) {
		$RPG.current.character.noteBonus(method, undo, pool, val, sel);
		pool.addSelection(val);
	});
	return {
		type: undo,
		pool: pool,
		values: values,
		isChoice: false
	};
}


// [objectStat, ...], integerChoices, stringTagName, nodeWrapper
export function appendSelectOrInputFromTags(stats, choices, tagName, wrapper) {
	var output = [], d = wrapper.dataset;
	if(choices === 1) {
		// Use a simple <select> for single-option choices
		let sel = $e("select");
		stats.forEach(function(s) {
			var id = s.id,
				title = s.get("title") || id,
				opt = $ea("option", {value: id}, title);
			sel.append(opt);
		});
		wrapper.append(sel);
		d.calculator = tagName + "Select";
	} else {
		// Use checkboxes for multi-option choices
		stats.forEach(function(s) {
			var id = s.id,
				title = s.get("title") || id,
				label = $e("label", title),
				box = $ea("input", {value: id, type: "checkbox"});
			label.prepend(box);
			wrapper.append(label);
		});
		d.calculator = tagName + "Input";
		wrapper.classList.add("chooserWithInputs");
	}
}


// [[stringTitle, anyValue], ...], integerChoices, stringTagName, nodeWrapper
export function appendSelectOrInputFromPairedValues(values, choices, tagName, wrapper) {
	var output = [], d = wrapper.dataset;
	if(choices <= 1) {
		// Use a simple <select> for single-option choices
		let sel = $ec("select");
		values.forEach(function(v) {
			var [title, value] = v,
				opt = $ea("option", {value: value}, title);
			sel.append(opt);
		});
		wrapper.append(sel);
		d.calculator = tagName + "Select";
	} else {
		// Use checkboxes for multi-option choices
		values.forEach(function(v) {
			var [title, value] = v,
				label = $e("label", title),
				box = $ea("input", {value: value, type: "checkbox"});
			box.dataset.title = title;
			label.prepend(box);
			wrapper.append(label);
		});
		d.calculator = tagName + "Input";
		wrapper.classList.add("chooserWithInputs");
	}
}


// Returns FALSE, an HTML node, or an ARRAY of HTML nodes
export function getBonusChoiceHTML(o) {
	var stats = o.stats,
		title = o.title,
		p = $e("p", title),
		tagName = "bonusChoice",
		value = Int.converter(o.value) || 1,
		choices = Int.converter(o.choices) || 1,
		wrapper = $ec("div", ["chooser", tagName]),
		d = wrapper.dataset;
	d.value = value;
	d.choices = choices;
	d.method = o.method;
	wrapper.append(p);
	appendSelectOrInputFromTags(stats, choices, tagName, wrapper);
	return wrapper;
}


// Returns FALSE, an HTML node, or an ARRAY of HTML nodes
export function getPoolBonusChoiceHTML(o) {
	var values = o.values,
		pool = o.pool,
		title = o.title,
		p = $e("p", title),
		tagName = "poolBonusChoice",
		choices = Int.converter(o.choices) || 1,
		wrapper = $ec("div", ["chooser", tagName]),
		d = wrapper.dataset;
	d.pool = pool.id;
	d.choices = choices;
	d.method = o.method;
	wrapper.append(p);
	appendSelectOrInputFromPairedValues(values, choices, tagName, wrapper);
	return wrapper;
}






$RPG.ADD("bundles", {
	TagHandlers: {
		Bonus: parseBonus,
		BonusChoice: parseBonusChoice,
		Notation: parseNotation,
		PoolBonus: parsePoolBonus,
		PoolBonusSelect: parsePoolBonusSelect,
		PoolBonusChoice: parsePoolBonusChoice
	},
	//$RPG.bundles.bundlePreloaders handlers should return either FALSE, an HTML node, or an ARRAY of HTML nodes
	bundlePreloaders: {
		BonusChoice: getBonusChoiceHTML,
		PoolBonusChoice: getPoolBonusChoiceHTML
	},
	previousBonuses: new Map(),
	choicesToBeMade: []
});
