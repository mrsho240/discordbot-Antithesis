// Adapter สำหรับ Modrinth (ไม่ต้องใช้ API key)
const API_BASE = 'https://api.modrinth.com/v2';
const HEADERS = { 'User-Agent': 'modtrack-bot/1.0 (discord bot)' };

export async function getProjectInfo(projectId) {
  const res = await fetch(`${API_BASE}/project/${projectId}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`ไม่พบโปรเจกต์ Modrinth: ${projectId}`);
  return res.json();
}

export async function getLatestVersion(projectId) {
  const res = await fetch(`${API_BASE}/project/${projectId}/version`, { headers: HEADERS });
  if (!res.ok) throw new Error(`ดึงเวอร์ชัน Modrinth ไม่สำเร็จ: ${projectId}`);
  const versions = await res.json();
  return versions[0] || null; // Modrinth คืนค่าล่าสุดมาก่อนเสมอ
}

export function getVersionId(version) {
  return version?.id ?? null;
}

export function formatVersionMessage(version, projectInfo) {
  const gameVersions = (version.game_versions || []).join(', ') || 'N/A';
  const loaders = (version.loaders || []).join(', ') || 'N/A';
  let changelog = version.changelog || 'ไม่มี changelog';
  if (changelog.length > 1400) changelog = changelog.slice(0, 1400) + '...';

  // ค้นหาลิงก์ดาวน์โหลดจาก files
  let downloadUrl = null;
  let fileName = null;
  if (version.files && version.files.length > 0) {
    const primary = version.files.find(f => f.primary);
    const file = primary || version.files[0];
    downloadUrl = file.url;
    fileName = file.filename;
  }

  return {
    title: `🔄 อัปเดตใหม่: ${version.name || version.version_number}`,
    url: `https://modrinth.com/${projectInfo.project_type || 'project'}/${projectInfo.slug}/version/${version.id}`,
    icon: projectInfo.icon_url,
    thumbnail: projectInfo.icon_url,
    downloadUrl,
    downloadFileName: fileName,
    fields: [
      { name: 'เวอร์ชัน', value: version.version_number || 'N/A', inline: true },
      { name: 'Game Version', value: gameVersions, inline: true },
      { name: 'Loader', value: loaders, inline: true },
      { name: 'Changelog', value: changelog },
    ],
  };
}
