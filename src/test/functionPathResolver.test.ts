import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FunctionPathResolver } from '../functionPathResolver';

/**
 * These tests exercise real filesystem structures (unlike linter.test.ts's fake-path tests)
 * because FunctionPathResolver's variant-attribute resolution has no test-only override hook —
 * it walks real directories and parses a real YAML file.
 */
suite('FunctionPathResolver', () => {
	let tmpDir: string;

	setup(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adk-ext-test-'));
	});

	teardown(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	function writeProject(variantAttributesContent: string): string {
		const configDir = path.join(tmpDir, 'config');
		fs.mkdirSync(configDir, { recursive: true });
		const attrPath = path.join(configDir, 'variant_attributes.yaml');
		fs.writeFileSync(attrPath, variantAttributesContent);

		const stepFile = path.join(tmpDir, 'topics', 'some_topic.yaml');
		fs.mkdirSync(path.dirname(stepFile), { recursive: true });
		fs.writeFileSync(stepFile, 'name: some_topic\n');
		return stepFile;
	}

	suite('findVariantAttributesPath', () => {
		test('finds config/variant_attributes.yaml even without a global functions/ directory', () => {
			// Project has flows/ and config/, but no top-level functions/ — findProjectRoot
			// would return null for this layout, so findVariantAttributesPath must not depend on it.
			const flowDir = path.join(tmpDir, 'flows', 'my_flow');
			fs.mkdirSync(flowDir, { recursive: true });
			fs.writeFileSync(path.join(flowDir, 'flow_config.yaml'), 'name: my_flow\n');

			const configDir = path.join(tmpDir, 'config');
			fs.mkdirSync(configDir, { recursive: true });
			const attrPath = path.join(configDir, 'variant_attributes.yaml');
			fs.writeFileSync(attrPath, 'attributes:\n  - name: site_name\n');

			const stepFile = path.join(flowDir, 'steps', 'greeting.yaml');
			fs.mkdirSync(path.dirname(stepFile), { recursive: true });
			fs.writeFileSync(stepFile, 'name: greeting\n');

			assert.strictEqual(FunctionPathResolver.findVariantAttributesPath(stepFile), attrPath);
			assert.ok(FunctionPathResolver.findVariantAttributeNames(stepFile).has('site_name'));
		});
	});

	suite('resolveVariantAttributeLocation', () => {
		test('resolves a name entry with a trailing comment', () => {
			const stepFile = writeProject(
				'attributes:\n' +
				'  - name: site_name # display name\n' +
				'    values:\n' +
				'      voice: Example Site\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 1);
		});

		test('resolves a name entry that appears after other keys in the mapping', () => {
			const stepFile = writeProject(
				'attributes:\n' +
				'  - values:\n' +
				'      voice: Example Site\n' +
				'    name: site_name\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 3);
		});

		test('does not match a name substring inside another entry', () => {
			const stepFile = writeProject(
				'attributes:\n' +
				'  - name: site_name_extended\n' +
				'  - name: site_name\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 2);
		});

		test('allows a trailing comment on the attributes section header', () => {
			const stepFile = writeProject(
				'attributes: # project attributes\n' +
				'  - name: site_name\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 1);
		});

		test('skips a full-line comment between entries without ending the search', () => {
			const stepFile = writeProject(
				'attributes:\n' +
				'  - name: other_attribute\n' +
				'# a comment at column 0, not a top-level key\n' +
				'  - name: site_name\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 3);
		});

		test('does not match "name:" text nested inside another entry\'s block-scalar value', () => {
			const stepFile = writeProject(
				'attributes:\n' +
				'  - name: greeting\n' +
				'    values:\n' +
				'      voice: |-\n' +
				'        Some text that happens to contain\n' +
				'        name: site_name\n' +
				'        as literal content.\n' +
				'  - name: site_name\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 7);
		});

		test('resolves a dash-only entry whose keys are indented on following lines', () => {
			const stepFile = writeProject(
				'attributes:\n' +
				'  -\n' +
				'    name: site_name\n' +
				'    values:\n' +
				'      voice: Example Site\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 2);
		});

		test('resolves a flow-style (inline) attributes definition', () => {
			const stepFile = writeProject(
				'attributes: [{name: site_name, values: {voice: Example Site}}]\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 0);
		});

		test('resolves an inline flow-style mapping entry inside a block sequence', () => {
			const stepFile = writeProject(
				'attributes:\n' +
				'  - {name: site_name, values: {voice: Example Site}}\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 1);
		});

		test('does not match a dash-prefixed line of literal text inside a block-scalar value', () => {
			const stepFile = writeProject(
				'attributes:\n' +
				'  - name: greeting\n' +
				'    values:\n' +
				'      voice: |-\n' +
				'        Some text that happens to contain\n' +
				'        - name: site_name\n' +
				'        as literal content.\n' +
				'  - name: site_name\n'
			);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 7);
		});

		test('does not let a scalar value containing "name: X" claim a later attribute in a flow-style list', () => {
			const lineText = 'attributes: [{name: greeting, voice: "name: site_name"}, {name: site_name}]\n';
			const stepFile = writeProject(lineText);

			const location = FunctionPathResolver.resolveVariantAttributeLocation('site_name', stepFile);
			assert.ok(location);
			assert.strictEqual(location!.line, 0);
			// The real "name: site_name" key is in the second {..} group; the quoted scalar
			// containing the same literal text comes first and must not be mistaken for it.
			const secondGroupStart = lineText.lastIndexOf('{name: site_name}');
			assert.ok(location!.character >= secondGroupStart);
		});
	});

	suite('buildVariantAttributeIndex', () => {
		test('indexes every attribute in one pass, reusable across multiple lookups', () => {
			const stepFile = writeProject(
				'attributes:\n' +
				'  - name: site_name\n' +
				'  - name: greeting\n'
			);

			const index = FunctionPathResolver.buildVariantAttributeIndex(stepFile);
			assert.strictEqual(index.size, 2);
			assert.strictEqual(index.get('site_name')?.line, 1);
			assert.strictEqual(index.get('greeting')?.line, 2);
			assert.strictEqual(index.get('missing'), undefined);
		});
	});
});
