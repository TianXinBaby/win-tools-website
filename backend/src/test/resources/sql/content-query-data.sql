-- Synthetic fixtures inserted out of ID order to exercise both sort keys.
INSERT INTO tool (id, name, slug, icon, description, category, path, status, sort_order)
VALUES
    (203, 'Tie later ID', 'tie-tool', NULL, NULL, NULL, '/tools/tie-tool', 1, 10),
    (201, 'Higher sort order', 'last-tool', NULL, NULL, NULL, '/tools/last-tool', 1, 20),
    (204, 'Private tool', 'disabled-tool', NULL, 'Private description', NULL, '/tools/private', 0, 0),
    (202, 'JSON test', 'json-test', 'code', 'Public description', 'developer', '/tools/json-test', 1, 10),
    (205, 'Private unknown status', 'unknown-status', NULL, NULL, NULL, '/tools/private', 2, 0),
    (206, 'Lower sort order', 'first-tool', NULL, NULL, NULL, '/tools/first-tool', 1, 5);

INSERT INTO article
    (id, title, slug, summary, content, cover_image, category, status, view_count, created_at, updated_at)
VALUES
    (303, 'Tie earlier ID', 'tie-article', NULL, 'Tie body', NULL, NULL, 1, 0,
     '2024-06-01 12:00:00', '2024-06-01 12:00:00'),
    (301, 'Newest article', 'newest-article', NULL, NULL, NULL, NULL, 1, 0,
     '2025-01-01 12:00:00', '2025-01-01 12:00:00'),
    (305, 'Private draft', 'draft-article', 'Private summary', 'Private content', NULL, NULL, 0, 0,
     '2030-01-01 12:00:00', '2030-01-01 12:00:00'),
    (302, 'Oldest article', 'oldest-article', NULL, 'Old body', NULL, NULL, 1, 0,
     '2023-01-01 12:00:00', '2023-01-01 12:00:00'),
    (304, 'Article query test', 'query-article', 'Public summary', 'Public body', '/images/article.png',
     'tutorial', 1, 4294967295, '2024-06-01 12:00:00', '2024-06-02 13:00:00'),
    (306, 'Private unknown status', 'unknown-article', NULL, 'Private content', NULL, NULL, 2, 0,
     '2030-01-01 12:00:00', '2030-01-01 12:00:00');
