const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const EXPORTS = ["buildSteps", "applyFit", "totalAll", "counts", "blockTotal", "blockFixed", "stepsSig", "BAL", "restRatios", "exWork", "exUnits", "normExercise", "planExercise", "SIDE_SWITCH", "backCalcWork", "parseSecs", "moveExercise", "moveBlock", "applyAdj", "suggestWeight"];

const html = () => fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function scriptSource() {
  const h = html();
  const a = h.indexOf("<script>") + "<script>".length;
  return h.slice(a, h.indexOf("</script>", a));
}

function loadTempo() {
  const src = scriptSource();
  const re = /\/\* @testable \*\/([\s\S]*?)\/\* @end-testable \*\//g;
  let code = "", m;
  while ((m = re.exec(src))) code += m[1] + "\n";
  code += `;({ ${EXPORTS.join(", ")} })`;
  return vm.runInNewContext(code, { DEF: { targetMin: 30 } });
}

module.exports = { loadTempo, scriptSource, EXPORTS };
