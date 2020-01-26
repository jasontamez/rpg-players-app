import { IntBonusable, BasicStat } from "./stats-module01.js";


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

export var exports = [
	["type", "PfSize", PfSize],
	["type", "PfSpells", PfSpells]
];
