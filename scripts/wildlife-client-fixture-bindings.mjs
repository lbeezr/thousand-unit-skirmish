import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import * as wildlifeClient from '../src/wildlife-client-state.mjs';

// Bind the production disclosure/selection helpers, never capture diagnostics.
// Harnesses supply their own fog, rendering, army and command dependencies.
export function wildlifeClientBindings() {
  return { ...wildlifeClient, selectedWildlifeId: null, selectedWildlifeView: null,
    latestWildlifeView: null, wildlifePositionMemory: null };
}

export function wildlifeClientFunctionSource(source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')) {
  const names = ['selectedWildlife', 'clearWildlifeSelection', 'applyWildlifeState',
    'wildlifePointVisible', 'wildlifeEndpointLegal', 'constructionResourceNodes',
    'selectWildlife', 'issueWildlifeOrder'];
  const declarations = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body
    .filter(node => node.type === 'FunctionDeclaration');
  return names.map(name => {
    const matches = declarations.filter(node => node.id?.name === name);
    if (matches.length !== 1) throw new Error(`Expected one production ${name} function, found ${matches.length}`);
    return source.slice(matches[0].start, matches[0].end);
  }).join('\n');
}
