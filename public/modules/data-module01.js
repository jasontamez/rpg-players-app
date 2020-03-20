// Import parsing and logging
import { parseObjectToArray, parseAttributesToObject, parseIdAndAttributesToArray, logErrorNode as logError, logErrorText } from "./parsing-logging.js";
import { Pool } from "./stats-module01.js";

var $RPG = window["$RPG"];



// Define a class for character objects
//   o = new CharacterObject(objectPlayer, stringRuleset)
//   o.set("property", value)
//   o.get("property") => value
export class CharacterObject {
	constructor(player, characterID, ruleset) {
		this.player = player;
		this.id = characterID;
		this.ruleset = ruleset;
		this.data = new Map();
		this.stats = new Map();
		this.multistats = new Map();
		this.bonuses = new Map();
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
	noteBonus(id, nombre, stat, type, notation) {
		var holder = this.bonuses.get(id) || [];
		holder.push([nombre, stat, type, notation]);
		//holder.set(nombre, {stat: stat, type: type, note: notation});
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
				stat = arr.shift();
			switch(n) {
				case null:
					// Note
					return stat.removeNotation(arr.pop());
				case Pool:
					// Pool Item
					return stat.removeItem(arr.shift());
				case 0:
					// Directly setting a value
					return stat.set("value", arr.shift());
				case true:
					// Selecting a Pool value
					if(!arr.pop()) {
						stat.removeSelection(arr.shift());
					}
					return;
				default:
					if(n instanceof Object) {
						// Customized undo method
						let undo = $RPG.data.undoBonusMethods[n.undoMethod];
						if(undo === undefined) {
							logError(n, "Cannot undo \"" + n.undoMethod + "\"");
							return;
						}
						return undo(n, stat, arr);
					}
					// Regular bonus
					stat.removeBonus(n, arr.shift(), arr.shift());
			}
		});
		this.bonuses.delete(id);
		return true;
	}
	//getById?
}

// Define a class for player objects
//   TBD
export class PlayerObject {
	constructor(playerID) {
		// TBD
		this.characters = new Map();
		// .set(ruleset, characterID)
	}
	makeCharacter(ruleset) {
		// make an ID
		var id = "ID", char;
		char = new CharacterObject(this, id, ruleset);
		this.characters.set(id, char);
		return char;
	}
	getCharacter(id) {
		return this.characters.get(id);
	}
	//getById
}

$RPG.ADD("data", {
	player: PlayerObject,
	character: CharacterObject,
	undoBonusMethods: {}
});
