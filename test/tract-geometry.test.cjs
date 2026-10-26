const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/tract-geometry.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS,target: ts.ScriptTarget.ES2018}}).outputText;
const context = {exports:{}, Float32Array};
vm.runInNewContext(source, context);
const build = context.exports.buildTractGeometry;
const points = [[1,10,100],[2,20,200],[3,30,300],[4,40,400]];
const axes = [0,1,2].map(axis => points.map(p => p[axis]));
const expected = [1,10,100,2,20,200,2,20,200,3,30,300,3,30,300,4,40,400];
for (const [name,coords] of Object.entries({points:[points],axes:[axes],matlabOuter:[[axes,axes]],matlabInner:[[axes],[axes]]})) {
 test(name+' yields correct segments and endpoints', () => {
  const result=build({coords});
  assert.deepEqual(Array.from(result.lines),name.startsWith('matlab') ? expected.concat(expected) : expected);
  assert.deepEqual(Array.from(result.startPoints).slice(0,3),points[0]);
  assert.deepEqual(Array.from(result.endPoints).slice(0,3),points[3]);
 });
}
test('ambiguous 3x3 retains legacy interpretation and supports explicit points',()=>{
 const coords=[points.slice(0,3)];
 assert.deepEqual(Array.from(build({coords}).startPoints),[1,2,3]);
 assert.deepEqual(Array.from(build({coords,coordinateLayout:'points'}).startPoints),points[0]);
});
test('3x3 follows other unambiguous fibers in a points bundle',()=>{
 assert.deepEqual(Array.from(build({coords:[points.slice(0,3),points]}).startPoints),points[0].concat(points[0]));
});
test('malformed, empty, nonfinite and mixed layouts reject',()=>{
 for(const coords of [[],null,[[[1,2],[3],[4,5]]],[[[NaN,1,2],[1,2,3]]],[points,axes]]) assert.throws(()=>build({coords}));
});
test('worker serialization has no external dependencies',()=>{
 const worker=vm.runInNewContext('('+build.toString()+')');
 assert.deepEqual(Array.from(worker({coords:[points]}).lines),expected);
});
