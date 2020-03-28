// Import parsing and logging
import { parseObjectToArray, parseAttributesToObject, parseIdAndAttributesToArray, logErrorNode as logError, logErrorText } from "./parsing-logging.js";

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


function undoBonus(stat, nombre, type, notation) { //string
	return stat.removeBonus(nombre, type, notation);
}
function undoNotation(stat, note) { //null
	return stat.removeNotation(note);
}
function undoPoolItem(stat, item) { //Pool
	return stat.removeItem(item);
}
function undoSetValue(stat, oldValue) { //0
	return stat.set("value", oldValue);
}
function undoPoolSelection(stat, value, prevSelect) { //true
	if(!prevSelect) {
		return stat.removeSelection(value);
	}
	return null;
}
function emptyPool(stat) {
	return stat.empty();
}


$RPG.ADD("data", {
	player: PlayerObject,
	character: CharacterObject,
	undoBonusMethods: {
		Bonus: undoBonus,
		Notation: undoNotation,
		PoolItem: undoPoolItem,
		SetValue: undoSetValue,
		PoolSelection: undoPoolSelection,
		emptyPool: emptyPool
	}
});
