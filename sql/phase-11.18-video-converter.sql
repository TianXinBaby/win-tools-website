-- Select win_tools first. Repeatable insert; preserve all existing metadata and disabled rows.
-- No schema change, no demo data, no FFmpeg binaries or video content in the database.
INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '视频格式转换器', 'video-converter', '上传至本站服务器，转换 ASF 等视频为 MP4 等格式。',
       'media', '/tools/video-converter', 1, 95
FROM tool WHERE slug = 'video-converter' HAVING COUNT(*) = 0;
