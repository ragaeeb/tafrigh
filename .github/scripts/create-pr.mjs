import { getOctokit, context } from '@actions/github'; // Import 'context' from '@actions/github'
import { setFailed, info } from '@actions/core';

const run = async () => {
    try {
        // Use process.env to get the token from environment variables
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error('GITHUB_TOKEN is not defined');
        }

        const octokit = getOctokit(token); // Initialize Octokit with the token

        const prTitle = context.payload.commits[0].message; // Get the PR title from the commit message
        const headBranch = context.ref.replace('refs/heads/', ''); // Get the branch name
        const baseBranch = 'main'; // The base branch for the PR

        const repoOwner = context.repo.owner; // Repository owner

        // Fetch the list of collaborators
        const { data: collaborators } = await octokit.rest.repos.listCollaborators({
            owner: repoOwner,
            repo: context.repo.repo,
        });

        // If there are collaborators, pick the first one; otherwise, fallback to the repo owner
        const assignee = collaborators.length > 0 ? collaborators[0].login : repoOwner;

        // Fetch milestone number for "next"
        const { data: milestones } = await octokit.rest.issues.listMilestonesForRepo({
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
