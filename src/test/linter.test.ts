import * as assert from 'assert';
import { checkPythonFile, PythonDiagnostic } from '../linter/rules/pythonRules';
import { checkYamlFile, YamlDiagnostic } from '../linter/rules/yamlRules';

/**
 * Helper to find diagnostics by code
 */
function findByCode(diagnostics: (PythonDiagnostic | YamlDiagnostic)[], code: string) {
	return diagnostics.filter(d => d.code === code);
}

/**
 * Helper to check that a specific rule is triggered
 */
function hasRule(diagnostics: (PythonDiagnostic | YamlDiagnostic)[], code: string): boolean {
	return diagnostics.some(d => d.code === code);
}

suite('Python Linter Rules', () => {

	suite('missing-imports-star', () => {
		test('should flag file without imports star', () => {
			const code = `
def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'missing-imports-star'));
		});

		test('should not flag file with imports star', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'missing-imports-star'));
		});

		test('should find imports star even if not first line', () => {
			const code = `
from datetime import datetime
from typing import Optional
from imports import *  # <AUTO GENERATED>

def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'missing-imports-star'));
		});
	});

	suite('manual-poly-import', () => {
		test('should flag direct poly_platform imports', () => {
			const code = `
from imports import *  # <AUTO GENERATED>
from poly_platform.conversation import Conversation

def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'manual-poly-import'));
		});

		test('should not flag imports without poly_platform', () => {
			const code = `
from imports import *  # <AUTO GENERATED>
from datetime import datetime

def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'manual-poly-import'));
		});
	});

	suite('function-name-mismatch', () => {
		test('should flag when function name does not match filename', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

def wrong_name(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'function-name-mismatch'));
		});

		test('should not flag when function name matches filename', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'function-name-mismatch'));
		});
	});

	suite('decorated-helper-function', () => {
		test('should flag helper function with func_description', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Helper")
def helper_function(arg: str) -> str:
    return arg

@func_description("Main")
def my_function(conv: Conversation) -> str:
    return helper_function("test")
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'decorated-helper-function'));
		});

		test('should not flag main function with decorators', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Main function")
@func_parameter("name", "The user name")
def my_function(conv: Conversation, name: str) -> str:
    return f"Hello {name}"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'decorated-helper-function'));
		});

		test('should flag helper function with long multiline decorators', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("This is a helper that should not have decorators")
@func_parameter(
    "some_param",
    "This is a very long description that spans multiple lines and contains a lot of text "
    "to ensure that the decorator parsing logic handles multiline decorators correctly.",
)
def helper_function(conv: Conversation, some_param: str) -> str:
    return some_param

@func_description("Main function")
def my_function(conv: Conversation) -> str:
    return helper_function(conv, "test")
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'decorated-helper-function'));
		});
	});

	suite('missing-func-description', () => {
		test('should flag main function without func_description', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'missing-func-description'));
		});

		test('should not flag main function with func_description', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Says hello")
def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'missing-func-description'));
		});

		test('should not flag start_function', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

def start_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/start_function.py');
			assert.ok(!hasRule(diagnostics, 'missing-func-description'));
		});

		test('should not flag end_function', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

def end_function(conv: Conversation) -> str:
    return "goodbye"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/end_function.py');
			assert.ok(!hasRule(diagnostics, 'missing-func-description'));
		});

		test('should handle multiline func_description decorator', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description(
    "This is a very long description "
    "that spans multiple lines"
)
def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'missing-func-description'));
		});

		test('should find func_description even with long func_parameter decorators', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Call to determine whether or not the user can assist you.")
@func_parameter(
    "can_user_assist",
    'Set to "True" if the user has said that they can assist, if they ask for any details about the service request (such as the SR number, site location or SR description) or if they say that \\'maybe\\' they can help. Set to "False" if the user has said that they cannot assist. Set to "Empty" if the user has not yet specified whether or not they can assist.',
)
@func_parameter(
    "declined_recording",
    "Set to true only if the user explicitly refuses being recorded or requires recording be turned off to proceed. Otherwise set to false. ",
)
def ask_can_user_assist(conv: Conversation, can_user_assist: str, declined_recording: bool):
    pass
`;
			const diagnostics = checkPythonFile(code, '/project/functions/ask_can_user_assist.py');
			assert.ok(!hasRule(diagnostics, 'missing-func-description'));
		});
	});

	suite('missing-func-parameter', () => {
		test('should flag parameter without func_parameter decorator', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test function")
def my_function(conv: Conversation, name: str) -> str:
    return f"Hello {name}"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'missing-func-parameter'));
		});

		test('should not flag parameter with func_parameter decorator', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test function")
@func_parameter("name", "The user name")
def my_function(conv: Conversation, name: str) -> str:
    return f"Hello {name}"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'missing-func-parameter'));
		});

		test('should not flag conv parameter', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test function")
def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'missing-func-parameter'));
		});

		test('should not flag flow parameter', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test function")
def my_function(conv: Conversation, flow: Flow) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/flows/test_flow/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'missing-func-parameter'));
		});
	});

	suite('silent-error-swallowing', () => {
		test('should flag try/except with only pass', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    try:
        do_something()
    except:
        pass
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'silent-error-swallowing'));
		});

		test('should flag try/except with only print', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    try:
        do_something()
    except Exception as e:
        print(e)
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'silent-error-swallowing'));
		});

		test('should not flag try/except with proper handling', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    try:
        do_something()
    except Exception as e:
        conv.log.error(f"Error: {e}", is_pii=False)
        raise
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'silent-error-swallowing'));
		});
	});

	suite('plog-usage', () => {
		test('should flag plog import', () => {
			const code = `
from imports import *  # <AUTO GENERATED>
from poly_core.logging import plog

@func_description("Test")
def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'plog-usage'));
		});

		test('should flag plog.info call', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    plog.info("message")
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'plog-usage'));
		});

		test('should flag plog.error call', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    plog.error("error message")
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'plog-usage'));
		});

		test('should not flag conv.log usage', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    conv.log.info("message", is_pii=False)
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'plog-usage'));
		});
	});

	suite('flow-function-missing-flow-param', () => {
		test('should flag flow function without flow parameter', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/flows/test_flow/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'flow-function-missing-flow-param'));
		});

		test('should not flag flow function with flow parameter', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/flows/test_flow/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'flow-function-missing-flow-param'));
		});

		test('should not flag non-flow function without flow parameter', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    return "hello"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'flow-function-missing-flow-param'));
		});
	});

	suite('return-conv-say', () => {
		test('should flag return conv.say()', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    return conv.say("hello")
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'return-conv-say'));
		});

		test('should not flag conv.say() without return', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation) -> str:
    conv.say("hello")
    return "done"
