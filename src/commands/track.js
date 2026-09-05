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
    await interaction.reply({ content: `✅ สร้าง forum channel แล้ว: ${forum}`, ephemeral: true });
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
    if (!adapter) return interaction.editReply('❌ ไม่รองรับแพลตฟอร์มนี้');

    let projectInfo, latest;
    try {
      projectInfo = await adapter.getProjectInfo(projectId);
      latest = await adapter.getLatestVersion(projectId);
    } catch (err) {
      return interaction.editReply(`❌ ดึงข้อมูลไม่สำเร็จ: ${err.message}`);
    }

    const name = customTitle || projectInfo.title || projectInfo.name || projectId;
    const rawDesc = customDesc || projectInfo.description || projectInfo.summary || 'ไม่มีคำอธิบาย';
    const desc = rawDesc.length > 3500 ? rawDesc.slice(0, 3500) + '...' : rawDesc;

    const embed = new EmbedBuilder()
      .setTitle(name)
      .setDescription(desc)
      .addFields(
        { name: 'แพลตฟอร์ม', value: platform, inline: true },
        { name: 'Project ID', value: String(projectId), inline: true }
      )
      .setColor(0x5865f2);

    // เพิ่ม logo/icon ถ้ามี
    if (platform === 'modrinth' && projectInfo.icon_url) {
      embed.setThumbnail(projectInfo.icon_url);
    } else if (platform === 'curseforge' && projectInfo.logo?.url) {
      embed.setThumbnail(projectInfo.logo.url);
    }

    // เพิ่มลิงค์ไปเว็บโปรเจกต์ด้านล่าง
    if (platform === 'modrinth') {
      embed.setURL(`https://modrinth.com/${projectInfo.project_type || 'modpack'}/${projectInfo.slug}`);
    } else if (platform === 'curseforge') {
      embed.setURL(`https://www.curseforge.com/minecraft/modpacks/${projectInfo.slug}`);
    }

    if (latest) {
      embed.addFields({
        name: 'เวอร์ชันล่าสุดตอนนี้',
        value: latest.version_number || latest.displayName || 'N/A',
      });
    }

    let thread;
    try {
      thread = await forum.threads.create({ name: name.slice(0, 90), message: { embeds: [embed] } });
    } catch (err) {
      return interaction.editReply(`❌ สร้างโพสต์ใน forum ไม่สำเร็จ: ${err.message} (เช็คสิทธิ์บอทในแชนแนลนี้)`);
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

    await interaction.editReply(`✅ สร้างโพสต์และเริ่มติดตามแล้ว: ${thread}`);
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
    await interaction.reply({ content: removed ? '✅ หยุดติดตามแล้ว' : '❌ ไม่พบรายการนี้', ephemeral: true });
    return;
  }

  if (sub === 'list') {
    const tracks = db.data.tracks.filter(t => t.guildId === interaction.guildId);
    if (!tracks.length) {
      await interaction.reply({ content: 'ยังไม่มีการติดตามในเซิร์ฟเวอร์นี้', ephemeral: true });
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
    await interaction.editReply('✅ เช็คอัปเดตทั้งหมดเรียบร้อย ถ้ามีอัปเดตใหม่จะโพสต์ในเธรดที่เกี่ยวข้องแล้ว');
    return;
  }

  if (sub === 'info') {
    await interaction.deferReply({ ephemeral: false });
    const projectId = interaction.options.getString('project_id');
    
    const track = db.data.tracks.find(t => t.guildId === interaction.guildId && t.projectId === projectId);
    if (!track) {
      return interaction.editReply('❌ ไม่พบการติดตามโปรเจกต์นี้ในเซิร์ฟเวอร์');
    }

    const adapter = adapters[track.platform];
    if (!adapter) {
      return interaction.editReply('❌ ไม่รองรับแพลตฟอร์มนี้');
    }

    let projectInfo, latest;
    try {
      projectInfo = await adapter.getProjectInfo(track.projectId);
      latest = await adapter.getLatestVersion(track.projectId);
    } catch (err) {
      return interaction.editReply(`❌ ดึงข้อมูลไม่สำเร็จ: ${err.message}`);
    }

    const rawDesc = projectInfo.description || projectInfo.summary || 'ไม่มีคำอธิบาย';
    const desc = rawDesc.length > 2000 ? rawDesc.slice(0, 2000) + '...' : rawDesc;

    const embed = new EmbedBuilder()
      .setTitle(track.name)
      .setDescription(desc)
      .setColor(0x5865f2)
      .addFields(
        { name: 'แพลตฟอร์ม', value: track.platform, inline: true },
        { name: 'Project ID', value: track.projectId, inline: true },
        { name: 'โพสต์ใน', value: `<#${track.threadId}>`, inline: true }
      );

    // เพิ่ม logo
    if (track.platform === 'modrinth' && projectInfo.icon_url) {
      embed.setThumbnail(projectInfo.icon_url);
    } else if (track.platform === 'curseforge' && projectInfo.logo?.url) {
      embed.setThumbnail(projectInfo.logo.url);
    }

    // เพิ่มเวอร์ชันล่าสุด
    if (latest) {
      embed.addFields({
        name: 'เวอร์ชันปัจจุบัน',
        value: latest.version_number || latest.displayName || 'N/A',
        inline: true,
      });
    }

    // ลิงค์ไปเว็บ
    if (track.platform === 'modrinth') {
      embed.setURL(`https://modrinth.com/${projectInfo.project_type || 'modpack'}/${projectInfo.slug}`);
    } else if (track.platform === 'curseforge') {
      embed.setURL(`https://www.curseforge.com/minecraft/modpacks/${projectInfo.slug}`);
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }
}
