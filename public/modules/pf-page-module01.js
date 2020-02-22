import { $ec, $ea as $e, $listen, $a, $q, $i } from "./dollar-sign-module.js";
import { logErrorNode as logError, parseAttributesToObject } from "./parsing-logging.js";
import { parseDeepHTMLArray, loadBundleItem } from "./pages-module01.js";
import { BasicIdObject, Pool, TF } from "./stats-module01.js";

var $RPG = window["$RPG"],
	$Pages = $RPG.pages;

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

// Move selected ability to the "standard" area
// Invalidate anything .standard that matches a namespace
// Invalidate unchosen abilities that match a namespace
// Unhide anything that requires a namespace this item provides
// Invalidate anything that avoids a namespace this item provides
function addArchetype(event) {
	// 'this' should be the button we clicked
	var unit = this.parentNode.parentNode,
		d = unit.dataset,
		sep = d.sep,
		namespaces = d.namespaces.split(sep),
		standard = $q(".standardAbilities"),
		alt = $q(".alternateAbilities"),
		error = [],
		input = $q("input.Archetype"),
		pool;
	// Ignore invalidated abilities
	if(unit.classList.contains("invalid")) {
		return;
	}
	// Check for a hidden input tag and set 'pool' appropriately
	if(input !== undefined) {
		pool = BasicIdObject.getById(input.dataset.stat);
	}
	// Move selected ability to the "standard" area
	standard.append(unit);
	// Select it
	pool && pool.addSelection($q(".id", unit).textContent);
	// Remove 'clicked' status from "standard" area abilities
	unit.classList.remove("clicked");
	namespaces.forEach(function(ns) {
		var CamelCase = ns.replace(/-([a-z])/g, v => v.replace(/[^a-zA-Z]/g, "").toUpperCase());
		// Invalidate anything .standard that matches a namespace
		$a(".standard[data-ns" + ns + "]", standard).forEach(function(ab) {
			ab.classList.add("invalid");
			// Unselect it
			pool && pool.removeSelection($q(".id", ab).textContent);
		});
		// Invalidate (and unclick) unchosen abilities that match a namespace
		$a(".selectable[data-ns" + ns + "]", alt).forEach(function(ab) {
			var abc = ab.classList;
			abc.add("invalid");
			abc.remove("clicked");
		});
		// Unhide anything that requires a namespace this item provides
		$a(".selectable[data-requires-namespaces=\"" + CamelCase + "\"]", alt).forEach(function(ab) {
			ab.classList.remove("hidden");
		});
		// Invalidate (and unclick) anything that avoids a namespace this item provides
		$a(".selectable[data-avoid-namespaces=\"" + CamelCase + "\"]", alt).forEach(function(ab) {
			var abc = ab.classList;
			abc.add("invalid");
			abc.remove("clicked");
		});
	});
	// Set hidden-input to correct value
	pool && setPoolInputValue(input, pool);
}
function setPoolInputValue(input, pool) {
	let sep = pool.separator || ",";
	input.value = Array.from(pool.getSelection()).join(sep);
}


