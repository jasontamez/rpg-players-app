import { $ea as $e } from "./dollar-sign-module.js";

// filler = list of nodes to insert into the element
// contents = where to insert those elements (or "ignore")
// atts = object

function templatePfRacialTraits(filler, contents, atts) {
	var div = $e("div", {}, "Racial Traits");
	div.append(...filler);
	return div;
}

function templatePfStats(filler, contents, atts) {
	var div = $e("div", {}, "Stats");
	div.append(...filler);
	return div;
}

function templatePfClassArchetypes(filler, contents, atts) {
	var div = $e("div", {}, "Class Archetypes");
	div.append(...filler);
	return div;
}

function templatePfClassChoices(filler, contents, atts) {
	var div = $e("div", {}, "Class Choice");
	div.append(...filler);
	return div;
}

function templatePfSkillsAdjust(filler, contents, atts) {
	var div = $e("div", {}, "Skills Adjust");
	div.append(...filler);
	return div;
}

function pfArchetypePicker(bundle) {

}


function pfArchetypeNamespace(bundle, item, atts) {

}


export const exports = [
	["pageTemplates", "PfRacialTraits", templatePfRacialTraits],
	["pageTemplates", "PfStats", templatePfStats],
	["pageTemplates", "PfClassArchetypes", templatePfClassArchetypes],
	["pageTemplates", "PfClassChoices", templatePfClassChoices],
	["pageTemplates", "PfSkillsAdjust", templatePfSkillsAdjust],
	["bundleHandlers", "PfArchetypePicker", pfArchetypePicker],
	["bundleHandlers", "PfNamespace", pfArchetypeNamespace]
];

//BasicPageObject.pageTemplates.PfRacialTraits = templatePfRacialTraits,
//BasicPageObject.pageTemplates.PfStats = templatePfStats,
//BasicPageObject.pageTemplates.PfClassArchetypes = templatePfClassArchetypes,
//BasicPageObject.pageTemplates.PfClassChoices = templatePfClassChoices,
//BasicPageObject.pageTemplates.PfSkillsAdjust = templatePfSkillsAdjust

//new PageTemplate("templatePfRacialTraits", function() {
//	return $e("div", {}, "Racial Traits");
//});

//new PageTemplate("templatePfStats", function() {
//	return $e("div", {}, "Stats");
//});

//new PageTemplate("templatePfClassArchetypes", function() {
//	return $e("div", {}, "Class Archetypes");
//});

//new PageTemplate("templatePfClassChoices", function() {
//	return $e("div", {}, "Class Choice");
//});

//new PageTemplate("templatePfSkillsAdjust", function() {
//	return $e("div", {}, "Skills Adjust");
//});

