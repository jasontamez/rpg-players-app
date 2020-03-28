import { $ec, $e, $ea, $a } from "./dollar-sign-module.js";
import { IntBonusable, BasicStat, MultiStat, BasicIdObject, SpecialGrabber, StatReference, SelfReference, TF, Formula } from "./stats-module01.js";
import { logErrorNode as logError, parseAttributesToObject } from "./parsing-logging.js";
import { appendSelectOrInputFromTags } from './bundles-module01.js';

var $RPG = window["$RPG"];


// This stat represents the size of the character
//   o = new PfSize(stringID, parentTag || undefined, xmlNode, [attribute pairs])
// 0 - Fine (min value)
// 1 - Diminutive
// 2 - Tiny
// 3 - Small
// 4 - Medium (default starting value)
// 5 - Large
// 6 - Huge
// 7 - Gargantuan
// 8 - Colossal (max value)
//
// Assuming that value = 2
//   o.get("sizeName") => "Tiny"
//   o.get("sizeModifier") => 2
//   o.get("specialSizeModifier") => -2
//   o.get("flyModifier") => 6
//   o.get("stealthModifier") => 12
//   o.get("sizeModifierText") => "+2"
//   o.get("specialSizeModifierText") => "-2"
//   o.get("flyModifierText") => "+4"
//   o.get("stealthModifierText") => "+8"
//
// Assuming that value = 8
//   o.get("sizeName") => "Colossal"
//   o.get("sizeModifier") => -8
//   o.get("specialSizeModifier") => 8
//   o.get("flyModifier") => -8
//   o.get("stealthModifier") => -16
//   o.get("sizeModifierText") => "-8"
//   o.get("specialSizeModifierText") => "+8"
//   o.get("flyModifierText") => "-8"
//   o.get("stealthModifierText") => "-16"
export class PfSize extends IntBonusable {
	constructor(id, padre, node, atts) {
		super(id, padre, node, atts);
		this.set("minValue", 0);
		this.set("maxValue", 8);
		this.set("value", 4);
	}
	get(prop) {
		var v, run;
		switch(prop) {
			case "sizeName":
				run = ["Fine","Diminutive","Tiny","Small","Medium","Large","Huge","Gargantuan","Colossal"];
			case "sizeModifier":
				run = run || [8, 4, 2, 1, 0, -1, -2, -4, -8];
			case "specialSizeModifier":
				run = run || [-8, -4, -2, -1, 0, 1, 2, 4, 8];
				v = this.get("value");
				return run[v];
			case "flyModifier":
				v = 0 - (this.get("value") - 4);
				return v * 2;
			case "stealthModifier":
				return this.get("flyModifier") * 2;
			case "sizeModifierText":
			case "specialSizeModifierText":
			case "flyModifierText":
			case "stealthModifierText":
				v = this.get(prop.slice(0, -4));
				if(v < 0) {
					return v.toString();
				}
				return "+" + v.toString();
		}
		return super.get(prop);
	}
}
PfSize.prototype.type = PfSize;


// This stat holds information about spellcasting and spell-like abilities
//   o = new PfSpells(stringID, parentTag || undefined, xmlNode, [attribute pairs])
//     attributes should include the following:
//       maxSpellLevel, an integer, defaulting to 9
//       minSpellLevel, an integer, either 1 or 0 (the default)
//       spellcastingStat, a string representing the spellcaster's base stat, defaulting to INT
//   o.spells is a Map with keys from 0..maxSpellLevel, each containing an
//     empty Map
export class PfSpells extends BasicStat {
	constructor(id, padre, node, atts) {
		var map = new Map(),
			s, max, min, stat;
		super(id, padre, node, atts);
		// max spell level
		min = Number(this.atts.get("minSpellLevel")) ? 1 : 0;
		this.atts.set("minSpellLevel", min);
		// min spell level
		max = this.atts.get("maxSpellLevel") || 9;
		max = parseInt(Number(max));
		this.atts.set("maxSpellLevel", max);
		// populate this.spells in preparation for spells known
		s = min;
		while(s <= max) {
			map.set(s, new Map());
			s++;
		}
		this.spells = map;
		// spellcasting stat
		stat = BasicIdObject.getById(this.atts.get("spellcastingStat")) || BasicIdObject.getById("INT");
		this.atts.set("spellcastingStat", stat);
		// spellcasting slots
	}
}
PfSpells.prototype.type = PfSpells;