// Move selected ability to "alternate" area
// Remove invalid from .standard abilities that match namespaces
// Remove invalid from unchosen abilities that match a namespace
// Remove chosen abilities that requires a namespace this item provides (add to array, check array once item is removed to see if others have that namespace)
// Hide anything that requires a namespace this item provides (see above)
// Remove invalid from anything that avoids a namespace this item provides
function removeArchetype(event) {
	// 'this' should be the button we clicked
	var unit = this.parentNode.parentNode,
		standard = $q(".standardAbilities"),
		alt = $q(".alternateAbilities"),
		moving = [],
		sorting = new Map(),
		input = $q("input.Archetype"),
		pool, d, sep, namespaces, keepLooping, possiblyRemoveable, possiblyHideable, activeNamespaces;
	// Check for a hidden input tag and set 'pool' appropriately
	if(input !== undefined) {
		pool = BasicIdObject.getById(input.dataset.stat);
	}
	// Move selected ability to "alternate" area
	alt.prepend(unit);
	// Remove from selection
	pool && pool.removeSelection($q(".id", unit).textContent);
	// We may need to run these checks more than once.
	do {
		d = unit.dataset;
		sep = d.sep;
		namespaces = d.namespaces.split(sep);
		possiblyRemoveable = new Set();
		possiblyHideable = new Set();
		activeNamespaces = new Set();
		keepLooping = false;
		// Go through each namespace of the just-removed item
		namespaces.forEach(function(ns) {
			// Remove invalid from .standard abilities that match namespaces
			$a(".standard.invalid[data-ns" + ns + "]", standard).forEach(function(ab) {
				ab.classList.remove("invalid");
				// Add ability back to pool
				pool && pool.addSelection($q(".id", ab).textContent);
			});
			// Remove invalid from unchosen abilities that match a namespace
			$a(".selectable.invalid[data-ns" + ns + "]", alt).forEach(function(ab) {
				ab.classList.remove("invalid");
			});
		});
		// Find active set of namespaces
		$a(".selectable:not(.invalid)", standard).forEach(function(ab) {
			var d = ab.dataset,
				sep = d.sep,
				nss = d.namespaces.split(sep);
			nss.forEach(nn => activeNamespaces.add(nn.replace(/-([a-z])/g, v => v.replace(/[^a-zA-Z]/g, "").toUpperCase())));
		});
		// Go through anything requiring a namespace in Standard
		$a(".selectable[data-requires-namespaces]", standard).forEach(function(pr) {
			var d = pr.dataset,
				sep = d.sep,
				req = d.requiresNamespaces.split(sep);
			// Check all requiresNamespace entries to see if they exist
			while(req.length > 0) {
				let checking = req.shift();
				if(!activeNamespaces.has(checking)) {
					// does not exist, get ready to remove this, break while loop
					moving.push(pr);
					break;
				}
			}
		});
		// Now see if we need to hide anything
		$a(".selectable[data-requires-namespaces]", alt).forEach(function(ph) {
			var d = ph.dataset,
				c = ph.classList,
				sep = d.sep,
				req = d.requiresNamespaces.split(sep);
			// Check all requiresNamespace entries to see if they exist
			while(req.length > 0) {
				let checking = req.shift();
				if(!activeNamespaces.has(checking)) {
					// does not exist: hide it, unclick it, break while loop
					c.add("hidden");
					c.remove("clicked");
					break;
				}
			}
		});
		// Remove invalid from anything that avoids a namespace no longer active
		$a(".selectable.invalid[data-avoid-namespaces]", alt).forEach(function(ph) {
			var d = ph.dataset,
				sep = d.sep,
				okToValidate = true,
				req = d.avoidNamespaces.split(sep);
			// Check all avoidNamespace entries to see if they exist
			while(req.length > 0) {
				let checking = req.shift();
				if(activeNamespaces.has(checking)) {
					// namespace exists, do not validate
					okToValidate = false;
					break;
				}
			}
			okToValidate && ph.classList.remove("invalid");
		});
		// Do we have anything marked for removal from standard?
		if(moving.length > 0) {
			// Watch out for duplicates
			unit = moving.shift();
			while(moving.length > 0 && unit.parentNode === alt) {
				unit = moving.shift();
			}
			// Remove from selection
			pool && pool.removeSelection($q(".id", unit).textContent);
			// Final check, then move it along and loop if needed
			if(unit.parentNode === standard) {
				alt.append(unit);
				keepLooping = true;
			}
		}
	} while(keepLooping);
	// Loop through alternateAbilities and alphabetize
	$a(".selectable", alt).forEach(function(ab) {
		var n = ab.textContent.toUpperCase();
		sorting.set(n, ab);
		moving.push(n)
	});
	moving.sort((a, b) => a > b ? 1 : (a === b ? 0 : -1));
	alt.append(...moving.map(ab => sorting.get(ab)));
	// Set hidden-input to correct value
	pool && setPoolInputValue(input, pool);
}


