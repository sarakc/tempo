const test = require("node:test");
const vm = require("node:vm");
const { scriptSource } = require("./load");

test("app script parses", () => {
  new vm.Script(scriptSource());
});