// 1: - - - 0 1 1 1 1 2 2 2 2 3 3 3 3 4 4 4 4 : ranger and paladin 1-4
//    - - - - - - 0 1 1 1 1 2 2 2 2 3 3 3 3 4
//    - - - - - - - - - 0 1 1 1 1 2 2 2 2 3 3
// 4: - - - - - - - - - - - - 0 1 1 1 1 2 2 3

// 0: 3 4 4 4 4 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 : magus 0-6
//    1 2 3 3 4 4 4 4 5 5 5 5 5 5 5 5 5 5 5 5 : bard (infinite 0-level spells), inquisitor and summoner 1-6
//    - - - 1 2 3 3 4 4 4 4 5 5 5 5 5 5 5 5 5
// 5: - - - - - - - - - - - - 1 2 3 3 4 4 5 5
// 6: - - - - - - - - - - - - - - - 1 2 3 4 5

// 1: 3 4 5 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 : oracle and sorcerer 1-9 (infinite 0-level uses)
//    - - - 3 4 5 6 6 6 6 6 6 6 6 6 6 6 6 6 6
//    - - - - - 3 4 5 6 6 6 6 6 6 6 6 6 6 6 6
// 9: - - - - - - - - - - - - - - - - - 3 4 6

// 0: 3 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 : cleric, witch, druid and wizard 0-9
//    1 2 2 3 3 3 4 4 4 4 4 4 4 4 4 4 4 4 4 4   (note that cleric gets bonus domain spell per spell level 1-9)
//    - - 1 2 2 3 3 3 4 4 4 4 4 4 4 4 4 4 4 4
// 8: - - - - - - - - - - - - - - 1 2 2 3 3 4
// 9: - - - - - - - - - - - - - - - - 1 2 3 4

//Level 	0th 	1st 	2nd 	3rd 	4th 	5th 	6th Bard spells known
//1st 	4 	2 	— 	— 	— 	— 	—
//2nd 	5 	3 	— 	— 	— 	— 	—
//3rd 	6 	4 	— 	— 	— 	— 	—
//4th 	6 	4 	2 	— 	— 	— 	—
//5th 	6 	4 	3 	— 	— 	— 	—
//6th 	6 	4 	4 	— 	— 	— 	—
//7th 	6 	5 	4 	2 	— 	— 	—
//8th 	6 	5 	4 	3 	— 	— 	—
//9th 	6 	5 	4 	4 	— 	— 	—
//10th 	6 	5 	5 	4 	2 	— 	—
//11th 	6 	6 	5 	4 	3 	— 	—
//12th 	6 	6 	5 	4 	4 	— 	—
//13th 	6 	6 	5 	5 	4 	2 	—
//14th 	6 	6 	6 	5 	4 	3 	—
//15th 	6 	6 	6 	5 	4 	4 	—
//16th 	6 	6 	6 	5 	5 	4 	2
//17th 	6 	6 	6 	6 	5 	4 	3
//18th 	6 	6 	6 	6 	5 	4 	4
//19th 	6 	6 	6 	6 	5 	5 	4
//20th 	6 	6 	6 	6 	6 	5 	5

