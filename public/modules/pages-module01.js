import { $a, $t, $ea as $e, $listen } from "./dollar-sign-module.js";
import { parseAttributesToObject, parseObjectToArray, checkObjProps, logErrorNode as logError, logErrorText } from "./parsing-logging.js";
import { BasicIdObject, Int, Str, IntBonusable, Num, TF } from "./stats-module01.js";


// Define a class for XML tags
export class BasicPageObject {
	constructor(node, id, atts) {
		let a = new Map();
		this.node = node;
		atts.forEach(function(prop) {
			a.set(prop[0], prop[1]);
		});
		this.atts = a;
		this.html = [];
		BasicPageObject.allIDs.set(id, this);
	}
	static getById(id) {
		return BasicPageObject.allIDs.get(id);
	}
}
BasicPageObject.allIDs = new Map();


var InformationObject = {
	pageTemplates: {},
	bundles: {},
	handlers: {
		Block: parseBlock,
		INPUT: parseInput,
		CHOOSE: parseChoose,
		BUTTON: parseButton,
		BUNDLE: parseBundle
	},
	buttonTypes: {
		navigation: {
			mandatoryProps: ["nextPage"],
			datasetProps: ["nextPage"],
			defaultText: "Next",
			listenFunc: loadPageFromButton
		},
		calculation: {
			mandatoryProps: [],
			datasetProps: [["which", "toCalc"]],
			defaultText: "Calculate",
			listenFunc: calculateFromPage
		},
		calcNav: {
			mandatoryProps: ["nextPage"],
			datasetProps: ["nextPage", "which", "haltable"],
			defaultText: "Save and Continue",
			listenFunc: calculateThenNavigate
		},
		closeSub: {
			mandatoryProps: ["subpage"],
			datasetProps: ["subpage"],
			defaultText: "Close",
			listenFunc: loadPageFromButton ////////////////
		}
	}
};
window.pageInfo = InformationObject;


function populateInformation(sharedObject) {
	Object.getOwnPropertyNames(sharedObject).forEach(function(prop) {
		if(InformationObject[prop] === undefined) {
			// New property.
			InformationObject[prop] = sharedObject[prop];
		} else {
			// Add to existing property.
			let Iprop = InformationObject[prop], sprop = sharedObject[prop];
			Object.getOwnPropertyNames(sprop).forEach(function(p) {
				Iprop[p] = sprop[p];
			});
		}
	});
}


// Parse an array of <Page> objects
export function parsePages(nodelist, sharedObject) {
	var pages = [];
	// Add in any additional properties
	populateInformation(sharedObject);
	// Parse nodes
	nodelist.forEach( node => pages.push(parsePageNodes(node)) );
	return pages;
}


// parse a single <Page> node, returning a BasicPageObject with its data
export function parsePageNodes(pageNode) {
	var pageTag, kids,
		atts = parseAttributesToObject(pageNode),
		id = atts.id;
	if(id === undefined) {
		logError(pageNode, "PAGE: missing required parameter \"id\"");
		return null;
	}
	delete atts.id;
	pageTag = new BasicPageObject(pageNode, id, parseObjectToArray(atts));
	kids = Array.from(pageNode.childNodes);
	kids.forEach(function(node) {
		var retVal = recursePageNodes(node);
		if(retVal !== null) {
			pageTag.html.push(retVal);
		}
	});
	return pageTag;
}

// Need to redo .html as a deep array
// Need to redo .html as a deep array
// Need to redo .html as a deep array
// Need to redo .html as a deep array
// Need to redo .html as a deep array
// Need to redo .html as a deep array


export function recursePageNodes(node) {
	var kids = Array.from(node.childNodes),
		nombre = node.nodeName,
		type = node.nodeType,
		html, atts, handle, filler = [];
	if(type === 3) {
		// Text node.
		return $t(node.textContent);
	} else if (type !== 1) {
		// Assume a comment. Ignore.
		return null;
	} else if (kids.length > 0) {
		// Has kids.
		kids.forEach(function(kid) {
			var retVal = recursePageNodes(kid);
			if(retVal !== null) {
				filler.push(retVal);
			}
		});
	}
	handle = InformationObject.handlers[nombre];
	if (handle !== undefined) {
		// Get the html from the handler
		return handle(node, filler);
	}
	// Assume HTML.
	atts = parseAttributesToObject(node);
	html = $e(nombre, atts);
	//html.append(...filler);
	return filler.length > 0 ? [html, filler] : html;
}


