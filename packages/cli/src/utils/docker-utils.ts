import { exec } from 'child_process';
import { logger } from '@elizaos/core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ContainerOptions {
  port: number;
  configDir?: string;
  characterFiles?: string[];
  target: 'dev' | 'test' | 'prod' | 'demo';
  envVars?: Record<string, string>;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  created: string;
  size: string;
}

export class DockerUtilities {
  private projectRoot: string;

  constructor() {
    // Find the project root by looking for package.json
    this.projectRoot = this.findProjectRoot();
  }

  private findProjectRoot(): string {
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    throw new Error('Could not find project root (package.json not found)');
  }

  /**
   * Check if Docker is available and running
   */
  async checkDockerAvailable(): Promise<void> {
    try {
      await execAsync('docker --version');
      await execAsync('docker info');
    } catch (error) {
      throw new Error(
        'Docker is not available or not running. Please install Docker and ensure it is running.\n' +
        'Visit https://docs.docker.com/get-docker/ for installation instructions.'
      );
    }
  }

  /**
   * Check if a Docker image exists locally
   */
  async checkImageExists(imageName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`docker images -q ${imageName}`);
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Build the elizaOS Docker image for a specific target
   */
  async buildImage(target: 'dev' | 'test' | 'prod' | 'demo' = 'prod'): Promise<void> {
    const buildScript = path.join(this.projectRoot, 'docker', 'scripts', 'build.sh');
    
    if (!fs.existsSync(buildScript)) {
      throw new Error('Build script not found. Please ensure the Docker infrastructure is properly set up.');
    }

    logger.info(`🐳 Building elizaOS Docker image for target: ${target}`);
    
    try {
      const { stdout, stderr } = await execAsync(`bash "${buildScript}" ${target}`, {
        cwd: this.projectRoot
      });
      
      if (stderr && !stderr.includes('WARNING')) {
        logger.warn('Build warnings:', stderr);
      }
      
      logger.info(`✅ Successfully built elizaos:${target}-latest`);
    } catch (error) {
      logger.error('Docker build failed:', error);
      throw new Error(`Failed to build Docker image for target ${target}`);
    }
  }

  /**
   * Ensure the Docker image exists, building it if necessary
   */
  async ensureImageExists(target: 'dev' | 'test' | 'prod' | 'demo' = 'prod'): Promise<void> {
    const imageName = `elizaos:${target}-latest`;
    const imageExists = await this.checkImageExists(imageName);
    
    if (!imageExists) {
      logger.info(`Image ${imageName} not found locally, building...`);
      await this.buildImage(target);
    } else {
      logger.info(`✅ Using existing image: ${imageName}`);
    }
  }

