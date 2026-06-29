/**
 * Generates a GitHub Actions workflow file for autograding.
 * This is injected into the student's repo on creation — exactly
 * like GitHub Classroom's autograding workflow.
 */

export interface TestCase {
  name: string;
  input?: string | null;
  expectedOutput?: string | null;
  points: number;
  compareMode: string;
  timeout?: number | null;
}

export interface AutogradeConfig {
  language: string;
  buildCommand?: string | null;
  runCommand?: string | null;
  timeLimit: number;
  memoryLimit: number;
  testCases: TestCase[];
}

const LANGUAGE_SETUP: Record<string, string> = {
  PYTHON: `
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install pytest 2>/dev/null || true`,

  JAVASCRIPT: `
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install 2>/dev/null || true`,

  TYPESCRIPT: `
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install 2>/dev/null || true`,

  JAVA: `
      - uses: actions/setup-java@v4
        with:
          java-version: "21"
          distribution: "temurin"`,

  CPP: `
      - run: sudo apt-get install -y g++ 2>/dev/null || true`,

  C: `
      - run: sudo apt-get install -y gcc 2>/dev/null || true`,

  GO: `
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"`,

  RUST: `
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable`,
};

/**
 * Generates the autograding workflow YAML.
 * Produces a step per test case with input/output validation,
 * then POSTs results back to the platform webhook.
 */
export function generateAutogradingWorkflow(
  config: AutogradeConfig,
  webhookUrl: string,
  submissionId: string,
  webhookSecret: string
): string {
  const langSetup = LANGUAGE_SETUP[config.language] ?? "";

  // Build test steps
  const testSteps = config.testCases.map((tc, i) => {
    const stepId = `test_${i}`;
    const timeoutMin = Math.ceil((tc.timeout ?? config.timeLimit) / 60) || 1;

    let runScript = "";

    if (config.runCommand) {
      if (tc.input) {
        runScript = `echo '${tc.input.replace(/'/g, "\\'")}' | ${config.runCommand}`;
      } else {
        runScript = config.runCommand;
      }
    } else {
      // Default run commands per language
      const defaults: Record<string, string> = {
        PYTHON: tc.input ? `echo '${tc.input}' | python solution.py` : "python solution.py",
        JAVASCRIPT: tc.input ? `echo '${tc.input}' | node solution.js` : "node solution.js",
        TYPESCRIPT: tc.input ? `echo '${tc.input}' | npx ts-node solution.ts` : "npx ts-node solution.ts",
        JAVA: tc.input ? `echo '${tc.input}' | java Main` : "java Main",
        CPP: tc.input ? `echo '${tc.input}' | ./solution` : "./solution",
        C: tc.input ? `echo '${tc.input}' | ./solution` : "./solution",
        GO: tc.input ? `echo '${tc.input}' | go run .` : "go run .",
        RUST: tc.input ? `echo '${tc.input}' | cargo run` : "cargo run",
      };
      runScript = defaults[config.language] ?? "echo 'no run command'";
    }

    let checkOutput = "";
    if (tc.expectedOutput) {
      if (tc.compareMode === "exact") {
        checkOutput = `
        run: |
          ACTUAL=$(${runScript} 2>&1 | tr -d '\\r')
          EXPECTED="${tc.expectedOutput.replace(/"/g, '\\"')}"
          if [ "$ACTUAL" = "$EXPECTED" ]; then
            echo "PASSED"
            echo "passed=true" >> $GITHUB_OUTPUT
          else
            echo "FAILED: expected '$EXPECTED' got '$ACTUAL'"
            echo "passed=false" >> $GITHUB_OUTPUT
            exit 1
          fi`;
      } else if (tc.compareMode === "contains") {
        checkOutput = `
        run: |
          ACTUAL=$(${runScript} 2>&1)
          if echo "$ACTUAL" | grep -q "${tc.expectedOutput.replace(/"/g, '\\"')}"; then
            echo "PASSED"
            echo "passed=true" >> $GITHUB_OUTPUT
          else
            echo "FAILED: output did not contain expected string"
            echo "passed=false" >> $GITHUB_OUTPUT
            exit 1
          fi`;
      } else {
        checkOutput = `
        run: |
          ACTUAL=$(${runScript} 2>&1)
          if echo "$ACTUAL" | grep -qP "${tc.expectedOutput}"; then
            echo "PASSED"
            echo "passed=true" >> $GITHUB_OUTPUT
          else
            echo "FAILED"
            echo "passed=false" >> $GITHUB_OUTPUT
            exit 1
          fi`;
      }
    } else {
      checkOutput = `
        run: |
          ${runScript}
          echo "passed=true" >> $GITHUB_OUTPUT`;
    }

    return `
      - name: "${tc.name}"
        id: ${stepId}
        continue-on-error: true
        timeout-minutes: ${timeoutMin}${checkOutput}`;
  }).join("\n");

  // Build results JSON construction
  const resultsJson = config.testCases.map((tc, i) => {
    return `{"name":"${tc.name.replace(/"/g, '\\"')}","passed":"\${{ steps.test_${i}.outputs.passed == 'true' }}","points":${tc.points},"maxPoints":${tc.points}}`;
  }).join(",");

  const buildStep = config.buildCommand
    ? `
      - name: Build
        run: ${config.buildCommand}`
    : "";

  return `name: Autograding

on: [push]

permissions:
  checks: write
  contents: read

jobs:
  autograde:
    name: Autograding
    runs-on: ubuntu-latest
    timeout-minutes: ${Math.ceil(config.timeLimit / 60) + 5}

    steps:
      - uses: actions/checkout@v4
${langSetup}
${buildStep}
${testSteps}

      - name: Report Results
        if: always()
        env:
          WEBHOOK_URL: "${webhookUrl}"
          SUBMISSION_ID: "${submissionId}"
          WEBHOOK_SECRET: "${webhookSecret}"
        run: |
          RESULTS='[${resultsJson}]'
          RESULTS=$(echo "$RESULTS" | sed 's/"true"/true/g' | sed 's/"false"/false/g')
          PAYLOAD=$(printf '{"submissionId":"%s","commitSha":"%s","results":%s}' \\
            "$SUBMISSION_ID" "$GITHUB_SHA" "$RESULTS")
          SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')
          curl -s -X POST "$WEBHOOK_URL/api/webhooks/autograde" \\
            -H "Content-Type: application/json" \\
            -H "X-Hub-Signature-256: sha256=$SIG" \\
            -d "$PAYLOAD" || true
`;
}
