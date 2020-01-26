import { $a, $i, $ea as $e } from "./modules/dollar-sign-module.js";
import { parseAttributesToObject, logErrorNode as logError } from "./modules/parsing-logging.js";
import { parseFormulae, parseStats } from "./modules/stats-module01.js";
import { parsePages } from "./modules/pages-module01.js";
const xmlDir = "./rulesets/",
	modDir = "./modules/";
var sharedObjects = {
	formulae: {},
	stats: {},
	pages: {}
};

//Object.getOwnPropertyNames(stats1).forEach(function(prop) {
//	stats[prop] = stats1[prop];
//});
//Object.getOwnPropertyNames(pages1).forEach(function(prop) {
//	pages[prop] = pages1[prop];
//});

//moduleObjects.stats = stats;
//moduleObjects.pages = pages;
//moduleObjects.pageTemplates = pageTemplates;

// initialize global variables
var	AJAXstorage = new Map(),
	numberWords=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];


// Add rulesets to the drop-down menu
async function findRulesets() {
	var getter = new XMLHttpRequest();
	// Call a parse function when the fetching is done
	getter.addEventListener("load", function() {
		const r = $i("rules"), options = Array.from($a("option", getter.responseXML));
		options.forEach(function(o) {
			var clone = o.cloneNode(true);
			r.appendChild(clone);
		});
		//console.log(options);
	});
	getter.responseType = "document";
	getter.open("GET", "/rulesets");
	getter.send();
}
findRulesets();

// Call function when ruleset drop-down list is changed
$i("rules").addEventListener("change", function(e) {
	// Save the ruleset selected
	const rules = e.currentTarget.value;
	// Create AJAX fetcher
	var getter = new XMLHttpRequest();
	if(rules === "x") {
		return;
	}
	// Call a parse function when the fetching is done
	getter.addEventListener("load", function() {
		AJAXstorage.set(rules, getter.responseXML);
		//console.log("Info received");
	});
	getter.open("GET", "rulesets/" + rules + "-master.xml");
	getter.send();
});


// Load a ruleset.
$i("loadInfo").addEventListener("click", tryDisplayInfo);

// When the button is pressed...
function tryDisplayInfo(event, x = 0) {
	var asyncF,
		cls = $i("rules").value;
	const button = $i("loadInfo");

	// what class are we using?
	// Check to see if we've selected an actual class
	if(cls === "x") {
		// Nope. Just stop everything.
		return alert("Please select a ruleset before attempting to Load Info.");
	}

	// Check if we have data
	if(x >= 10) {
		// We've waited 5 seconds
		// Set the class drop-down to null
		$i("rules").value = "x";
		// Restore the button
		button.textContent = "Load Info";
		button.disabled = false;
		// Send an alert
		return alert("Ruleset information was not loaded. Please select your ruleset again, then attempt to Load Info.");
	} else if(!AJAXstorage.has(cls)) {
		if(x === 0) {
			button.textContent = "...Loading...";
			button.disabled = true;
		}
		// Suspend for half a second to wait for it
		setTimeout(tryDisplayInfo.bind(null, event, x + 1), 500);
		return;
	}

	// Show "loading" screen
	document.body.classList.add("loading");

	asyncF = new Promise(function(resolve, reject) {
		// disable class/race choice and indicate we can recalculate at will
		$i("rules").disabled = true;
		button.textContent = "Recalculate!";
		button.disabled = false;
		// Run the meat of the program, giving it a pause to wait for the transition to play
		setTimeout(loadAndAssembleInfo.bind(null, cls), 100);
		resolve();
	});
	asyncF.then(function() {
		// Anything?
	}).catch(function(error) {
		console.log(error.name + " :: " + error.message + " :: " + error.fileName + "\n" + error.stack);
		alert(error.name + " :: " + error.message + " :: " + error.fileName + "\n\nPlease inform the webmaster. Or, reload the page and try again.");
	}).finally(function() {
		setTimeout(() => document.body.classList.remove("loading"), 250);
	});
}

async function loadAndAssembleInfo(cls) {
	var doc = AJAXstorage.get(cls),
		body = doc.documentElement,
//		ul = $e("ul"),
		modules = Array.from($a("Modules Module", body)),
		c = 0,
		l = modules.length;
	const main = $i("mainGrid");
	while(c < l) {
		let node = modules[c];
		await parseModuleNode(node);
		c++;
	}
	//console.log("Modules Parsed");
	//console.log(doc);
	//console.log(body);
	//console.log("Begin");
	parseFormulae(Array.from($a("Formulae Formula", body)), sharedObjects.formulae);
	//console.log("Formulas done");
	parseStats(Array.from($a("Stats", body)), sharedObjects.stats);
	//console.log("Stats done");
	//recurseNodes(body, ul);
	//main.append(ul);
	parsePages(Array.from($a("Pages Page", body)), sharedObjects.pages).forEach(function(page) {
		main.append(...page.html);
	});
	//console.log("End");
}

//function recurseNodes(parent, parentTag) {
//	var nodes = [...parent.childNodes];
//	while(nodes.length > 0) {
//		let node = nodes.shift(), text;
//		if(node.nodeType === 3) {
//			text = node.nodeValue.trim();
//			if(parentTag === undefined) {
//				// Skip!
//			} else if(text !== "") {
//				parentTag.set("text", text);
//			}
//		} else {
//			let a = node.attributes, c = 0, atts = [], tag, nombre = node.nodeName, id = "";
// 			while(c < a.length) {
//				let att = a.item(c), n = att.name, v = att.value;
//				if(n=== "ID") {
//					id = v;
//				} else {
//					atts.push([a.name, a.value])
//				}
//				c++;
// 			}
//			if(nombre === "Stat") {
//				tag = new stats.BasicStat(id, parentTag, node, atts);
//			} else {
//				tag = new stats.BasicIdObject(nombre, parentTag, node, atts);
//			}
//			//console.log(tag);
//			recurseNodes(node, tag);
//		}
//	}
//}

async function parseModuleNode(modNode) {
	var atts = parseAttributesToObject(modNode),
		t = atts.type,
		type = sharedObjects[t],
		src = atts.src,
		msg = false;
	if(t === undefined) {
		msg = "MODULE: missing required parameter \"type\"";
	} else if (src === undefined) {
		msg = "MODULE: missing required parameter \"src\"";
	} else if (type === undefined) {
		msg = "MODULE: invalid module type \"" + t + "\"";
	}
	if(msg) {
		logError(modNode, msg);
		return null;
	}
	await import(modDir + src)
		.then(function(info) {
			var exports = info.exports;
			if(exports !== undefined) {
				exports.forEach(function(imported) {
					var value = imported.pop(),
						prop = imported.pop(),
						o = type;
					while(imported.length > 0) {
						let p = imported.shift();
						if(o[p] === undefined) {
							o[p] = {};
						}
						o = o[p];
					}
					o[prop] = value;
				});
			} else {
				let e = atts.exports || "";
				exports = e.split(",");
				if(exports.length === 0) {
					exports = Object.getOwnPropertyNames(info);
				}
				exports.forEach(function(prop) {
					type[prop] = info[prop];
				});
			}
		}).catch(function(error) {
			logError(modNode, error.message);
			console.log(error);
			console.log(modDir + src);
		});
}