// "click" event listener for .selectable elements
function clickArchetype(event) {
	// 'this' should be the .selectable element we clicked
	var pn = this.parentNode,
		alt = $q(".alternateAbilities"),
		cL = this.classList;
	if(pn !== alt) {
		// Ignore clicks when not in "alternate" area
		return;
	} else if (event.target.classList.contains("btn")) {
		// Ignore clicks on the add/remove "buttons"
		return;
	} else if (cL.contains("clicked")) {
		// Remove 'clicked' status
		return cL.remove("clicked");
	}
	// Remove 'clicked' from any other elements
	$a(".selectable.clicked").forEach(el => el.classList.remove("clicked"));
	// Add "clicked" to this
	cL.add("clicked");
}


// add listeners for add/remove "buttons"
// hide selectables that require other namespaces
// add listeners for alternates so they can be "clicked"
// set up list of standards to be replaced by an alternate
// invalidate options that do not meet prerequisites
function pfArchetypePicker(html, unit) {
	// Listen on add(+) and remove(x) "buttons"
	$a(".selectable .addMe", html).forEach(sel => $listen(sel, addArchetype));
	$a(".selectable .delMe", html).forEach(sel => $listen(sel, removeArchetype));
	// Assume required namespaces must be added
	// - if a standard ability is required, it should be "replaced" by the alternate
	$a(".selectable[data-requires-namespaces]", html).forEach(sel => sel.classList.add("hidden"));
	// Handle non-standard abilities
	$a(".alternateAbilities .selectable", html).forEach(function(sel) {
		var d = sel.dataset,
			sep = d.sep,
			ns = d.namespaces.split(sep),
			replacements = [],
			e = $ec("div", ["replacements"]),
			txt = "This replaces",
			SPACE = String.fromCharCode(160),
			prereq = d.prerequisites,
			final;
		// Listen for clicks on non-standard abilities
		$listen(sel, clickArchetype);
		// Add in a .replacements div showing which abilities would be replaced by this ability
		ns.forEach(function(NS) {
			// making list of ability names
			var dashed = NS.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase()),
				target = $q(".standardAbilities [data-ns" + dashed + "] .title", html);
			if(target !== null) {
				replacements.push($ec("span", ["ns"], target.textContent));
			}
		});
		// Create the "replacements" text
		if(replacements.length > 0) {
			// turn that list into text
			let penult = "";
			final = replacements.pop();
			e.append(txt, SPACE);
			if(replacements.length > 0) {
				penult = replacements.pop();
			}
			replacements.forEach(r => e.append(r, "," + SPACE));
			if(penult) {
				e.append(penult, SPACE + "and" + SPACE);
			}
			e.append(final);
			sel.append(e);
		}
		// invalidate options that do not meet prerequisites
		if(prereq !== undefined) {
			let sep = d.prerequisiteSeparator || ",",
				multisep = d.prerequisiteMultiSeparator || "|",
				comparator = d.prerequisiteComparator || "If",
				operation = d.prerequisiteOperation || "AND",
				comp = $RPG.stats.comparators[comparator],
				prereqs = prereq.split(multisep),
				ops = operation.split(multisep),
				results = [],
				text = [],
				stop = false;
			if(comp === undefined) {
				logError(sel, "Prerequisite: comparator \"" + comparator + "\" does not exist");
				stop = true;
			} else if (comp.operation === undefined) {
				logError(sel, "Prerequisite: comparator \"" + comparator + "\" does not have an \"operation\" function");
				stop = true;
			}
			while(!stop && prereqs.length > 0) {
				let pr = prereqs.shift().split(sep),
					stat, st, test, value;
				if (pr.length < 3) {
					logError(sel, "Prerequisites must be in the format \"Stat" + sep + "TestFunction" + sep + "TestValue\"");
					stop = true;
				} else {
					st = pr.shift();
					test = pr.shift();
					value = pr.shift();
					stat = BasicIdObject.getById(st);
					if(stat === undefined) {
						logError(sel, "Prerequisite: stat \"" + st + "\" does not exist");
						stop = true;
					} else if(comp[test] === undefined) {
						logError(sel, "Prerequisite: comparator \"" + comparator + "\" does not have function \"" + test + "\"");
						stop = true;
					} else {
						let compare;
						if(stat instanceof Pool) {
							compare = stat.getSelection();
						} else {
							compare = stat.get("value");
						}
						results.push(comp[test](compare, stat.type.converter(value)));
						text.push((stat.get("title") || st) + " " + test + " " + value);
					}
				}
			}
			if(!stop) {
				// Add invalid class if prerequisites are not met
				if(!comp.operation(operation, results)) {
					sel.classList.add("invalid");
				}
				// Add a prerequisites line with "description" class
				sel.append($ec("div", ["description", "prereq"], "Prerequisite(s): " + text.join(" " + operation + " ")));
			}
		}
	});
	return true;
}


