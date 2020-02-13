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
BasicPageObject.handlers = {
	Block: parseBlock,
	INPUT: parseInput,
	CHOOSE: parseChoose,
	BUTTON: parseButton,
	BUNDLE: parseBundle
};


var InformationObject = {
	pageTemplates: {},
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


// Parse an array of <Page> objects
export function parsePages(nodelist, sharedObject) {
	var pages = [];
	// Add in any additional properties
	populateInformation(sharedObject);
	// Parse nodes
	nodelist.forEach( node => pages.push(parsePageNodes(node)) );
	return pages;
}


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
	handle = BasicPageObject.handlers[nombre];
	if (handle !== undefined) {
		// Get the html from the handler
		return handle(node, filler);
	}
	// Assume HTML.
	atts = parseAttributesToObject(node);
	html = $e(nombre, atts);
	html.append(...filler);
	return html;
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
		div.append(...filler);
		return div;
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
		bundles = InformationObject.bundles,
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



export function parseBundle(node) {
	
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
	var MAIN = InformationObject.MAIN;
	// If we're not a subpage, clear out all previous info on-screen
	if(!subPage) {
		while(MAIN.firstChild !== null) {
			MAIN.firstChild.remove();
		}
	}
	MAIN.append(...page.html);
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
