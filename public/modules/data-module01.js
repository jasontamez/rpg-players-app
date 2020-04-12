// Import parsing and logging
import { logErrorNode as logError, logErrorText } from "./parsing-logging.js";

var $RPG = window["$RPG"];



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
	undoBonusMethods: {
		Bonus: undoBonus,
		Notation: undoNotation,
		PoolItem: undoPoolItem,
		SetValue: undoSetValue,
		PoolSelection: undoPoolSelection,
		emptyPool: emptyPool
	}
});