  /**
   * Start a container using docker-compose for the specified target
   */
  async startWithCompose(options: ContainerOptions): Promise<void> {
    const composeFile = path.join(
      this.projectRoot, 
      'docker', 
      'targets', 
      options.target, 
      'docker-compose.yml'
    );

    if (!fs.existsSync(composeFile)) {
      throw new Error(`Docker compose file not found for target: ${options.target}`);
    }

    // Create environment file if needed
    await this.createEnvFile(options);

    logger.info(`🚀 Starting elizaOS in Docker (${options.target} mode)...`);
    
    try {
      // Use docker-compose up with proper project name
      const projectName = `elizaos-${options.target}`;
      const command = `docker-compose -f "${composeFile}" -p "${projectName}" up --build`;
      
      logger.info(`Running: ${command}`);
      logger.info(`🌐 ElizaOS will be available at: http://localhost:${options.port}`);
      logger.info('💡 Press Ctrl+C to stop the container');
      
      // Run the command and stream output
      const child = exec(command, { cwd: this.projectRoot });
      
      child.stdout?.on('data', (data) => {
        process.stdout.write(data);
      });
      
      child.stderr?.on('data', (data) => {
        process.stderr.write(data);
      });
      
      // Handle process termination
      process.on('SIGINT', () => {
        logger.info('🛑 Stopping containers...');
        exec(`docker-compose -f "${composeFile}" -p "${projectName}" down`, { cwd: this.projectRoot });
        process.exit(0);
      });
      
      await new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            resolve(void 0);
          } else {
            reject(new Error(`Docker compose exited with code ${code}`));
          }
        });
      });
      
    } catch (error) {
      logger.error('Failed to start Docker container:', error);
      throw error;
    }
  }

  /**
   * Start a container directly with docker run (simpler approach)
   */
  async startContainer(options: ContainerOptions): Promise<void> {
    await this.ensureImageExists(options.target);
    
    const imageName = `elizaos:${options.target}-latest`;
    const containerName = `elizaos-${options.target}-${Date.now()}`;
    
    // Build docker run command
    const dockerArgs = [
      'run',
      '--rm',
      '--name', containerName,
      '-p', `${options.port}:3000`,
      '-p', '50000-50100:50000-50100/udp',
      ...this.getVolumeArgs(options),
      ...this.getEnvArgs(options.envVars),
      imageName
    ];

    logger.info(`🚀 Starting elizaOS container: ${containerName}`);
    logger.info(`🌐 ElizaOS will be available at: http://localhost:${options.port}`);
    logger.info('💡 Press Ctrl+C to stop the container');

    try {
      const child = exec(`docker ${dockerArgs.join(' ')}`, { cwd: this.projectRoot });
      
      child.stdout?.on('data', (data) => {
        process.stdout.write(data);
      });
      
      child.stderr?.on('data', (data) => {
        process.stderr.write(data);
      });
      
      // Handle process termination
      process.on('SIGINT', () => {
        logger.info('🛑 Stopping container...');
        exec(`docker stop ${containerName}`);
        process.exit(0);
      });
      
      await new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            resolve(void 0);
          } else {
            reject(new Error(`Docker container exited with code ${code}`));
          }
        });
      });
      
    } catch (error) {
      logger.error('Failed to start Docker container:', error);
      throw error;
    }
  }

  /**
   * Get volume mount arguments for character files and config
   */
  private getVolumeArgs(options: ContainerOptions): string[] {
    const volumes: string[] = [];
    
    // Mount character files
    if (options.characterFiles?.length) {
      for (const charFile of options.characterFiles) {
        const resolved = path.resolve(charFile);
        if (fs.existsSync(resolved)) {
          volumes.push('-v', `${resolved}:/app/characters/${path.basename(charFile)}`);
        }
      }
    }
    
    // Mount config directory
    if (options.configDir) {
      const resolved = path.resolve(options.configDir);
      if (fs.existsSync(resolved)) {
        volumes.push('-v', `${resolved}:/app/config`);
      }
    }
    
    return volumes;
  }

  /**
   * Get environment variable arguments
   */
  private getEnvArgs(envVars?: Record<string, string>): string[] {
    const args: string[] = [];
    
    // Standard environment variables
    const standardEnvVars = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'DISCORD_API_TOKEN',
      'TELEGRAM_BOT_TOKEN',
      'TWITTER_USERNAME',
      'TWITTER_PASSWORD', 
      'TWITTER_EMAIL',
      'NODE_ENV',
    ];
    
    // Add standard env vars if they exist
    for (const envVar of standardEnvVars) {
      if (process.env[envVar]) {
        args.push('-e', `${envVar}=${process.env[envVar]}`);
      }
    }
    
    // Add custom env vars
    if (envVars) {
      for (const [key, value] of Object.entries(envVars)) {
        args.push('-e', `${key}=${value}`);
      }
    }
    
    return args;
  }

  /**
   * Create environment file for docker-compose
   */
  private async createEnvFile(options: ContainerOptions): Promise<void> {
    const envFile = path.join(
      this.projectRoot,
      'docker',
      'targets',
      options.target,
      '.env'
    );

    const envContent = [
      `# Generated environment file for ${options.target} target`,
      `NODE_ENV=${options.target === 'dev' ? 'development' : 'production'}`,
      `ELIZA_PORT=${options.port}`,
      '',
      '# API Keys (set these in your shell environment)',
      `OPENAI_API_KEY=${process.env.OPENAI_API_KEY || ''}`,
      `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY || ''}`,
      `DISCORD_API_TOKEN=${process.env.DISCORD_API_TOKEN || ''}`,
      `TELEGRAM_BOT_TOKEN=${process.env.TELEGRAM_BOT_TOKEN || ''}`,
      `TWITTER_USERNAME=${process.env.TWITTER_USERNAME || ''}`,
      `TWITTER_PASSWORD=${process.env.TWITTER_PASSWORD || ''}`,
      `TWITTER_EMAIL=${process.env.TWITTER_EMAIL || ''}`,
    ].join('\n');

    await fs.promises.writeFile(envFile, envContent, 'utf8');
  }

  /**
   * List available Docker images
   */
  async listImages(): Promise<DockerImage[]> {
    try {
      const { stdout } = await execAsync('docker images --format "table {{.ID}}\\t{{.Repository}}\\t{{.Tag}}\\t{{.CreatedAt}}\\t{{.Size}}" elizaos');
      
      const lines = stdout.trim().split('\n').slice(1); // Skip header
      return lines.map(line => {
        const [id, repository, tag, created, size] = line.split('\t');
        return { id, repository, tag, created, size };
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Clean up Docker resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('🧹 Cleaning up Docker resources...');
      
      // Stop all elizaos containers
      await execAsync('docker ps -q --filter "name=elizaos" | xargs -r docker stop');
      
      // Remove stopped containers
      await execAsync('docker container prune -f');
      
      logger.info('✅ Docker cleanup completed');
    } catch (error) {
      logger.warn('Docker cleanup failed:', error);
    }
  }
} 