// <Block template="whatever"> ... </Block>
export function parseBlock(node, filler) {
	var atts = parseAttributesToObject(node),
		temp = atts.template,
		contents = atts.contents,
		format;
	if(temp === undefined) {
		// Assume this is a plain <div>.
		let div = $e("div", atts);
		//div.append(...filler);
		return filler.length > 0 ? [div, filler] : div;
	} else if ((format = InformationObject.pageTemplates[temp]) === undefined) {
		logError(node, "BLOCK: template \"" + temp + "\" is not defined");
		return null;
	}
	if(contents === undefined) {
		contents = "ignore";
	} else {
		delete atts.contents;
	}
	delete atts.template;
	return format(filler, contents, atts);
}


export function parseTemplate() {
	
}


// <INPUT id="Stat" />
export function parseInput(node, filler) {
	var atts = parseAttributesToObject(node),
		id = atts.id,
		stat = BasicIdObject.getById(id),
		inputObject;
	if(id === undefined) {
		logError(node, "INPUT: missing required \"id\" parameter");
		return null;
	} else if (stat === undefined) {
		logError(node, "INPUT: unable to find a Stat named \"" + id + "\"");
		return null;
	}
	delete atts.id;
	switch(stat.type) {
		case Int:
		case IntBonusable:
		case Num:
			atts.type = "number";
			inputObject = stat.get("minValue");
			if(inputObject !== undefined && inputObject === inputObject) {
				atts.min = inputObject.toString();
			}
			inputObject = stat.get("maxValue");
			if(inputObject !== undefined && inputObject === inputObject) {
				atts.max = inputObject.toString();
			}
			break;
		case Str:
			atts.type = "text";
			break;
		default:
			logError(node, "INPUT: Stat id=\"" + id + "\" is not of a user-definable type.");
			return null;
	}
	atts.value = stat.get("value");
	inputObject = $e("input", atts);
	inputObject.append(...filler);
	inputObject.classList.add("Stat");
	inputObject.dataset.stat = id;
	return inputObject;
}


// <BUTTON type="navigation" to="page2">Continue</BUTTON>
export function parseButton(node, filler) {
	var atts = parseAttributesToObject(node),
		type = atts.type,
		buttonType = InformationObject.buttonTypes[type],
		button;
	if(type === undefined) {
		logError(node, "BUTTON: missing required \"type\" parameter");
		return null;
	} else if (buttonType === undefined) {
		logError(node, "BUTTON: type \"" + type + "\" is invalid");
		return null;
	}
	// Check for any/all mandatory properties
	button = checkObjProps(node, atts, buttonType.mandatoryProps, "BUTTON, " + type);
	if(button.length !== 0) {
		// Some/all mandatory properties did not exist
		button = null;
	} else {
		// All mandatory properties are present
		let data = [["type", type]], d;
		delete atts.type;
		// Go through all datasetProps (they may or may not be present)
		buttonType.datasetProps.forEach(function(prop) {
			var info = atts[prop];
			// If the prop exists, save its value with its dataset name, then delete it from atts
			// Otherwise, ignore it and move on
			if(info !== undefined) {
				data.push([prop, info]);
				delete atts[prop];
			}
		});
		// Make button
		button = $e("button", atts);
		// Fill button with text
		if(filler.length === 0) {
			button.textContent = buttonType.defaultText;
		} else {
			button.append(...filler);
		}
		// Set dataset info
		d = button.dataset;
		data.forEach(pair => d[pair[0]] = pair[1]);
		// Set listener
		$listen(button, buttonType.listenFunc);
	}
	return button;
}


