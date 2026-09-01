import { LinkedInVoyagerClient } from "./voyager-client";

export async function sendConnectionRequest(
  client: LinkedInVoyagerClient,
  profileUrn: string,
  message?: string
): Promise<{ success: boolean }> {
  const body = {
    invitee: {
      inviteeUnion: {
        memberProfile: profileUrn.startsWith("urn:")
          ? profileUrn
          : `urn:li:fsd_profile:${profileUrn}`,
      },
    },
    ...(message
      ? {
          customMessage: message.slice(0, 300),
        }
      : {}),
  };

  await client.post("/voyagerRelationshipsDashMemberRelationships", {
    action: "verifyQuotaAndCreateV2",
    ...body,
  });

  return { success: true };
}

export async function sendMessage(
  client: LinkedInVoyagerClient,
  recipientUrn: string,
  message: string
): Promise<{ success: boolean }> {
  const createBody = {
    keyVersion: "LEGACY_INBOX",
    conversationCreate: {
      eventCreate: {
        value: {
          "com.linkedin.voyager.messaging.create.MessageCreate": {
            body: message,
            attachments: [],
            attributedBody: { text: message, attributes: [] },
          },
        },
      },
      recipients: [recipientUrn],
      subtype: "MEMBER_TO_MEMBER",
    },
  };

  await client.post(
    `/messaging/conversations?action=create`,
    createBody
  );

  return { success: true };
}

export async function sendConnectionOrMessage(
  client: LinkedInVoyagerClient,
  profileUrn: string,
  message: string
): Promise<{ method: "connection" | "message"; success: boolean }> {
  try {
    await sendConnectionRequest(client, profileUrn, message);
    return { method: "connection", success: true };
  } catch {
    try {
      await sendMessage(client, profileUrn, message);
      return { method: "message", success: true };
    } catch (err) {
      throw new Error(
        `Failed to send LinkedIn outreach: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }
}
