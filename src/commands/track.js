import { SlashCommandBuilder, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../db.js';
import { adapters, platformChoices } from '../adapters/index.js';

export const data = new SlashCommandBuilder()
  .setName('track')
  .setDescription('จัดการการติดตามอัปเดตของเกม/ม็อดแพ็ค')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(sub =>
    sub
      .setName('add')
      .setDescription('เพิ่มการติดตามใหม่ และสร้างโพสต์ใน forum')
      .addStringOption(opt =>
        opt.setName('platform').setDescription('แพลตฟอร์ม').setRequired(true).addChoices(...platformChoices)
      )
      .addStringOption(opt =>
        opt.setName('project_id').setDescription('slug (Modrinth) หรือ mod id (CurseForge)').setRequired(true)
      )
      .addChannelOption(opt =>
        opt
          .setName('forum')
          .setDescription('Forum channel ที่จะสร้างโพสต์')
          .addChannelTypes(ChannelType.GuildForum)
          .setRequired(true)
      )
      .addStringOption(opt => opt.setName('title').setDescription('ชื่อโพสต์เอง (ไม่ใส่ = ใช้ชื่อจาก API)'))
      .addStringOption(opt => opt.setName('description').setDescription('คำอธิบายเองที่จะใส่ในโพสต์'))
  )
  .addSubcommand(sub =>
    sub
      .setName('remove')
      .setDescription('หยุดติดตาม (ไม่ลบโพสต์ forum ที่สร้างไปแล้ว)')
      .addStringOption(opt => opt.setName('project_id').setDescription('project id ที่ติดตามอยู่').setRequired(true))
  )
  .addSubcommand(sub => sub.setName('list').setDescription('แสดงรายการที่ติดตามอยู่ในเซิร์ฟเวอร์นี้'))
  .addSubcommand(sub =>
    sub
      .setName('create-forum')
      .setDescription('สร้าง Forum channel ใหม่ไว้เก็บโพสต์ติดตาม')
      .addStringOption(opt => opt.setName('name').setDescription('ชื่อ forum channel').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('check-now').setDescription('สั่งเช็คอัปเดตทั้งหมดทันที (ไม่ต้องรอรอบถัดไป)')
  )
  .addSubcommand(sub =>
    sub
      .setName('info')
      .setDescription('ดูรายละเอียดโปรเจกต์ที่ติดตาม (logo, description, ลิงค์ดาวน์โหลด)')
      .addStringOption(opt =>
        opt.setName('project_id').setDescription('project id ที่ติดตามอยู่').setRequired(true)
      )
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'create-forum') {
    const name = interaction.options.getString('name');
    const forum = await interaction.guild.channels.create({ name, type: ChannelType.GuildForum });
    await interaction.reply({ content: `Forum channel created: ${forum}`, ephemeral: true });
    return;
  }

  if (sub === 'add') {
    await interaction.deferReply({ ephemeral: true });
    const platform = interaction.options.getString('platform');
    const projectId = interaction.options.getString('project_id');
    const forum = interaction.options.getChannel('forum');
    const customTitle = interaction.options.getString('title');
    const customDesc = interaction.options.getString('description');

    const adapter = adapters[platform];
    if (!adapter) return interaction.editReply('Platform not supported');

    let projectInfo, latest;
    try {
      projectInfo = await adapter.getProjectInfo(projectId);
      latest = await adapter.getLatestVersion(projectId);
    } catch (err) {
      return interaction.editReply(`Failed to fetch project info: ${err.message}`);
    }

    const name = customTitle || projectInfo.title || projectInfo.name || projectId;
    const rawDesc = customDesc || projectInfo.description || projectInfo.summary || 'ไม่มีคำอธิบาย';
    const desc = rawDesc.length > 3500 ? rawDesc.slice(0, 3500) + '...' : rawDesc;

    const embed = new EmbedBuilder()
      .setTitle(name)
      .setDescription(desc)
      .addFields(
        { name: 'Platform', value: platform, inline: true },
        { name: 'Project ID', value: String(projectId), inline: true }
      )
      .setColor(0x5865f2);

    // Add logo/icon if available
    if (platform === 'modrinth' && projectInfo.icon_url) {
      embed.setThumbnail(projectInfo.icon_url);
    } else if (platform === 'curseforge' && projectInfo.logo?.url) {
      embed.setThumbnail(projectInfo.logo.url);
    }

    // Add link to project page
    if (platform === 'modrinth') {
      embed.setURL(`https://modrinth.com/${projectInfo.project_type || 'modpack'}/${projectInfo.slug}`);
    } else if (platform === 'curseforge') {
      embed.setURL(`https://www.curseforge.com/minecraft/modpacks/${projectInfo.slug}`);
    }

    if (latest) {
      embed.addFields({
        name: 'Current Version',
        value: latest.version_number || latest.displayName || 'N/A',
      });
    }

    let thread;
    try {
      thread = await forum.threads.create({ name: name.slice(0, 90), message: { embeds: [embed] } });
    } catch (err) {
      return interaction.editReply(`Error creating forum post: ${err.message} (Check bot permissions in this channel)`);
    }

    db.data.tracks.push({
      guildId: interaction.guildId,
      forumId: forum.id,
      threadId: thread.id,
      platform,
      projectId,
      lastVersionId: latest ? adapter.getVersionId(latest) : null,
      name,
    });
    await db.write();

    await interaction.editReply(`Successfully created tracking post: ${thread}`);
    return;
  }

  if (sub === 'remove') {
    const projectId = interaction.options.getString('project_id');
    const before = db.data.tracks.length;
    db.data.tracks = db.data.tracks.filter(
      t => !(t.guildId === interaction.guildId && t.projectId === projectId)
    );
    await db.write();
    const removed = before !== db.data.tracks.length;
    await interaction.reply({ content: removed ? 'Tracking stopped' : 'Project not found', ephemeral: true });
    return;
  }

  if (sub === 'list') {
    const tracks = db.data.tracks.filter(t => t.guildId === interaction.guildId);
    if (!tracks.length) {
      await interaction.reply({ content: 'No tracked projects in this server', ephemeral: true });
      return;
    }
    const lines = tracks.map(t => `• **${t.name}** (${t.platform} / ${t.projectId}) → <#${t.threadId}>`);
    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    return;
  }

  if (sub === 'check-now') {
    await interaction.deferReply({ ephemeral: true });
    const { checkUpdates } = await import('../poller.js');
    await checkUpdates(interaction.client);
    await interaction.editReply('Update check completed. New updates posted to relevant threads.');
    return;
  }

  if (sub === 'info') {
    await interaction.deferReply({ ephemeral: false });
    const projectId = interaction.options.getString('project_id');
    
    const track = db.data.tracks.find(t => t.guildId === interaction.guildId && t.projectId === projectId);
    if (!track) {
      return interaction.editReply('Project not found in this server');
    }

    const adapter = adapters[track.platform];
    if (!adapter) {
      return interaction.editReply('Platform not supported');
    }

    let projectInfo, latest;
    try {
      projectInfo = await adapter.getProjectInfo(track.projectId);
      latest = await adapter.getLatestVersion(track.projectId);
    } catch (err) {
      return interaction.editReply(`Failed to fetch project info: ${err.message}`);
    }

    const rawDesc = projectInfo.description || projectInfo.summary || 'No description available';
    const desc = rawDesc.length > 2000 ? rawDesc.slice(0, 2000) + '...' : rawDesc;

    const embed = new EmbedBuilder()
      .setTitle(track.name)
      .setDescription(desc)
      .setColor(0x5865f2)
      .addFields(
        { name: 'Platform', value: track.platform, inline: true },
        { name: 'Project ID', value: track.projectId, inline: true },
        { name: 'Thread', value: `<#${track.threadId}>`, inline: true }
      );

    // Add logo
    if (track.platform === 'modrinth' && projectInfo.icon_url) {
      embed.setThumbnail(projectInfo.icon_url);
    } else if (track.platform === 'curseforge' && projectInfo.logo?.url) {
      embed.setThumbnail(projectInfo.logo.url);
    }

    // Add current version
    if (latest) {
      embed.addFields({
        name: 'Current Version',
        value: latest.version_number || latest.displayName || 'N/A',
        inline: true,
      });
    }

    // Add project link
    if (track.platform === 'modrinth') {
      embed.setURL(`https://modrinth.com/${projectInfo.project_type || 'modpack'}/${projectInfo.slug}`);
    } else if (track.platform === 'curseforge') {
      embed.setURL(`https://www.curseforge.com/minecraft/modpacks/${projectInfo.slug}`);
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }
}