// <CHOOSE category="name" />
// Makes a <select> tag filled with <options> drawn from a category of Bundles
export function parseChoose(node) {
	//<CHOOSE category="race" />
	var atts = parseAttributesToObject(node),
		cat = atts.category,
		bundles = InformationObject.rawBundles,
		saveTo = atts.saveTo,
		selectObject;
	if(cat === undefined) {
		logError(node, "CHOOSE: missing required \"category\" parameter");
		return null;
	}
	delete atts.category;
	delete atts.saveTo;
	selectObject = $e("select", atts);
	if(saveTo !== undefined) {
		selectObject.dataset.stat = saveTo;
	}
	if(bundles) {
		let info = bundles.get(cat);
		if(info) {
			info.forEach(function(optionObj, optionName) {
				selectObject.append($e("option", { value: optionName }, optionObj.get("title")));
			});
		}
	}
	return selectObject;
}


//  InformationObject.bundles = {
//    categoryName: Map(
//      bundleName => {
//        title: "Title",
//        tagName: Map(
//          id => {
//            namespaces => [],
//            kids => [kids],
//            att => att...
//          }
//        ),
//        allNamespaces: Set [maybe don't use this, just assume Standard is chosen and don't duplicate other namespaces already chosen?]
//      }
//    )
//  }

//<BUNDLE category="x" ?show="Tag"></BUNDLE>
export function loadBundle(appendTo, node, atts, rawcategory) {
	var BUNDLES = InformationObject.bundles,
		cat = atts.category,
		category = BUNDLES[cat],
		stat = atts.stat,
		test, chosen;
	if(stat === undefined) {
		// Assume the stat is the same as the category
		stat = cat;
	} else {
		delete atts.stat;
	}
	test = BasicIdObject.getById(stat);
	if(test === undefined) {
		logError(node, "BUNDLE: stat \"" + stat + "\" not found");
		console.log([node, atts, rawcategory]);
		return null;
	}
	chosen = test.get("value");
	if(!rawcategory.has(chosen)) {
 		logError(node, "BUNDLE: bundle \"" + chosen + "\" (via stat \"" + stat + "\") not found within category \"" + cat +  "\"");
		return null;
	} else if (category === undefined) {
		// Category exists but is not parsed yet
		let tempcat = new Map();
		// Parse each bundle in the category
		rawcategory.forEach(function(bundle, id) {
			// Bundle should be a map with an array of "kids" and a "title"
			// A separator is optional, defaulting to a comma
			var kids = bundle.get("kids"),
				separator = bundle.get("separator") || ",",
				masterNSlist = new Set(),
				o = {
					title: bundle.get("title")
				};
			//recurseBundleCategory(kids);
			// Parse each kid in the bundle
			kids.forEach(function(node) {
				// Each kid should have an ID and a deliminated string of namespaces
				// Each tag name may be unique
				var atts = parseAttributesToObject(node),
					id = atts.id,
					namespaces = atts.namespaces,
					tagName = node.nodeName,
					kidmap = o[tagName] || new Map(),
					k = Array.from(node.children),
					obj;
				if(id === undefined || namespaces === undefined) {
					logError(node, "BUNDLE: category \"" + cat +  "\", tag \"" + tagName +  "\" missing id and/or namespaces parameters");
					return null;
				}
				namespaces = namespaces.split(separator);
				obj = {
					namespaces: namespaces,
					kids: Array.from(node.children)
					//
					//
					//
					//
					// KIDS NEED TO BE PARSED FOR BONUSES!!!
					// KIDS NEED TO BE PARSED FOR BONUSES!!!
					// KIDS NEED TO BE PARSED FOR BONUSES!!!
					// KIDS NEED TO BE PARSED FOR BONUSES!!!
					//
					//
					//
					//
				};
				delete atts.id;
				delete atts.namespaces;
				// Add any other attributes
				Object.getOwnPropertyNames(atts).forEach(function(n) {
					obj[n] = atts[n];
				});
				// Save these atts
				kidmap.set(id, obj);
				// Save to the bundle
				o[tagName] = kidmap;
				// Save namespaces
				namespaces.forEach(ns => masterNSlist.add(ns));
			});
			// Save namespaces
			o.allNamespaces = masterNSlist;
			tempcat.set(id, o);
		});
		category = tempcat;
		BUNDLES[cat] = category;
	}
	// Bundle is parsed
	// Turn into HTML
	


	delete atts.show;
}


