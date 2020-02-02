import { IntBonusable, BasicStat, MultiStat, BasicIdObject, SpecialGrabber, StatReference, SelfReference, TF, Formula } from "./stats-module01.js";
import { logErrorNode as logError, parseAttributesToObject } from "./parsing-logging.js"


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
	constructor(id, parent, node, atts) {
		super(id, parent, node, atts);
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
//     attributes should include maxSpellLevel, or else it's set to 9
//   o.spells is a Map with keys from 0..maxSpellLevel, each containing an
//     empty Map
export class PfSpells extends BasicStat {
	constructor(id, parent, node, atts) {
		var max, s = 0, map = new Map();
		super(id, parent, node, atts);
		max = this.atts.get("maxSpellLevel") || 9;
		max = parseInt(Number(max));
		this.atts.set("maxSpellLevel", max);
		while(s <= max) {
			map.set(s, new Map());
			s++;
		}
		this.spells = map;
	}
}
PfSpells.prototype.type = PfSpells;


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
	constructor(id, parent, node) {
		super(id, parent, node, [["startingValue", 0], ["minValue", 0]]);
		this.classSkillMarkings = [];
		this.rankBonusesLimited = new Map();
		this.rankBonusesUnlimited = new Map();
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
				v = super.get(prop, context);
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
	getModifiedValue(context = this.defaultContext) {
		// fetch markings and modified value (stepValue is not needed)
		var cs = this.classSkillMarkings.slice(),
			amount = super.getModifiedValue(context),
			v = this.get("value");
		// check if we have marks and see if raw value (ranks) are at least 1
		if(cs.length > 0 && v > 0) {
			// See if we have more true markings than false
			let test = cs.reduce( (total, v) => total + (v[1] ? 1 : 0), 0);
			// If so, add three!
			if(test > 0) {
				amount += 3;
			}
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
	markClassSkill(id, tf) {
		var cs = this.classSkillMarkings;
		tf = TF.converter(tf);
		if(cs.every(function(pair, i) {
			var [n, v] = pair;
			if(n === id) {
				cs[i][1] = tf;
				return false;
			}
			return true;
		})) {
			// Did not find a previously-existing value maching id.
			cs.push([id, tf]);
		}
		return cs;
	}
	removeClassSkillMark(id) {
		var cs = this.classSkillMarkings;
		if(cs.every(function(pair, i) {
			var [n, v] = pair;
			if(n === id) {
				let front = cs.slice(0, i),
					back = cs.slice(i+1);
				this.classSkillMarkings = front.concat(back);
				return false;
			}
			return true;
		})) {
			// Did not find a previously-existing value matching id.
			return false;
		}
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
		value = mark ? true : false;
	if(id === undefined) {
		return logError(node, "PFCSKILL: missing required \"id\" parameter");
	} else if(mark === undefined && unmark === undefined) {
		return logError(node, "PFCSKILL: missing required \"mark\" or \"unmark\" parameter");
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
	}
	skill.markClassSkill(id, value);
}


// Handling  <BonusPfSkillRank> tags
export function parseBonusPfSkillRank(node, parentNode, parentTag) {
	//<BonusPfSkillRank to="Sense Motive" fromId="level" />
	var atts = parseAttributesToObject(node),
		target = atts.to,
		formula = atts.formula,
		fromID = atts.getFromId,
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
		return logError(node, "BONUSPFSKILLRANK: missing required \"value\", \"getFromId\" or \"formula\" parameter");
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

export const exports = [
	["type", "PfSize", PfSize],
	["type", "PfSpells", PfSpells],
	["type", "PfSkill", PfSkill],
	["StatTagHandlers", "PfCSkill", parsePfCSkill],

					// should the above be a bundletaghandler? ////////////////////////////////////////////////


	["BundleTagHandlers", "BonusPfSkillRank", parseBonusPfSkillRank],
	["BundleTagHandlers", "BonusPfCSkillChoice", parsePfCSkillChoice]
];
