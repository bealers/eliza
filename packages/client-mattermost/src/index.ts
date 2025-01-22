import { Client as ElizaClient, IAgentRuntime, elizaLogger } from "@elizaos/core";
import { MattermostService } from './services/mattermost.service';

// Add debug logging
elizaLogger.debug("🔍 Mattermost client module loaded");

// Export types and service for optional use
export * from './types/mattermost-types';
export * from './services/mattermost.service';

// Only initialize if Mattermost is configured
const isMattermostConfigured = () => {
    return process.env.MATTERMOST_URL && process.env.MATTERMOST_TOKEN;
};

export const MattermostClientInterface: ElizaClient = {
    start: async (runtime: IAgentRuntime) => {
        elizaLogger.debug("🚀 Attempting to initialize Mattermost client...");

        if (!isMattermostConfigured()) {
            elizaLogger.debug("⚠️ Mattermost not configured, skipping initialization");
            return;
        }

        elizaLogger.log("🚀 Initializing Mattermost client...");
        const service = new MattermostService();
        await service.initialize(runtime);

        elizaLogger.success("✅ Mattermost client successfully started");
        return service;
    },
    stop: async () => {
        elizaLogger.warn("Mattermost client stopping...");
    }
};

// This is critical - Eliza looks for this
export default MattermostClientInterface;