// This stat holds information about skills, specifically handling class skills
//   o = new PfSpkill(stringID, parentTag || undefined, xmlNode)
//     : startingValue is 0
//     : minValue is 0
//     : maxValue is equal to the character's Level
//   o.addBonusRanks("unique_name", value, boolean true or false)
//   o.removeBonusRanks("unique_name", boolean true or false)
//     modifies ranks based on the existing rules (true) or regardless of the rules (false)
//   o.markClassSkill("unique_name_of_class_skill_granter", boolean true or false)
//   o.removeClassSkillMark("unique_name_of_class_skill_granter")
//     the final mark given to the skill will determine if it is a class skill (true) or not (false)
export class PfSkill extends IntBonusable {
	constructor(id, padre, node, atts = []) {
		//var siblings = PfSkill.getSkillsBySource(source) || [];
		super(id, padre, node, [["startingValue", 0], ["minValue", 0], ["source", []]]);
		this.classSkillMarkings = [];
		this.rankBonusesLimited = new Map();
		this.rankBonusesUnlimited = new Map();
		//siblings.push(this);
		//PfSkill.sources.set(source, siblings);
		// If the parent is a multistat, it may have preset class skill [un]markings: process any
		atts.forEach(function(att) {
			var n = att.shift(), v = att.shift();
			switch(n) {
				case "is_class_skill":
					this.markClassSkill("started as class skill", v, true);
			}
		});
	}
	get(prop, context = this.defaultContext) {
		var v;
		switch(prop) {
			case "maxValue":
				return BasicIdObject.getById("Level").get("value");
			case "minValue":
				return 0;
			case "stepValue":
				return 1;
			case "value":
				// Calculate bonus ranks
				v = this.atts.get("value");
				// Add ranks that count against the normal limits
				this.rankBonusesLimited.forEach(function(value) {
					if(value instanceof SpecialGrabber) {
						v += value.grabValue(context);
					} else {
						v += value;
					}
				});
				v = Math.min(0, Math.max(v, BasicIdObject.getById("Level").get("value")));
				// Add ranks that ignore the normal limits
				this.rankBonusesUnlimited.forEach(function(value) {
					if(value instanceof SpecialGrabber) {
						v += value.grabValue(context);
					} else {
						v += value;
					}
				});
				break;
			default:
				// Get normal value
				v = this.atts.get(prop, context);
		}
		return v;
	}
	set(prop, v) {
		var min, max, num;
		//console.log(this.id + " " + prop + " = " + v);
		switch(prop) {
			case "value":
				max = BasicIdObject.getById("Level").get("value");
				num = this.type.converter(v);
				if(num < 0) {
					num = 0;
				} else if (num > max) {
					num = max;
				}
				v = num;
				break;
			case "minValue":
			case "maxValue":
			case "stepValue":
				// Not needed
				return null;
			case "startingValue":
				v = this.type.converter(v);
				break;
		}
		return this.atts.set(prop, v);
	}
	isClassSkill() {
		// See if we have more true markings than false
		var source = [],
			cs = this.classSkillMarkings.slice(),
			test = cs.reduce(function(total, v) {
				if(v[2]) {
					source.push(v[1]);
					return total + 1;
				}
				return total;
			}, 0);
		this.set("source", source);
		return test > 0;
	}
	getModifiedValue(context = this.defaultContext) {
		// call isClassSkill and fetch value and modified value (stepValue is not needed)
		var isClassSkill = this.isClassSkill(),
			amount = super.getModifiedValue(context),
			v = this.get("value");
		// check if we have marks and see if raw value (ranks) are at least 1
		if(v > 0 && isClassSkill) {
			// If so, add three!
			amount += 3;
		}
		return amount;
	}
	addBonusRanks(title, value, limited = true, cn = "bonus rank(s)") {
		var prop = "rankBonuses" + (limited ? "L" : "Unl") + "imited";
		return this[prop].set(title, value);
	}
	removeBonusRanks(title, limited) {
		var prop = "rankBonuses" + (limited ? "L" : "Unl") + "imited";
		return this[prop].delete(title);
	}
	markClassSkill(id, source, tf) {
		var cs = this.classSkillMarkings,
			newSources = [];
		tf = TF.converter(tf);
		// Check to see if this ID was used before, and therefore needs to be overwritten
		if(cs.every(function(trio, i) {
			var [n, s, v] = trio;
			// Found a match!
			if(n === id) {
				// Set to new values.
				cs[i] = [n, source, tf];
				// Compile new array of sources
				cs.forEach(function(trio) {
					if(trio[2]) {
						newSources.push(trio[1]);
					}
				});
				// Return false, we don't need to search any farther
				return false;
			}
			// Keep searching
			return true;
		})) {
			// Did not find a previously-existing value maching id
			// Add it
			cs.push([id, source, tf]);
			// Get array of sources
			newSources = this.get("source");
			if(tf) {
				// If this is a new class skill marking, then add its source
				newSources.push(source);
			}
		}
		// Set (possibly new) array of sources
		this.set("source", newSources);
		return cs;
	}
	removeClassSkillMark(id) {
		var cs = this.classSkillMarkings;
		// Find id
		if(cs.every(function(trio, i) {
			var [n, s, v] = trio;
			if(n === id) {
				// Found it
				let front = cs.slice(0, i),
					back = cs.slice(i+1),
					newSources = [];
				// Store new list of class skill markings, minus this deleted one
				cs = front.concat(back);
				this.classSkillMarkings = cs;
				// Compile new array of sources
				cs.forEach(function(trio) {
					if(trio[2]) {
						newSources.push(trio[1]);
					}
				});
				// Set (possibly new) array of sources
				this.set("source", newSources);
				return false;
			}
			return true;
		})) {
			// Did not find a previously-existing value matching id
			return false;
		}
		// Found and deleted: return true
		return true;
	}
}
PfSkill.prototype.type = PfSkill;
PfSkill.converter = IntBonusable.converter;


