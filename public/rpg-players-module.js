import { $a, $i, $t, $listen } from "./modules/dollar-sign-module.js";
import { parseAttributesToObject, parseObjectToArray, logErrorNode as logError } from "./modules/parsing-logging.js";
import { parseFormulae, parseStats } from "./modules/stats-module01.js";
import { parsePages, loadPageNamed } from "./modules/pages-module01.js";
import { PlayerObject } from "./modules/data-module01.js";
const xmlDir = "./rulesets/",
	modDir = "./modules/",
	BODY = document.body,
	MAIN = $i("mainGrid");
var okToDeload = false,
	data = new Map(),
	BUNDLES = new Map(),
	AJAXstorage = new Map(),
	$RPG = window["$RPG"];

// Set up global variable
$RPG.ADD("pages", "data", data);
$RPG.ADD("pages", "rawBundles", BUNDLES);
$RPG.ADD("pages", "MAIN", MAIN);
$RPG.ADD("pages", "OVERLAY", $i("overlay"));

// Character/player creation
var PO = new PlayerObject("id"),
	Char = PO.makeCharacter("pf01");

// Show the loading screen
function showLoadingScreen() {
	BODY.classList.add("loading");
	okToDeload = false;
}
// Remove the loading screen
function removeLoadingScreen() {
	if(!okToDeload) {
		return setTimeout(removeLoadingScreen, 150);
	}
	BODY.classList.remove("loading");
}
// Modify the loading screen with a message
function modifyLoadingScreen() {
	var msg = $i("loading-message");
	while(msg.firstChild !== null) {
		msg.firstChild.remove();
	}
	msg.append(...arguments);
}


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
$listen($i("loadInfo"), tryDisplayInfo);


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
	showLoadingScreen();

	asyncF = new Promise(function(resolve, reject) {
		// disable class/race choice and indicate we can recalculate at will
		$i("rules").disabled = true;
		//button.textContent = "Recalculate!";
		//button.disabled = false;
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
		setTimeout(() => okToDeload = true, 250);
	});
}


async function loadAndAssembleInfo(cls) {
	var doc = AJAXstorage.get(cls),
		body = doc.documentElement,
//		ul = $e("ul"),
		modules = Array.from($a("Modules Module", body)),
		c = 0,
		l = modules.length,
		nodes,
		start;
	modifyLoadingScreen($t("[parsing modules]"));
	while(c < l) {
		let node = modules[c];
		await parseModuleNode(node);
		c++;
	}
	//console.log("Modules Parsed");
	//console.log(doc);
	//console.log(body);
	//console.log("Begin");
	modifyLoadingScreen($t("[parsing formulae]"));
	parseFormulae(Array.from($a("Formulae Formula", body)));
	//console.log("Formulas done");
	modifyLoadingScreen($t("[parsing stats]"));
	parseStats(Array.from($a("Stats", body)));
	//console.log("Stats done");
	//recurseNodes(body, ul);
	//main.append(ul);
	modifyLoadingScreen($t("[parsing data]"));
	Array.from($a("Data Datum", body)).forEach(function(n) {
		var id = n.getAttribute("id"),
			value = n.getAttribute("value");
		if(id === undefined || value === undefined) {
			return logError(n, "DATUM: missing required \"id\" and/or \"value\" parameters");
		}
		data.set(id, value);
	});
	modifyLoadingScreen($t("[parsing bundles]"));
	Array.from($a("Bundles Bundle", body)).forEach(function(n) {
		parseBundle(n);
	});
	nodes = Array.from($a("Bundles Category", body));
	while(nodes.length > 0) {
		let node = nodes.shift(),
			atts = parseAttributesToObject(node),
			category = atts.name,
			src = atts.src;
		if(category === undefined) {
			return logError(node, "BUNDLE CATEGORY: missing required \"name\" parameter");
		} else if (src === undefined) {
			node.querySelectorAll("Bundle").forEach( n => parseBundle(n, category) );
		} else {
			await parseBundles(src)
				.then( bundleDoc => Array.from($a("Bundle", bundleDoc)).forEach( n => parseBundle(n, category) ) )
				.catch(function(err) {
					logError(node, err.statusText);
					console.log(err);
				});
		}
	}
	modifyLoadingScreen($t("[parsing pages]"));
	parsePages(Array.from($a("Pages Page", body)));
	modifyLoadingScreen($t("[loading first page]"));
	start = data.get("firstPage");
	if(start === undefined) {
		modifyLoadingScreen($t("[ERROR: missing 'firstPage' datum in RuleSet " + cls + "]"));
		return;
	}
	loadPageNamed(start, false);
	modifyLoadingScreen($t("[Done!]"));
	//console.log("End");
	// Remove "loading" screen
	removeLoadingScreen();
}

async function parseModuleNode(modNode) {
	var atts = parseAttributesToObject(modNode),
		t = atts.type,
		type = $RPG[t],
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


function parseBundles(location) {
	return new Promise(function(resolve, reject) {
		// Create AJAX fetcher
		var getter = new XMLHttpRequest();
		// Fetch the file
		getter.open("GET", xmlDir + location);
		// Call a parse function when the fetching is done
		getter.onload = function() {
			if (this.status >= 200 && this.status < 300) {
				resolve(getter.responseXML);
			} else {
				reject({
					status: this.status,
					statusText: getter.statusText
				});
			}
		};
		// Launch the fetcher!
		getter.send();
	});
}


function parseBundle(node, category) {
	var atts = parseAttributesToObject(node),
		id = atts.id,
		theseKids = Array.from(node.children),
		info, item;
	if(category === undefined) {
		category = atts.category;
		delete atts.category;
	}
	if(id === undefined || category === undefined) {
		return logError(node, "BUNDLE: missing required \"id\" and/or \"category\" parameters");
	}
	delete atts.id;
	atts = parseObjectToArray(atts);
	info = BUNDLES.get(category);
	if(info !== undefined) {
		// category found
		item = info.get(id);
		if(item !== undefined) {
			// id found
			let kids = item.get("kids");
			item.set("kids", kids.concat(theseKids));
		} else {
			// id not found
			item = new Map();
			item.set("kids", theseKids);
		}
	} else {
		// category not found
		item = new Map([["kids", theseKids]]);
		info = new Map([[id, item]]);
	}
	atts.forEach(pair => item.set(pair[0], pair[1]));
	info.set(id, item);
	BUNDLES.set(category, info);
}

