// Import Eliza's runtime interface - provides access to settings and configuration
import { IAgentRuntime } from "@elizaos/core";
// Import Eliza's logging system for consistent debug/error logging
import { elizaLogger } from "@elizaos/core";
// Import Zod schema validation library - ensures our config is valid
import { z } from "zod";

// Define our environment schema using Zod
// This validates all configuration at runtime
export const mattermostEnvSchema = z.object({
    // Validate Mattermost server URL - must be a valid URL format
    MATTERMOST_URL: z.string().url("Mattermost URL must be a valid URL"),

    // Bot token for authentication - required and must not be empty
    MATTERMOST_TOKEN: z.string().min(1, "Mattermost bot token is required"),

    // Optional team name - if not provided, will auto-detect
    MATTERMOST_TEAM: z.string().optional(),

    // Port for webhook server - defaults to 3070 if not provided
    // Converts string from env to number
    MATTERMOST_PORT: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val) : 3070)),
});

// Generate TypeScript type from our Zod schema
export type MattermostConfig = z.infer<typeof mattermostEnvSchema>;

// Validate configuration against our schema
// Takes Eliza runtime, returns validated config or throws error
export async function validateMattermostConfig(
    runtime: IAgentRuntime
): Promise<MattermostConfig> {
    try {
        // Log start of validation
        elizaLogger.debug(
            "Validating Mattermost configuration with runtime settings"
        );

        // Build config object - runtime settings override env vars
        const config = {
            MATTERMOST_URL:
                runtime.getSetting("MATTERMOST_URL") || process.env.MATTERMOST_URL,
            MATTERMOST_TOKEN:
                runtime.getSetting("MATTERMOST_TOKEN") ||
                process.env.MATTERMOST_TOKEN,
            MATTERMOST_TEAM:
                runtime.getSetting("MATTERMOST_TEAM") ||
                process.env.MATTERMOST_TEAM,
            MATTERMOST_PORT:
                runtime.getSetting("MATTERMOST_PORT") ||
                process.env.MATTERMOST_PORT,
        };

        // Validate against schema
        elizaLogger.debug("Parsing configuration with schema", config);
        const validated = mattermostEnvSchema.parse(config);
        elizaLogger.debug("Configuration validated successfully");
        return validated;

    } catch (error) {
        // Handle Zod validation errors with detailed messages
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join("\n");

            elizaLogger.error(
                "Configuration validation failed:",
                errorMessages
            );
            throw new Error(
                `Mattermost configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
