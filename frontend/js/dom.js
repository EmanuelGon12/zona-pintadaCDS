export function h(tagName, attributes = {}, ...children) {
  const element = document.createElement(tagName);
  let deferredValue;

  for (const [name, value] of Object.entries(attributes || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (name.startsWith("on") && typeof value === "function") {
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (name === "class") {
      element.className = value;
    } else if (name === "value") {
      deferredValue = value;
    } else if (value === true) {
      element.setAttribute(name, "");
    } else {
      element.setAttribute(name, value);
    }
  }

  appendChildren(element, children);
  if (deferredValue !== undefined) element.value = deferredValue;
  return element;
}

function appendChildren(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(parent, child);
    } else if (child instanceof Node) {
      parent.appendChild(child);
    } else {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }
}

export function fromMarkup(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

export function replaceContent(container, ...children) {
  container.replaceChildren();
  appendChildren(container, children);
}
