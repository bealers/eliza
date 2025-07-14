import { logger } from '@elizaos/core';
import { DockerUtilities, type ContainerOptions } from '../../../utils/docker-utils';
import { type DevOptions } from '../types';

/**
 * Start elizaOS development mode using Docker containers with live reload
 */
export async function startDevWithDocker(options: DevOptions): Promise<void> {
  const dockerUtils = new DockerUtilities();

  try {
    // Check Docker availability first
    logger.info('🔍 Checking Docker availability...');
    await dockerUtils.checkDockerAvailable();

    // Prepare container options for development
    const containerOptions: ContainerOptions = {
      port: options.port || 3000,
      configDir: options.configDir,
      characterFiles: options.character || [],
      target: 'dev', // Always use dev target for development mode
      envVars: {
        NODE_ENV: 'development',
        ELIZA_DEV_MODE: 'true',
        // Pass through configuration flag
        ...(options.configure && { ELIZA_CONFIGURE: 'true' }),
      },
    };

    logger.info('🚀 Starting elizaOS in Docker development mode...');
    logger.info('📁 Project root: ' + process.cwd());
    logger.info('🔄 Live reload enabled - your changes will be reflected automatically');
    
    if (containerOptions.characterFiles?.length) {
      logger.info(`🎭 Character files: ${containerOptions.characterFiles.join(', ')}`);
    }

    // Start using docker-compose with development configuration
    await dockerUtils.startWithCompose(containerOptions);

  } catch (error) {
    logger.error('❌ Docker development mode failed:', error);
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('Docker is not available')) {
        logger.info('💡 To install Docker:');
        logger.info('   • Visit: https://docs.docker.com/get-docker/');
        logger.info('   • For macOS: brew install --cask docker');
        logger.info('   • For Ubuntu: sudo apt install docker.io');
        logger.info('   • For Windows: Download Docker Desktop');
      } else if (error.message.includes('Docker compose file not found')) {
        logger.info('💡 The Docker development infrastructure may not be set up correctly.');
        logger.info('   • Ensure you are in the correct project directory');
        logger.info('   • Check that docker/targets/dev/ directory exists');
      }
    }
    
    // Graceful fallback suggestion
    logger.info('💡 Try running without --docker flag for direct development mode:');
    const fallbackCmd = [
      'elizaos dev',
      options.character?.length ? `--character ${options.character.join(' ')}` : '',
      options.port ? `--port ${options.port}` : '',
      options.configure ? '--configure' : ''
    ].filter(Boolean).join(' ');
    
    logger.info(`   ${fallbackCmd}`);
    
    throw error;
  }
} 