import { getOctokit } from '@actions/github';
import { setFailed, info } from '@actions/core';

const run = async () => {
    try {
        // Use process.env to get the token from environment variables
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error('GITHUB_TOKEN is not defined');
        }

        const octokit = getOctokit(token);
        const context = github.context;

        const prTitle = context.payload.commits[0].message;
        const headBranch = context.ref.replace('refs/heads/', '');
        const baseBranch = 'main';

        const repoOwner = context.repo.owner;

        const { data: collaborators } = await octokit.rest.repos.listCollaborators({
            owner: repoOwner,
            repo: context.repo.repo,
        });

        const assignee = collaborators.length > 0 ? collaborators[0].login : repoOwner;

        const milestones = await octokit.rest.issues.listMilestonesForRepo({
            owner: context.repo.owner,
            repo: context.repo.repo,
        });
        const milestone = milestones.find((m) => m.title === 'next');

        // Create a pull request
        const { data: pr } = await octokit.rest.pulls.create({
            owner: context.repo.owner,
            repo: context.repo.repo,
            title: prTitle,
            head: headBranch,
            base: baseBranch,
            assignees: [assignee],
            milestone: milestone ? milestone.number : undefined,
            draft: false,
        });

        info(`Pull Request created: ${pr.html_url}`);
    } catch (error) {
        setFailed(`Action failed with error: ${error.message}`);
    }
};

run();
