import { IFileItem } from "./models/Room";
import crypto from "crypto";

export interface GitHubImportResult {
    success: boolean;
    files: IFileItem[];
    error?: string;
    repoName?: string;
}

export interface GitHubCommitResult {
    success: boolean;
    commitSha?: string;
    commitUrl?: string;
    error?: string;
}

// Parse "owner/repo" or "https://github.com/owner/repo"
export const parseRepoSlug = (input: string): { owner: string; repo: string } | null => {
    let clean = input.trim();
    clean = clean.replace(/\.git$/, "");
    if (clean.includes("github.com/")) {
        const parts = clean.split("github.com/")[1]?.split("/");
        if (parts && parts[0] && parts[1]) {
            return { owner: parts[0], repo: parts[1] };
        }
    }
    const parts = clean.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
        return { owner: parts[0], repo: parts[1] };
    }
    return null;
};

// Import repo files into our FileItem tree
export const importFromGitHub = async (
    repoInput: string,
    token?: string
): Promise<GitHubImportResult> => {
    const slug = parseRepoSlug(repoInput);
    if (!slug) {
        return { success: false, files: [], error: "Invalid repository format. Use 'owner/repo' or GitHub URL." };
    }

    const { owner, repo } = slug;
    const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CollaborativeCodeEditor",
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        // 1. Get default branch
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
        if (!repoRes.ok) {
            return { success: false, files: [], error: `GitHub repo not found (${repoRes.status})` };
        }
        const repoData: any = await repoRes.json();
        const defaultBranch = repoData.default_branch || "main";

        // 2. Fetch git tree recursively
        const treeRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
            { headers }
        );
        if (!treeRes.ok) {
            return { success: false, files: [], error: `Failed to fetch repo tree (${treeRes.status})` };
        }
        const treeData: any = await treeRes.json();
        const treeItems: any[] = treeData.tree || [];

        // 3. Convert tree items into FileItems with parent relationships
        const pathIdMap = new Map<string, string>();
        const files: IFileItem[] = [];

        // First create folders
        for (const item of treeItems) {
            if (item.type === "tree") {
                const id = `folder-${crypto.randomUUID()}`;
                pathIdMap.set(item.path, id);
                const parentPath = item.path.includes("/")
                    ? item.path.substring(0, item.path.lastIndexOf("/"))
                    : null;
                const parentId = parentPath ? pathIdMap.get(parentPath) || null : null;
                const name = item.path.split("/").pop() || item.path;

                files.push({
                    id,
                    name,
                    type: "folder",
                    parentId,
                    updatedAt: new Date(),
                });
            }
        }

        // Limit file fetch to first 30 relevant files to keep imports fast and avoid rate limits
        const blobItems = treeItems.filter((i) => i.type === "blob").slice(0, 35);

        for (const item of blobItems) {
            const id = `file-${crypto.randomUUID()}`;
            pathIdMap.set(item.path, id);
            const parentPath = item.path.includes("/")
                ? item.path.substring(0, item.path.lastIndexOf("/"))
                : null;
            const parentId = parentPath ? pathIdMap.get(parentPath) || null : null;
            const name = item.path.split("/").pop() || item.path;

            // Fetch file content if size is reasonable (< 300KB)
            let content = "";
            if (item.size && item.size < 300000) {
                try {
                    const rawRes = await fetch(
                        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${item.path}`
                    );
                    if (rawRes.ok) {
                        content = await rawRes.text();
                    }
                } catch {
                    content = "// Content could not be loaded";
                }
            }

            files.push({
                id,
                name,
                type: "file",
                parentId,
                content,
                updatedAt: new Date(),
            });
        }

        return {
            success: true,
            files,
            repoName: `${owner}/${repo}`,
        };
    } catch (err: any) {
        return { success: false, files: [], error: err.message || "Failed to import repo" };
    }
};

// Fetch commit history from a GitHub repository
export const getGitHubCommits = async (
    repoInput: string,
    token?: string
): Promise<any[]> => {
    const slug = parseRepoSlug(repoInput);
    if (!slug) return [];

    const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CollaborativeCodeEditor",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
        const res = await fetch(
            `https://api.github.com/repos/${slug.owner}/${slug.repo}/commits?per_page=15`,
            { headers }
        );
        if (!res.ok) return [];
        const data: any = await res.json();
        return (data || []).map((c: any) => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message,
            author: c.commit.author.name,
            date: c.commit.author.date,
            url: c.html_url,
        }));
    } catch {
        return [];
    }
};

