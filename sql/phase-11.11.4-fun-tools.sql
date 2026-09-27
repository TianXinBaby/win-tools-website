-- Phase 11.11.4 catalog data for an existing win_tools database.
-- Run after sql/init.sql with win_tools selected (USE win_tools).
-- Re-running preserves existing rows, including disabled entries.
-- This script changes no table structure and inserts no demonstration content.

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT 'Mikutap', 'mikutap', '通过点击创造音乐和动态视觉效果。',
       'fun', '/tools/mikutap', 1, 180
FROM tool WHERE slug = 'mikutap' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '在线钢琴', 'online-piano', '使用键盘弹奏在线钢琴。',
       'fun', '/tools/online-piano', 1, 190
FROM tool WHERE slug = 'online-piano' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '随机头像生成器', 'random-avatar', '随机生成个性化头像。',
       'fun', '/tools/random-avatar', 1, 200
FROM tool WHERE slug = 'random-avatar' HAVING COUNT(*) = 0;

INSERT INTO tool (name, slug, description, category, path, status, sort_order)
SELECT '声控弹力球', 'voice-ball', '根据声音大小控制球体运动。',
       'fun', '/tools/voice-ball', 1, 210
FROM tool WHERE slug = 'voice-ball' HAVING COUNT(*) = 0;
