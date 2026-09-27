-- Phase 11.11.3 catalog data for an existing win_tools database.
-- Run after sql/init.sql with win_tools selected (USE win_tools).
-- Re-running preserves existing rows, including disabled entries.
-- This script changes no table structure and inserts no demonstration content.

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
