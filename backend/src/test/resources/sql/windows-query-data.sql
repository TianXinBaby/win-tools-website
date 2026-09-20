-- Synthetic query fixtures, not release metadata or ISO checksums.
-- Insert out of ID order so all three sort keys must be respected.
INSERT INTO windows_version
    (id, name, version, edition, architecture, release_date, description,
     official_download_url, sha256, image_url, status, sort_order)
VALUES
    (104, 'Tie later ID', 'test', 'Test edition', 'x64', '2024-01-01', 'Tie fixture',
     NULL, NULL, NULL, 1, 10),
    (101, 'Higher sort order', 'test', NULL, NULL, '2025-01-01', NULL,
     NULL, NULL, NULL, 1, 20),
    (105, 'Disabled private resource', 'private', NULL, NULL, '2030-01-01', 'Private description',
     NULL, NULL, NULL, 0, 0),
    (102, 'Older release', 'test', NULL, NULL, '2023-01-01', NULL,
     NULL, NULL, NULL, 1, 10),
    (103, 'Windows query test', 'test-version', 'Test edition', 'x64', '2024-01-01', 'Public description',
     'https://www.microsoft.com/software-download/windows11', REPEAT('a', 64), '/images/test.png', 1, 10),
    (106, 'Unknown status private resource', 'private', NULL, NULL, '2030-01-01', NULL,
     NULL, NULL, NULL, 2, 0),
    (107, 'Unknown release date', 'test', NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 1, 10),
    (108, 'Lower sort order', 'test', NULL, NULL, '2020-01-01', NULL,
     NULL, NULL, NULL, 1, 5);
