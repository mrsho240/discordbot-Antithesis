// Adapter สำหรับ CurseForge (ต้องใช้ API key จาก https://console.curseforge.com/)
const API_BASE = 'https://api.curseforge.com/v1';

function headers() {
  return {
    'x-api-key': process.env.CURSEFORGE_API_KEY || '',
    Accept: 'application/json',
  };
}

export async function getProjectInfo(modId) {
  const res = await fetch(`${API_BASE}/mods/${modId}`, { headers: headers() });
  if (!res.ok) throw new Error(`ไม่พบ mod/modpack CurseForge: ${modId} (เช็คว่าใส่ CURSEFORGE_API_KEY แล้วหรือยัง)`);
  const data = await res.json();
  return data.data;
}

export async function getLatestVersion(modId) {
  const info = await getProjectInfo(modId);
  const files = info.latestFiles || [];
  if (!files.length) return null;
  files.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));
  return files[0];
}

export function getVersionId(file) {
  return file?.id ?? null;
}

export async function getChangelog(modId, fileId) {
  try {
    const res = await fetch(`${API_BASE}/mods/${modId}/files/${fileId}/changelog`, { headers: headers() });
    if (!res.ok) return 'No changelog available';
    const data = await res.json();
    let text = data.data || 'No changelog provided';
    // CurseForge stores changelog as HTML - strip tags
    text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > 1400) text = text.slice(0, 1400) + '...';
    return text || 'No changelog provided';
  } catch {
    return 'No changelog available';
  }
}

export async function formatVersionMessage(file, projectInfo) {
  const changelog = await getChangelog(projectInfo.id, file.id);
  
  // Extract download URL from file
  const downloadUrl = file.downloadUrl;
  const downloadFileName = file.fileName;

  // Extract gallery images
  let galleryImages = [];
  if (projectInfo.screenshots && Array.isArray(projectInfo.screenshots)) {
    galleryImages = projectInfo.screenshots
      .filter(s => s.url)
      .slice(0, 3)
      .map(s => s.url);
  }

  return {
    title: `Update: ${file.displayName}`,
    url: `https://www.curseforge.com/minecraft/modpacks/${projectInfo.slug}/files/${file.id}`,
    icon: projectInfo.logo?.url,
    thumbnail: projectInfo.logo?.url,
    downloadUrl,
    downloadFileName,
    galleryImages,
    changelog,
    fields: [
      { name: 'File', value: file.fileName, inline: true },
      { name: 'Game Version', value: (file.gameVersions || []).slice(0, 5).join(', ') || 'N/A', inline: true },
      { name: 'Released', value: new Date(file.fileDate).toLocaleString('en-US'), inline: true },
      { name: 'Changelog', value: changelog },
    ],
  };
}
