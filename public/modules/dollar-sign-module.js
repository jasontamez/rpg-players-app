// get element by ID
export function $i(id, doc = document) {
	return doc.getElementById(id);
}
// query selector
export function $q(query, doc = document) {
	return doc.querySelector(query);
}
// query selector all
export function $a(query, doc = document) {
	return doc.querySelectorAll(query);
}
// create element, [classes], [atts], text
export function $eca(tag, c = [], a = [], text="") {
	var e = document.createElement(tag);
	e.textContent = text;
	e.classList.add(...c);
	a.forEach(function(pair) {
		e.setAttribute(pair[0], pair[1]);
	});
	return e;
}
// create element, [classes], text
export function $ec(tag, c = [], text="") {
	var e = document.createElement(tag);
	e.textContent = text;
	e.classList.add(...c);
	return e;
}
// create element, {atts}, text
export function $ea(tag, a = {}, text="") {
	var e = document.createElement(tag), classes = a.class;
	e.textContent = text;
	if(classes !== undefined) {
		delete a.class;
		classes = classes.split(/\s+/);
	} else {
		classes = [];
	}
	Object.getOwnPropertyNames(a).forEach(nombre => e.setAttribute(nombre, a[nombre]));
	e.classList.add(...classes);
	return e;
}
// create element, text
export function $e(tag, text="") {
	var e = document.createElement(tag);
	e.textContent = text;
	return e;
}
// create text node
export function $t(text) {
	return document.createTextNode(text);
}
// add event listeners - click and enter
export function $listen(element, func, event = "click") {
	element.addEventListener(event, func);
	//element.addEventListener("keydown", ev => ev.keyCode === 13 && func.bind(ev.currentTarget, ev).call());
	// Apparently, hitting Enter while a button is selected will fire a click event
}
