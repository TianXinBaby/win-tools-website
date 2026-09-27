-- Phase 11.11.2 catalog data for an existing win_tools database.
-- Run after sql/init.sql with win_tools selected (USE win_tools).
-- Re-running preserves existing rows, including disabled entries.
-- This script changes no table structure and inserts no demonstration content.

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