// Handling <PfCSkill> tags
export function parsePfCSkill(node, parentNode, method) {
	var skill,
		atts = parseAttributesToObject(node),
		id = atts.id,
		mark = atts.mark,
		unmark = atts.unmark,
		source = atts.source,
		value = mark ? true : false;
	if(id === undefined) {
		return logError(node, "PFCSKILL: missing required \"id\" parameter");
	} else if(mark === undefined && unmark === undefined) {
		return logError(node, "PFCSKILL: missing required \"mark\" or \"unmark\" parameter");
	} else if(source === undefined) {
		return logError(node, "PFCSKILL: missing required \"source\" parameter");
	}
	skill = BasicIdObject.getById(mark || unmark);
	if(!(skill instanceof PfSkill)) {
		let m,
			multi = atts.multi,
			sub = atts.sub;
		// Possibly a multistat
		if(multi !== undefined && sub !== undefined && (m = MultiStat.getById(multi)) !== undefined) {
			// Yup, multistat
			// Make into a new stat
			skill = m.makeStatBasic(sub);
		} else {
			return logError(node, "PFCSKILL: \"" + (mark || unmark) + "\" is not a Skill object");
		}
	} else if (skill instanceof MultiStat) {
		let cSkill = skill.get("class_skills") || [];
		cSkill.push([id, source, value]);
		skill.set("class_skills", cSkill);
		return null;
	}
	skill.markClassSkill(id, source, value);
	$RPG.current.character.noteBonus(method, "pfCSkill", skill, id);
	return {
		type: "BonusPfCSkill",
		stat: skill,
		name: id,
		isChoice: false
	};
}


