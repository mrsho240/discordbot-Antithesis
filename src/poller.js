import { db } from './db.js';
import { adapters } from './adapters/index.js';
import { EmbedBuilder } from 'discord.js';

export function startPoller(client) {
  const intervalMinutes = Number(process.env.POLL_INTERVAL_MINUTES || 10);
  setInterval(() => checkUpdates(client), intervalMinutes * 60 * 1000);
  // เช็คครั้งแรกหลังบอทออนไลน์ 15 วิ
  setTimeout(() => checkUpdates(client), 15000);
}

export async function checkUpdates(client) {
  for (const track of db.data.tracks) {
    try {
      const adapter = adapters[track.platform];
      if (!adapter) continue;

      const latest = await adapter.getLatestVersion(track.projectId);
      if (!latest) continue;

      const latestId = adapter.getVersionId(latest);
      if (latestId && latestId !== track.lastVersionId) {
        const thread = await client.channels.fetch(track.threadId).catch(() => null);

        if (thread) {
          const projectInfo = await adapter.getProjectInfo(track.projectId);
          const msg = await adapter.formatVersionMessage(latest, projectInfo);
          const embed = new EmbedBuilder()
            .setTitle(msg.title)
            .setURL(msg.url)
            .addFields(msg.fields)
            .setColor(0x57f287)
            .setTimestamp(new Date());

          // Add icon/logo if available
          if (msg.icon) embed.setThumbnail(msg.icon);
          if (msg.thumbnail) embed.setImage(msg.thumbnail);

          let content = '';
          // Add download link
          if (msg.downloadUrl && msg.downloadFileName) {
            content = `[Download: ${msg.downloadFileName}](${msg.downloadUrl})`;
          }

          // Add gallery images in separate messages if available
          const messages = [{ content: content || undefined, embeds: [embed] }];
          
          if (msg.galleryImages && msg.galleryImages.length > 0) {
            for (const imageUrl of msg.galleryImages) {
              const galleryEmbed = new EmbedBuilder()
                .setImage(imageUrl)
                .setColor(0x57f287);
              messages.push({ embeds: [galleryEmbed] });
            }
          }

          for (const msg of messages) {
            await thread.send(msg);
          }
          console.log(`[poller] posted update for ${track.platform}/${track.projectId}`);
        } else {
          console.warn(`[poller] thread ${track.threadId} not found (deleted?) skipping this track`);
        }

        track.lastVersionId = latestId;
        await db.write();
      }
    } catch (err) {
      console.error(`[poller] error checking ${track.platform}/${track.projectId}:`, err.message);
    }
  }
}
