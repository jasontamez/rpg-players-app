import { IntBonusable, BasicStat, MultiStat, BasicIdObject, SpecialGrabber, StatReference, SelfReference, TF, Formula } from "./stats-module01.js";
import { logErrorNode as logError, parseAttributesToObject } from "./parsing-logging.js"

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
			switch(att) {
				case "class_skills":
					att.forEach(this.markClassSkill(...att));
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
	addBonusRanks(title, value, limited = true) {
		var prop = limited ? "L" : "Unl";
		return this["rankBonuses" + prop + "imited"].set(title, value);
	}
	removeBonusRanks(title, limited) {
		var prop = limited ? "L" : "Unl";
		return this["rankBonuses" + prop + "imited"].delete(title);
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
			newSources = this.get("sources");
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
export function parsePfCSkill(node, parentNode, parentTag) {
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
}


// Handling <BonusPfSkillRank> tags
export function parseBonusPfSkillRank(node, parentNode, parentTag) {
	//<BonusPfSkillRank to="Sense Motive" fromId="level" />
	var atts = parseAttributesToObject(node),
		target = atts.to,
		formula = atts.formula,
		fromID = atts.fromId,
		value = atts.value,
		limited = !TF.converter(atts.unlimited),
		att, nombre, tag;
	if(target === undefined) {
		return logError(node, "BONUSPFSKILLRANK: missing required \"to\" parameter");
	}
	target = BasicIdObject.getById(target);
	if(!(target instanceof PfSkill)) {
		return logError(node, "BONUSPFSKILLRANK: \"" + target + "\" is not a skill or does not exist");
	} else if(value === undefined && fromID === undefined && formula === undefined) {
		return logError(node, "BONUSPFSKILLRANK: missing required \"value\", \"fromId\" or \"formula\" parameter");
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
			return logError(node, "BONUSPFSKILLRANK: formula \"" + formula + "\" is not defined");
		}
	} else if(value !== undefined) {
		tag = target.converter(value);
	} else {
		delete atts.fromId;
		if(fromID === "this") {
			//getReference(fromID, property, parent, node, atts)
			tag = SelfReference.getReference(att, parentTag, node, atts);
		} else {
			tag = StatReference.getReference(fromID, att, parentTag, node, atts);
		}
	}
	target.addBonusRanks(nombre, tag, limited);
}


// <PfCSkillChoice>
function parsePfCSkillChoice() {
	
}

//export const exports = [
//	["type", "PfSize", PfSize],
//	["type", "PfSpells", PfSpells],
//	["type", "PfSkill", PfSkill],
//	["StatTagHandlers", "PfCSkill", parsePfCSkill],
//
//					// should the above be a bundletaghandler? ////////////////////////////////////////////////
//
//
//	["BundleTagHandlers", "BonusPfSkillRank", parseBonusPfSkillRank],
//	["BundleTagHandlers", "BonusPfCSkillChoice", parsePfCSkillChoice]
//];
export const exports = [];

$RPG.ADD("stats", "type", "PfSize", PfSize);
$RPG.ADD("stats", "type", "PfSpells", PfSpells);
$RPG.ADD("stats", "type", "PfSkill", PfSkill);
$RPG.ADD("stats", "StatTagHandlers", "PfCSkill", parsePfCSkill);
$RPG.ADD("stats", "BundleTagHandlers", "BonusPfSkillRank", parseBonusPfSkillRank);
$RPG.ADD("stats", "BundleTagHandlers", "BonusPfCSkillChoice", parsePfCSkillChoice);
