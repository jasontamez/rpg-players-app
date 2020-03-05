// Import parsing and logging
import { parseObjectToArray, parseAttributesToObject, parseIdAndAttributesToArray, logErrorNode as logError, logErrorText } from "./parsing-logging.js";

var $RPG = window["$RPG"],
	InformationObject = {};
$RPG.data = InformationObject;


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
	//getById
}

InformationObject.player = PlayerObject;
InformationObject.character = CharacterObject;

