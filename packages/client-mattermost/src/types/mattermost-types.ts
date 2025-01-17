import { Client4 as Client } from "@mattermost/client";

// Configuration for Mattermost client
export interface MattermostConfig {
    url: string;      // Mattermost server URL
    token: string;    // Bot access token
    team?: string;    // Optional team name
}

// Service interface
export interface IMattermostService {
    client: Client;
    initialize(runtime: any): Promise<void>;
    sendMessage(channelId: string, message: string): Promise<any>;
    sendDirectMessage(userId: string, message: string): Promise<any>;
}

// Service type identifier
export const MATTERMOST_SERVICE_TYPE = "mattermost";
