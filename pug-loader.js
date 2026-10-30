// Compiles a .pug file into a module whose export is the template function,
// so `import tpl from "./x.pug"` gives tpl(locals) -> HTML string.
const pug = require("pug");

module.exports = function (source) {
  const template = pug.compileClient(source, {
    filename: this.resourcePath,
    compileDebug: false,
    doctype: "html",
  });
  return `${template}\nmodule.exports = template;\n`;
};