// create HTML with the ability's namespaces in its dataset
function pfArchetypeNamespace(appendTo, nodeObj, itemObj, id) {
	var tag = nodeObj.tag || "span",
		separator = nodeObj.separator || " ",
		c = nodeObj.class,
		cs = c ? c.split(" ") : [],
		o = $ec(tag, ["selectable", ...cs]),
		d = o.dataset,
		dashed = [],
		namespaces = itemObj.namespaces;
	// Save separator string to dataset
	o.dataset.sep = separator;
	// Translate namespaces into CSS-compatible format
	namespaces.forEach(function(ns) {
		d["ns" + ns] = "";
		dashed.push(ns.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase()));
	});
	// Save to dataset
	o.dataset.namespaces = dashed.join(separator);
	// Save other properties to dataset
	Object.getOwnPropertyNames(itemObj).forEach(function(att) {
		switch(att) {
			case "namespaces":
			case "description":
			case "explanation":
			case "kids":
				return;
			default:
				d[att] = itemObj[att];
		}
	});
	// Save required namespaces to dataset if needed
	//if(required) {
		//d.requiresNamespaces = required;
	//}
	// Save avoided namespaces to dataset if needed
	//if(avoids) {
		//d.avoidNamespaces = avoids;
	//}
	// Parse any contents
	parseDeepHTMLArray(o, nodeObj.contents, $Pages.subLoaders.bundleItem, id, itemObj);
	// Return object
	return o;
}


export function parseAddToPool(node, filler) {
	var atts = parseAttributesToObject(node),
		id = atts.id,
		pool = BasicIdObject.getById(id);
	if(id === undefined) {
		logError(node, "ADDTOPOOL: missing required \"id\" parameter");
		return null;
	} else if (pool === undefined) {
		logError(node, "ADDTOPOOL: id \"" + id + "\" does not exist");
		return null;
	} else if (pool.type !== Pool) {
		logError(node, "ADDTOPOOL: id \"" + id + "\" is not a Pool");
		return null;
	}
	return {
		ADDTOPOOL: true,
		deferred: true,
		selected: TF.converter(atts.selected),
		node: node,
		pool: pool,
		markInput: atts.markInput,
		loader: loadAddToPool
	};
}


// Adds ability/archetype to given Pool
export function loadAddToPool(appTo, item, id, object) {
	item.pool.addItem(id, object, item.selected);
	return null;
}


export const exports = [];


$Pages.pageTemplates.PfRacialTraits = templatePfRacialTraits;
$Pages.pageTemplates.PfStats = templatePfStats;
$Pages.pageTemplates.PfClassArchetypes = templatePfClassArchetypes;
$Pages.pageTemplates.PfClassChoices = templatePfClassChoices;
$Pages.pageTemplates.PfSkillsAdjust = templatePfSkillsAdjust;
$Pages.pageFilters.PfArchetypePicker = pfArchetypePicker;
$Pages.bundleItemFilters.PfNamespace = pfArchetypeNamespace;

$Pages.subLoaders.bundle.push([pool => (pool.ADDTOPOOL !== undefined), loadAddToPool]);
$Pages.handlers.ADDTOPOOL = parseAddToPool;

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

