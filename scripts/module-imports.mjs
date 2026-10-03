import { parse } from 'acorn';

// Source and served-module audits share JavaScript grammar, while retaining
// their own filesystem/URL resolution and boundary policies.
export function moduleImportGroups(source, filename) {
  let ast;
  try {
    ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  } catch (error) {
    throw new SyntaxError(`${filename}: ${error.message}`, { cause: error });
  }
  const staticImports = new Set(), dynamicImports = new Set();
  function visit(node) {
    if (!node?.type) return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)
      && node.source) {
      // A computed import hides an edge from both audits. Use literal imports
      // or an explicit dispatch table so all possible modules can be checked.
      if (node.source.type !== 'Literal' || typeof node.source.value !== 'string') {
        throw new Error(`${filename}:${node.loc.start.line}: runtime imports must use literal specifiers`);
      }
      (node.type === 'ImportExpression' ? dynamicImports : staticImports).add(node.source.value);
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child?.type) visit(child);
    }
  }
  visit(ast);
  return { staticImports: [...staticImports], dynamicImports: [...dynamicImports] };
}

export function moduleImports(source, filename) {
  const { staticImports, dynamicImports } = moduleImportGroups(source, filename);
  return [...new Set([...staticImports, ...dynamicImports])].sort();
}
