import { getOctokit, context } from '@actions/github';
import { setFailed, info } from '@actions/core';

const run = async () => {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) throw new Error('GITHUB_TOKEN is not defined');

        const octokit = getOctokit(token);
        const prTitle = context.payload.commits[0].message;
        const headBranch = context.ref.replace('refs/heads/', '');
        const baseBranch = 'main';
        const repoOwner = context.repo.owner;

        // Fetch collaborators
        const { data: collaborators } = await octokit.rest.repos.listCollaborators({
            owner: repoOwner,
            repo: context.repo.repo,
        });

        const assignee = collaborators.length > 0 ? collaborators[0].login : repoOwner;

        // Fetch milestones
        const { data: milestones } = await octokit.rest.issues.listMilestones({
            owner: repoOwner,
            repo: context.repo.repo,
        });
        const milestone = milestones.find((m) => m.title === 'next');

        // Create pull request
        const { data: pr } = await octokit.rest.pulls.create({
            owner: repoOwner,
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
