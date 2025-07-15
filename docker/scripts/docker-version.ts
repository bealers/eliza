#!/usr/bin/env bun
/**
 * Docker Versioning System for elizaOS
 * Manages semantic versioning and build metadata
 */

import { $ } from "bun";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface VersionInfo {
  version: string;
  gitCommit: string;
  gitBranch: string;
  buildDate: string;
  elizaosVersion: string;
}

export class DockerVersionManager {
  private readonly versionFile = join(import.meta.dir, "../VERSION");
  
  async getCurrentVersion(): Promise<VersionInfo> {
    // Get git info
    const gitCommit = await $`git rev-parse --short HEAD`.text().then(t => t.trim());
    const gitBranch = await $`git rev-parse --abbrev-ref HEAD`.text().then(t => t.trim());
    
    // Get elizaOS version from package.json
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const elizaosVersion = packageJson.version || "latest";
    
    // Read Docker version
    let dockerVersion = "0.1.0";
    try {
      dockerVersion = readFileSync(this.versionFile, "utf8").trim();
    } catch {
      // Create initial version file
      writeFileSync(this.versionFile, dockerVersion);
    }
    
    return {
      version: dockerVersion,
      gitCommit,
      gitBranch,
      buildDate: new Date().toISOString(),
      elizaosVersion
    };
  }
  
  async bumpVersion(type: "major" | "minor" | "patch" = "patch"): Promise<string> {
    const current = await this.getCurrentVersion();
    const [major, minor, patch] = current.version.split(".").map(Number);
    
    let newVersion: string;
    switch (type) {
      case "major":
        newVersion = `${major + 1}.0.0`;
        break;
      case "minor":
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case "patch":
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }
    
    writeFileSync(this.versionFile, newVersion);
    return newVersion;
  }
  
  generateTags(baseTag: string, version: VersionInfo): string[] {
    const tags: string[] = [];
    
    // Base tag with full version
    tags.push(`${baseTag}:${version.version}`);
    
    // Git commit tag
    tags.push(`${baseTag}:${version.gitCommit}`);
    
    // Branch-based tags
    if (version.gitBranch === "main" || version.gitBranch === "master") {
      tags.push(`${baseTag}:latest`);
      tags.push(`${baseTag}:stable`);
    } else if (version.gitBranch === "develop") {
      tags.push(`${baseTag}:edge`);
    } else if (version.gitBranch.startsWith("feature/")) {
      tags.push(`${baseTag}:dev`);
    }
    
    // Date-based tag for nightlies
    const date = new Date().toISOString().split("T")[0];
    tags.push(`${baseTag}:${date}`);
    
    return tags;
  }
  
  generateBuildArgs(version: VersionInfo): string[] {
    return [
      `--build-arg VERSION=${version.version}`,
      `--build-arg BUILD_DATE=${version.buildDate}`,
      `--build-arg GIT_COMMIT=${version.gitCommit}`,
      `--build-arg GIT_BRANCH=${version.gitBranch}`,
      `--build-arg ELIZAOS_VERSION=${version.elizaosVersion}`
    ];
  }
  
  generateLabels(version: VersionInfo): string[] {
    return [
      `--label org.opencontainers.image.version=${version.version}`,
      `--label org.opencontainers.image.created=${version.buildDate}`,
      `--label org.opencontainers.image.revision=${version.gitCommit}`,
      `--label org.opencontainers.image.source=https://github.com/elizaOS/eliza`,
      `--label org.opencontainers.image.title=elizaOS`,
      `--label org.opencontainers.image.description=ElizaOS Docker Image`,
      `--label org.opencontainers.image.vendor=elizaOS`,
      `--label elizaos.version=${version.elizaosVersion}`,
      `--label elizaos.branch=${version.gitBranch}`
    ];
  }
}

// CLI interface
if (import.meta.main) {
  const manager = new DockerVersionManager();
  const args = process.argv.slice(2);
  
  if (args[0] === "bump") {
    const type = args[1] as "major" | "minor" | "patch" || "patch";
    const newVersion = await manager.bumpVersion(type);
    console.log(`Version bumped to: ${newVersion}`);
  } else if (args[0] === "info") {
    const info = await manager.getCurrentVersion();
    console.log("Version Information:");
    console.log(JSON.stringify(info, null, 2));
  } else if (args[0] === "tags") {
    const info = await manager.getCurrentVersion();
    const tags = manager.generateTags("elizaos", info);
    console.log("Generated tags:");
    tags.forEach(tag => console.log(`  - ${tag}`));
  } else {
    console.log("Usage:");
    console.log("  bun docker-version.ts info     - Show current version info");
    console.log("  bun docker-version.ts bump [major|minor|patch] - Bump version");
    console.log("  bun docker-version.ts tags     - Show generated tags");
  }
}