import { $a, $i, $t, $listen, $ea as $e } from "./modules/dollar-sign-module.js";
import { parseAttributesToObject, parseObjectToArray, logErrorNode as logError, logErrorText } from "./modules/parsing-logging.js";
import "./modules/objects-module.js";
import { parseFormulae, parseStats } from "./modules/stats-module01.js";
import { parsePages, loadPageNamed } from "./modules/pages-module01.js";
const xmlDir = "./rulesets/",
	modDir = "./modules/",
	BODY = document.body,
	MAIN = $i("mainGrid");
var okToDeload = false,
	data = new Map(),
	BUNDLES = new Map(),
	AJAXstorage = new Map(),
	$RPG = window["$RPG"],
	PlayerObject = $RPG.objects.data.player,
	socket = window["$IO"];

// Set up global variable
$RPG.ADD("pages", "data", data);
$RPG.ADD("bundles", "raw", BUNDLES);
$RPG.ADD("pages", "MAIN", MAIN);
$RPG.ADD("pages", "OVERLAY", $i("overlay"));

// Character/player creation
var PO = new PlayerObject("id"),
	Char = PO.makeCharacter("pf01");
$RPG.ADD("current", {
	player: PO,
	character: Char
});

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


// Set up description shower/hider
$listen($i("more"), function(e) {
	$i("more").classList.toggle("visible");
	$i("description").classList.toggle("visible");
});


// Call function when ruleset drop-down list is changed
//$i("rules").addEventListener("change", function(e) {
//	// Save the ruleset selected
//	const rules = e.currentTarget.value;
//	// Create AJAX fetcher
//	var getter = new XMLHttpRequest();
//	if(rules === "x") {
//		return;
//	}
//	// Call a parse function when the fetching is done
//	getter.addEventListener("load", function() {
//		AJAXstorage.set(rules, getter.responseXML);
//		//console.log("Info received");
//	});
//	getter.open("GET", "rulesets/" + rules + "-master.xml");
//	getter.send();
//});


// Load a ruleset.
$listen($i("loadInfo"), tryDisplayInfo);

function tryDisplayInfo(event) {
	const filename = $i("rules").value,
		button = $i("loadInfo");
	if(filename === "x") {
		// Nope. Just stop everything.
		return alert("Please select a ruleset before attempting to Load Info.");
	}
	$i("rules").disabled = true;
	button.textContent = "...Loading...";
	button.disabled = true;
	socket.emit(
		'get ruleset',
		filename,
		function(success, info) {
			if(success) {
				loadAndAssembleInfo(info);
			} else {
				alert(msg);
				$i("rules").disabled = false;
				button.textContent = "Load Ruleset";
				button.disabled = false;
			}
		}
	);
}

