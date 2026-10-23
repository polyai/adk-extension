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
	});
});