// Handling <BonusPfSkillRank> tags
export function parseBonusPfSkillRank(node, parentNode, method) {
	//<BonusPfSkillRank to="Sense Motive" fromId="level" />
	var atts = parseAttributesToObject(node),
		target = atts.to,
		formula = atts.formula,
		fromID = atts.fromId,
		value = atts.value,
		limited = !TF.converter(atts.unlimited),
		att, nombre, tag, stat;
	if(target === undefined) {
		logError(node, "BONUSPFSKILLRANK: missing required \"to\" parameter");
		return null;
	}
	stat = BasicIdObject.getById(target);
	if(!(stat instanceof PfSkill)) {
		logError(node, "BONUSPFSKILLRANK: \"" + target + "\" is not a skill or does not exist");
		return null;
	} else if(value === undefined && fromID === undefined && formula === undefined) {
		logError(node, "BONUSPFSKILLRANK: missing required \"value\", \"fromId\" or \"formula\" parameter");
		return null;
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
	if(formula !== undefined) {
		tag = Formula.getName(formula);
		if(tag === undefined) {
			logError(node, "BONUSPFSKILLRANK: formula \"" + formula + "\" is not defined");
			return null;
		}
	} else if(value !== undefined) {
		tag = stat.converter(value);
	} else {
		delete atts.fromId;
		if(fromID === "this") {
			//getReference(fromID, property, parent, node, atts)
			tag = SelfReference.getReference(att, undefined, node, atts);
		} else {
			tag = StatReference.getReference(fromID, att, undefined, node, atts);
		}
	}
	stat.addBonusRanks(nombre, tag, limited);
	$RPG.current.character.noteBonus(method, "rankBonuses", stat, nombre, limited);
	return {
		type: "BonusPfSkillRank",
		stat: stat,
		name: nombre,
		isChoice: false
	};
}


//<PfCSkillChoice id="Human Fey Magic" source="racial trait" marking="true"
//skills="Acrobatics,Bluff,Climb,Diplomacy,Disguise,Escape Artist,Fly,Knowledge (nature),Perception,Sense Motive,Sleight of Hand,Stealth,Swim,Use Magic Device"
//multiPickAny="perform_skills" choice="2"
//multiSpecifics="craft_skills,jewelry,weapons|profession_skills,barrister,sailor"/>

// parsePfCSkillChoice(objectNode, objectParentNode, method) => null || object
// Logs error and returns null if parameters missing, stat not found, etc
// Otherwise, returns object:
//  o.type = "PfCSkillChoice"
//  o.title = string describing the choice(s) presented, such as "Choose two of the skills below to learn"
//  o.id = stringID
//  o.source = string representing the source of the class skill
//  o.skills = array of possible values, each one an array of [objectSkill, stringID]
//  o.multis = array of arrays, each one containing a MultiStat object and an array of strings indicating sub-stats of that multi that may or may not exist
//  o.multisAny = array of MultiStat objects, of which "any" sub-stat can be chosen
//  o.marking = "true" || "false"
//  o.choices = integer representing the number of options that need to be selected
//  o.method = string Identifier for undoing bonuses
//  o.isChoice = true
function parsePfCSkillChoice(node, parentNode, method) {
	var atts = parseAttributesToObject(node),
		id = atts.id,
		marking = atts.marking,
		skillStr = atts.skills,
		multiStrAny = atts.multiPickAny,
		multiStr = atts.multiSpecifics,
		possibilities = [skillStr, multiStrAny, multiStr],
		choices = IntBonusable.converter(atts.choices),
		sep = atts.separator || ",",
		sep2 = atts.separatorMulti || "|",
		skills = [],
		multisAny = [],
		multis = [],
		source = atts.source,
		CHAR = $RPG.current.character;
	if(id === undefined) {
		logError(node, "PFCSKILLCHOICE: missing required \"id\" parameter");
		return null;
	} else if(possibilities.every(p => p === undefined)) {
		logError(node, "PFCSKILLCHOICE: the tag must have at least one of the following: \"skills\", \"multis\" or \"multiPickAny\"");
		return null;
	} else if(source === undefined) {
		logError(node, "PFCSKILLCHOICE: missing required \"source\" parameter");
		return null;
	} else if(isNaN(choices) || choices <= 0) {
		logError(node, "PFCSKILLCHOICE: missing, negative or non-numeric \"choices\" parameter");
		return null;
	}
	if(skillStr && !skillStr.split(sep).every(function(s) {
		var skill = CHAR.getStat(s);
		if(!(skill instanceof PfSkill)) {
			logError(node, "PFSKILLCHOICE: \"" + s + "\" is not a skill");
			return false;
		}
		skills.push(skill);
		return true;
	})) {
		// At least one skill was bad.
		return null;
	}
	if(multiStrAny && !multiStrAny.split(sep).every(function(s) {
		var skill = CHAR.getMultiStat(s);
		if(skill === undefined || (skill.type !== PfSkill && !(skill.type instanceof PfSkill))) {
			logError(node, "PFSKILLCHOICE: \"" + s + "\" is not a MultiStat of a skill");
			return false;
		}
		multisAny.push(skill);
		return true;
	})) {
		// At least one skill was bad.
		return null;
	}
	if(multiStr && !multiStr.split(sep2).every(function(m) {
		var group = m.split(sep),
			s = group.shift(),
			skill = CHAR.getMultiStat(s);
		if(skill === undefined || (skill.type !== PfSkill && !(skill.type instanceof PfSkill))) {
			logError(node, "PFSKILLCHOICE: \"" + s + "\" is not a MultiStat of a skill");
			return false;
		}
		multis.push([skill, group]);
		return true;
	})) {
		// At least one skill was bad.
		return null;
	}
	return {
		type: "PfCSkillChoice",
		title: "Choose two skills: these will always be considered Class Skills for you",
		id: id,
		source: source,
		skills: skills,
		multis: multis,
		multisAny: multisAny,
		marking: marking,
		choices: choices,
		method: method,
		isChoice: true
	};
}

//  o.type = "PfCSkillChoice"
//  o.title = string describing the choice(s) presented, such as "Choose two of the skills below to learn"
//  o.id = stringID
//  o.source = string representing the source of the class skill
//  o.skills = array of possible values, each one an array of [objectSkill, stringID]
//  o.multis = array of arrays, each one containing a MultiStat object and an array of strings indicating sub-stats of that multi that may or may not exist
//  o.multisAny = array of MultiStat objects, of which "any" sub-stat can be chosen
//  o.marking = "true" || "false"
//  o.choices = integer representing the number of options that need to be selected
//  o.method = string Identifier for undoing bonuses
//  o.isChoice = true
function getPfCSkillChoiceHTML(o) {
	console.log(o);
	var title = o.title,
		id = o.id,
		source = o.source,
		skills = o.skills.slice(),
		multis = o.multis,
		multisAny = o.multisAny,
		marking = o.marking,
		choices = o.choices,
		skillsToBe = [],
		skillsAny = [],
		tagName = "pfCSkillChoice",
		wrapper = $ec("div", ["chooser", tagName]),
		d = wrapper.dataset,
		p = $e("p", o.title);
	// Save ID, source, method and marking
	d.tagId = id;
	d.source = source;
	d.marking = marking,
	d.method = o.method;
	d.choices = choices.toString();
	// Begin HTML
	wrapper.append(p);
	// Look for specific multis
	// Transform 'multis' into a Map, too
	if(multis.length > 0) {
		let mm = multis.slice();
		multis = new Map();
		// mm is an array of arrays: [objectMultiStat, "substat1", "substat2" ...]
		while(mm.length > 0) {
			let m = mm.shift(),
				stat = m.shift(),
				subs = m.shift().slice(),
				toBe = [];
			// Look for each substat
			subs.forEach(function(subname) {
				var sub = stat.getChild(subname);
				if(sub === undefined) {
					// Does not yet exist: add to an array
					toBe.push(subname);
				} else {
					// Already exists: add into 'skills'
					skills.push(sub);
				}
			});
			// Save array of nonexistent substats to multis, using the MultiStat as key
			if(toBe.length > 0) {
				toBe.sort(function(a, b) {
					var x = a.toLowerCase(), y = b.toLowerCase();
					return x > y ? 1 : (x < y ? -1 : 0);
				});
				multis.set(stat, toBe);
			}
		}
	} else {
		multis = new Map();
	}
	// Make more HTML
	if(multisAny.length === 0 && multis.size === 0) {
		// If we only have regular skills, then follow the regular process
		appendSelectOrInputFromTags(sortSkills(skills), choices, tagName, wrapper);
	} else {
		// We have MultiStats to deal with
		let m = Array.from(multis.keys()),
			a = multisAny.slice();
		// Go through every MultiStat that can be "any" substat
		a.forEach(function(ms) {
			// Add it to the regular 'multis' Map as "ANY"
			multis.set(ms, "ANY");
			// Add it to the skills array
			skills.push(ms);
			// Add to any substats to the skill array
			skills = skills.concat(Array.from(ms.inheritors.values()));
		});
		// Sort skills and multis by title into a Set (no dupes)
		skills = new Set(sortSkills(skills.concat(a, m)));
		// Make the HTML
		skills.forEach(function(skill) {
			// Reusable variables
			var test = multis.get(skill),
				id = skill.id,
				title = skill.get("title") || id,
				box = $ea("input", {value: id, type: "checkbox"});
			if(test === undefined) {
				// Normal skill
				let label = $e("label", title);
				label.prepend(box);
				wrapper.append(label);
			} else {
				// Multistat
				// <span class="multistatContainer">
				//   <label><input type="checkbox" value="[ID]" data-multi="ANY" data-which="[INT]">[TITLE]</label>
				//   &nbsp;(<input type="text" placeholder="[PLACEHOLDER]" data-multi="[ID]_[INT]" >)
				// </span>
				if (test === "ANY") {
					// "Any" stat
					let c = 0,
						ph = skill.get("placeholder") || "";
					// Add a blank input for every possible choice
					while(c < choices) {
						let label = $e("label", title),
							span = $ec("span", ["multistatContainer"]),
							bx = box.cloneNode(),
							dx = bx.dataset,
							i = $ea("input", {type: "text", placeholder: ph}),
							cs;
						c++;
						cs = c.toString();
						dx.multi = test;
						i.dataset.multi = id + "_" + cs;
						dx.which = cs;
						//
						//
						// Probably should $listen to [text] and check corresponding box if has a value
						//
						//
						label.prepend(bx);
						span.append(label, String.fromCharCode(160) + "(", i, ")"); // 160 = non-breaking space
						wrapper.append(span);
					}
				} else {
					// Nonexistent multistat substat
					// <label><input type="checkbox" value="[ID]" data-multi="[SUBSTAT]">[TITLE] ([SUBSTAT])</label>
					// test is an alphabetized array of possible substats
					test.forEach(function(substat) {
						var label = $e("label", skill.makeAtt("title", test)),
							bx = box.cloneNode();
						bx.dataset.multi = test;
						label.prepend(bx);
						wrapper.append(label);
					});
				}
			}
		});
	}
	return wrapper;
}


function calcPfSkillChoiceInput(chooser, cn) {
	// Container will have no. of choices
	var d = chooser.dataset,
		choices = IntBonusable.converter(d.choices) || 1,
		source = d.source,
		value = d.marking,
		id = d.tagId,
		c = 0,
		CHAR = $RPG.current.character;
	// Inputs should be checkboxes or radio buttons
	// Each will have its own stat as its value
	Array.from($a("input", chooser)).every(function(i) {
		var sk, skill;
		if(c >= choices) {
			return false;
		}
		sk = i.value;
		skill = CHAR.getStat(sk);
		if(skill === undefined) {
			logError(i, "Stat \"" + sk + "\" not found (data-stat)");
		} else if (!(skill instanceof PfSkill)) {
			logError(i, "Stat \"" + sk + "\" is not a Pathfinder skill");
		} else if (i.checked) {
			c++;
			skill.markClassSkill(id, source, value);
			CHAR.noteBonus(cn, "pfCSkill", skill, id);
		}
		return true;
	});
}


function calcPfSkillChoiceSelect(chooser, cn) {
	// Container will have no. of choices and the Pool object
	var d = chooser.dataset,
		choices = IntBonusable.converter(d.choices) || 1,
		source = d.source,
		value = d.marking,
		id = d.tagId,
		c = 0,
		CHAR = $RPG.current.character;
	// Only one selection per select
	// The chosen option will have its own stat as its value
	Array.from($a("select", chooser)).every(function(i) {
		var sk, skill;
		if(c >= choices) {
			return false;
		}
		sk = i.value;
		skill = CHAR.getStat(sk);
		if(skill === undefined) {
			logError(i, "Stat \"" + sk + "\" not found (data-stat)");
		} else if (!(skill instanceof PfSkill)) {
			logError(i, "Stat \"" + sk + "\" is not a Pathfinder skill");
		} else if (i.checked) {
			c++;
			skill.markClassSkill(id, source, value);
			CHAR.noteBonus(cn, "pfCSkill", skill, id);
		}
		return true;
	});
}


// objectSkill, stringID
function undoPfSkillChoice(skill, id) {
	skill.removeClassSkillMark(id);
}


// objectSkill, stringName, booleanLimited
function undoPfSkillRanks(skill, title, limited) {
	skill.removeBonusRanks(title, limited);
}


function sortSkills(stats) {
	stats.sort(function(a, b) {
		var x, y;
		if(a instanceof MultiStat) {
			x = a.makeAtt("title", "zzzzzzzzzzzzzzz");
		} else {
			x = a.get("title") || a.id;
		}
		if(b instanceof MultiStat) {
			y = b.makeAtt("title", "zzzzzzzzzzzzzzz");
		} else {
			y = b.get("title") || b.id;
		}
		x = x.toLowerCase();
		y = y.toLowerCase();
		return x > y ? 1 : (x < y ? -1 : 0);
	});
	return stats;
}




export const exports = [];

$RPG.ADD("stats", "type", "PfSize", PfSize);
$RPG.ADD("stats", "type", "PfSpells", PfSpells);
$RPG.ADD("stats", "type", "PfSkill", PfSkill);
$RPG.ADD("stats", "StatTagHandlers", "PfCSkill", parsePfCSkill);
$RPG.ADD("bundles", "TagHandlers", "BonusPfSkillRank", parseBonusPfSkillRank);
$RPG.ADD("bundles", "TagHandlers", "PfCSkill", parsePfCSkill);
$RPG.ADD("bundles", "TagHandlers", "PfCSkillChoice", parsePfCSkillChoice);
$RPG.ADD("bundles", "bundlePreloaders", "PfCSkillChoice", getPfCSkillChoiceHTML);

// What changes the HTML into character data? I can't remember.

$RPG.ADD("data", "undoBonusMethods", "rankBonuses", undoPfSkillRanks);
$RPG.ADD("data", "undoBonusMethods", "pfCSkill", undoPfSkillChoice);
