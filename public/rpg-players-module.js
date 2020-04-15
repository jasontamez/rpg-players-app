import { $a, $i, $t, $listen, $ea as $e } from "./modules/dollar-sign-module.js";
import { parseAttributesToObject, parseObjectToArray, logErrorNode as logError, logErrorText } from "./modules/parsing-logging.js";
import "./modules/objects-module.js";
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
				setTimeout(() => okToDeload = true, 250);
			} else {
				alert(msg);
				$i("rules").disabled = false;
				button.textContent = "Load Ruleset";
				button.disabled = false;
				setTimeout(() => okToDeload = true, 250);
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
//	// load stats
//	modifyLoadingScreen($t("[parsing stats]"));
//	parseStats(info.Groups, info.Stats, info.MultiStats, info.Pools);
//	// load data
//	modifyLoadingScreen($t("[parsing data]"));
//	test = info.Data || [];
//	info.Data.forEach(function(n) {
//		var [id, value] = n;
//		data.set(id, value);
//	});
//	// load bundles
//	modifyLoadingScreen($t("[parsing bundles]"));
//	test = info.Bundles || [];
//	info.Bundles.forEach(function(n) {
//		parseBundle(n);
//	});
//	// load pages
//	modifyLoadingScreen($t("[parsing pages]"));
//	m = info.Pages;
//	l = m.length;
//	c = 0;
//	while(c < l) {
//		let src = m[c];
//		await grabAndParseXML(src)
//			.then( parsedPages => parsePages(Array.from($a("Page"), parsedPages)) )
//			.catch(function(err) {
//				logErrorText(err.statusText);
//				console.log(err);
//			});
//		c++;
//	}
//	modifyLoadingScreen($t("[loading first page]"));
//	start = data.get("firstPage");
//	if(start === undefined) {
//		modifyLoadingScreen($t("[ERROR: missing 'firstPage' datum in RuleSet " + cls + "]"));
//		return;
//	}
//	loadPageNamed(start, false);
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
			logErrorText("RESOURCE: \"" + type + "\" not found", new Error());
			return null;
	}
	atts.forEach(function(pair) {
		var p = pair.slice(),
			att = p.shift();
		if(p.length > 0) {
			let v = p.shift();
			if(v === undefined) {
				logErrorText("RESOURCE: Could not set parameter \"" + att + "\"", new Error());
				return null;
			}
			a[att] = v;
		} else if(atts[att] !== undefined) {
			a[att] = atts[att];
		}
	});
	where.appendChild($e(element, a));
}

async function parseModule(t, src) {
	var ok = null,
		type = $RPG[t];
	if(type === undefined) {
		logErrorText2("MODULE: invalid module type \"" + t + "\"", new Error());
		return null;
	}
	await import(modDir + src)
		.then(function(info) {
			ok = true;
		}).catch(function(error) {
			logErrorText(error.message, new Error());
			console.log(error);
			console.log(modDir + src);
		});
	return ok;
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