`;
			const diagnostics = checkPythonFile(code, '/project/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'return-conv-say'));
		});
	});

	suite('exit-flow-before-transition', () => {
		test('should flag exit_flow followed by transition', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow) -> str:
    conv.exit_flow()
    return transition("next_step")
`;
			const diagnostics = checkPythonFile(code, '/project/flows/test_flow/functions/my_function.py');
			assert.ok(hasRule(diagnostics, 'exit-flow-before-transition'));
		});

		test('should not flag exit_flow alone', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow) -> str:
    conv.exit_flow()
    return "done"
`;
			const diagnostics = checkPythonFile(code, '/project/flows/test_flow/functions/my_function.py');
			assert.ok(!hasRule(diagnostics, 'exit-flow-before-transition'));
		});
	});

	suite('invalid-goto-step', () => {
		const flowStepNames = ['Manually Collect Location', 'Handle external data', 'Wait For Location From Webpage'];

		test('should flag goto_step with non-existent step name', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    flow.goto_step("Wait for external data")
    return {"utterance": "waiting"}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			assert.ok(hasRule(diagnostics, 'invalid-goto-step'));
			const matches = findByCode(diagnostics, 'invalid-goto-step');
			assert.strictEqual(matches.length, 1);
			assert.ok(matches[0].message.includes('Wait for external data'));
		});

		test('should not flag goto_step with valid step name', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    flow.goto_step("Manually Collect Location")
    return {"utterance": "collecting"}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should flag multiple invalid goto_step calls', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    if something:
        flow.goto_step("Non Existent Step")
    else:
        flow.goto_step("Also Not Real")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			const matches = findByCode(diagnostics, 'invalid-goto-step');
			assert.strictEqual(matches.length, 2);
		});

		test('should handle mix of valid and invalid goto_step calls', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    flow.goto_step("Manually Collect Location")
    flow.goto_step("Wait for external data")
    flow.goto_step("Handle external data")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			const matches = findByCode(diagnostics, 'invalid-goto-step');
			assert.strictEqual(matches.length, 1);
			assert.ok(matches[0].message.includes('Wait for external data'));
		});

		test('should not flag goto_step in non-flow functions', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation):
    flow.goto_step("Non Existent Step")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/functions/my_function.py',
				{ flowStepNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should handle single-quoted step names', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    flow.goto_step('Does Not Exist')
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			assert.ok(hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should list available steps in error message', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    flow.goto_step("Bogus Step")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			const matches = findByCode(diagnostics, 'invalid-goto-step');
			assert.strictEqual(matches.length, 1);
			assert.ok(matches[0].message.includes('Manually Collect Location'));
			assert.ok(matches[0].message.includes('Handle external data'));
		});

		test('should skip rule when no step names available', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    flow.goto_step("Anything")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py'
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should handle goto_step with second argument', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    flow.goto_step("Handle external data", "Some Label")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should flag invalid goto_step with second argument', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    flow.goto_step("nonexistent_step", "Label")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			assert.ok(hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should not flag commented-out goto_step (full line)', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    # flow.goto_step("Wait for external data")
    flow.goto_step("Manually Collect Location")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should not flag goto_step after inline comment', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    flow.goto_step("Manually Collect Location")  # flow.goto_step("Wait for external data")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowStepNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-step'));
		});
	});

	suite('invalid-goto-step in function_steps', () => {
		const flowStepNames = ['Ask Vendor Question', 'Initiate Vendor Dial', 'get_next_match', 'check_delivery_strategy'];

		test('should flag invalid goto_step in function_steps file', () => {
			const code = `
