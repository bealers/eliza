import { logger } from '@elizaos/core';
import { DockerUtilities, type ContainerOptions } from '../../../utils/docker-utils';
import { type StartOptions } from '../types';

/**
 * Start elizaOS using Docker containers
 */
export async function startWithDocker(
  options: StartOptions & { character?: string[] }
): Promise<void> {
  const dockerUtils = new DockerUtilities();

  try {
    // Check Docker availability first
    logger.info('🔍 Checking Docker availability...');
    await dockerUtils.checkDockerAvailable();

    // Determine target based on environment or default to prod
    const target = process.env.NODE_ENV === 'development' ? 'dev' : 'prod';
    
    // Prepare container options
    const containerOptions: ContainerOptions = {
      port: options.port || 3000,
      configDir: options.configDir,
      characterFiles: options.character || [],
      target: target,
      envVars: {
        // Pass through any additional environment variables
        ...(process.env.NODE_ENV && { NODE_ENV: process.env.NODE_ENV }),
      },
    };

    logger.info(`🐳 Starting elizaOS in Docker (${target} mode)...`);
    logger.info(`📁 Project root: ${process.cwd()}`);
    
    if (containerOptions.characterFiles?.length) {
      logger.info(`🎭 Character files: ${containerOptions.characterFiles.join(', ')}`);
    }

    // Start using docker-compose for better integration
    await dockerUtils.startWithCompose(containerOptions);

  } catch (error) {
    logger.error('❌ Docker start failed:', error);
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('Docker is not available')) {
        logger.info('💡 To install Docker:');
        logger.info('   • Visit: https://docs.docker.com/get-docker/');
        logger.info('   • For macOS: brew install --cask docker');
        logger.info('   • For Ubuntu: sudo apt install docker.io');
        logger.info('   • For Windows: Download Docker Desktop');
      } else if (error.message.includes('Docker compose file not found')) {
        logger.info('💡 The Docker infrastructure may not be set up correctly.');
        logger.info('   • Ensure you are in the correct project directory');
        logger.info('   • Check that docker/targets/ directories exist');
      }
    }
    
    // Graceful fallback suggestion
    logger.info('💡 Try running without --docker flag for direct execution:');
    logger.info(`   elizaos start ${options.character ? `--character ${options.character.join(' ')}` : ''}`);
    
    throw error;
  }
}

/**
 * Start elizaOS using simple docker run (alternative method)
 */
export async function startWithDockerRun(
  options: StartOptions & { character?: string[] }
): Promise<void> {
  const dockerUtils = new DockerUtilities();

  try {
    await dockerUtils.checkDockerAvailable();

    const containerOptions: ContainerOptions = {
      port: options.port || 3000,
      configDir: options.configDir,
      characterFiles: options.character || [],
      target: 'prod', // Use production target for direct container run
    };

    await dockerUtils.startContainer(containerOptions);

  } catch (error) {
    logger.error('❌ Docker container start failed:', error);
    throw error;
  }
} 