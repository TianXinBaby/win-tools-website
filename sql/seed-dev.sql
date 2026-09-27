-- Local development examples only. Run sql/init.sql first and select win_tools.
-- Run sequentially in a single local session; not a concurrent seed/migration job.
-- Existing matching rows (including disabled tools and draft articles) are preserved, never updated.
-- Versions below are examples, not a claim about the current Microsoft download.
-- Unknown release dates/checksums stay NULL; the official page may offer another version.
-- Read the target directly in INSERT ... SELECT, not inside a target-table subquery.
-- Aggregate existence checks emit one row only when no matching row exists.

INSERT INTO windows_version
    (name, version, edition, architecture, release_date, description,
     official_download_url, sha256, image_url, status, sort_order)
SELECT 'Windows 11', '24H2', 'Windows 11', 'x64', NULL,
       '本地开发示例；实际可下载版本与系统要求请以 Microsoft 官方页面为准。',
       'https://www.microsoft.com/software-download/windows11', NULL, NULL, 1, 10
FROM windows_version
WHERE name = 'Windows 11' AND version = '24H2'
  AND edition = 'Windows 11' AND architecture = 'x64'
HAVING COUNT(*) = 0;

INSERT INTO windows_version
    (name, version, edition, architecture, release_date, description,
     official_download_url, sha256, image_url, status, sort_order)
SELECT 'Windows 10', '22H2', 'Windows 10', 'x64', NULL,
       '本地开发示例；实际可下载版本与支持状态请以 Microsoft 官方页面为准。',
       'https://www.microsoft.com/software-download/windows10', NULL, NULL, 1, 20
FROM windows_version
WHERE name = 'Windows 10' AND version = '22H2'
  AND edition = 'Windows 10' AND architecture = 'x64'
HAVING COUNT(*) = 0;

-- Catalog metadata only; browser-local implementations live in frontend.
INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT 'JSON 格式化', 'json', 'JSON 格式化工具目录示例；当前阶段未实现工具功能。',
       'developer', '/tools/json', 1, 10
FROM tool WHERE slug = 'json' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT 'UUID 生成', 'uuid', 'UUID 生成工具目录示例；当前阶段未实现工具功能。',
       'developer', '/tools/uuid', 1, 20
FROM tool WHERE slug = 'uuid' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '时间戳转换', 'timestamp', '时间戳转换工具目录示例；当前阶段未实现工具功能。',
       'developer', '/tools/timestamp', 1, 30
FROM tool WHERE slug = 'timestamp' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT 'SHA256', 'sha256', 'SHA256 工具目录示例；当前阶段未实现工具功能。',
       'developer', '/tools/sha256', 1, 40
FROM tool WHERE slug = 'sha256' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT 'Base64', 'base64', 'Base64 工具目录示例；当前阶段未实现工具功能。',
       'developer', '/tools/base64', 1, 50
FROM tool WHERE slug = 'base64' HAVING COUNT(*) = 0;

-- Short original examples for local API development, not complete technical tutorials.
-- Phase 7: browser-local media tools; catalog metadata only, no uploaded content.
INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '二维码生成', 'qrcode', '浏览器本地编码文本或 URL，生成并下载 PNG 二维码。',
       'media', '/tools/qrcode', 1, 60
FROM tool WHERE slug = 'qrcode' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '图片压缩', 'image-compress', '本地调整 JPEG / WebP 质量或重新编码 PNG，不保证体积减小。',
       'media', '/tools/image-compress', 1, 70
FROM tool WHERE slug = 'image-compress' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '图片尺寸调整', 'image-resize', '本地调整图片宽高，默认保持原图比例与格式。',
       'media', '/tools/image-resize', 1, 80
FROM tool WHERE slug = 'image-resize' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '图片格式转换', 'image-convert', '本地转换静态 JPEG、PNG、WebP；JPEG 透明区域填充白色。',
       'media', '/tools/image-convert', 1, 90
FROM tool WHERE slug = 'image-convert' HAVING COUNT(*) = 0;

-- Phase 11.11.2: browser-local fun tools. Also available separately in phase-11.11.2-fun-tools.sql.
INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '随机昵称生成器', 'nickname-generator', '随机生成游戏昵称、个性昵称。',
       'fun', '/tools/nickname-generator', 1, 100
FROM tool WHERE slug = 'nickname-generator' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT 'ASCII艺术生成器', 'ascii-art', '将文字转换为字符艺术。',
       'fun', '/tools/ascii-art', 1, 110
FROM tool WHERE slug = 'ascii-art' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '幸运转盘', 'lucky-wheel', '自定义选项随机选择。',
       'fun', '/tools/lucky-wheel', 1, 120
FROM tool WHERE slug = 'lucky-wheel' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '反应速度测试', 'reaction-test', '测试用户反应时间。',
       'fun', '/tools/reaction-test', 1, 130
FROM tool WHERE slug = 'reaction-test' HAVING COUNT(*) = 0;

-- Phase 11.11.3: browser-local animation and typing tools. Also available separately.
INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '魔法键盘', 'magic-keyboard', '按下键盘触发粒子动画和声音效果。',
       'fun', '/tools/magic-keyboard', 1, 140
FROM tool WHERE slug = 'magic-keyboard' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '老电视模拟器', 'crt-tv', '模拟复古CRT电视显示效果。',
       'fun', '/tools/crt-tv', 1, 150
FROM tool WHERE slug = 'crt-tv' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT 'FPS测试', 'fps-test', '检测浏览器动画帧率。',
       'fun', '/tools/fps-test', 1, 160
FROM tool WHERE slug = 'fps-test' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '打字速度测试', 'typing-test', '测试输入速度和准确率。',
       'fun', '/tools/typing-test', 1, 170
FROM tool WHERE slug = 'typing-test' HAVING COUNT(*) = 0;

INSERT INTO article (title, slug, summary, content, category, status)
SELECT 'Windows 11 官方下载说明', 'windows-11-download-guide', '本地开发示例：查看官方入口。',
       '本示例用于演示文章查询。请从网站 Windows 资源详情中的 Microsoft 官方入口查看下载说明，具体版本和系统要求以官方页面为准。',
       'windows', 1
FROM article WHERE slug = 'windows-11-download-guide' HAVING COUNT(*) = 0;

INSERT INTO article (title, slug, summary, content, category, status)
SELECT 'Windows 10 官方下载说明', 'windows-10-download-guide', '本地开发示例：核对官方说明。',
       '本示例用于演示文章详情。下载前请到 Microsoft 官方页面核对可用版本、下载方式和支持说明；本项目不提供 ISO 文件托管。',
       'windows', 1
FROM article WHERE slug = 'windows-10-download-guide' HAVING COUNT(*) = 0;

INSERT INTO article (title, slug, summary, content, category, status)
SELECT '在线工具使用说明', 'online-tools-guide', '本地开发示例：认识工具目录。',
       '当前阶段只提供工具名称、描述和路径等目录元数据，工具功能与前端页面尚未实现。后续能够在浏览器本地完成的处理将优先在本地执行。',
       'tools', 1
FROM article WHERE slug = 'online-tools-guide' HAVING COUNT(*) = 0;
