#!/usr/bin/env bun
/**
 * Docker Test Framework for elizaOS
 * Systematic testing of Docker builds across all variants
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";

interface TestResult {
  variant: string;
  buildSuccess: boolean;
  buildTime: number;
  imageSize: string;
  startupSuccess: boolean;
  healthCheck: boolean;
  logs: string[];
  errors: string[];
}

class DockerTestFramework {
  private results: TestResult[] = [];
  
  private readonly variants = [
    { name: 'baseline', dockerfile: 'Dockerfile.baseline', tag: 'elizaos:baseline', target: 'runtime' },
    { name: 'optimized-prod', dockerfile: 'Dockerfile.optimized', tag: 'elizaos:optimized-prod', target: 'production' },
    { name: 'current-prod', dockerfile: 'Dockerfile', tag: 'elizaos:current-prod', target: 'production' }
  ];

  async testAll(): Promise<void> {
    console.log("🧪 elizaOS Docker Test Framework\n");
    
    // Check Docker daemon and try to start if needed
    if (!(await this.ensureDockerRunning())) {
      console.error("❌ Failed to start Docker daemon");
      process.exit(1);
    }

    // Test each variant
    for (const variant of this.variants) {
      await this.testVariant(variant);
    }

    // Report results
    this.reportResults();
  }

  private async isDockerRunning(): Promise<boolean> {
    try {
      await $`docker info`.quiet();
      return true;
    } catch {
      return false;
    }
  }

  private async ensureDockerRunning(): Promise<boolean> {
    if (await this.isDockerRunning()) {
      console.log("✅ Docker daemon is running\n");
      return true;
    }

    console.log("🐳 Docker daemon not running. Attempting to start...");
    
    // Detect platform and try to start Docker
    const platform = process.platform;
    
    try {
      if (platform === "darwin") {
        // macOS - try to open Docker Desktop
        console.log("  Starting Docker Desktop on macOS...");
        await $`open -a Docker`.quiet();
        
        // Wait for Docker to start (max 60 seconds)
        for (let i = 0; i < 60; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          process.stdout.write(`\r  Waiting for Docker to start... ${60 - i}s `);
          
          if (await this.isDockerRunning()) {
            console.log("\n✅ Docker Desktop started successfully!\n");
            return true;
          }
        }
      } else if (platform === "linux") {
        // Linux - try systemctl or service
        console.log("  Starting Docker service on Linux...");
        try {
          await $`sudo systemctl start docker`.quiet();
        } catch {
          // Try service command as fallback
          try {
            await $`sudo service docker start`.quiet();
          } catch {
            console.log("  ⚠️  Need sudo access to start Docker service");
          }
        }
        
        // Check if started
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (await this.isDockerRunning()) {
          console.log("✅ Docker service started successfully!\n");
          return true;
        }
      } else if (platform === "win32") {
        // Windows - try to start Docker Desktop
        console.log("  Starting Docker Desktop on Windows...");
        try {
          await $`powershell -Command "Start-Process 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'"`.quiet();
        } catch {
          console.log("  ⚠️  Could not start Docker Desktop automatically");
        }
        
        // Wait for Docker to start
        for (let i = 0; i < 60; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          process.stdout.write(`\r  Waiting for Docker to start... ${60 - i}s `);
          
          if (await this.isDockerRunning()) {
            console.log("\n✅ Docker Desktop started successfully!\n");
            return true;
          }
        }
      }
    } catch (error) {
      console.error(`\n❌ Failed to start Docker: ${error}`);
    }

    console.log("\n❌ Docker daemon is not running and could not be started automatically.");
    console.log("\n📝 Please start Docker manually:");
    if (platform === "darwin") {
      console.log("   - Open Docker Desktop from Applications");
      console.log("   - Or run: open -a Docker");
    } else if (platform === "linux") {
      console.log("   - Run: sudo systemctl start docker");
      console.log("   - Or: sudo service docker start");
    } else if (platform === "win32") {
      console.log("   - Open Docker Desktop from Start Menu");
    }
    
    return false;
  }

  private async testVariant(variant: { name: string; dockerfile: string; tag: string; target?: string }): Promise<void> {
    console.log(`\n📦 Testing ${variant.name} variant...`);
    
    const result: TestResult = {
      variant: variant.name,
      buildSuccess: false,
      buildTime: 0,
      imageSize: 'N/A',
      startupSuccess: false,
      healthCheck: false,
      logs: [],
      errors: []
    };

    // Build test
    const startTime = Date.now();
    try {
      console.log(`  Building ${variant.dockerfile}...`);
      if (variant.target) {
        await $`docker build -f docker/dockerfiles/${variant.dockerfile} --target ${variant.target} -t ${variant.tag} .`.quiet();
      } else {
        await $`docker build -f docker/dockerfiles/${variant.dockerfile} -t ${variant.tag} .`.quiet();
      }
      result.buildSuccess = true;
      result.buildTime = (Date.now() - startTime) / 1000;
      
      // Get image size
      const sizeOutput = await $`docker images ${variant.tag} --format "{{.Size}}"`.text();
      result.imageSize = sizeOutput.trim();
      
      console.log(`  ✅ Build successful (${result.buildTime.toFixed(1)}s, ${result.imageSize})`);
    } catch (error) {
      result.errors.push(`Build failed: ${error}`);
      console.log(`  ❌ Build failed`);
      this.results.push(result);
      return;
    }

    // Runtime test
    const containerName = `test-${variant.name}-${Date.now()}`;
    try {
      console.log(`  Starting container...`);
      await $`docker run -d --name ${containerName} -p 3001:3000 ${variant.tag}`.quiet();
      
      // Wait for startup
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Check if running
      const psOutput = await $`docker ps --filter name=${containerName} --format "{{.Names}}"`.text();
      if (psOutput.includes(containerName)) {
        result.startupSuccess = true;
        console.log(`  ✅ Container started`);
        
        // Get logs
        const logs = await $`docker logs ${containerName} --tail 50`.text();
        result.logs = logs.split('\n').slice(-10); // Last 10 lines
        
        // Health check
        try {
          await $`curl -f http://localhost:3001/health`.quiet();
          result.healthCheck = true;
          console.log(`  ✅ Health check passed`);
        } catch {
          console.log(`  ⚠️  Health check not available`);
        }
      } else {
        // Get logs from failed container
        try {
          const logs = await $`docker logs ${containerName} 2>&1`.text();
          result.errors.push(`Container exited. Last logs:\n${logs.split('\n').slice(-20).join('\n')}`);
        } catch {
          result.errors.push("Container failed to start - no logs available");
        }
        console.log(`  ❌ Container failed to start`);
      }
    } catch (error) {
      result.errors.push(`Runtime error: ${error}`);
      console.log(`  ❌ Runtime test failed`);
    } finally {
      // Cleanup
      try {
        await $`docker stop ${containerName}`.quiet();
        await $`docker rm ${containerName}`.quiet();
      } catch {}
    }

    this.results.push(result);
  }

  private reportResults(): void {
    console.log("\n📊 Test Results Summary\n");
    console.log("| Variant   | Build | Size    | Runtime | Health | Time   |");
    console.log("|-----------|-------|---------|---------|--------|--------|");
    
    for (const result of this.results) {
      const build = result.buildSuccess ? '✅' : '❌';
      const runtime = result.startupSuccess ? '✅' : '❌';
      const health = result.healthCheck ? '✅' : '⚠️ ';
      const time = result.buildSuccess ? `${result.buildTime.toFixed(1)}s` : 'N/A';
      
      console.log(
        `| ${result.variant.padEnd(9)} | ${build}    | ${result.imageSize.padEnd(7)} | ${runtime}      | ${health}     | ${time.padEnd(6)} |`
      );
    }

    // Detailed errors
    const failures = this.results.filter(r => r.errors.length > 0);
    if (failures.length > 0) {
      console.log("\n❌ Errors:");
      for (const failure of failures) {
        console.log(`\n${failure.variant}:`);
        failure.errors.forEach(err => console.log(`  - ${err}`));
      }
    }

    // Size comparison
    console.log("\n📏 Size Comparison:");
    const validSizes = this.results
      .filter(r => r.buildSuccess)
      .sort((a, b) => {
        const sizeA = this.parseSize(a.imageSize);
        const sizeB = this.parseSize(b.imageSize);
        return sizeA - sizeB;
      });
    
    if (validSizes.length > 0) {
      const smallest = validSizes[0];
      console.log(`  Smallest: ${smallest.variant} (${smallest.imageSize})`);
      
      for (let i = 1; i < validSizes.length; i++) {
        const size = validSizes[i];
        const ratio = (this.parseSize(size.imageSize) / this.parseSize(smallest.imageSize) * 100 - 100).toFixed(0);
        console.log(`  ${size.variant}: ${size.imageSize} (+${ratio}%)`);
      }
    }
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)([GMK]?)B?$/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'G': return value * 1024 * 1024 * 1024;
      case 'M': return value * 1024 * 1024;
      case 'K': return value * 1024;
      default: return value;
    }
  }
}

// Run if called directly
if (import.meta.main) {
  const tester = new DockerTestFramework();
  await tester.testAll();
}