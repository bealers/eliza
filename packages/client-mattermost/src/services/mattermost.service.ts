import { Service, IAgentRuntime, ServiceType, elizaLogger } from "@elizaos/core";
import { Client4 as Client, WebSocketClient } from "@mattermost/client";
import { IMattermostService } from "../types/mattermost-types";

/**
 * MattermostService provides integration with Mattermost chat platform.
 * It handles real-time messaging, direct messages, and channel communication.
 */
export class MattermostService extends Service implements IMattermostService {
    // The main Mattermost client instance
    public client!: Client;
    // WebSocket client for real-time events
    private wsClient!: WebSocketClient;

    static get serviceType(): ServiceType {
        return 'mattermost' as ServiceType;
    }

    get serviceType(): ServiceType {
        return 'mattermost' as ServiceType;
    }

    /**
     * Initializes the Mattermost service with the provided runtime configuration.
     * Sets up both REST client and WebSocket connections.
     */
    async initialize(runtime: IAgentRuntime): Promise<void> {
        const url = runtime.getSetting("MATTERMOST_URL");
        const token = runtime.getSetting("MATTERMOST_TOKEN");

        if (!url || !token) {
            throw new Error("MATTERMOST_URL and MATTERMOST_TOKEN are required");
        }

        // Initialize REST client
        this.client = new Client();
        this.client.setUrl(url);
        this.client.setToken(token);

        // Initialize WebSocket for real-time events
        this.wsClient = new WebSocketClient();
        await this.wsClient.initialize(url.replace(/^http/, 'ws'), token);

        // Set up real-time message handling
        this.wsClient.addMessageListener(async (event) => {
            if (event.event === 'posted') {
                const post = JSON.parse(event.data.post);
                // We need to handle the message here
                elizaLogger.debug(`📨 Received message: ${post.message}`);
                // TODO: Process message through Eliza
            }
        });

        // Test connection
        try {
            const me = await this.client.getMe();
            elizaLogger.success(`🤖 Connected as @${me.username}`);
        } catch (error) {
            elizaLogger.error('Failed to connect to Mattermost:', error);
            throw error;
        }
    }

    /**
     * Sends a message to a specific channel
     * @param channelId - The ID of the target channel
     * @param message - The message text to send
     */
    async sendMessage(channelId: string, message: string): Promise<any> {
        return await this.client.createPost({
            channel_id: channelId,
            message,
            create_at: 0,  // Server will set this
            user_id: '',   // Server will set this
            type: ''       // Default post type
        } as any);  // Type assertion needed due to Mattermost client types
    }

    /**
     * Sends a direct message to a specific user
     * @param userId - The ID of the target user
     * @param message - The message text to send
     */
    async sendDirectMessage(userId: string, message: string): Promise<any> {
        const channel = await this.client.createDirectChannel([this.client.userId, userId]);
        return await this.sendMessage(channel.id, message);
    }
}
