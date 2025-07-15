#!/usr/bin/env bun

/**
 * elizaOS CLI Docker Build Script
 * Unified TypeScript build script for all Docker targets
 * 
 * Usage:
 *   bun run docker/scripts/build.ts prod
 *   bun run docker/scripts/build.ts dev --force
 *   bun run docker/scripts/build.ts test --push
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface BuildOptions {
  target: string;
  force?: boolean;
  push?: boolean;
  platform?: string;
  tag?: string;
}

class ElizaOSDockerBuilder {
  private readonly projectRoot: string;
  private readonly dockerfilePath: string;
  private readonly buildContext: string;

  constructor() {
    this.projectRoot = join(__dirname, '../..');
    // Dockerfiles now live in target directories
    this.dockerfilePath = ''; // Will be set based on target
    this.buildContext = this.projectRoot;
  }

  /**
   * Available build targets matching Dockerfile stages
   */
  private readonly TARGETS = {
    dev: {
      stage: 'development',
      tag: 'elizaos:dev',
      description: 'Development container with live reload'
    },
    test: {
      stage: 'test',
      tag: 'elizaos:test',
      description: 'Testing container with test dependencies'
    },
    prod: {
      stage: 'production', 
      tag: 'elizaos:prod',
      description: 'Production container (optimized)'
    },
    demo: {
      stage: 'demo',
      tag: 'elizaos:demo', 
      description: 'Demo container with sample content'
    }
  };

  /**
   * Verify prerequisites before building
   */
  private verifyPrerequisites(): void {
    console.log('🔍 Verifying prerequisites...\n');
    
    // Check Docker availability
    try {
      execSync('docker --version', { stdio: 'pipe' });
      console.log('✅ Docker is available');
    } catch (error) {
      console.error('❌ Docker is not available or not in PATH');
      process.exit(1);
    }
    
    // Check Docker BuildKit support
    try {
      execSync('docker buildx version', { stdio: 'pipe' });
      console.log('✅ Docker BuildKit is available');
    } catch (error) {
      console.warn('⚠️  Docker BuildKit not available, using standard build');
    }
    
    console.log('✅ All prerequisites verified\n');
  }

  /**
   * Execute command with error handling
   */
  private executeCommand(command: string, description: string): void {
    console.log(`🔧 ${description}...`);
    console.log(`📝 Command: ${command}\n`);
    
    try {
      execSync(command, { 
        stdio: 'inherit',
        cwd: this.projectRoot,
        env: { ...process.env, DOCKER_BUILDKIT: '1' }
      });
      console.log(`✅ ${description} completed successfully\n`);
    } catch (error) {
      console.error(`❌ ${description} failed`);
      process.exit(1);
    }
  }

  /**
   * Build Docker image for specified target
   */
  async buildImage(options: BuildOptions): Promise<void> {
    const targetConfig = this.TARGETS[options.target as keyof typeof this.TARGETS];
    
    if (!targetConfig) {
      console.error(`❌ Unknown target: ${options.target}`);
      console.error(`Available targets: ${Object.keys(this.TARGETS).join(', ')}`);
      process.exit(1);
    }

    const { stage, tag: defaultTag, description } = targetConfig;
    const imageTag = options.tag || defaultTag;
    const platform = options.platform || 'linux/amd64';
    
    // Set dockerfile path based on target (prod or dev for now)
    const targetDir = options.target === 'prod' || options.target === 'demo' ? 'prod' : 'dev';
    const dockerfilePath = join(this.projectRoot, 'docker', 'targets', targetDir, 'Dockerfile');
    
    if (!existsSync(dockerfilePath)) {
      console.error(`❌ Dockerfile not found: ${dockerfilePath}`);
      process.exit(1);
    }
    
    console.log(`🚀 Building ${options.target} image`);
    console.log(`📋 Target: ${targetDir}`);
    console.log(`🏷️  Tag: ${imageTag}`);
    console.log(`📋 Platform: ${platform}`);
    console.log(`📝 Description: ${description}\n`);
    
    // Build command arguments - no target needed since each dockerfile is already optimized
    const buildArgs = [
      'docker build',
      `--file ${dockerfilePath}`,
      `--tag ${imageTag}`,
      `--platform ${platform}`,
      '--progress=plain',
      options.force ? '--no-cache' : '',
      this.buildContext
    ].filter(Boolean).join(' ');
    
    this.executeCommand(buildArgs, `Building ${options.target} image`);
    
    // Tag with latest for production builds
    if (options.target === 'prod' && !options.tag) {
      this.executeCommand(
        `docker tag ${imageTag} elizaos:latest`,
        'Tagging production image as latest'
      );
    }
  }

  /**
   * Display image information
   */
  private showImageInfo(tag: string): void {
    try {
      const output = execSync(
        `docker images ${tag} --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"`,
        { encoding: 'utf8' }
      );
      console.log(output);
    } catch (error) {
      console.warn(`⚠️ Could not get image info for ${tag}`);
    }
  }

  /**
   * Display next steps and usage
   */
  private displayNextSteps(options: BuildOptions): void {
    const targetConfig = this.TARGETS[options.target as keyof typeof this.TARGETS];
    const imageTag = options.tag || targetConfig.tag;
    
    console.log('🎉 Build completed successfully!\n');
    console.log('📋 Next steps:');
    console.log(`   1. Test the container: docker run --rm -it ${imageTag} bun --version`);
    console.log(`   2. Start CLI: elizaos start --docker [options]`);
    console.log(`   3. Start dev: elizaos dev --docker [options]\n`);
    
    console.log('🧪 Test commands:');
    console.log(`   docker run --rm ${imageTag} node -e "console.log('Node:', process.version)"`);
    console.log(`   docker run --rm ${imageTag} bun --version`);
    console.log(`   docker run --rm ${imageTag} ls -la /app\n`);
    
    console.log('📊 Image information:');
    this.showImageInfo(imageTag);
  }

  /**
   * Main build process
   */
  async build(options: BuildOptions): Promise<void> {
    const startTime = Date.now();
    
    console.log('🏗️  ElizaOS CLI Docker Builder');
    console.log('=' .repeat(50) + '\n');
    
    this.verifyPrerequisites();
    await this.buildImage(options);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  Build completed in ${duration} seconds\n`);
    
    this.displayNextSteps(options);
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): BuildOptions {
  const args = process.argv.slice(2);
  const target = args[0] || 'prod';
  
  return {
    target,
    force: args.includes('--force') || args.includes('-f'),
    push: args.includes('--push') || args.includes('-p'),
    platform: args.find(arg => arg.startsWith('--platform='))?.split('=')[1],
    tag: args.find(arg => arg.startsWith('--tag='))?.split('=')[1]
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const options = parseArguments();
    const builder = new ElizaOSDockerBuilder();
    await builder.build(options);
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.main) {
  main();
}

export { ElizaOSDockerBuilder, main }; 