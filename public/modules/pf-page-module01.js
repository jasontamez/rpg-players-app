import { $ea as $e } from "./dollar-sign-module.js";

function templatePfRacialTraits() {
	return $e("div", {}, "Racial Traits");
}

function templatePfStats() {
	return $e("div", {}, "Stats");
}

function templatePfClassArchetypes() {
	return $e("div", {}, "Class Archetypes");
}

function templatePfClassChoices() {
	return $e("div", {}, "Class Choice");
}

function templatePfSkillsAdjust() {
	return $e("div", {}, "Skills Adjust");
}


export var exports = [
	["pageTemplates", "PfRacialTraits", templatePfRacialTraits],
	["pageTemplates", "PfStats", templatePfStats],
	["pageTemplates", "PfClassArchetypes", templatePfClassArchetypes],
	["pageTemplates", "PfClassChoices", templatePfClassChoices],
	["pageTemplates", "PfSkillsAdjust", templatePfSkillsAdjust]
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