from _gen import *  # <AUTO GENERATED>

def my_step(conv: Conversation, flow: Flow):
    flow.goto_step("nonexistent_step")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/function_steps/my_step.py',
				{ flowStepNames }
			);
			assert.ok(hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should not flag valid step name in function_steps file', () => {
			const code = `
from _gen import *  # <AUTO GENERATED>

def my_step(conv: Conversation, flow: Flow):
    flow.goto_step("Ask Vendor Question")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/function_steps/my_step.py',
				{ flowStepNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should not flag valid function step name in function_steps file', () => {
			const code = `
from _gen import *  # <AUTO GENERATED>

def my_step(conv: Conversation, flow: Flow):
    flow.goto_step("get_next_match")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/function_steps/my_step.py',
				{ flowStepNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should handle goto_step with second argument in function_steps', () => {
			const code = `
from _gen import *  # <AUTO GENERATED>

def my_step(conv: Conversation, flow: Flow):
    flow.goto_step("check_delivery_strategy", "Vendor Reconfirmed")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/function_steps/my_step.py',
				{ flowStepNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-step'));
		});

		test('should not run other function rules on function_steps files', () => {
			const code = `
from _gen import *  # <AUTO GENERATED>

def my_step(conv: Conversation, flow: Flow):
    flow.goto_step("get_next_match")
    return {}
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/function_steps/my_step.py',
				{ flowStepNames }
			);
			assert.ok(!hasRule(diagnostics, 'missing-func-description'));
		});
	});

	suite('invalid-goto-flow', () => {
		const flowNames = ['ROADSIDE_ASSISTANCE', 'SMS flow', 'IDNV'];

		test('should flag goto_flow with non-existent flow name', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation):
    conv.goto_flow("NONEXISTENT_FLOW")
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/functions/my_function.py',
				{ flowNames }
			);
			assert.ok(hasRule(diagnostics, 'invalid-goto-flow'));
			const matches = findByCode(diagnostics, 'invalid-goto-flow');
			assert.strictEqual(matches.length, 1);
			assert.ok(matches[0].message.includes('NONEXISTENT_FLOW'));
		});

		test('should not flag goto_flow with valid flow name', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation):
    conv.goto_flow("ROADSIDE_ASSISTANCE")
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/functions/my_function.py',
				{ flowNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-flow'));
		});

		test('should not flag goto_flow with variable argument', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation):
    conv.goto_flow(flow_name)
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/functions/my_function.py',
				{ flowNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-flow'));
		});

		test('should flag invalid goto_flow in flow function', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation, flow: Flow):
    conv.goto_flow("BAD_FLOW")
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/functions/my_function.py',
				{ flowNames, flowStepNames: ['Some Step'] }
			);
			assert.ok(hasRule(diagnostics, 'invalid-goto-flow'));
		});

		test('should flag invalid goto_flow in function_steps', () => {
			const code = `
from _gen import *  # <AUTO GENERATED>

def my_step(conv: Conversation, flow: Flow):
    conv.goto_flow("BAD_FLOW")
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/flows/test_flow/function_steps/my_step.py',
				{ flowNames, flowStepNames: ['Some Step'] }
			);
			assert.ok(hasRule(diagnostics, 'invalid-goto-flow'));
		});

		test('should list available flows in error message', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation):
    conv.goto_flow("WRONG")
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/functions/my_function.py',
				{ flowNames }
			);
			const matches = findByCode(diagnostics, 'invalid-goto-flow');
			assert.strictEqual(matches.length, 1);
			assert.ok(matches[0].message.includes('ROADSIDE_ASSISTANCE'));
			assert.ok(matches[0].message.includes('SMS flow'));
		});

		test('should skip rule when no flow names available', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation):
    conv.goto_flow("anything")
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/functions/my_function.py'
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-flow'));
		});

		test('should handle single-quoted flow name', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation):
    conv.goto_flow('SMS flow')
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/functions/my_function.py',
				{ flowNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-flow'));
		});

		test('should not flag commented-out goto_flow (full line)', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation):
    # conv.goto_flow("NONEXISTENT_FLOW")
    conv.goto_flow("ROADSIDE_ASSISTANCE")
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/functions/my_function.py',
				{ flowNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-flow'));
		});

		test('should not flag goto_flow after inline comment', () => {
			const code = `
from imports import *  # <AUTO GENERATED>

@func_description("Test")
def my_function(conv: Conversation):
    conv.goto_flow("ROADSIDE_ASSISTANCE")  # conv.goto_flow("NONEXISTENT_FLOW")
`;
			const diagnostics = checkPythonFile(
				code,
				'/project/functions/my_function.py',
				{ flowNames }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-goto-flow'));
		});
	});

	suite('non-function files', () => {
		test('should not lint files outside functions directory', () => {
			const code = `
# This file doesn't have proper imports
def some_utility():
    pass
`;
			const diagnostics = checkPythonFile(code, '/project/utils/helper.py');
			assert.strictEqual(diagnostics.length, 0);
		});
	});
});

suite('YAML Linter Rules', () => {

	suite('flow_config.yaml rules', () => {
		test('should flag empty flow config', () => {
			const yaml = ``;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/flow_config.yaml');
			assert.ok(hasRule(diagnostics, 'empty-flow-config'));
		});

		test('should flag missing name', () => {
			const yaml = `
description: "Test flow"
start_step: "start"
`;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/flow_config.yaml');
			assert.ok(hasRule(diagnostics, 'flow-config-missing-name'));
		});

		test('should flag missing description', () => {
			const yaml = `
name: "Test Flow"
start_step: "start"
`;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/flow_config.yaml');
			assert.ok(hasRule(diagnostics, 'flow-config-missing-description'));
		});

		test('should flag empty description', () => {
			const yaml = `
name: "Test Flow"
description: ""
start_step: "start"
`;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/flow_config.yaml');
			assert.ok(hasRule(diagnostics, 'flow-config-missing-description'));
		});

		test('should flag missing start_step', () => {
			const yaml = `
name: "Test Flow"
description: "A test flow"
`;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/flow_config.yaml');
			assert.ok(hasRule(diagnostics, 'flow-config-missing-start-step'));
		});

		test('should pass valid flow config', () => {
			const yaml = `
name: "Test Flow"
description: "A valid test flow"
start_step: "start"
`;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/flow_config.yaml');
			assert.ok(!hasRule(diagnostics, 'flow-config-missing-name'));
			assert.ok(!hasRule(diagnostics, 'flow-config-missing-description'));
			assert.ok(!hasRule(diagnostics, 'flow-config-missing-start-step'));
		});
	});

	suite('step file rules', () => {
		test('should flag step without name', () => {
			const yaml = `
step_type: "collect"
prompt: "Hello"
`;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/steps/my_step.yaml');
			assert.ok(hasRule(diagnostics, 'step-missing-name'));
		});

		test('should not flag step with name', () => {
			const yaml = `
name: "my_step"
step_type: "collect"
prompt: "Hello"
`;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/steps/my_step.yaml');
			assert.ok(!hasRule(diagnostics, 'step-missing-name'));
		});

		test('should flag conv.state in prompt', () => {
			const yaml = `
name: "my_step"
prompt: "Hello conv.state.user_name, how are you?"
`;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/steps/my_step.yaml');
			assert.ok(hasRule(diagnostics, 'conv-state-in-prompt'));
		});

		test('should not flag $variable in prompt', () => {
			const yaml = `
name: "my_step"
prompt: "Hello $user_name, how are you?"
`;
			const diagnostics = checkYamlFile(yaml, '/project/flows/test_flow/steps/my_step.yaml');
			assert.ok(!hasRule(diagnostics, 'conv-state-in-prompt'));
		});
	});

	suite('invalid-child-step', () => {
		const childStepTargets = ['Collect Name', 'Confirm Details', 'call_client_matches', 'confirmation_failure_handoff'];

		test('should flag child_step referencing non-existent target', () => {
			const yaml = `
name: "My Step"
conditions:
  - name: "Some Condition"
    condition_type: step_condition
    child_step: nonexistent_step
`;
			const diagnostics = checkYamlFile(
				yaml,
				'/project/flows/test_flow/steps/my_step.yaml',
				{ childStepTargets }
			);
			assert.ok(hasRule(diagnostics, 'invalid-child-step'));
			const matches = findByCode(diagnostics, 'invalid-child-step');
			assert.strictEqual(matches.length, 1);
			assert.ok(matches[0].message.includes('nonexistent_step'));
		});

		test('should not flag child_step referencing valid step name', () => {
			const yaml = `
name: "My Step"
conditions:
  - name: "Go to Collect Name"
    condition_type: step_condition
    child_step: Collect Name
`;
			const diagnostics = checkYamlFile(
				yaml,
				'/project/flows/test_flow/steps/my_step.yaml',
				{ childStepTargets }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-child-step'));
		});

		test('should not flag child_step referencing valid function step', () => {
			const yaml = `
name: "My Step"
conditions:
  - name: "Details Confirmed"
    condition_type: step_condition
    child_step: call_client_matches
`;
			const diagnostics = checkYamlFile(
				yaml,
				'/project/flows/test_flow/steps/my_step.yaml',
				{ childStepTargets }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-child-step'));
		});

		test('should flag multiple invalid child_step references', () => {
			const yaml = `
name: "My Step"
conditions:
  - name: "Condition A"
    condition_type: step_condition
    child_step: does_not_exist
  - name: "Condition B"
    condition_type: step_condition
    child_step: also_invalid
`;
			const diagnostics = checkYamlFile(
				yaml,
				'/project/flows/test_flow/steps/my_step.yaml',
				{ childStepTargets }
			);
			const matches = findByCode(diagnostics, 'invalid-child-step');
			assert.strictEqual(matches.length, 2);
		});

		test('should handle mix of valid and invalid child_step references', () => {
			const yaml = `
name: "My Step"
conditions:
  - name: "Valid"
    condition_type: step_condition
    child_step: call_client_matches
  - name: "Invalid"
    condition_type: step_condition
    child_step: bogus_step
`;
			const diagnostics = checkYamlFile(
				yaml,
				'/project/flows/test_flow/steps/my_step.yaml',
				{ childStepTargets }
			);
			const matches = findByCode(diagnostics, 'invalid-child-step');
			assert.strictEqual(matches.length, 1);
			assert.ok(matches[0].message.includes('bogus_step'));
		});

		test('should list available targets in error message', () => {
			const yaml = `
name: "My Step"
conditions:
  - name: "Bad"
    condition_type: step_condition
    child_step: wrong
`;
			const diagnostics = checkYamlFile(
				yaml,
				'/project/flows/test_flow/steps/my_step.yaml',
				{ childStepTargets }
			);
			const matches = findByCode(diagnostics, 'invalid-child-step');
			assert.strictEqual(matches.length, 1);
			assert.ok(matches[0].message.includes('Collect Name'));
			assert.ok(matches[0].message.includes('call_client_matches'));
		});

		test('should skip rule when no targets available', () => {
			const yaml = `
name: "My Step"
conditions:
  - name: "Some Condition"
    condition_type: step_condition
    child_step: anything
`;
			const diagnostics = checkYamlFile(
				yaml,
				'/project/flows/test_flow/steps/my_step.yaml'
			);
			assert.ok(!hasRule(diagnostics, 'invalid-child-step'));
		});

		test('should not flag step without conditions', () => {
			const yaml = `
name: "My Step"
prompt: "Hello"
`;
			const diagnostics = checkYamlFile(
				yaml,
				'/project/flows/test_flow/steps/my_step.yaml',
				{ childStepTargets }
			);
			assert.ok(!hasRule(diagnostics, 'invalid-child-step'));
		});
	});

	suite('topic file rules', () => {
		test('should flag too many example queries', () => {
			const yaml = `
name: "test_topic"
example_queries:
  - "query 1"
  - "query 2"
  - "query 3"
  - "query 4"
  - "query 5"
  - "query 6"
  - "query 7"
  - "query 8"
  - "query 9"
  - "query 10"
  - "query 11"
`;
			const diagnostics = checkYamlFile(yaml, '/project/topics/test_topic.yaml');
			assert.ok(hasRule(diagnostics, 'too-many-example-queries'));
		});

		test('should not flag 10 or fewer example queries', () => {
			const yaml = `
name: "test_topic"
example_queries:
  - "query 1"
  - "query 2"
  - "query 3"
`;
			const diagnostics = checkYamlFile(yaml, '/project/topics/test_topic.yaml');
			assert.ok(!hasRule(diagnostics, 'too-many-example-queries'));
		});

		test('should flag function reference in content field', () => {
			const yaml = `
name: "test_topic"
content: "Please call {{fn:do_something}} for help"
`;
			const diagnostics = checkYamlFile(yaml, '/project/topics/test_topic.yaml');
			assert.ok(hasRule(diagnostics, 'functions-outside-actions'));
		});

		test('should not flag function reference inside actions', () => {
			const yaml = `
name: "test_topic"
content: "How can I help you?"
actions: "Call {{fn:do_something}} to process"
`;
			const diagnostics = checkYamlFile(yaml, '/project/topics/test_topic.yaml');
			// Check that functions-outside-actions is not triggered
			assert.ok(!hasRule(diagnostics, 'functions-outside-actions'));
		});

		test('should flag variable in content field', () => {
			const yaml = `
name: "test_topic"
content: "Hello $user_name"
`;
			const diagnostics = checkYamlFile(yaml, '/project/topics/test_topic.yaml');
			assert.ok(hasRule(diagnostics, 'variables-outside-actions'));
		});

		test('should flag output-oriented pattern in actions', () => {
			// Note: Rule checks 'actions' field for output-oriented patterns
			const yaml = `
name: "test_topic"
content: "Help the user"
actions: "Say: 'Hello, how can I help you today?'"
`;
			const diagnostics = checkYamlFile(yaml, '/project/topics/test_topic.yaml');
			assert.ok(hasRule(diagnostics, 'output-oriented-prompt'));
		});

		test('should not flag instructional actions', () => {
			const yaml = `
name: "test_topic"
content: "Help the user"
actions: "Greet the user and ask how you can help them."
`;
			const diagnostics = checkYamlFile(yaml, '/project/topics/test_topic.yaml');
			assert.ok(!hasRule(diagnostics, 'output-oriented-prompt'));
		});
	});

	suite('non-agent-studio files', () => {
		test('should not lint random YAML files', () => {
			const yaml = `
# Random config file
key: value
`;
			const diagnostics = checkYamlFile(yaml, '/project/config/settings.yaml');
			assert.strictEqual(diagnostics.length, 0);
		});
	});
});

suite('Linter Config', () => {
	// Note: Config tests would require file system mocking
	// These are integration tests that should be run manually or with proper mocking
	
	test('placeholder for config tests', () => {
		// Config loading is tested implicitly through CLI testing
		assert.ok(true);
	});
});