// When the button is pressed...
function tryDisplayInfo_OLD(event, x = 0) {
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


async function loadAndAssembleInfo(info) {
	var modules = info.Modules,
		m = modules.length,
		resources = info.Resources,
		r = resources.length,
		c = 0,
		test;
	// Show "loading" screen
	showLoadingScreen();
	// Set info to $RPG.current.ruleset
	$RPG.ADD("current", "ruleset", info);
	// load resources
	modifyLoadingScreen($t("[parsing resources]"));
	while(c < r) {
		let [type, src] = resources[c];
		await parseResource(type, src);
		c++;
	}
	// load modules
	c = 0;
	modifyLoadingScreen($t("[parsing modules]"));
	while(c < m) {
		let [type, src] = modules[c];
		await parseModule(type, src);
		c++;
	}
	// load formulae
	modifyLoadingScreen($t("[parsing formulae]"));
	parseFormulae(info.Formulae || []);
	// load stats
	modifyLoadingScreen($t("[parsing stats]"));
	parseStats(info.Groups, info.Stats, info.MultiStats, info.Pools);
	// load data
	modifyLoadingScreen($t("[parsing data]"));
	test = info.Data || [];
	info.Data.forEach(function(n) {
		var [id, value] = n;
		data.set(id, value);
	});
	// load bundles
	modifyLoadingScreen($t("[parsing bundles]"));
	test = info.Bundles || [];
	info.Bundles.forEach(function(n) {
		parseBundle(n);
	});
	// load pages
	modifyLoadingScreen($t("[parsing pages]"));
	m = info.Pages;
	l = m.length;
	c = 0;
	while(c < l) {
		let src = m[c];
		await grabAndParseXML(src)
			.then( parsedPages => parsePages(Array.from($a("Page"), parsedPages)) )
			.catch(function(err) {
				logErrorText(err.statusText);
				console.log(err);
			});
		c++;
	}
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
async function loadAndAssembleInfo_OLD(cls) {
	var doc = AJAXstorage.get(cls),
		body = doc.documentElement,
//		ul = $e("ul"),
		modules = Array.from($a("Modules Module", body)),
		resources = Array.from($a("Resources Resource", body)),
		c = 0,
		l = modules.length,
		r = resources.length,
		nodes,
		start;
	modifyLoadingScreen($t("[parsing resources]"));
	while(c < r) {
		let node = resources[c];
		await parseResourceNode(node);
		c++;
	}
	c = 0;
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
			await grabAndParseXML(src)
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

async function parseResource(type, resource) {
	var a = [],
		element, where, atts;
	switch(type) {
		case "stylesheet":
			element = "link";
			where = document.head;
			atts = [
				["rel", "stylesheet"],
				["type", "text/css"],
				["href", "/rulesets/" + resource]
			];
			break;
		case "script":
			element = "script";
			where = document.body;
			atts = [];
			break;
		default:
			logErrorText("RESOURCE: \"" + type + "\" not found");
			return null;
	}
	atts.forEach(function(pair) {
		var p = pair.slice(),
			att = p.shift();
		if(p.length > 0) {
			let v = p.shift();
			if(v === undefined) {
				logErrorText("RESOURCE: Could not set parameter \"" + att + "\"");
				return null;
			}
			a[att] = v;
		} else if(atts[att] !== undefined) {
			a[att] = atts[att];
		}
	});
	where.appendChild($e(element, a));
}
async function parseResourceNode(modNode) {
	var atts = parseAttributesToObject(modNode),
		t = atts.type,
		resources = {
			stylesheet: {
				element: "link",
				location: document.head,
				attributes: [
					["rel", "stylesheet"],
					["type", "text/css"],
					["href", "/rulesets/" + atts.src]
				]
			},
			script: {
				element: "script",
				location: document.body,
				attributes: [
					["type"],
					["src", "/rulesets/" + atts.src]
				]
			}
		},
		type = resources[t],
		src = atts.src,
		msg = false,
		a = {};
	if(t === undefined) {
		msg = "RESOURCE: missing required parameter \"type\"";
	} else if (src === undefined) {
		msg = "RESOURCE: missing required parameter \"src\"";
	} else if (type === undefined) {
		msg = "RESOURCE: invalid resource type \"" + t + "\"";
	}
	if(msg) {
		logError(modNode, msg);
		return null;
	}
	type.attributes.forEach(function(pair) {
		var p = pair.slice(),
			att = p.shift();
		if(p.length > 0) {
			let v = p.shift();
			if(v === undefined) {
				logError(modNode, "RESOURCE: Could not set parameter \"" + att + "\"");
				return null;
			}
			a[att] = v;
		} else if(atts[att] !== undefined) {
			a[att] = atts[att];
		}
	});
	type.location.appendChild($e(type.element, a));
}

async function parseModule(t, src) {
	var ok = null,
		type = $RPG[t];
	if(type === undefined) {
		logErrorText("MODULE: invalid module type \"" + t + "\"");
		return null;
	}
	await import(modDir + src)
		.then(function(info) {
			ok = true;
		}).catch(function(error) {
			logErrorText(error.message);
			console.log(error);
			console.log(modDir + src);
		});
	return ok;
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


function grabAndParseXML(location) {
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
		info, item,
		BUNDLES = $RPG.bundles.raw;
	if(category === undefined) {
		category = atts.category;
		delete atts.category;
	}
	if(id === undefined || category === undefined) {
		return logError(node, "BUNDLE: missing required \"id\" and/or \"category\" parameters");
	}
	modifyLoadingScreen($t("[parsing bundle \"" + category + "\"]"));
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