function parseBundle(node) {
	var atts = parseAttributesToObject(node),
		cat = atts.category,
		raw = InformationObject.rawBundles,
		test;
	if(cat === undefined) {
		logError(node, "BUNDLE: missing required \"category\" parameter");
		return null;
	} else if (!raw.has(cat)) {
		logError(node, "BUNDLE: category \"" + cat + "\" does not seem to exist");
		return null;
	}
	/// HOW do you defer parsing this until later?
	return {
		deferred: true,
		atts: atts,
		node: node,
		raw: InformationObject.rawBundles.get(cat),
		loader: loadBundle
	};
}



// loadPageNamed(string pageName, ?boolean subPage, ?object sharedObject)
export function loadPageNamed(pageName, subPage, sharedObject) {
	var page = BasicPageObject.getById(pageName);
	if(page === undefined) {
		return logErrorText("There is no page with the id \"" + pageName + "\"");
	}
	sharedObject && populateInformation(sharedObject);
	loadPage(page, subPage);
}


export function loadPage(page, subPage) {
	var MAIN = InformationObject.MAIN, held = [], unit, appendTo = MAIN, html = page.html.slice();
	// If we're not a subpage, clear out all previous info on-screen
	if(!subPage) {
		while(MAIN.firstChild !== null) {
			MAIN.firstChild.remove();
		}
	}
	// If an item is an array, the first element is the parent, followed by an array of filler
	while(html.length > 0) {
		unit = html.shift();
		// Screen for a node/element
		while(!(unit instanceof Node)) {
			if(unit.deferred === true) {
				// Deferred object
				unit = unit.loader(appendTo, unit.node, unit.atts, unit.raw);
				// DELETE THE LINE BELOW ONCE LOADERS ARE SET UP
				// DELETE THE LINE BELOW ONCE LOADERS ARE SET UP
				// DELETE THE LINE BELOW ONCE LOADERS ARE SET UP
				unit = $e("div", {});
			} else {
				// Must be an array
				// Get parent of next group
				let u = unit.slice(),
					x = u.shift();
				// Save current remainders
				held.push([appendTo, html]);
				// Load the new group as 'html'
				html = u[0].slice();
				// Load the new head as 'appendTo'
				appendTo = x;
				// Get the new 'unit'
				unit = html.shift();
			}
		}
		// We have a node
		// Append to parent element
		appendTo.append(unit);
		while(html.length === 0 && held.length > 0) {
			// We're out of the current array
			// See if we have more
			let last = held.pop(),
				aT = last[0];
			// Save the parent element to the new parent
			aT.append(appendTo);
			// Now set up the new appendTo and html
			appendTo = aT;
			html = last[1];
		}
	}
}


// button = this
export function loadPageFromButton() {
	var d = this.dataset,
		to = d.nextPage,
		subPage = TF.converter(d.subpage);
	return loadPageNamed(to, subPage);
}


// button = this
export function calculateFromPage() {
	var MAIN = InformationObject.MAIN,
		parent = this.parentNode,
		errors = [];
	// Look up chain until we find a statContainer node, or hit the main node
	while(!parent.classList.contains("statContainer")) {
		let p = parent.parentNode;
		if(p === MAIN) {
			break;
		}
		parent = p;
	}
	// Look for all inputs and selects
	$a("input.Stat,select[data-stat]", parent).forEach(function(input) {
		var id = input.dataset.stat,
			stat = BasicIdObject.getById(id),
			value = input.value;
		if(stat === undefined) {
			errors.push([input, id]);
			return logError(input, "Stat \"" + id + "\" not found (data-stat)");
		}
		return stat.set("value", value);
	});
}


export function calculateThenNavigate(e) {
	calculateFromPage.bind(this).call();
	loadPageFromButton.bind(this).call();
}
