import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';

const serverURL = new URL('../server.mjs', import.meta.url);

// One construction phase only. Never import or execute the server entrypoint.
// Runtime state and routing hooks remain owned by each isolated fixture.
export async function loadConstructionServerFixture(sourceURL = serverURL) {
  const source = await readFile(sourceURL, 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const declaration = name => ast.body.find(node => node.type === 'FunctionDeclaration' && node.id?.name === name);
  const first = declaration('constructionEndpointSnapshotGetter');
  const last = declaration('updateWallBuildOrders');
  assert.ok(first && last && first.start < last.start, 'Production construction fixture boundaries changed');
  const helpers = ast.body.filter(node => node.start >= first.start && node.start < last.start);
  for (const name of ['constructionPoseAvailable', 'updateConstructionAccess']) {
    assert.ok(helpers.some(node => node.type === 'FunctionDeclaration' && node.id?.name === name),
      `Missing production construction helper: ${name}`);
  }
  const names = new Set();
  function visit(node, parent, key) {
    if (!node?.type) return;
    if (node.type === 'Identifier') {
      // Property labels are not imported values (unit.path is not node:path).
      if (key === 'property' && parent?.type === 'MemberExpression' && !parent.computed) return;
      if (key === 'key' && parent?.type === 'Property' && !parent.computed) return;
      names.add(node.name);
    }
    for (const [childKey, child] of Object.entries(node)) {
      if (Array.isArray(child)) child.forEach(value => visit(value, node, childKey));
      else if (child?.type) visit(child, node, childKey);
    }
  }
  // Consumers also extract the actual completion phase. Resolve its imported
  // dependencies with the same loader while keeping each caller's phase/state.
  const completion = declaration('updateBuildingAndProduction');
  [...helpers, ...(completion ? [completion] : [])].forEach(node => visit(node));
  const bindings = {};
  if (completion) {
    const queueLimit = ast.body.filter(node => node.type === 'VariableDeclaration')
      .flatMap(node => node.declarations).find(node => node.id?.name === 'MAX_QUEUED_WAYPOINTS');
    assert.ok(queueLimit?.init?.type === 'Literal' && Number.isSafeInteger(queueLimit.init.value)
      && queueLimit.init.value > 0, 'Missing production construction queue limit');
    bindings.MAX_QUEUED_WAYPOINTS = queueLimit.init.value;
  }
  for (const node of ast.body.filter(node => node.type === 'ImportDeclaration')) {
    const required = node.specifiers.filter(specifier => names.has(specifier.local.name));
    if (!required.length) continue;
    assert.ok(node.source.value.startsWith('./'), 'Construction fixtures require local production imports');
    const module = await import(new URL(node.source.value, sourceURL).href);
    for (const specifier of required) {
      if (specifier.type === 'ImportNamespaceSpecifier') bindings[specifier.local.name] = module;
      else {
        const exported = specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported.name ?? specifier.imported.value;
        assert.ok(Object.hasOwn(module, exported), `Missing production construction import: ${exported}`);
        bindings[specifier.local.name] = module[exported];
      }
    }
  }
  return { functions: source.slice(first.start, last.start), bindings };
}

const construction = await loadConstructionServerFixture();
export const constructionServerFunctions = construction.functions;
export function constructionServerBindings() {
  return { ...construction.bindings, palisadeConstructionRetries: new WeakMap(),
    movePlanningEpoch: 0, navigationRevision: 0, TICK_RATE: 30 };
}
