import { Octokit } from "@octokit/rest";

export function createOctokit(token?: string) {
  return new Octokit({
    auth: token ?? process.env.GITHUB_TOKEN,
  });
}

export interface CreateRepoOptions {
  org: string;
  name: string;
  description?: string;
  private?: boolean;
  templateOwner?: string;
  templateRepo?: string;
  autoInit?: boolean;
}

export async function createRepositoryFromTemplate(
  octokit: Octokit,
  opts: CreateRepoOptions
) {
  if (opts.templateOwner && opts.templateRepo) {
    const response = await octokit.rest.repos.createUsingTemplate({
      template_owner: opts.templateOwner,
      template_repo: opts.templateRepo,
      owner: opts.org,
      name: opts.name,
      description: opts.description ?? "",
      private: opts.private ?? true,
    });
    return response.data;
  }

  const response = await octokit.rest.repos.createInOrg({
    org: opts.org,
    name: opts.name,
    description: opts.description ?? "",
    private: opts.private ?? true,
    auto_init: opts.autoInit ?? true,
  });
  return response.data;
}

export async function addCollaborator(
  octokit: Octokit,
  owner: string,
  repo: string,
  username: string,
  permission: "pull" | "push" | "admin" = "push"
) {
  await octokit.rest.repos.addCollaborator({
    owner,
    repo,
    username,
    permission,
  });
}

/**
 * Injects the autograding workflow YAML into the student's repo.
 * Creates .github/workflows/autograding.yml via the GitHub Contents API.
 */
export async function injectAutogradingWorkflow(
  octokit: Octokit,
  owner: string,
  repo: string,
  workflowYaml: string
): Promise<void> {
  const path = ".github/workflows/autograding.yml";
  const content = Buffer.from(workflowYaml).toString("base64");

  // Check if file already exists (e.g. from template)
  let sha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
    if (!Array.isArray(data)) sha = data.sha;
  } catch {
    // File doesn't exist yet — that's fine
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: "Add autograding workflow",
    content,
    sha,
  });
}

export async function archiveRepository(
  octokit: Octokit,
  owner: string,
  repo: string
) {
  await octokit.rest.repos.update({
    owner,
    repo,
    archived: true,
  });
}

export async function getRepositoryCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  since?: string
) {
  const response = await octokit.rest.repos.listCommits({
    owner,
    repo,
    since,
    per_page: 100,
  });
  return response.data;
}

export async function protectBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
) {
  await octokit.rest.repos.updateBranchProtection({
    owner,
    repo,
    branch,
    required_status_checks: null,
    enforce_admins: false,
    required_pull_request_reviews: null,
    restrictions: null,
  });
}

export function buildRepoName(
  courseCode: string,
  studentId: string,
  assignmentTitle: string
): string {
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  return `${sanitize(courseCode)}_${sanitize(studentId)}_${sanitize(assignmentTitle)}`;
}
